import {
  ErrorLogSeverity,
  ErrorLogType,
  Prisma,
  SecurityBlockSource,
  SecurityBlockStatus,
  SecurityMitigationAction,
  type SecurityBlock,
} from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { redis } from "../../config/redis.js";
import { computeRiskScore, normalizeConfidence, type Confidence } from "./risk-scoring.js";
import { errorLogger } from "./system-logs.service.js";

const CONFIG_KEY = "security_response_config";

const BLOCK_KEY_PREFIX = "sec:block:";
const BLOCK_COUNT_KEY_PREFIX = "sec:blockcount:";
const MALICIOUS_KEY_PREFIX = "sec:malicious:";
const PATHS_KEY_PREFIX = "sec:malpaths:";
const CATS_KEY_PREFIX = "sec:malcats:";

// Sensitive-file / traversal probes are always blocked per-request (404), but
// only escalate to an IP block after this many probes in the scoring window.
const SENSITIVE_PROBE_BLOCK_AFTER = 3;

export interface SecurityResponseConfig {
  enabled: boolean;
  rateLimitThreshold: number;
  blockThreshold: number;
  scoringWindowSeconds: number;
  blockDurations: {
    first: number;
    second: number;
    third: number;
    repeat: number;
    critical: number;
  };
}

const DEFAULT_CONFIG: SecurityResponseConfig = {
  enabled: true,
  rateLimitThreshold: 35,
  blockThreshold: 60,
  scoringWindowSeconds: 300,
  blockDurations: {
    first: 300,
    second: 1800,
    third: 7200,
    repeat: 86400,
    critical: 7200,
  },
};

export type MitigationDecision = "ALLOW" | "OBSERVE" | "RATE_LIMIT" | "TEMP_BLOCK";

export interface DetectionLike {
  attackType: string;
  confidence: string;
  severity: ErrorLogSeverity;
  source: string;
}

export interface MitigationContext {
  ip: string;
  ipVersion: string;
  path: string;
  method: string;
  userAgent: string | null;
  requestId: string | null;
}

export interface MitigationResult {
  decision: MitigationDecision;
  riskScore: number;
  reason: string;
  blockId?: string;
  durationSeconds?: number;
}

interface RedisBlockRecord {
  blockId: string;
  expiresAt: number;
  status: string;
}

// Per-process fallback cache used only when Redis is unavailable. Redis remains
// the source of truth for multi-instance deployments.
const memoryBlocks = new Map<string, RedisBlockRecord>();

export class SecurityResponseService {
  public async getConfig(): Promise<SecurityResponseConfig> {
    const setting = await prisma.setting.findUnique({ where: { key: CONFIG_KEY } });
    const stored = (setting?.value ?? {}) as Partial<SecurityResponseConfig>;

    return {
      enabled: typeof stored.enabled === "boolean" ? stored.enabled : DEFAULT_CONFIG.enabled,
      rateLimitThreshold:
        typeof stored.rateLimitThreshold === "number" ? stored.rateLimitThreshold : DEFAULT_CONFIG.rateLimitThreshold,
      blockThreshold: typeof stored.blockThreshold === "number" ? stored.blockThreshold : DEFAULT_CONFIG.blockThreshold,
      scoringWindowSeconds:
        typeof stored.scoringWindowSeconds === "number"
          ? stored.scoringWindowSeconds
          : DEFAULT_CONFIG.scoringWindowSeconds,
      blockDurations: {
        first: stored.blockDurations?.first ?? DEFAULT_CONFIG.blockDurations.first,
        second: stored.blockDurations?.second ?? DEFAULT_CONFIG.blockDurations.second,
        third: stored.blockDurations?.third ?? DEFAULT_CONFIG.blockDurations.third,
        repeat: stored.blockDurations?.repeat ?? DEFAULT_CONFIG.blockDurations.repeat,
        critical: stored.blockDurations?.critical ?? DEFAULT_CONFIG.blockDurations.critical,
      },
    };
  }

