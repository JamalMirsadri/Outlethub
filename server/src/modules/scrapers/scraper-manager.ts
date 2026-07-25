import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ConnectorRunStatus, ImportJobStatus, Prisma, ProductSource, ScraperArtifactType, ScraperRunStatus, type ScraperSource } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { browserManager } from "./browser/browser-manager.js";
import type { BrowserManagerConfig } from "./browser/browser-manager.js";
import type { RequestLimiterConfig } from "./contracts/browser-adapter.js";
import { importManager } from "../imports/import-manager.js";
import { scraperRegistry } from "./scraper-registry.js";

const DEBUG_ENV_PATH = ".dbg/nike-import-empty-catalog.env";
const DEBUG_SERVER_FALLBACK_URL = "http://127.0.0.1:7777/event";
const DEBUG_SESSION_FALLBACK_ID = "nike-import-empty-catalog";

function shouldReportSprinterSource(source: ScraperSource) {
  const sourceName = source.name.toLowerCase();
  const website = (source.website ?? "").toLowerCase();
  const connectorKey = source.connectorKey.toLowerCase();
  return (
    sourceName.includes("sprinter") ||
    sourceName.includes("sport zone") ||
    sourceName.includes("nike") ||
    website.includes("sprinter") ||
    website.includes("nike") ||
    connectorKey.includes("nike")
  );
}

function reportSprinterDebugEvent(
  hypothesisId: "A" | "B" | "C" | "D" | "E",
  location: string,
  msg: string,
  data: Record<string, unknown>,
) {
  let debugServerUrl = DEBUG_SERVER_FALLBACK_URL;
  let debugSessionId = DEBUG_SESSION_FALLBACK_ID;

  try {
    const envContent = readFileSync(DEBUG_ENV_PATH, "utf8");
    debugServerUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
    debugSessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId;
  } catch {
    // Ignore debug env read failures and use fallback values.
  }

  void fetch(debugServerUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId: "pre-fix",
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
    }),
  }).catch(() => undefined);
}

interface ScraperSourceConfiguration {
  headless?: boolean;
  timeoutMs?: number;
  retryAttempts?: number;
  userAgent?: string;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  } | null;
  requestLimiter?: RequestLimiterConfig | null;
}

interface ScraperRunStats {
  productsFound: number;
  discoveredCount: number;
  fetchedCount: number;
  normalizedCount: number;
  validatedCount: number;
  productsImported: number;
  productsUpdated: number;
  unchangedCount: number;
  failedCount: number;
}

function parseConfiguration(configuration: Prisma.JsonValue | null): ScraperSourceConfiguration | null {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return null;
  }

  return configuration as unknown as ScraperSourceConfiguration;
}

function buildBrowserManagerConfig(source: ScraperSource): BrowserManagerConfig {
  const configuration = parseConfiguration(source.configuration);

  return {
    scraperType: source.scraperType,
    headless: configuration?.headless ?? true,
    timeoutMs: configuration?.timeoutMs ?? 30000,
    retryAttempts: configuration?.retryAttempts ?? 2,
    userAgent: configuration?.userAgent,
    proxy: configuration?.proxy ?? null,
    requestLimiter: configuration?.requestLimiter ?? null,
  };
}

async function createScraperArtifact(scraperRunId: string, type: ScraperArtifactType, filename: string, payload: unknown) {
  const artifactDirectory = join(process.cwd(), ".local-services", "scraper-artifacts", scraperRunId);
  await mkdir(artifactDirectory, { recursive: true });

  const filePath = join(artifactDirectory, filename);
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

  return prisma.scraperArtifact.create({
    data: {
      scraperRunId,
      type,
      filePath,
    },
  });
}

export class ScraperManager {
  public async createRun(input: { sourceId: string }) {
    const source = await prisma.scraperSource.findUnique({
      where: { id: input.sourceId },
    });

    if (!source) {
      throw new ApiError(404, "Scraper source not found.");
    }

    const run = await prisma.scraperRun.create({
      data: {
        sourceId: input.sourceId,
        status: ScraperRunStatus.PENDING,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: "SCRAPER_RUN_CREATED",
        entityType: "ScraperRun",
        entityId: run.id,
        scraperRunId: run.id,
        metadata: {
          sourceId: source.id,
          connectorKey: source.connectorKey,
        },
      },
    });

    return run;
  }

