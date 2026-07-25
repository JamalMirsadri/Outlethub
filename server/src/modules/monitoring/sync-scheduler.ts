import { ScraperStatus, SyncFrequency, type ScraperSource } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { syncSchedulerQueue } from "../../config/bullmq.js";
import { productMonitoringService } from "./product-monitoring.service.js";

function getRepeatEvery(syncFrequency: SyncFrequency): number | null {
  switch (syncFrequency) {
    case SyncFrequency.HOURLY:
      return 60 * 60 * 1000;
    case SyncFrequency.EVERY_6_HOURS:
      return 6 * 60 * 60 * 1000;
    case SyncFrequency.DAILY:
      return 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export class SyncScheduler {
  public async syncSchedules(): Promise<void> {
    const repeatableJobs = await syncSchedulerQueue.getRepeatableJobs();
    await Promise.all(repeatableJobs.map((job) => syncSchedulerQueue.removeRepeatableByKey(job.key)));

    const scheduledSources = await prisma.scraperSource.findMany({
      where: {
        status: ScraperStatus.ACTIVE,
      },
      select: {
        id: true,
        syncFrequency: true,
      },
    });

    for (const source of scheduledSources) {
      const every = getRepeatEvery(source.syncFrequency);
      if (!every) {
        continue;
      }

      await syncSchedulerQueue.add(
        "run-sync",
        {
          sourceId: source.id,
          trigger: "schedule",
        },
        {
          jobId: `scheduled-sync-${source.id}`,
          repeat: {
            every,
          },
        },
      );
    }

    const scheduledProducts = await productMonitoringService.listScheduledProducts();
    for (const product of scheduledProducts) {
      await syncSchedulerQueue.add(
        "run-product-monitor",
        {
          jobType: "product-monitor",
          productId: product.productId,
          trigger: "schedule",
        },
        {
          jobId: `scheduled-product-monitor-${product.productId}`,
          repeat: {
            every: product.intervalMinutes * 60 * 1000,
          },
        },
      );
    }
  }

  public buildSourceSummary(source: Pick<ScraperSource, "id" | "name" | "syncFrequency">) {
    return {
      id: source.id,
      name: source.name,
      syncFrequency: source.syncFrequency,
      isAutomatic: source.syncFrequency !== SyncFrequency.MANUAL,
    };
  }
}

export const syncScheduler = new SyncScheduler();
