import { createHash } from "node:crypto";

import { ErrorLogSeverity, ErrorLogType, Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

const MESSAGE_MAX_LENGTH = 4000;
const STACK_MAX_LENGTH = 16000;
const SHORT_FIELD_MAX_LENGTH = 500;
const EXPORT_MAX_RECORDS = 5000;
const SECURITY_ALERT_EVALUATION_COOLDOWN_MS = 30_000;
const STATEFUL_THREAT_DETECTION_COOLDOWN_MS = 30_000;

let lastSecurityAlertEvaluationAt = 0;
let lastStatefulThreatDetectionAt = 0;

const SENSITIVE_PATTERNS: RegExp[] = [
  /(authorization\s*[:=]\s*)(bearer\s+)?[^\s,;"']+/gi,
  /(x-api-key\s*[:=]\s*)[^\s,;"']+/gi,
  /(password\s*[:=]\s*)[^\s,;"']+/gi,
  /(passwd\s*[:=]\s*)[^\s,;"']+/gi,
  /(token\s*[:=]\s*)[^\s,;"']+/gi,
  /(cookie\s*[:=]\s*)[^\s,;"']+/gi,
  /(secret\s*[:=]\s*)[^\s,;"']+/gi,
  /(access[_-]?token\s*[:=]\s*)[^\s,;"']+/gi,
  /(refresh[_-]?token\s*[:=]\s*)[^\s,;"']+/gi,
];

export interface CreateErrorLogInput {
  type: ErrorLogType;
  severity?: ErrorLogSeverity;
  message: string;
  stack?: string | null;
  source?: string | null;
  page?: string | null;
  endpoint?: string | null;
  method?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  ip?: string | null;
  requestId?: string | null;
  attackType?: string | null;
  confidence?: string | null;
  userAgent?: string | null;
}

export interface ListErrorLogsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  severity?: ErrorLogSeverity;
  type?: ErrorLogType;
  resolved?: boolean;
  userId?: string;
  route?: string;
  from?: string;
  to?: string;
  sort?: "newest" | "oldest" | "occurrences";
}

export interface ErrorLogView {
  id: string;
  type: ErrorLogType;
  severity: ErrorLogSeverity;
  message: string;
  stack: string | null;
  source: string | null;
  page: string | null;
  endpoint: string | null;
  method: string | null;
  statusCode: number | null;
  durationMs: number | null;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  ip: string | null;
  requestId: string | null;
  attackType: string | null;
  confidence: string | null;
  userAgent: string | null;
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolved: boolean;
  note: string | null;
  createdAt: Date;
}

function clip(value: string | null | undefined, maxLength: number): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

export function sanitizeSensitiveData(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  let sanitized = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "$1[REDACTED]");
  }

  return sanitized;
}

export function deriveSeverity(type: ErrorLogType, statusCode?: number | null): ErrorLogSeverity {
  if (typeof statusCode === "number") {
    if (statusCode >= 500) {
      return ErrorLogSeverity.HIGH;
    }

    if (statusCode === 401 || statusCode === 403) {
      return ErrorLogSeverity.MEDIUM;
    }

    if (statusCode >= 400) {
      return ErrorLogSeverity.LOW;
    }
  }

  if (type === ErrorLogType.BACKEND) {
    return ErrorLogSeverity.HIGH;
  }

  return ErrorLogSeverity.MEDIUM;
}

function computeFingerprint(input: {
  type: string;
  source: string;
  message: string;
  page: string;
  endpoint: string;
  method: string;
  statusCode: string;
}): string {
  const hash = createHash("sha256");
  hash.update(
    [input.type, input.source, input.message, input.page, input.endpoint, input.method, input.statusCode].join("::"),
  );
  return hash.digest("hex");
}

function normalizeSeverity(value?: ErrorLogSeverity | null): ErrorLogSeverity | null {
  if (!value) {
    return null;
  }

  return Object.values(ErrorLogSeverity).includes(value) ? value : null;
}

export function toListOutput(log: Prisma.ErrorLogGetPayload<{}>): ErrorLogView {
  return {
    id: log.id,
    type: log.type,
    severity: log.severity,
    message: log.message,
    stack: log.stack,
    source: log.source,
    page: log.page,
    endpoint: log.endpoint,
    method: log.method,
    statusCode: log.statusCode,
    durationMs: log.durationMs,
    userId: log.userId,
    userEmail: log.userEmail,
    userRole: log.userRole,
    browser: log.browser,
    os: log.os,
    device: log.device,
    ip: log.ip,
    requestId: log.requestId,
    attackType: log.attackType,
    confidence: log.confidence,
    userAgent: log.userAgent,
    occurrences: log.occurrences,
    firstSeenAt: log.firstSeenAt,
    lastSeenAt: log.lastSeenAt,
    resolved: log.resolved,
    note: log.note,
    createdAt: log.createdAt,
  };
}

export class SystemLogsService {
  public async log(input: CreateErrorLogInput) {
    const message = clip(sanitizeSensitiveData(input.message), MESSAGE_MAX_LENGTH) ?? "Unknown error";
    const stack = clip(sanitizeSensitiveData(input.stack), STACK_MAX_LENGTH);
    const source = clip(sanitizeSensitiveData(input.source), SHORT_FIELD_MAX_LENGTH);
    const page = clip(input.page, SHORT_FIELD_MAX_LENGTH);
    const endpoint = clip(input.endpoint, SHORT_FIELD_MAX_LENGTH);
    const method = clip(input.method, 20)?.toUpperCase() ?? null;
    const userEmail = clip(input.userEmail, 320);
    const userRole = clip(input.userRole, 40);
    const browser = clip(input.browser, SHORT_FIELD_MAX_LENGTH);
    const os = clip(input.os, SHORT_FIELD_MAX_LENGTH);
    const device = clip(input.device, SHORT_FIELD_MAX_LENGTH);
    const ip = clip(input.ip, 64);
    const requestId = clip(input.requestId, 200);
    const attackType = clip(input.attackType, 60);
    const confidence = clip(input.confidence, 20)?.toUpperCase() ?? null;
    const userAgent = clip(input.userAgent, 500);
    const severity = normalizeSeverity(input.severity) ?? deriveSeverity(input.type, input.statusCode);

    const fingerprint = computeFingerprint({
      type: input.type,
      source: source ?? "",
      message,
      page: page ?? "",
      endpoint: endpoint ?? "",
      method: method ?? "",
      statusCode: input.statusCode != null ? String(input.statusCode) : "",
    });

    const now = new Date();

    const data = {
      type: input.type,
      severity,
      message,
      stack,
      source,
      page,
      endpoint,
      method,
      statusCode: typeof input.statusCode === "number" ? input.statusCode : null,
      durationMs: typeof input.durationMs === "number" && input.durationMs >= 0 ? input.durationMs : null,
      userId: input.userId ? clip(input.userId, 200) : null,
      userEmail,
      userRole,
      browser,
      os,
      device,
      ip,
      requestId,
      attackType,
      confidence,
      userAgent,
    };

    return prisma.errorLog.upsert({
      where: { fingerprint },
      create: {
        ...data,
        fingerprint,
        occurrences: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      },
      update: {
        occurrences: { increment: 1 },
        lastSeenAt: now,
        resolved: false,
      },
    }).then((result) => {
      if (input.type === ErrorLogType.SECURITY_SCAN) {
        this.triggerSecurityAlertEvaluation();
      } else if (this.isStatefulThreatCandidate(input)) {
        this.triggerStatefulThreatDetection();
      }

      return result;
    });
  }

  private isStatefulThreatCandidate(input: CreateErrorLogInput): boolean {
    if (input.type !== ErrorLogType.API) {
      return false;
    }

    const endpoint = input.endpoint ?? "";

    if (input.statusCode === 429) {
      return true;
    }

    if (input.statusCode === 401 && endpoint.includes("/auth/login")) {
      return true;
    }

    return (
      endpoint.includes("/auth/forgot-password") ||
      endpoint.includes("/auth/resend-verification") ||
      endpoint.includes("/auth/verify-email")
    );
  }

  private triggerStatefulThreatDetection(): void {
    const now = Date.now();
    if (now - lastStatefulThreatDetectionAt < STATEFUL_THREAT_DETECTION_COOLDOWN_MS) {
      return;
    }

    lastStatefulThreatDetectionAt = now;
    void import("./security.service.js")
      .then(({ securityService }) => securityService.detectStatefulThreats())
      .catch(() => undefined);
  }

  private triggerSecurityAlertEvaluation(): void {
    const now = Date.now();
    if (now - lastSecurityAlertEvaluationAt < SECURITY_ALERT_EVALUATION_COOLDOWN_MS) {
      return;
    }

    lastSecurityAlertEvaluationAt = now;
    void import("./security.service.js")
      .then(({ securityService }) => securityService.evaluateAlerts())
      .catch(() => undefined);
  }

  private buildWhere(query: ListErrorLogsQuery): Prisma.ErrorLogWhereInput {
    const where: Prisma.ErrorLogWhereInput = {};

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (typeof query.resolved === "boolean") {
      where.resolved = query.resolved;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.route) {
      where.page = { contains: query.route, mode: "insensitive" };
    }

    if (query.search) {
      where.OR = [
        { message: { contains: query.search, mode: "insensitive" } },
        { source: { contains: query.search, mode: "insensitive" } },
        { endpoint: { contains: query.search, mode: "insensitive" } },
        { userEmail: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    return where;
  }

  private buildOrderBy(sort: "newest" | "oldest" | "occurrences"): Prisma.ErrorLogOrderByWithRelationInput[] {
    if (sort === "oldest") {
      return [{ createdAt: "asc" }];
    }

    if (sort === "occurrences") {
      return [{ occurrences: "desc" }, { lastSeenAt: "desc" }];
    }

    return [{ lastSeenAt: "desc" }];
  }

  public async list(query: ListErrorLogsQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const sort = query.sort ?? "newest";
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(sort);

    const [items, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.errorLog.count({ where }),
    ]);

    return {
      items: items.map(toListOutput),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  public async exportLogs(query: ListErrorLogsQuery): Promise<ErrorLogView[]> {
    const sort = query.sort ?? "newest";
    const items = await prisma.errorLog.findMany({
      where: this.buildWhere(query),
      orderBy: this.buildOrderBy(sort),
      take: EXPORT_MAX_RECORDS,
    });

    return items.map(toListOutput);
  }

  public async get(id: string) {
    const log = await prisma.errorLog.findUnique({ where: { id } });

    if (!log) {
      throw new ApiError(404, "Error log not found.");
    }

    return toListOutput(log);
  }

  public async resolve(id: string) {
    await this.ensureExists(id);

    const log = await prisma.errorLog.update({
      where: { id },
      data: { resolved: true },
    });

    return toListOutput(log);
  }

  public async addNote(id: string, note: string) {
    await this.ensureExists(id);

    const log = await prisma.errorLog.update({
      where: { id },
      data: { note: clip(note, 2000) ?? "" },
    });

    return toListOutput(log);
  }

  public async remove(id: string) {
    await this.ensureExists(id);

    await prisma.errorLog.delete({ where: { id } });

    return { id, deleted: true };
  }

  public async summary() {
    const [total, unresolved, critical, high, byType, bySeverity] = await Promise.all([
      prisma.errorLog.count(),
      prisma.errorLog.count({ where: { resolved: false } }),
      prisma.errorLog.count({ where: { severity: ErrorLogSeverity.CRITICAL, resolved: false } }),
      prisma.errorLog.count({ where: { severity: ErrorLogSeverity.HIGH, resolved: false } }),
      prisma.errorLog.groupBy({
        by: ["type"],
        _count: { type: true },
        where: { resolved: false },
      }),
      prisma.errorLog.groupBy({
        by: ["severity"],
        _count: { severity: true },
        where: { resolved: false },
      }),
    ]);

    return {
      total,
      unresolved,
      critical,
      high,
      byType: byType.map((item) => ({ type: item.type, count: item._count.type })),
      bySeverity: bySeverity.map((item) => ({ severity: item.severity, count: item._count.severity })),
    };
  }

  private async ensureExists(id: string) {
    const existing = await prisma.errorLog.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      throw new ApiError(404, "Error log not found.");
    }
  }
}

export const systemLogsService = new SystemLogsService();

/**
 * Fire-and-forget logger that never throws. Logging must never crash the
 * application or its request lifecycle, so any failure is swallowed here.
 */
export const errorLogger = {
  capture(input: CreateErrorLogInput): void {
    void systemLogsService.log(input).catch(() => undefined);
  },
};