  public async executeRun(runId: string) {
    const run = await prisma.scraperRun.findUnique({
      where: { id: runId },
      include: {
        source: {
          include: {
            connectorConfiguration: {
              include: {
                brandSource: true,
              },
            },
          },
        },
      },
    });

    if (!run) {
      throw new ApiError(404, "Scraper run not found.");
    }

    const source = run.source;
    const browserConfig = buildBrowserManagerConfig(source);

    const startedAt = new Date();

    await prisma.scraperRun.update({
      where: { id: run.id },
      data: {
        status: ScraperRunStatus.RUNNING,
        startedAt,
      },
    });

    const connectorRun = source.connectorConfiguration
      ? await prisma.connectorRun.create({
          data: {
            connectorConfigurationId: source.connectorConfiguration.id,
            brandSourceId: source.connectorConfiguration.brandSourceId,
            scraperSourceId: source.id,
            scraperRunId: run.id,
            status: ConnectorRunStatus.RUNNING,
            triggerMode: "scraper",
            startedAt,
          },
        })
      : null;

    const connectorContext = {
      source,
      browserManager,
      runId: run.id,
    };

    try {
      const executionResult = await scraperRegistry.executeConnector(source.connectorKey, connectorContext);
      // #region debug-point C:scraper-execution-result
      if (shouldReportSprinterSource(source)) {
        reportSprinterDebugEvent("C", "scraper-manager:executeRun:executionResult", "[DEBUG] Scraper connector execution completed before import.", {
          runId: run.id,
          sourceId: source.id,
          sourceName: source.name,
          productsFound: executionResult.productsFound,
          rawProductsCount: executionResult.rawProducts.length,
          normalizedProductsCount: executionResult.normalizedProducts.length,
          sampleRawProducts: executionResult.rawProducts.slice(0, 5),
          firstFiveNormalized: executionResult.normalizedProducts.slice(0, 5).map((product) => ({
            name: product.name,
            sourceUrl: product.sourceUrl,
            price: product.price,
            oldPrice: product.oldPrice,
            imageUrl: product.imageUrl,
            brand: product.brand,
            category: product.category,
          })),
        });
      }
      // #endregion

      await createScraperArtifact(run.id, ScraperArtifactType.JSON_DUMP, "raw-products.json", executionResult.rawProducts);
      await createScraperArtifact(run.id, ScraperArtifactType.JSON_DUMP, "normalized-products.json", executionResult.normalizedProducts);

      const importJob = await importManager.createJob({
        scraperRunId: run.id,
        connectorRunId: connectorRun?.id,
        triggerMode: "scraper",
      });

      await prisma.importJob.update({
        where: { id: importJob.id },
        data: {
          status: ImportJobStatus.RUNNING,
          startedAt: new Date(),
          errorMessage: null,
          errorPayload: Prisma.JsonNull,
        },
      });

      await prisma.importSnapshot.create({
        data: {
          jobId: importJob.id,
          productCount: executionResult.normalizedProducts.length,
        },
      });

      const importStats = await importManager.importNormalizedProducts(importJob.id, executionResult.normalizedProducts, {
        productSourceType: ProductSource.SCRAPER,
      }, {
        discoveredCount: executionResult.observability?.discoveredCount ?? executionResult.productsFound,
        fetchedCount: executionResult.observability?.fetchedCount ?? executionResult.rawProducts.length,
        normalizedCount: executionResult.observability?.normalizedCount ?? executionResult.rawProducts.length,
        validatedCount: executionResult.observability?.validatedCount ?? executionResult.normalizedProducts.length,
      });
      // #region debug-point E:import-stats
      if (shouldReportSprinterSource(source)) {
        reportSprinterDebugEvent("E", "scraper-manager:executeRun:importStats", "[DEBUG] Import manager returned stats for scraper run.", {
          runId: run.id,
          importJobId: importJob.id,
          productsFound: executionResult.productsFound,
          importedCount: importStats.importedCount,
          updatedCount: importStats.updatedCount,
          failedCount: importStats.failedCount,
          processedCount: importStats.processedCount,
          totalCount: importStats.totalCount,
        });
      }
      // #endregion

      await importManager.completeJob(importJob.id, importStats, null, executionResult.normalizedProducts.length);

      const completedAt = new Date();
      const stats: ScraperRunStats = {
        productsFound: executionResult.productsFound,
        discoveredCount: executionResult.observability?.discoveredCount ?? executionResult.productsFound,
        fetchedCount: executionResult.observability?.fetchedCount ?? executionResult.rawProducts.length,
        normalizedCount: executionResult.observability?.normalizedCount ?? executionResult.rawProducts.length,
        validatedCount: executionResult.observability?.validatedCount ?? executionResult.normalizedProducts.length,
        productsImported: importStats.importedCount,
        productsUpdated: importStats.updatedCount,
        unchangedCount: importStats.unchangedCount,
        failedCount: importStats.failedCount,
      };
      const auditMetadata = JSON.parse(
        JSON.stringify({
          connectorKey: source.connectorKey,
          browserHooks: browserManager.getArchitectureHooks(browserConfig),
          stats,
        }),
      ) as Prisma.InputJsonValue;

      await prisma.scraperRun.update({
        where: { id: run.id },
        data: {
          status: ScraperRunStatus.COMPLETED,
          completedAt,
          productsFound: stats.productsFound,
          discoveredCount: stats.discoveredCount,
          fetchedCount: stats.fetchedCount,
          normalizedCount: stats.normalizedCount,
          validatedCount: stats.validatedCount,
          productsImported: stats.productsImported,
          productsUpdated: stats.productsUpdated,
          unchangedCount: stats.unchangedCount,
          failedCount: stats.failedCount,
        },
      });

      if (connectorRun) {
        await prisma.connectorRun.update({
          where: { id: connectorRun.id },
          data: {
            importJobId: importJob.id,
            status: ConnectorRunStatus.COMPLETED,
            strategyUsed: executionResult.observability?.strategyUsed ?? source.scraperType,
            httpStatus: executionResult.observability?.httpStatus ?? null,
            protectionType: executionResult.observability?.protectionType ?? null,
            discoveredCount: stats.discoveredCount,
            fetchedCount: stats.fetchedCount,
            normalizedCount: stats.normalizedCount,
            validatedCount: stats.validatedCount,
            importedCount: stats.productsImported,
            updatedCount: stats.productsUpdated,
            unchangedCount: stats.unchangedCount,
            failedCount: stats.failedCount,
            urlsDiscovered: executionResult.observability?.urlsDiscovered ?? stats.discoveredCount,
            urlsProcessed: executionResult.observability?.urlsProcessed ?? stats.fetchedCount,
            duplicateUrlsRemoved: executionResult.observability?.duplicateUrlsRemoved ?? 0,
            urlsSkipped: executionResult.observability?.urlsSkipped ?? 0,
            rawRecordCount: executionResult.observability?.rawRecordCount ?? executionResult.rawProducts.length,
            validationFailureCount: executionResult.observability?.validationFailureCount ?? 0,
            rejectedCount: importStats.rejectedCount,
            diagnosticsPayload: executionResult.observability
              ? ({
                  strategyUsed: executionResult.observability.strategyUsed,
                  httpStatus: executionResult.observability.httpStatus,
                  protectionType: executionResult.observability.protectionType,
                } satisfies Prisma.InputJsonValue)
              : undefined,
            discoveryPayload: executionResult.observability?.discovery as Prisma.InputJsonValue | undefined,
            normalizationPayload: executionResult.observability?.normalization as Prisma.InputJsonValue | undefined,
            upsertPayload: ({
              created: importStats.importedCount,
              updated: importStats.updatedCount,
              unchanged: importStats.unchangedCount,
              rejected: importStats.rejectedCount,
              failed: importStats.failedCount,
            } satisfies Prisma.InputJsonValue),
            completedAt,
            durationMs: startedAt ? completedAt.getTime() - startedAt.getTime() : null,
          },
        });
      }

      await prisma.scraperSource.update({
        where: { id: source.id },
        data: {
          lastRunAt: completedAt,
          runCount: {
            increment: 1,
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: "SYSTEM",
          action: "SCRAPER_RUN_COMPLETED",
          entityType: "ScraperRun",
          entityId: run.id,
          scraperRunId: run.id,
          importJobId: importJob.id,
          metadata: auditMetadata,
        },
      });

      return {
        runId: run.id,
        importJobId: importJob.id,
        sourceId: source.id,
        sourceStore: source.name,
        importedProducts: executionResult.normalizedProducts.map((product) => ({
          sourceProductId: product.sourceProductId,
          sourceUrl: product.sourceUrl,
        })),
        ...stats,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scraper run failed.";
      const payload = error instanceof Error ? { name: error.name, message: error.message } : { error };

      await prisma.scraperRun.update({
        where: { id: run.id },
        data: {
          status: ScraperRunStatus.FAILED,
          completedAt: new Date(),
          errorMessage: message,
          errorPayload: payload as Prisma.InputJsonValue,
        },
      });

      if (connectorRun) {
        await prisma.connectorRun.update({
          where: { id: connectorRun.id },
          data: {
            status: ConnectorRunStatus.FAILED,
            completedAt: new Date(),
            errorMessage: message,
            durationMs: startedAt ? new Date().getTime() - startedAt.getTime() : null,
          },
        });
      }

      await prisma.scraperSource.update({
        where: { id: source.id },
        data: {
          status: "ERROR",
          runCount: {
            increment: 1,
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: "SYSTEM",
          action: "SCRAPER_RUN_FAILED",
          entityType: "ScraperRun",
          entityId: run.id,
          scraperRunId: run.id,
          metadata: payload as Prisma.InputJsonValue,
        },
      });

      throw error;
    } finally {
      await browserManager.shutdown(source.scraperType);
    }
  }
}

export const scraperManager = new ScraperManager();
