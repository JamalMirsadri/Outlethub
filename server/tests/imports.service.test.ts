import assert from "node:assert/strict";
import test from "node:test";

import { ImportSourceType } from "@prisma/client";

import { prisma } from "../src/config/prisma.js";
import { importManager } from "../src/modules/imports/import-manager.js";
import {
  closeImportQueueInfrastructure,
  enqueueImportJob,
  startImportWorker,
} from "../src/modules/imports/import-queue.js";
import { importsService } from "../src/modules/imports/imports.service.js";

const TEST_SOURCE_PREFIX = "Test Import";
const TEST_BRAND_JSON = "Test Import Brand";
const TEST_CATEGORY_JSON = "Test Import Category";
const TEST_BRAND_XML = "Test Import XML Brand";
const TEST_CATEGORY_XML = "Test Import XML Category";

async function cleanup(): Promise<void> {
  await prisma.importLog.deleteMany({
    where: {
      job: {
        OR: [
          { source: { name: { startsWith: TEST_SOURCE_PREFIX } } },
          { triggerMode: { in: ["upload", "manual", "schedule"] } },
        ],
      },
    },
  });

  await prisma.importSnapshot.deleteMany({
    where: {
      job: {
        OR: [
          { source: { name: { startsWith: TEST_SOURCE_PREFIX } } },
          { triggerMode: { in: ["upload", "manual", "schedule"] } },
        ],
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
      source: {
        name: {
          startsWith: TEST_SOURCE_PREFIX,
        },
      },
    },
  });

  await prisma.importSource.deleteMany({
    where: {
      name: {
        startsWith: TEST_SOURCE_PREFIX,
      },
    },
  });

  await prisma.importRule.deleteMany({
    where: {
      name: {
        startsWith: TEST_SOURCE_PREFIX,
      },
    },
  });

  await prisma.brand.deleteMany({
    where: {
      name: {
        in: [TEST_BRAND_JSON, TEST_BRAND_XML],
      },
    },
  });

  await prisma.category.deleteMany({
    where: {
      name: {
        in: [TEST_CATEGORY_JSON, TEST_CATEGORY_XML],
      },
    },
  });
}

async function waitForJobCompletion(jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
    });

    if (job?.status === "COMPLETED" || job?.status === "FAILED") {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for job ${jobId} to finish.`);
}

test("import engine covers JSON/XML upload, normalization, deal detection, queue processing, and logs", async () => {
  await cleanup();
  startImportWorker();

  try {
    await importsService.createRule({
      name: `${TEST_SOURCE_PREFIX} Rule`,
      minDiscount: 0,
      allowedBrands: [],
      allowedCategories: [],
      isActive: true,
    });

    const jsonSource = await importsService.createSource({
      name: `${TEST_SOURCE_PREFIX} JSON`,
      sourceType: ImportSourceType.JSON_FEED,
      syncFrequency: "MANUAL",
      configuration: {
        sourceStore: `${TEST_SOURCE_PREFIX} JSON Store`,
      },
    });

    const jsonJob = await importManager.createJob({
      sourceId: jsonSource.id,
      triggerMode: "upload",
    });

    await enqueueImportJob({
      jobId: jsonJob.id,
      mode: "upload",
      sourceId: jsonSource.id,
      triggerMode: "upload",
      upload: {
        sourceId: jsonSource.id,
        format: "json",
        sourceType: ImportSourceType.JSON_FEED,
        name: `${TEST_SOURCE_PREFIX} JSON Store`,
        content: JSON.stringify({
          items: [
            {
              name: "Test Import Queue Tee",
              brand: TEST_BRAND_JSON,
              category: TEST_CATEGORY_JSON,
              price: 39,
              oldPrice: 99,
              imageUrl: "https://example.com/test-import-tee.jpg",
              sourceUrl: "https://example.com/test-import-tee",
            },
          ],
        }),
      },
    });

    await waitForJobCompletion(jsonJob.id);

    const completedJsonJob = await prisma.importJob.findUniqueOrThrow({
      where: { id: jsonJob.id },
    });
    assert.equal(completedJsonJob.status, "COMPLETED");
    assert.equal(completedJsonJob.processedCount, 1);
    assert.equal(completedJsonJob.importedCount, 1);

    const importedJsonProduct = await prisma.product.findFirstOrThrow({
      where: {
        sourceStore: `${TEST_SOURCE_PREFIX} JSON Store`,
      },
    });
    assert.equal(importedJsonProduct.dealLevel, "HOT");
    assert.ok(importedJsonProduct.contentHash);

    const jsonPriceHistory = await prisma.priceHistory.count({
      where: { productId: importedJsonProduct.id },
    });
    assert.equal(jsonPriceHistory, 1);

    const jsonLogs = await prisma.importLog.findMany({
      where: { jobId: jsonJob.id },
    });
    assert.ok(jsonLogs.length >= 2);

    const jsonSnapshots = await prisma.importSnapshot.findMany({
      where: { jobId: jsonJob.id },
    });
    assert.equal(jsonSnapshots[0]?.productCount, 1);

    const duplicateJob = await importManager.createJob({
      sourceId: jsonSource.id,
      triggerMode: "upload",
    });

    await enqueueImportJob({
      jobId: duplicateJob.id,
      mode: "upload",
      sourceId: jsonSource.id,
      triggerMode: "upload",
      upload: {
        sourceId: jsonSource.id,
        format: "json",
        sourceType: ImportSourceType.JSON_FEED,
        name: `${TEST_SOURCE_PREFIX} JSON Store`,
        content: JSON.stringify({
          items: [
            {
              name: "Test Import Queue Tee",
              brand: TEST_BRAND_JSON,
              category: TEST_CATEGORY_JSON,
              price: 39,
              oldPrice: 99,
              imageUrl: "https://example.com/test-import-tee.jpg",
              sourceUrl: "https://example.com/test-import-tee",
            },
          ],
        }),
      },
    });

    await waitForJobCompletion(duplicateJob.id);

    const duplicatePriceHistory = await prisma.priceHistory.count({
      where: { productId: importedJsonProduct.id },
    });
    assert.equal(duplicatePriceHistory, 1);

    const xmlSource = await importsService.createSource({
      name: `${TEST_SOURCE_PREFIX} XML`,
      sourceType: ImportSourceType.XML_FEED,
      syncFrequency: "MANUAL",
      configuration: {
        sourceStore: `${TEST_SOURCE_PREFIX} XML Store`,
      },
    });

    const xmlJob = await importManager.createJob({
      sourceId: xmlSource.id,
      triggerMode: "upload",
    });

    await enqueueImportJob({
      jobId: xmlJob.id,
      mode: "upload",
      sourceId: xmlSource.id,
      triggerMode: "upload",
      upload: {
        sourceId: xmlSource.id,
        format: "xml",
        sourceType: ImportSourceType.XML_FEED,
        name: `${TEST_SOURCE_PREFIX} XML Store`,
        content: `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <products>
    <product>
      <name>Test Import XML Tote</name>
      <brand>${TEST_BRAND_XML}</brand>
      <category>${TEST_CATEGORY_XML}</category>
      <price>120</price>
      <oldPrice>240</oldPrice>
      <imageUrl>https://example.com/test-import-xml.jpg</imageUrl>
      <sourceUrl>https://example.com/test-import-xml</sourceUrl>
    </product>
  </products>
</catalog>`,
      },
    });

    await waitForJobCompletion(xmlJob.id);

    const completedXmlJob = await prisma.importJob.findUniqueOrThrow({
      where: { id: xmlJob.id },
    });
    assert.equal(completedXmlJob.status, "COMPLETED");
    assert.equal(completedXmlJob.processedCount, 1);

    const importedXmlProduct = await prisma.product.findFirstOrThrow({
      where: {
        sourceStore: `${TEST_SOURCE_PREFIX} XML Store`,
      },
    });
    assert.equal(importedXmlProduct.dealLevel, "GOOD");
  } finally {
    await cleanup();
    await closeImportQueueInfrastructure();
    await prisma.$disconnect();
  }
});
