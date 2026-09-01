import { AlertSeverity, AlertType, ErrorLogSeverity, ErrorLogType, Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { errorLogger, toListOutput, type ErrorLogView } from "./system-logs.service.js";

const SECURITY_ALERTS_CONFIG_KEY = "security_alerts_config";

const SEVERITY_RANK: Record<ErrorLogSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export interface SecurityAlertsConfig {
  enabled: boolean;
  threshold: number;
  windowMinutes: number;
  minSeverity: ErrorLogSeverity;
}

const DEFAULT_CONFIG: SecurityAlertsConfig = {
  enabled: true,
  threshold: 30,
  windowMinutes: 10,
  minSeverity: ErrorLogSeverity.LOW,
};

export interface SecurityOverview {
  summary: {
    scansToday: number;
    uniqueIps: number;
    totalRequests: number;
    phpProbes: number;
    wordpressProbes: number;
    rceProbes: number;
    otherProbes: number;
    highRiskEvents: number;
    topIp: string | null;
    topIpRequests: number;
    lastEventAt: string | null;
  };
  attackTypes: Array<{ category: string; count: number }>;
  topAttackers: Array<{ ip: string; count: number }>;
  recentEvents: ErrorLogView[];
}

export interface SecurityAlertView {
  id: string;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

function severitiesAtOrAbove(min: ErrorLogSeverity): ErrorLogSeverity[] {
  const minRank = SEVERITY_RANK[min] ?? SEVERITY_RANK.INFO;
  return (Object.keys(SEVERITY_RANK) as ErrorLogSeverity[]).filter((severity) => SEVERITY_RANK[severity] >= minRank);
}

function categorizeSource(source: string | null): "php" | "wordpress" | "rce" | "other" {
  const value = (source ?? "").toLowerCase();

  if (value.includes("php")) {
    return "php";
  }

  if (value.includes("wordpress")) {
    return "wordpress";
  }

  if (value.includes("rce") || value.includes("sql") || value.includes("injection") || value.includes("traversal") || value.includes("sensitive")) {
    return "rce";
  }

  return "other";
}

export class SecurityService {
  public async getOverview(): Promise<SecurityOverview> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const where: Prisma.ErrorLogWhereInput = { type: ErrorLogType.SECURITY_SCAN };

    const [scansToday, uniqueIpGroups, totalAggregate, bySource, topAttackers, lastEvent, recentEvents] = await Promise.all([
      prisma.errorLog.count({ where: { ...where, lastSeenAt: { gte: startOfToday } } }),
      prisma.errorLog.groupBy({ by: ["ip"], where: { ...where, ip: { not: null } } }),
      prisma.errorLog.aggregate({ where, _sum: { occurrences: true } }),
      prisma.errorLog.groupBy({ by: ["source"], where, _sum: { occurrences: true } }),
      prisma.errorLog.groupBy({
        by: ["ip"],
        where: { ...where, ip: { not: null } },
        _sum: { occurrences: true },
        orderBy: { _sum: { occurrences: "desc" } },
        take: 10,
      }),
      prisma.errorLog.findFirst({ where, orderBy: { lastSeenAt: "desc" } }),
      prisma.errorLog.findMany({ where, orderBy: { lastSeenAt: "desc" }, take: 20 }),
    ]);

    const categoryTotals = { php: 0, wordpress: 0, rce: 0, other: 0 };
    for (const row of bySource) {
      const count = row._sum.occurrences ?? 0;
      categoryTotals[categorizeSource(row.source)] += count;
    }

    const topIp = topAttackers[0];

    return {
      summary: {
        scansToday,
        uniqueIps: uniqueIpGroups.length,
        totalRequests: totalAggregate._sum.occurrences ?? 0,
        phpProbes: categoryTotals.php,
        wordpressProbes: categoryTotals.wordpress,
        rceProbes: categoryTotals.rce,
        otherProbes: categoryTotals.other,
        highRiskEvents: categoryTotals.rce,
        topIp: topIp?.ip ?? null,
        topIpRequests: topIp?._sum.occurrences ?? 0,
        lastEventAt: lastEvent?.lastSeenAt?.toISOString() ?? null,
      },
      attackTypes: [
        { category: "WordPress probe", count: categoryTotals.wordpress },
        { category: "PHP probe", count: categoryTotals.php },
        { category: "RCE probe", count: categoryTotals.rce },
        { category: "Other probe", count: categoryTotals.other },
      ],
      topAttackers: topAttackers.map((row) => ({ ip: row.ip ?? "unknown", count: row._sum.occurrences ?? 0 })),
      recentEvents: recentEvents.map(toListOutput),
    };
  }

  public async getAlertsConfig(): Promise<SecurityAlertsConfig> {
    const setting = await prisma.setting.findUnique({ where: { key: SECURITY_ALERTS_CONFIG_KEY } });
    const stored = (setting?.value ?? {}) as Partial<SecurityAlertsConfig>;

    return {
      enabled: typeof stored.enabled === "boolean" ? stored.enabled : DEFAULT_CONFIG.enabled,
      threshold: typeof stored.threshold === "number" ? stored.threshold : DEFAULT_CONFIG.threshold,
      windowMinutes: typeof stored.windowMinutes === "number" ? stored.windowMinutes : DEFAULT_CONFIG.windowMinutes,
      minSeverity: stored.minSeverity && SEVERITY_RANK[stored.minSeverity] != null ? stored.minSeverity : DEFAULT_CONFIG.minSeverity,
    };
  }

  public async updateAlertsConfig(input: Partial<SecurityAlertsConfig>): Promise<SecurityAlertsConfig> {
    const current = await this.getAlertsConfig();
    const next: SecurityAlertsConfig = {
      enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
      threshold: typeof input.threshold === "number" ? input.threshold : current.threshold,
      windowMinutes: typeof input.windowMinutes === "number" ? input.windowMinutes : current.windowMinutes,
      minSeverity: input.minSeverity ?? current.minSeverity,
    };

    await prisma.setting.upsert({
      where: { key: SECURITY_ALERTS_CONFIG_KEY },
      update: { value: next as unknown as Prisma.InputJsonValue },
      create: { key: SECURITY_ALERTS_CONFIG_KEY, value: next as unknown as Prisma.InputJsonValue },
    });

    return next;
  }

  public async evaluateAlerts(): Promise<SecurityAlertView[]> {
    const config = await this.getAlertsConfig();

    if (!config.enabled) {
      return this.listAlerts();
    }

    const windowStart = new Date(Date.now() - config.windowMinutes * 60_000);

    const groups = await prisma.errorLog.groupBy({
      by: ["ip"],
      where: {
        type: ErrorLogType.SECURITY_SCAN,
        ip: { not: null },
        severity: { in: severitiesAtOrAbove(config.minSeverity) },
        lastSeenAt: { gte: windowStart },
      },
      _sum: { occurrences: true },
      having: { occurrences: { _sum: { gte: config.threshold } } },
    });

    for (const group of groups) {
      const ip = group.ip;
      if (!ip) {
        continue;
      }

      const count = group._sum.occurrences ?? 0;
      const title = `Suspicious activity from ${ip}`;
      const existing = await prisma.alert.findFirst({
        where: { type: AlertType.SECURITY, title, createdAt: { gte: windowStart } },
        select: { id: true },
      });

      if (existing) {
        continue;
      }

      await prisma.alert.create({
        data: {
          type: AlertType.SECURITY,
          severity: AlertSeverity.CRITICAL,
          title,
          message: `${ip} generated ${count} suspicious requests in the last ${config.windowMinutes} minutes.`,
        },
      });
    }

    return this.listAlerts();
  }

  public async listAlerts(limit = 50): Promise<SecurityAlertView[]> {
    const items = await prisma.alert.findMany({
      where: { type: AlertType.SECURITY },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return items.map((alert) => ({
      id: alert.id,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      isRead: alert.isRead,
      createdAt: alert.createdAt,
    }));
  }

  public logThreat(input: {
    attackType: string;
    confidence: string;
    severity: ErrorLogSeverity;
    source: string;
    ip: string | null;
    method: string | null;
    path: string;
    statusCode: number | null;
    userAgent: string | null;
    requestId: string | null;
    message?: string;
  }): void {
    errorLogger.capture({
      type: ErrorLogType.SECURITY_SCAN,
      severity: input.severity,
      message: input.message ?? `Detected ${input.attackType}: ${input.method ?? "GET"} ${input.path}`,
      source: input.source,
      attackType: input.attackType,
      confidence: input.confidence,
      endpoint: input.path,
      method: input.method,
      statusCode: input.statusCode,
      ip: input.ip,
      userAgent: input.userAgent,
      requestId: input.requestId,
    });
  }

  public async detectStatefulThreats(): Promise<void> {
    const config = await this.getAlertsConfig();
    if (!config.enabled) {
      return;
    }

    const since = new Date(Date.now() - config.windowMinutes * 60_000);

    await this.detectFailedLoginAbuse(since);
    await this.detectAuthAbuse(since);
    await this.detectApiAbuse(since);
  }

  private async detectFailedLoginAbuse(since: Date): Promise<void> {
    const groups = await prisma.errorLog.groupBy({
      by: ["ip"],
      where: {
        type: ErrorLogType.API,
        endpoint: { contains: "/auth/login" },
        statusCode: 401,
        ip: { not: null },
        lastSeenAt: { gte: since },
      },
      _count: { ip: true },
      having: { ip: { _count: { gte: 10 } } },
    });

    for (const group of groups) {
      const ip = group.ip;
      if (!ip) {
        continue;
      }

      const count = group._count.ip;
      const isStuffing = count >= 30;
      errorLogger.capture({
        type: ErrorLogType.SECURITY_SCAN,
        severity: ErrorLogSeverity.HIGH,
        message: `${isStuffing ? "Credential stuffing" : "Brute force"} from ${ip}`,
        source: isStuffing ? "Credential stuffing" : "Brute force",
        attackType: isStuffing ? "CREDENTIAL_STUFFING" : "BRUTE_FORCE",
        confidence: "HIGH",
        endpoint: "/auth/login",
        method: "POST",
        statusCode: 401,
        ip,
      });
    }
  }

  private async detectAuthAbuse(since: Date): Promise<void> {
    const groups = await prisma.errorLog.groupBy({
      by: ["ip"],
      where: {
        type: ErrorLogType.API,
        OR: [
          { endpoint: { contains: "/auth/forgot-password" } },
          { endpoint: { contains: "/auth/resend-verification" } },
          { endpoint: { contains: "/auth/verify-email" } },
        ],
        ip: { not: null },
        lastSeenAt: { gte: since },
      },
      _count: { ip: true },
      having: { ip: { _count: { gte: 20 } } },
    });

    for (const group of groups) {
      const ip = group.ip;
      if (!ip) {
        continue;
      }

      errorLogger.capture({
        type: ErrorLogType.SECURITY_SCAN,
        severity: ErrorLogSeverity.MEDIUM,
        message: `Auth abuse from ${ip}`,
        source: "Auth abuse",
        attackType: "AUTH_ABUSE",
        confidence: "MEDIUM",
        endpoint: "/auth/*",
        method: "POST",
        ip,
      });
    }
  }

  private async detectApiAbuse(since: Date): Promise<void> {
    const groups = await prisma.errorLog.groupBy({
      by: ["ip"],
      where: {
        type: ErrorLogType.API,
        statusCode: 429,
        ip: { not: null },
        lastSeenAt: { gte: since },
      },
      _count: { ip: true },
      having: { ip: { _count: { gte: 30 } } },
    });

    for (const group of groups) {
      const ip = group.ip;
      if (!ip) {
        continue;
      }

      errorLogger.capture({
        type: ErrorLogType.SECURITY_SCAN,
        severity: ErrorLogSeverity.MEDIUM,
        message: `API abuse from ${ip}`,
        source: "API abuse",
        attackType: "API_ABUSE",
        confidence: "MEDIUM",
        endpoint: "/api/*",
        method: null,
        statusCode: 429,
        ip,
      });
    }
  }
}

export const securityService = new SecurityService();
