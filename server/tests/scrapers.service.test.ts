import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ScraperStatus, ScraperType } from "@prisma/client";

import { prisma } from "../src/config/prisma.js";
import { startImportWorker } from "../src/modules/imports/import-queue.js";
import { nikeOutletConnector } from "../src/modules/scrapers/connectors/nike/nike-outlet.connector.js";
import { closeScraperQueueInfrastructure, enqueueScraperRun, startScraperWorker } from "../src/modules/scrapers/scraper-queue.js";
import { scraperManager } from "../src/modules/scrapers/scraper-manager.js";
import { scraperRegistry } from "../src/modules/scrapers/scraper-registry.js";
import { scrapersService } from "../src/modules/scrapers/scrapers.service.js";

const TEST_SOURCE_PREFIX = "Test Scraper Source";
const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");

test.after(async () => {
  await prisma.$disconnect();
});

async function loadFixture(name: string): Promise<string> {
  return readFile(resolve(FIXTURE_DIR, name), "utf8");
}

async function withMockedFetch<T>(html: string, callback: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(html, {
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

  await prisma.scraperSource.deleteMany({
    where: {
      name: {
        startsWith: TEST_SOURCE_PREFIX,
      },
    },
  });
}

async function waitForScraperRunCompletion(runId: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const run = await prisma.scraperRun.findUnique({
      where: { id: runId },
    });

    if (run?.status === "COMPLETED" || run?.status === "FAILED") {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for scraper run ${runId} to finish.`);
}

test("scraper framework registers connectors, executes queue runs, and integrates with the import engine", async () => {
  await cleanup();
  startImportWorker();
  startScraperWorker();

  try {
    const connector = scraperRegistry.getConnector("demo");
    assert.equal(connector.key, "demo");

    const source = await scrapersService.createSource({
      name: `${TEST_SOURCE_PREFIX} Demo`,
      website: "https://demo.local",
      status: ScraperStatus.ACTIVE,
      scraperType: ScraperType.PLAYWRIGHT,
      connectorKey: "demo",
      configuration: {
        headless: true,
        timeoutMs: 30000,
        retryAttempts: 2,
        requestLimiter: {
          maxRequestsPerMinute: 60,
          maxConcurrentPages: 2,
        },
      },
    });

    const run = await scraperManager.createRun({ sourceId: source.id });
    await enqueueScraperRun({ runId: run.id });
    await waitForScraperRunCompletion(run.id);

    const completedRun = await prisma.scraperRun.findUniqueOrThrow({
      where: { id: run.id },
      include: {
        artifacts: true,
        importJobs: true,
      },
    });

    assert.equal(completedRun.status, "COMPLETED");
    assert.equal(completedRun.productsFound, 2);
    assert.equal(completedRun.productsImported, 2);
    assert.ok(completedRun.artifacts.length >= 2);
    assert.equal(completedRun.importJobs.length, 1);

    const importedProducts = await prisma.product.findMany({
      where: {
        sourceStore: `${TEST_SOURCE_PREFIX} Demo`,
      },
      orderBy: { createdAt: "asc" },
    });

    assert.equal(importedProducts.length, 2);
    assert.ok(importedProducts.every((product) => product.sourceType === "SCRAPER"));

    const linkedImportJob = completedRun.importJobs[0];
    assert.equal(linkedImportJob.importedCount, 2);

    const listedRuns = await scrapersService.listRuns({ limit: 20 });
    assert.equal(listedRuns[0]?.id, run.id);
  } finally {
    await cleanup();
    await closeScraperQueueInfrastructure();
  }
});

test("nike outlet connector extracts and normalizes public sale products", async () => {
  const html = await loadFixture("nike-outlet-sale.fixture.html");
  const connector = scraperRegistry.getConnector("nike-outlet");

  assert.equal(connector.key, "nike-outlet");

  await withMockedFetch(html, async () => {
    const context = {
      source: {
        id: "test-nike-source",
        name: `${TEST_SOURCE_PREFIX} Nike Outlet`,
        website: "https://www.nike.com/w/sale-3yaep",
        status: ScraperStatus.ACTIVE,
        scraperType: ScraperType.PLAYWRIGHT,
        connectorKey: "nike-outlet",
        configuration: null,
        lastRunAt: null,
        runCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      browserManager: {} as never,
      runId: "test-nike-run",
    };

    await nikeOutletConnector.initialize(context);

    try {
      const rawProducts = await nikeOutletConnector.run(context);
      const normalizedProducts = await nikeOutletConnector.normalize(rawProducts, context);

      assert.equal(rawProducts.length, 3);
      assert.deepEqual(
        rawProducts.map((product) => product.discountPercent),
        [50, 60, 70],
      );
      assert.equal(normalizedProducts.length, 3);
      assert.equal(normalizedProducts[0]?.brand, "Nike");
      assert.equal(normalizedProducts[0]?.category, "Trail Running Shoes");
      assert.equal(normalizedProducts[0]?.sourceStore, `${TEST_SOURCE_PREFIX} Nike Outlet`);
      assert.equal(normalizedProducts[0]?.price, 75);
      assert.equal(normalizedProducts[0]?.oldPrice, 150);
      assert.equal(normalizedProducts[2]?.discountPercent, 70);
      assert.ok(normalizedProducts.every((product) => product.sourceUrl?.startsWith("https://www.nike.com/t/")));
    } finally {
      await nikeOutletConnector.shutdown(context);
    }
  });
});

test("nike outlet connector integrates with the import engine, persists catalog products, and applies deal levels", async () => {
  await cleanup();
  startImportWorker();

  const html = await loadFixture("nike-outlet-sale.fixture.html");

  try {
    await withMockedFetch(html, async () => {
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

      const run = await scraperManager.createRun({ sourceId: source.id });
      const result = await scraperManager.executeRun(run.id);

      assert.equal(result.productsFound, 3);
      assert.equal(result.productsImported, 3);
      assert.equal(result.failedCount, 0);

      const completedRun = await prisma.scraperRun.findUniqueOrThrow({
        where: { id: run.id },
        include: {
          artifacts: true,
          importJobs: true,
        },
      });

      assert.equal(completedRun.status, "COMPLETED");
      assert.equal(completedRun.productsFound, 3);
      assert.equal(completedRun.productsImported, 3);
      assert.ok(completedRun.artifacts.length >= 2);
      assert.equal(completedRun.importJobs[0]?.importedCount, 3);

      const importedProducts = await prisma.product.findMany({
        where: {
          sourceStore: `${TEST_SOURCE_PREFIX} Nike Outlet`,
        },
        orderBy: { createdAt: "asc" },
      });

      assert.equal(importedProducts.length, 3);
      assert.ok(importedProducts.every((product) => product.sourceType === "SCRAPER"));
      assert.deepEqual(
        importedProducts.map((product) => product.dealLevel).sort(),
        ["FEATURED", "GOOD", "HOT"],
      );

      const priceHistoryCount = await prisma.priceHistory.count({
        where: {
          product: {
            sourceStore: `${TEST_SOURCE_PREFIX} Nike Outlet`,
          },
        },
      });

      assert.equal(priceHistoryCount, 3);
    });
  } finally {
    await cleanup();
    await closeScraperQueueInfrastructure();
  }
});

test("scraper framework records error handling when a connector is missing", async () => {
  await cleanup();

  const source = await scrapersService.createSource({
    name: `${TEST_SOURCE_PREFIX} Missing Connector`,
    website: "https://demo.local",
    status: ScraperStatus.ACTIVE,
    scraperType: ScraperType.PLAYWRIGHT,
    connectorKey: "missing-connector",
    configuration: {
      headless: true,
    },
  });

  const run = await scraperManager.createRun({ sourceId: source.id });

  await assert.rejects(async () => {
    await scraperManager.executeRun(run.id);
  });

  const failedRun = await prisma.scraperRun.findUniqueOrThrow({
    where: { id: run.id },
  });

  assert.equal(failedRun.status, "FAILED");
  assert.ok(failedRun.errorMessage);

  await cleanup();
});
