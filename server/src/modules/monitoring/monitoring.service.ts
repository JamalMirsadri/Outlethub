import { ScraperStatus, SyncFrequency, SyncRunStatus } from "@prisma/client";

import { priceMonitorQueue, syncSchedulerQueue } from "../../config/bullmq.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { calculateConnectorHealthScore, type ConnectorHealthRunSample } from "../imports/import-observability.js";
import { alertManager } from "./alert-manager.js";
import { importAnalytics } from "./import-analytics.js";
import { enqueueProductMonitorJob, enqueueSyncRun } from "./monitoring-queue.js";
import { priceMonitor } from "./price-monitor.js";
import { productMonitoringService } from "./product-monitoring.service.js";
import { syncScheduler } from "./sync-scheduler.js";

function mapSyncRun(run: {
  id: string;
  sourceId: string;
  startedAt: Date | null;
  completedAt: Date | null;
  status: SyncRunStatus;
  productsChecked: number;
  productsChanged: number;
  createdAt: Date;
  updatedAt: Date;
  source?: {
    id: string;
    name: string;
    connectorKey: string;
    syncFrequency: SyncFrequency;
  } | null;
}) {
  return {
    id: run.id,
    sourceId: run.sourceId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    status: run.status,
    productsChecked: run.productsChecked,
    productsChanged: run.productsChanged,
    source: run.source
      ? {
          id: run.source.id,
          name: run.source.name,
          connectorKey: run.source.connectorKey,
          syncFrequency: run.source.syncFrequency,
        }
      : null,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

function buildDurationMs(startedAt: Date | null, completedAt: Date | null) {
  if (!startedAt || !completedAt) {
    return null;
  }

  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

function toHealthSamplesFromConnectorRuns(
  runs: Array<{
    status: string;
    discoveredCount: number;
    validatedCount: number;
    importedCount: number;
    updatedCount: number;
    unchangedCount: number;
    failedCount: number;
    durationMs: number | null;
  }>,
): ConnectorHealthRunSample[] {
  return runs.map((run) => ({
    status: run.status,
    discoveredCount: run.discoveredCount,
    validatedCount: run.validatedCount,
    importedCount: run.importedCount,
    updatedCount: run.updatedCount,
    unchangedCount: run.unchangedCount,
    failedCount: run.failedCount,
    durationMs: run.durationMs,
  }));
}

function toHealthSamplesFromScraperRuns(
  runs: Array<{
    status: string;
    discoveredCount: number;
    productsFound: number;
    validatedCount: number;
    productsImported: number;
    productsUpdated: number;
    unchangedCount: number;
    failedCount: number;
    startedAt: Date | null;
    completedAt: Date | null;
  }>,
): ConnectorHealthRunSample[] {
  return runs.map((run) => ({
    status: run.status,
    discoveredCount: run.discoveredCount || run.productsFound,
    validatedCount: run.validatedCount || run.productsFound,
    importedCount: run.productsImported,
    updatedCount: run.productsUpdated,
    unchangedCount: run.unchangedCount,
    failedCount: run.failedCount,
    durationMs: buildDurationMs(run.startedAt, run.completedAt),
  }));
}

function mapMonitoringSource(source: {
  id: string;
  name: string;
  status: ScraperStatus;
  connectorKey: string;
  syncFrequency: SyncFrequency;
  lastRunAt: Date | null;
  connectorConfiguration?: {
    runs: Array<{
      status: string;
      discoveredCount: number;
      validatedCount: number;
      importedCount: number;
      updatedCount: number;
      unchangedCount: number;
      failedCount: number;
      durationMs: number | null;
    }>;
  } | null;
  runs: Array<{
    status: string;
    productsFound: number;
    discoveredCount: number;
    validatedCount: number;
    productsImported: number;
    productsUpdated: number;
    unchangedCount: number;
    failedCount: number;
    startedAt: Date | null;
    completedAt: Date | null;
  }>;
  syncRuns: Array<{
    status: SyncRunStatus;
    completedAt: Date | null;
  }>;
}) {
  const connectorRuns = source.connectorConfiguration?.runs ?? [];
  const healthSamples =
    connectorRuns.length > 0 ? toHealthSamplesFromConnectorRuns(connectorRuns) : toHealthSamplesFromScraperRuns(source.runs);
  const health = calculateConnectorHealthScore(healthSamples);
  const latestSync = source.syncRuns[0] ?? null;

  return {
    id: source.id,
    name: source.name,
    status: source.status,
    connectorKey: source.connectorKey,
    syncFrequency: source.syncFrequency,
    lastRunAt: source.lastRunAt,
    lastSyncStatus: latestSync?.status ?? null,
    healthScore: health.healthScore,
    successRate: health.successRate,
    failureRate: health.failureRate,
    productYield: health.productYield,
    runtimeStability: health.runtimeStability,
    importedCount: source.runs.reduce((sum, run) => sum + run.productsImported, 0),
    updatedCount: source.runs.reduce((sum, run) => sum + run.productsUpdated, 0),
    unchangedCount: source.runs.reduce((sum, run) => sum + run.unchangedCount, 0),
    failedCount: source.runs.reduce((sum, run) => sum + run.failedCount, 0),
  };
}

export class MonitoringService {
  private async ensureSource(sourceId: string) {
    const source = await prisma.scraperSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      throw new ApiError(404, "Scraper source not found.");
    }

    return source;
  }

  public async getDashboard(sourceId?: string) {
    const [sources, totalSyncRuns, completedSyncRuns, failedSyncRuns, scraperRunTotals, alertCounts, failureSummary, syncQueue, priceQueue, recentRuns] =
      await Promise.all([
        prisma.scraperSource.findMany({
          include: {
            runs: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
            syncRuns: {
              orderBy: { createdAt: "desc" },
              take: 3,
            },
            connectorConfiguration: {
              include: {
                runs: {
                  orderBy: { createdAt: "desc" },
                  take: 10,
                },
              },
            },
          },
          orderBy: [{ lastRunAt: "desc" }, { createdAt: "desc" }],
        }),
        prisma.syncRun.count(),
        prisma.syncRun.count({
          where: {
            status: SyncRunStatus.COMPLETED,
          },
        }),
        prisma.syncRun.count({
          where: {
            status: SyncRunStatus.FAILED,
          },
        }),
        prisma.scraperRun.aggregate({
          _sum: {
            productsImported: true,
            productsUpdated: true,
            unchangedCount: true,
            failedCount: true,
          },
        }),
        Promise.all([
          prisma.alert.count(),
          prisma.alert.count({ where: { isRead: false } }),
          prisma.alert.count({ where: { severity: "CRITICAL" } }),
        ]),
        prisma.importProductResult.groupBy({
          by: ["failureReason"],
          _count: {
            failureReason: true,
          },
          where: {
            failureReason: {
              not: null,
            },
          },
        }),
        syncSchedulerQueue.getJobCounts("active", "completed", "delayed", "failed", "waiting", "paused"),
        priceMonitorQueue.getJobCounts("active", "completed", "delayed", "failed", "waiting", "paused"),
        prisma.syncRun.findMany({
          include: {
            source: {
              select: {
                id: true,
                name: true,
                connectorKey: true,
                syncFrequency: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
      ]);

    const mappedSources = sources.map(mapMonitoringSource);
    const selectedSource = mappedSources.find((item) => item.id === sourceId) ?? mappedSources[0] ?? null;

    if (!selectedSource) {
      return {
        summary: {
          totalSources: 0,
          activeSources: 0,
          totalSyncRuns,
          successfulSyncs: completedSyncRuns,
          failedSyncs: failedSyncRuns,
          successRate: 0,
          importedCount: 0,
          updatedCount: 0,
          unchangedCount: 0,
          failedCount: 0,
          averageHealthScore: 0,
        },
        selectedSource: null,
        sources: [],
        monitoring: {
          lastSync: null,
          productsChecked: 0,
          productsChanged: 0,
          priceDrops: 0,
          priceChanges: 0,
          stockChanges: 0,
          failedSyncs: 0,
        },
        analytics: null,
        recentRuns: recentRuns.map(mapSyncRun),
        failureReasons: failureSummary.map((item) => ({
          reason: item.failureReason,
          count: item._count.failureReason,
        })),
        alerts: {
          total: alertCounts[0],
          unread: alertCounts[1],
          critical: alertCounts[2],
        },
        queueStatus: {
          syncScheduler: syncQueue,
          priceMonitor: priceQueue,
        },
      };
    }

    const source = await this.ensureSource(selectedSource.id);
    const [latestSync, syncAggregation, selectedSourceFailedSyncs, selectedSourceAnalytics, priceChangeStats, stockChangeCount] =
      await Promise.all([
        prisma.syncRun.findFirst({
          where: { sourceId: source.id },
          include: {
            source: {
              select: {
                id: true,
                name: true,
                connectorKey: true,
                syncFrequency: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.syncRun.aggregate({
          where: { sourceId: source.id },
          _sum: {
            productsChecked: true,
            productsChanged: true,
          },
        }),
        prisma.syncRun.count({
          where: {
            sourceId: source.id,
            status: SyncRunStatus.FAILED,
          },
        }),
        importAnalytics.getSummary(source.name),
        priceMonitor.getPriceChangeStats(source.name),
        prisma.stockChange.count({
          where: {
            product: {
              sourceStore: source.name,
              deletedAt: null,
            },
          },
        }),
      ]);

    const averageHealthScore =
      mappedSources.length > 0
        ? Math.round(mappedSources.reduce((sum, item) => sum + item.healthScore, 0) / mappedSources.length)
        : 0;
    const successRate = totalSyncRuns > 0 ? Math.round((completedSyncRuns / totalSyncRuns) * 100) : 0;

    return {
      summary: {
        totalSources: mappedSources.length,
        activeSources: mappedSources.filter((item) => item.status === ScraperStatus.ACTIVE).length,
        totalSyncRuns,
        successfulSyncs: completedSyncRuns,
        failedSyncs: failedSyncRuns,
        successRate,
        importedCount: scraperRunTotals._sum.productsImported ?? 0,
        updatedCount: scraperRunTotals._sum.productsUpdated ?? 0,
        unchangedCount: scraperRunTotals._sum.unchangedCount ?? 0,
        failedCount: scraperRunTotals._sum.failedCount ?? 0,
        averageHealthScore,
      },
      selectedSource,
      sources: mappedSources,
      monitoring: {
        lastSync: latestSync ? mapSyncRun(latestSync) : null,
        productsChecked: syncAggregation._sum.productsChecked ?? 0,
        productsChanged: syncAggregation._sum.productsChanged ?? 0,
        priceDrops: priceChangeStats.drops,
        priceChanges: priceChangeStats.count,
        stockChanges: stockChangeCount,
        failedSyncs: selectedSourceFailedSyncs,
      },
      analytics: selectedSourceAnalytics,
      recentRuns: recentRuns.map(mapSyncRun),
      failureReasons: failureSummary.map((item) => ({
        reason: item.failureReason,
        count: item._count.failureReason,
      })),
      alerts: {
        total: alertCounts[0],
        unread: alertCounts[1],
        critical: alertCounts[2],
      },
      queueStatus: {
        syncScheduler: syncQueue,
        priceMonitor: priceQueue,
      },
    };
  }

  public async listAlerts(limit: number, unreadOnly: boolean) {
    const alerts = await alertManager.listAlerts(limit, unreadOnly);
    return alerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      isRead: alert.isRead,
      createdAt: alert.createdAt,
    }));
  }

  public async markAlertRead(id: string) {
    const alert = await alertManager.markRead(id);
    return {
      id: alert.id,
      isRead: alert.isRead,
    };
  }

  public async listSyncHistory(limit: number, status?: SyncRunStatus, sourceId?: string) {
    const runs = await prisma.syncRun.findMany({
      where: {
        ...(sourceId ? { sourceId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        source: {
          select: {
            id: true,
            name: true,
            connectorKey: true,
            syncFrequency: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return runs.map(mapSyncRun);
  }

  public async runSync(sourceId: string, trigger: "manual" | "schedule" = "manual") {
    const source = await this.ensureSource(sourceId);
    await enqueueSyncRun(
      {
        sourceId: source.id,
        trigger,
      },
      {
        jobId: trigger === "manual" ? `manual-sync-${source.id}-${Date.now()}` : undefined,
      },
    );

    return {
      sourceId: source.id,
      status: "QUEUED",
      trigger,
    };
  }

  public async updateSourceSettings(input: {
    sourceId: string;
    syncFrequency?: SyncFrequency;
    status?: ScraperStatus;
  }) {
    const source = await this.ensureSource(input.sourceId);
    const updated = await prisma.scraperSource.update({
      where: { id: source.id },
      data: {
        syncFrequency: input.syncFrequency,
        status: input.status,
      },
    });

    await syncScheduler.syncSchedules();

    return {
      id: updated.id,
      syncFrequency: updated.syncFrequency,
      status: updated.status,
    };
  }

  public async getProductMonitoringSettings(productId: string) {
    return productMonitoringService.getProductOverview(productId);
  }

  public async listProductMonitoringLogs(productId: string, limit: number) {
    return productMonitoringService.listProductLogs(productId, limit);
  }

  public async getGlobalProductMonitoringSettings() {
    return productMonitoringService.getGlobalSettings();
  }

  public async updateGlobalProductMonitoringSettings(input: {
    enabled?: boolean;
    intervalMinutes?: number;
    timeoutMs?: number;
  }) {
    const result = await productMonitoringService.updateGlobalSettings(input);
    await syncScheduler.syncSchedules();
    return result;
  }

  public async updateProductMonitoringSettings(
    productId: string,
    input: {
      enabled?: boolean;
      intervalMinutes?: number | null;
    },
  ) {
    const override = await productMonitoringService.updateProductOverride(productId, input);
    await syncScheduler.syncSchedules();
    return {
      productId,
      override,
      resolved: await productMonitoringService.getResolvedConfig(productId),
    };
  }

  public async queueProductMonitoringRun(productId: string, trigger: "manual" | "schedule" = "manual") {
    await productMonitoringService.getProductOverview(productId);
    await enqueueProductMonitorJob({
      productId,
      trigger,
    });

    return {
      productId,
      status: "QUEUED",
      trigger,
    };
  }
}

export const monitoringService = new MonitoringService();
