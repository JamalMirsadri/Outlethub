import { readFileSync } from "node:fs";

import { Worker, type JobsOptions } from "bullmq";
import { SyncRunStatus } from "@prisma/client";

import {
  bullmqConnection,
  priceMonitorQueue,
  priceMonitorQueueEvents,
  syncSchedulerQueue,
  syncSchedulerQueueEvents,
} from "../../config/bullmq.js";
import { prisma } from "../../config/prisma.js";
import { alertManager } from "./alert-manager.js";
import { priceMonitor } from "./price-monitor.js";
import { productMonitoringService } from "./product-monitoring.service.js";
import { scraperManager } from "../scrapers/scraper-manager.js";
import { changeDetector, type ImportedProductKey, type ProductSnapshot } from "./change-detector.js";
import { syncScheduler } from "./sync-scheduler.js";

export type QueuedSyncPayload =
  | {
      sourceId: string;
      trigger: "manual" | "schedule";
      jobType?: "source-sync";
    }
  | {
      productId: string;
      trigger: "manual" | "schedule";
      jobType: "product-monitor";
    };

export type QueuedPriceMonitorPayload =
  | {
      syncRunId: string;
      sourceId: string;
      sourceStore: string;
      beforeSnapshot: ProductSnapshot[];
      importedProducts: ImportedProductKey[];
      jobType?: "sync-result";
    }
  | {
      productId: string;
      trigger: "manual" | "schedule";
      jobType: "product-monitor-check";
    };

let syncSchedulerWorker: Worker<QueuedSyncPayload> | null = null;
let priceMonitorWorker: Worker<QueuedPriceMonitorPayload> | null = null;

function reportManualUpdateDebug(
  hypothesisId: "A" | "B",
  location: string,
  msg: string,
  data: Record<string, unknown>,
) {
  let url = "http://127.0.0.1:7777/event";
  let sessionId = "manual-update-stuck";
  try {
    const env = readFileSync(".dbg/manual-update-stuck.env", "utf8");
    url = env.match(/DEBUG_SERVER_URL=(.+)/)?.[1] ?? url;
    sessionId = env.match(/DEBUG_SESSION_ID=(.+)/)?.[1] ?? sessionId;
  } catch {}

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      runId: "pre-fix",
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}

export async function enqueueSyncRun(payload: QueuedSyncPayload, options?: JobsOptions) {
  return syncSchedulerQueue.add("run-sync", payload, options);
}

export async function enqueuePriceMonitorJob(payload: QueuedPriceMonitorPayload) {
  return priceMonitorQueue.add("process-sync-monitoring", payload);
}

export async function enqueueProductMonitorJob(payload: { productId: string; trigger: "manual" | "schedule" }) {
  // #region debug-point A:enqueue-product-monitor
  reportManualUpdateDebug("A", "monitoring-queue.ts:enqueueProductMonitorJob", "enqueue product monitor job", payload);
  // #endregion
  return priceMonitorQueue.add("process-product-monitor", {
    ...payload,
    jobType: "product-monitor-check",
  });
}

export function startSyncSchedulerWorker(): Worker<QueuedSyncPayload> {
  if (syncSchedulerWorker) {
    return syncSchedulerWorker;
  }

  syncSchedulerWorker = new Worker<QueuedSyncPayload>(
    "sync-scheduler",
    async (job) => {
      if (job.data.jobType === "product-monitor") {
        await enqueueProductMonitorJob({
          productId: job.data.productId,
          trigger: job.data.trigger,
        });
        return;
      }

      const source = await prisma.scraperSource.findUnique({
        where: { id: job.data.sourceId },
      });

      if (!source) {
        return;
      }

      const syncRun = await prisma.syncRun.create({
        data: {
          sourceId: source.id,
          status: SyncRunStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      const beforeSnapshot = await changeDetector.captureSourceSnapshot(source.name);

      try {
        const scraperRun = await scraperManager.createRun({
          sourceId: source.id,
        });
        const result = await scraperManager.executeRun(scraperRun.id);

        await enqueuePriceMonitorJob({
          syncRunId: syncRun.id,
          sourceId: source.id,
          sourceStore: source.name,
          beforeSnapshot,
          importedProducts: result.importedProducts,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Nike sync failed.";

        await prisma.syncRun.update({
          where: { id: syncRun.id },
          data: {
            status: SyncRunStatus.FAILED,
            completedAt: new Date(),
            productsChecked: 0,
            productsChanged: 0,
          },
        });

        await alertManager.createScraperFailureAlert(source.name, message);
        await alertManager.createSyncFailureAlert(source.name, message);
        throw error;
      }
    },
    {
      connection: bullmqConnection,
      concurrency: 1,
    },
  );

  syncSchedulerWorker.on("failed", (job, error) => {
    console.error("Sync scheduler job failed", job?.id, error);
  });

  return syncSchedulerWorker;
}

export function startPriceMonitorWorker(): Worker<QueuedPriceMonitorPayload> {
  if (priceMonitorWorker) {
    return priceMonitorWorker;
  }

  priceMonitorWorker = new Worker<QueuedPriceMonitorPayload>(
    "price-monitor",
    async (job) => {
      if (job.data.jobType === "product-monitor-check") {
        // #region debug-point A:price-monitor-worker-received
        reportManualUpdateDebug("A", "monitoring-queue.ts:startPriceMonitorWorker", "worker received product monitor job", {
          jobId: job.id,
          productId: job.data.productId,
          trigger: job.data.trigger,
        });
        // #endregion
        const result = await productMonitoringService.checkProduct(job.data.productId);
        // #region debug-point B:price-monitor-worker-result
        reportManualUpdateDebug("B", "monitoring-queue.ts:startPriceMonitorWorker", "worker completed product monitor job", {
          jobId: job.id,
          productId: job.data.productId,
          status: result.status,
          changedFields: result.changedFields,
          errorMessage: result.errorMessage,
          responseStatus: result.responseStatus,
        });
        // #endregion
        if (result.rescheduleRequired) {
          await syncScheduler.syncSchedules();
        }
        return result;
      }

      try {
        await priceMonitor.processSyncResult(job.data);
      } catch (error) {
        await priceMonitor.failSyncRun(job.data.syncRunId);
        const message = error instanceof Error ? error.message : "Price monitor failed.";
        await alertManager.createSyncFailureAlert(job.data.sourceStore, message);
        throw error;
      }
    },
    {
      connection: bullmqConnection,
      concurrency: 1,
    },
  );

  priceMonitorWorker.on("failed", (job, error) => {
    console.error("Price monitor job failed", job?.id, error);
  });

  return priceMonitorWorker;
}

export async function stopMonitoringWorkers(): Promise<void> {
  if (syncSchedulerWorker) {
    await syncSchedulerWorker.close();
    syncSchedulerWorker = null;
  }

  if (priceMonitorWorker) {
    await priceMonitorWorker.close();
    priceMonitorWorker = null;
  }
}

export async function closeMonitoringQueueInfrastructure(): Promise<void> {
  await stopMonitoringWorkers();
  await priceMonitorQueueEvents.close();
  await syncSchedulerQueueEvents.close();
  await priceMonitorQueue.close();
  await syncSchedulerQueue.close();
}
