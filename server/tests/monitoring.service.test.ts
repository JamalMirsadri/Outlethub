import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { AlertType, ScraperStatus, ScraperType, StockStatus, SyncFrequency } from "@prisma/client";

import { prisma } from "../src/config/prisma.js";
import { priceMonitorQueue, syncSchedulerQueue } from "../src/config/bullmq.js";
import { startImportWorker } from "../src/modules/imports/import-queue.js";
import { importAnalytics } from "../src/modules/monitoring/import-analytics.js";
import {
  closeMonitoringQueueInfrastructure,
  enqueueSyncRun,
  startPriceMonitorWorker,
  startSyncSchedulerWorker,
} from "../src/modules/monitoring/monitoring-queue.js";
import { syncScheduler } from "../src/modules/monitoring/sync-scheduler.js";
import { scrapersService } from "../src/modules/scrapers/scrapers.service.js";

const TEST_SOURCE_PREFIX = "Test Monitoring Source";
const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");

test.after(async () => {
  await prisma.$disconnect();
});

async function loadFixture(name: string): Promise<string> {
  return readFile(resolve(FIXTURE_DIR, name), "utf8");
}

async function withSequentialMockedFetch<T>(responses: string[], callback: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  let index = 0;

  globalThis.fetch = async () =>
    new Response(responses[Math.min(index++, responses.length - 1)], {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function cleanup(): Promise<void> {
  await prisma.alert.deleteMany({
    where: {
      message: {
        contains: TEST_SOURCE_PREFIX,
      },
    },
  });

  await prisma.stockChange.deleteMany({
    where: {
      product: {
        sourceStore: {
          startsWith: TEST_SOURCE_PREFIX,
        },
      },
    },
  });

  await prisma.priceChange.deleteMany({
    where: {
      product: {
        sourceStore: {
          startsWith: TEST_SOURCE_PREFIX,
        },
      },
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { scraperRun: { source: { name: { startsWith: TEST_SOURCE_PREFIX } } } },
        { importJob: { scraperRun: { source: { name: { startsWith: TEST_SOURCE_PREFIX } } } } },
      ],
    },
  });

  await prisma.importLog.deleteMany({
    where: {
      job: {
        scraperRun: {
          source: {
            name: {
              startsWith: TEST_SOURCE_PREFIX,
            },
          },
        },
      },
    },
  });

  await prisma.importSnapshot.deleteMany({
    where: {
      job: {
        scraperRun: {
          source: {
            name: {
              startsWith: TEST_SOURCE_PREFIX,
            },
          },
        },
      },
    },
  });

  await prisma.priceHistory.deleteMany({
    where: {
      product: {
        sourceStore: {
          startsWith: TEST_SOURCE_PREFIX,
        },
      },
    },
  });

  await prisma.productImage.deleteMany({
    where: {
      product: {
        sourceStore: {
          startsWith: TEST_SOURCE_PREFIX,
        },
      },
    },
  });

  await prisma.product.deleteMany({
    where: {
      sourceStore: {
        startsWith: TEST_SOURCE_PREFIX,
      },
    },
  });

  await prisma.importJob.deleteMany({
    where: {
      scraperRun: {
        source: {
          name: {
            startsWith: TEST_SOURCE_PREFIX,
          },
        },
      },
    },
  });

  await prisma.scraperArtifact.deleteMany({
    where: {
      scraperRun: {
        source: {
          name: {
            startsWith: TEST_SOURCE_PREFIX,
          },
        },
      },
    },
  });

  await prisma.scraperRun.deleteMany({
    where: {
      source: {
        name: {
          startsWith: TEST_SOURCE_PREFIX,
        },
      },
    },
  });

  await prisma.syncRun.deleteMany({
    where: {
      source: {
        name: {
          startsWith: TEST_SOURCE_PREFIX,
        },
      },
    },
  });

  await prisma.scraperSource.deleteMany({
    where: {
      name: {
        startsWith: TEST_SOURCE_PREFIX,
      },
    },
  });
}

async function waitForCompletedSyncCount(sourceId: string, expectedCount: number) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const runs = await prisma.syncRun.findMany({
      where: { sourceId },
      orderBy: { createdAt: "desc" },
    });

    if (runs.length >= expectedCount && runs[0]?.status === "COMPLETED") {
      return runs;
    }

    if (runs.length >= expectedCount && runs[0]?.status === "FAILED") {
      throw new Error(`Sync run failed for source ${sourceId}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for ${expectedCount} completed sync runs.`);
}

test("monitoring infrastructure detects price and stock changes, creates alerts, schedules syncs, processes queues, and calculates analytics", async () => {
  await cleanup();
  startImportWorker();
  startSyncSchedulerWorker();
  startPriceMonitorWorker();

  const initialHtml = await loadFixture("nike-outlet-sale.fixture.html");
  const updatedHtml = await loadFixture("nike-outlet-sale-updated.fixture.html");

  try {
    const source = await scrapersService.createSource({
      name: `${TEST_SOURCE_PREFIX} Nike Outlet`,
      website: "https://www.nike.com/w/sale-3yaep",
      status: ScraperStatus.ACTIVE,
      scraperType: ScraperType.PLAYWRIGHT,
      connectorKey: "nike-outlet",
      configuration: {
        headless: true,
        timeoutMs: 30000,
        retryAttempts: 2,
        requestLimiter: {
          maxRequestsPerMinute: 30,
          maxConcurrentPages: 1,
        },
      },
    });

    await prisma.scraperSource.update({
      where: { id: source.id },
      data: {
        syncFrequency: SyncFrequency.HOURLY,
      },
    });

    await syncScheduler.syncSchedules();
    const repeatableJobs = await syncSchedulerQueue.getRepeatableJobs();
    assert.ok(repeatableJobs.some((job) => job.key.includes(source.id)));

    await withSequentialMockedFetch([initialHtml, updatedHtml], async () => {
      await enqueueSyncRun({
        sourceId: source.id,
        trigger: "manual",
      });
      await waitForCompletedSyncCount(source.id, 1);

      await enqueueSyncRun({
        sourceId: source.id,
        trigger: "manual",
      });
      await waitForCompletedSyncCount(source.id, 2);
    });

    const syncRuns = await prisma.syncRun.findMany({
      where: { sourceId: source.id },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(syncRuns.length, 2);
    assert.ok(syncRuns.every((run) => run.status === "COMPLETED"));
    assert.equal(syncRuns[1]?.productsChecked, 2);
    assert.equal(syncRuns[1]?.productsChanged, 3);

    const products = await prisma.product.findMany({
      where: {
        sourceStore: source.name,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
      select: {
        name: true,
        stockStatus: true,
      },
    });

    const jacket = products.find((product) => product.name === "Nike Dri-FIT ADV Running Jacket");
    assert.equal(jacket?.stockStatus, StockStatus.OUT_OF_STOCK);

    const priceChanges = await prisma.priceChange.findMany({
      where: {
        product: {
          sourceStore: source.name,
        },
      },
    });
    assert.equal(priceChanges.length, 2);

    const stockChanges = await prisma.stockChange.findMany({
      where: {
        product: {
          sourceStore: source.name,
        },
      },
    });
    assert.equal(stockChanges.length, 1);
    assert.equal(stockChanges[0]?.newStatus, StockStatus.OUT_OF_STOCK);

    const alerts = await prisma.alert.findMany({
      where: {
        message: {
          contains: source.name,
        },
      },
      orderBy: { createdAt: "asc" },
    });
    assert.deepEqual(
      alerts.map((alert) => alert.type).sort(),
      [AlertType.PRICE_DROP, AlertType.STOCK_CHANGE].sort(),
    );

    const analytics = await importAnalytics.getSummary(source.name);
    assert.equal(analytics.importedProducts, 3);
    assert.equal(analytics.activeProducts, 2);
    assert.equal(analytics.priceChangeCount, 2);
    assert.ok(analytics.averageDiscount > 0);
    assert.ok(analytics.topDeals.length >= 2);

    const syncQueueCounts = await syncSchedulerQueue.getJobCounts("completed", "failed", "waiting", "active");
    const priceQueueCounts = await priceMonitorQueue.getJobCounts("completed", "failed", "waiting", "active");
    assert.ok((syncQueueCounts.completed ?? 0) >= 2);
    assert.ok((priceQueueCounts.completed ?? 0) >= 2);
  } finally {
    await cleanup();
    await closeMonitoringQueueInfrastructure();
  }
});