  public async updateConfig(input: Partial<SecurityResponseConfig>): Promise<SecurityResponseConfig> {
    const current = await this.getConfig();
    const next: SecurityResponseConfig = {
      enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
      rateLimitThreshold:
        typeof input.rateLimitThreshold === "number" ? input.rateLimitThreshold : current.rateLimitThreshold,
      blockThreshold: typeof input.blockThreshold === "number" ? input.blockThreshold : current.blockThreshold,
      scoringWindowSeconds:
        typeof input.scoringWindowSeconds === "number" ? input.scoringWindowSeconds : current.scoringWindowSeconds,
      blockDurations: {
        first: input.blockDurations?.first ?? current.blockDurations.first,
        second: input.blockDurations?.second ?? current.blockDurations.second,
        third: input.blockDurations?.third ?? current.blockDurations.third,
        repeat: input.blockDurations?.repeat ?? current.blockDurations.repeat,
        critical: input.blockDurations?.critical ?? current.blockDurations.critical,
      },
    };

    await prisma.setting.upsert({
      where: { key: CONFIG_KEY },
      update: { value: next as unknown as Prisma.InputJsonValue },
      create: { key: CONFIG_KEY, value: next as unknown as Prisma.InputJsonValue },
    });

    return next;
  }

  /**
   * Fast-path active-block lookup. Redis is primary; per-process memory + DB
   * are used only as a fail-safe fallback when Redis is unavailable.
   */
  public async isBlocked(ip: string): Promise<{ blocked: boolean; blockId?: string }> {
    const record = await this.getActiveBlock(ip);
    if (!record) {
      return { blocked: false };
    }

    return { blocked: true, blockId: record.blockId };
  }

  /**
   * Scores a detected attack and returns a graduated mitigation decision.
   * TEMP_BLOCK also persists a block record and caches it for enforcement.
   */
  public async evaluate(detection: DetectionLike, context: MitigationContext): Promise<MitigationResult> {
    const config = await this.getConfig();
    if (!config.enabled) {
      return { decision: "ALLOW", riskScore: 0, reason: "security response disabled" };
    }

    const confidence: Confidence = normalizeConfidence(detection.confidence);
    const { repeatCount, distinctPaths, distinctCategories } = await this.recordAndCount(
      context.ip,
      context.path,
      detection.attackType,
      config.scoringWindowSeconds,
    );
    const priorBlockCount = await this.getPriorBlockCount(context.ip);

    const riskScore = computeRiskScore({
      severity: detection.severity,
      confidence,
      attackType: detection.attackType,
      repeatCount,
      distinctPaths,
      distinctCategories,
      priorBlockCount,
    });

    if (riskScore >= config.blockThreshold) {
      const durationSeconds = this.resolveBlockDuration(detection.severity, priorBlockCount, config);
      const block = await this.createBlock({
        ip: context.ip,
        ipVersion: context.ipVersion,
        reason: `Repeated ${detection.attackType} activity with risk score ${riskScore}`,
        attackType: detection.attackType,
        severity: detection.severity,
        confidence: detection.confidence,
        riskScore,
        triggerCount: repeatCount,
        samplePath: context.path,
        sampleMethod: context.method,
        userAgent: context.userAgent,
        requestId: context.requestId,
        matchedRule: `score>=${config.blockThreshold}`,
        source: SecurityBlockSource.AUTO,
        durationSeconds,
      });

      return {
        decision: "TEMP_BLOCK",
        riskScore,
        reason: `risk score ${riskScore} >= block threshold ${config.blockThreshold}`,
        blockId: block.id,
        durationSeconds,
      };
    }

    if (riskScore >= config.rateLimitThreshold) {
      return {
        decision: "RATE_LIMIT",
        riskScore,
        reason: `risk score ${riskScore} >= rate-limit threshold ${config.rateLimitThreshold}`,
      };
    }

    return { decision: "OBSERVE", riskScore, reason: "insufficient evidence to mitigate" };
  }

  /**
   * Records a sensitive-file / traversal probe and escalates to an IP block
   * only after repeated malicious probes (never on a single probe).
   */
  public async recordProbeAndEscalate(detection: DetectionLike, context: MitigationContext): Promise<void> {
    const config = await this.getConfig();
    if (!config.enabled) {
      return;
    }

    const { repeatCount, distinctPaths, distinctCategories } = await this.recordAndCount(
      context.ip,
      context.path,
      detection.attackType,
      config.scoringWindowSeconds,
    );

    if (repeatCount < SENSITIVE_PROBE_BLOCK_AFTER) {
      return;
    }

    const priorBlockCount = await this.getPriorBlockCount(context.ip);
    const riskScore = computeRiskScore({
      severity: detection.severity,
      confidence: normalizeConfidence(detection.confidence),
      attackType: detection.attackType,
      repeatCount,
      distinctPaths,
      distinctCategories,
      priorBlockCount,
    });

    if (riskScore < config.blockThreshold) {
      return;
    }

    const durationSeconds = this.resolveBlockDuration(detection.severity, priorBlockCount, config);

    await this.createBlock({
      ip: context.ip,
      ipVersion: context.ipVersion,
      reason: `Repeated ${detection.attackType} probes with risk score ${riskScore}`,
      attackType: detection.attackType,
      severity: detection.severity,
      confidence: detection.confidence,
      riskScore,
      triggerCount: repeatCount,
      samplePath: context.path,
      sampleMethod: context.method,
      userAgent: context.userAgent,
      requestId: context.requestId,
      matchedRule: `sensitive-probe-repeat>=${SENSITIVE_PROBE_BLOCK_AFTER}`,
      source: SecurityBlockSource.AUTO,
      durationSeconds,
    });
  }

  public async createBlock(input: {
    ip: string;
    ipVersion: string;
    reason: string;
    attackType?: string | null;
    severity?: ErrorLogSeverity | null;
    confidence?: string | null;
    riskScore: number;
    triggerCount: number;
    samplePath?: string | null;
    sampleMethod?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
    matchedRule?: string | null;
    source: SecurityBlockSource;
    durationSeconds: number;
    createdBy?: string | null;
  }): Promise<SecurityBlock> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.durationSeconds * 1000);
    const triggerEventIds = await this.collectTriggerEventIds(input.ip);

    const block = await prisma.securityBlock.create({
      data: {
        ip: input.ip,
        ipVersion: input.ipVersion,
        reason: input.reason,
        attackType: input.attackType ?? null,
        severity: input.severity ?? null,
        confidence: input.confidence ?? null,
        riskScore: input.riskScore,
        triggerCount: input.triggerCount,
        firstSeenAt: now,
        blockedAt: now,
        expiresAt,
        status: SecurityBlockStatus.ACTIVE,
        source: input.source,
        matchedRule: input.matchedRule ?? null,
        samplePath: input.samplePath ?? null,
        sampleMethod: input.sampleMethod ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
        createdBy: input.createdBy ?? null,
        triggerEventIds,
      },
    });

    this.cacheBlock(input.ip, block.id, expiresAt.getTime());
    await this.incrementBlockCount(input.ip);

    const isManual = input.source === SecurityBlockSource.MANUAL;

    errorLogger.capture({
      type: ErrorLogType.SECURITY_SCAN,
      severity: input.severity ?? ErrorLogSeverity.HIGH,
      message: isManual ? `Manually blocked ${input.ip}: ${input.reason}` : `Blocked ${input.ip}: ${input.reason}`,
      source: "Security response",
      attackType: input.attackType ?? "SECURITY_BLOCK",
      confidence: input.confidence ?? null,
      securityAction: isManual ? SecurityMitigationAction.BLOCK_MANUAL : SecurityMitigationAction.BLOCK_TRIGGERED,
      blockId: block.id,
      endpoint: input.samplePath ?? null,
      method: input.sampleMethod ?? null,
      statusCode: 403,
      ip: input.ip,
      requestId: input.requestId ?? null,
      userAgent: input.userAgent ?? null,
    });

    return block;
  }

  public async releaseBlock(
    id: string,
    actor: string | null,
    reason: string | null,
  ): Promise<SecurityBlock | null> {
    const existing = await prisma.securityBlock.findUnique({ where: { id } });
    if (!existing) {
      return null;
    }

    const block = await prisma.securityBlock.update({
      where: { id },
      data: {
        status: SecurityBlockStatus.RELEASED,
        releasedAt: new Date(),
        releasedBy: actor,
        releaseReason: reason,
      },
    });

    this.removeCachedBlock(block.ip);

    errorLogger.capture({
      type: ErrorLogType.SECURITY_SCAN,
      severity: ErrorLogSeverity.INFO,
      message: `Released block for ${block.ip}`,
      source: "Security response",
      attackType: block.attackType ?? "SECURITY_BLOCK",
      securityAction: SecurityMitigationAction.BLOCK_RELEASED,
      blockId: block.id,
      ip: block.ip,
    });

    return block;
  }

  public async extendBlock(id: string, extraSeconds: number, actor: string | null): Promise<SecurityBlock | null> {
    const existing = await prisma.securityBlock.findUnique({ where: { id } });
    if (!existing) {
      return null;
    }

    const base = existing.expiresAt.getTime() > Date.now() ? existing.expiresAt.getTime() : Date.now();
    const expiresAt = new Date(base + extraSeconds * 1000);

    const block = await prisma.securityBlock.update({
      where: { id },
      data: {
        status: SecurityBlockStatus.ACTIVE,
        expiresAt,
        createdBy: actor ?? existing.createdBy,
      },
    });

    this.cacheBlock(block.ip, block.id, expiresAt.getTime());

    errorLogger.capture({
      type: ErrorLogType.SECURITY_SCAN,
      severity: ErrorLogSeverity.MEDIUM,
      message: `Extended block for ${block.ip}`,
      source: "Security response",
      attackType: block.attackType ?? "SECURITY_BLOCK",
      securityAction: SecurityMitigationAction.BLOCK_ESCALATED,
      blockId: block.id,
      ip: block.ip,
    });

    return block;
  }

  public async listBlocks(query: {
    status?: SecurityBlockStatus;
    search?: string;
    attackType?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const where = this.buildBlockWhere(query);

    const [items, total] = await Promise.all([
      prisma.securityBlock.findMany({
        where,
        orderBy: { blockedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.securityBlock.count({ where }),
    ]);

    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  public async blockOverview() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [activeBlocks, blocks24h, blockedRequests24h, rateLimited24h, totalBlocks, byAttackType] = await Promise.all([
      prisma.securityBlock.count({ where: { status: SecurityBlockStatus.ACTIVE, expiresAt: { gt: new Date() } } }),
      prisma.securityBlock.count({ where: { blockedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } } }),
      prisma.errorLog.count({
        where: {
          type: ErrorLogType.SECURITY_SCAN,
          securityAction: SecurityMitigationAction.BLOCK_ENFORCED,
          lastSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
        },
      }),
      prisma.errorLog.count({
        where: {
          type: ErrorLogType.SECURITY_SCAN,
          securityAction: SecurityMitigationAction.RATE_LIMITED,
          lastSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
        },
      }),
      prisma.securityBlock.count({ where: { firstSeenAt: { gte: startOfToday } } }),
      prisma.securityBlock.groupBy({ by: ["attackType"], where: { attackType: { not: null } }, _count: { attackType: true } }),
    ]);

    return {
      activeBlocks,
      blocks24h,
      blockedRequests24h,
      rateLimited24h,
      totalBlocksToday: totalBlocks,
      topAttackTypes: byAttackType
        .map((row) => ({ attackType: row.attackType ?? "unknown", count: row._count.attackType }))
        .sort((a, b) => b.count - a.count),
    };
  }

  public async sweepExpired(): Promise<void> {
    const now = new Date();
    const expired = await prisma.securityBlock.findMany({
      where: { status: SecurityBlockStatus.ACTIVE, expiresAt: { lte: now } },
      select: { id: true, ip: true, attackType: true },
    });

    if (expired.length === 0) {
      return;
    }

    await prisma.securityBlock.updateMany({
      where: { id: { in: expired.map((block) => block.id) }, status: SecurityBlockStatus.ACTIVE },
      data: { status: SecurityBlockStatus.EXPIRED },
    });

    for (const block of expired) {
      errorLogger.capture({
        type: ErrorLogType.SECURITY_SCAN,
        severity: ErrorLogSeverity.INFO,
        message: `Block ${block.id} for ${block.ip} expired`,
        source: "Security response",
        attackType: block.attackType ?? "SECURITY_BLOCK",
        securityAction: SecurityMitigationAction.BLOCK_EXPIRED,
        blockId: block.id,
        ip: block.ip,
      });
    }
  }

  private buildBlockWhere(query: {
    status?: SecurityBlockStatus;
    search?: string;
    attackType?: string;
    from?: string;
    to?: string;
  }): Prisma.SecurityBlockWhereInput {
    const where: Prisma.SecurityBlockWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.attackType) {
      where.attackType = query.attackType;
    }

    if (query.search) {
      where.OR = [
        { ip: { contains: query.search, mode: "insensitive" } },
        { reason: { contains: query.search, mode: "insensitive" } },
        { samplePath: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.from || query.to) {
      where.blockedAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    return where;
  }

  private async getActiveBlock(ip: string): Promise<RedisBlockRecord | null> {
    if (redis) {
      try {
        const raw = await redis.get(`${BLOCK_KEY_PREFIX}${ip}`);
        if (!raw) {
          return null;
        }

        const record = JSON.parse(raw) as RedisBlockRecord;
        if (record.expiresAt > Date.now()) {
          return record;
        }

        await redis.del(`${BLOCK_KEY_PREFIX}${ip}`).catch(() => undefined);
        return null;
      } catch {
        // Fall through to the memory/DB fallback on Redis failure.
      }
    }

    const memoryRecord = memoryBlocks.get(ip);
    if (memoryRecord) {
      if (memoryRecord.expiresAt > Date.now()) {
        return memoryRecord;
      }

      memoryBlocks.delete(ip);
    }

    try {
      const block = await prisma.securityBlock.findFirst({
        where: { ip, status: SecurityBlockStatus.ACTIVE, expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: "desc" },
      });

      if (block) {
        const record = { blockId: block.id, expiresAt: block.expiresAt.getTime(), status: block.status };
        memoryBlocks.set(ip, record);
        return record;
      }
    } catch {
      // Fail open: a broken store must never take the site offline.
    }

    return null;
  }

  private cacheBlock(ip: string, blockId: string, expiresAtMs: number): void {
    const record: RedisBlockRecord = { blockId, expiresAt: expiresAtMs, status: "ACTIVE" };
    memoryBlocks.set(ip, record);

    if (redis) {
      const ttlMs = Math.max(1000, expiresAtMs - Date.now());
      void redis.set(`${BLOCK_KEY_PREFIX}${ip}`, JSON.stringify(record), "PX", ttlMs).catch(() => undefined);
    }
  }

  private removeCachedBlock(ip: string): void {
    memoryBlocks.delete(ip);
    if (redis) {
      void redis.del(`${BLOCK_KEY_PREFIX}${ip}`).catch(() => undefined);
    }
  }

  private async incrementBlockCount(ip: string): Promise<void> {
    if (redis) {
      try {
        await redis.incr(`${BLOCK_COUNT_KEY_PREFIX}${ip}`);
      } catch {
        // Non-critical counter.
      }
    }
  }

  private async getPriorBlockCount(ip: string): Promise<number> {
    if (redis) {
      try {
        const value = await redis.get(`${BLOCK_COUNT_KEY_PREFIX}${ip}`);
        if (value != null) {
          return Number(value) || 0;
        }
      } catch {
        // Fall through to DB.
      }
    }

    try {
      return await prisma.securityBlock.count({ where: { ip, source: SecurityBlockSource.AUTO } });
    } catch {
      return 0;
    }
  }

  private async recordAndCount(
    ip: string,
    path: string,
    attackType: string,
    windowSeconds: number,
  ): Promise<{ repeatCount: number; distinctPaths: number; distinctCategories: number }> {
    if (!redis) {
      return { repeatCount: 1, distinctPaths: 1, distinctCategories: 1 };
    }

    try {
      const now = Date.now();
      const min = now - windowSeconds * 1000;
      const member = `${now}:${Math.random().toString(36).slice(2)}`;

      const maliciousKey = `${MALICIOUS_KEY_PREFIX}${ip}`;
      const pathsKey = `${PATHS_KEY_PREFIX}${ip}`;
      const catsKey = `${CATS_KEY_PREFIX}${ip}`;

      await redis.zadd(maliciousKey, now, member);
      await redis.zremrangebyscore(maliciousKey, 0, min);
      const repeatCount = await redis.zcard(maliciousKey);
      await redis.expire(maliciousKey, windowSeconds);

      await redis.zadd(pathsKey, now, path);
      await redis.zremrangebyscore(pathsKey, 0, min);
      const distinctPaths = await redis.zcard(pathsKey);
      await redis.expire(pathsKey, windowSeconds);

      await redis.zadd(catsKey, now, attackType);
      await redis.zremrangebyscore(catsKey, 0, min);
      const distinctCategories = await redis.zcard(catsKey);
      await redis.expire(catsKey, windowSeconds);

      return { repeatCount, distinctPaths, distinctCategories };
    } catch {
      return { repeatCount: 1, distinctPaths: 1, distinctCategories: 1 };
    }
  }

  private async collectTriggerEventIds(ip: string): Promise<string[]> {
    try {
      const since = new Date(Date.now() - 10 * 60_000);
      const rows = await prisma.errorLog.findMany({
        where: {
          type: ErrorLogType.SECURITY_SCAN,
          ip,
          securityAction: SecurityMitigationAction.DETECTED,
          lastSeenAt: { gte: since },
        },
        select: { id: true },
        orderBy: { lastSeenAt: "desc" },
        take: 20,
      });

      return rows.map((row) => row.id);
    } catch {
      return [];
    }
  }

  private resolveBlockDuration(severity: ErrorLogSeverity, priorBlockCount: number, config: SecurityResponseConfig): number {
    if (severity === ErrorLogSeverity.CRITICAL) {
      return config.blockDurations.critical;
    }

    if (priorBlockCount >= 3) {
      return config.blockDurations.repeat;
    }

    if (priorBlockCount === 2) {
      return config.blockDurations.third;
    }

    if (priorBlockCount === 1) {
      return config.blockDurations.second;
    }

    return config.blockDurations.first;
  }
}

export const securityResponseService = new SecurityResponseService();
