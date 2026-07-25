import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  DealLevel,
  ImportJobStatus,
  ImportLogLevel,
  ImportSourceType,
  Prisma,
  ProductSource,
  ProductStatus,
  StockStatus,
  type ImportSource,
} from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { dealEngine } from "./deal-engine.js";
import type { ImportSourceConfiguration, NormalizedImportProduct } from "./import-normalizer.js";
import {
  mapFailureReason,
  type ImportFailureReason,
  type ImportProductProcessingResult,
  type ImportRunStats,
  validateNormalizedProduct,
} from "./import-observability.js";
import { pricingService } from "../commerce/pricing.service.js";
import { productMonitoringService } from "../monitoring/product-monitoring.service.js";
import { importParserRegistry } from "./parser-registry.js";
import type { uploadImportSchema } from "./imports.schemas.js";
import { z } from "zod";

type UploadImportInput = z.infer<typeof uploadImportSchema>;
const DEBUG_ENV_PATH = ".dbg/nike-import-empty-catalog.env";
const DEBUG_SERVER_FALLBACK_URL = "http://127.0.0.1:7777/event";
const DEBUG_SESSION_FALLBACK_ID = "nike-import-empty-catalog";

export interface QueuedImportPayload {
  jobId: string;
  mode: "source" | "upload";
  sourceId?: string;
  triggerMode: "manual" | "upload" | "schedule";
  upload?: UploadImportInput;
}

interface ResolvedImportContext {
  source: ImportSource | null;
  sourceType: ImportSourceType;
  website: string | null;
  sourceStore: string;
  configuration: ImportSourceConfiguration | null;
  content: string;
  parserMode: "source" | "upload";
  uploadFormat?: "json" | "xml";
}

export interface DirectImportOptions {
  source?: ImportSource | null;
  productSourceType?: ProductSource;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function toDecimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined) {
    return null;
  }

  return new Prisma.Decimal(value);
}

function decimalEquals(
  left: Prisma.Decimal | number | null | undefined,
  right: Prisma.Decimal | number | null | undefined,
): boolean {
  if (left === null || left === undefined) {
    return right === null || right === undefined;
  }

  if (right === null || right === undefined) {
    return false;
  }

  return new Prisma.Decimal(left).equals(new Prisma.Decimal(right));
}

function mapImportSourceTypeToProductSource(sourceType: ImportSourceType): ProductSource {
  switch (sourceType) {
    case ImportSourceType.AWIN:
      return ProductSource.AWIN;
    case ImportSourceType.CJ:
      return ProductSource.CJ;
    case ImportSourceType.SCRAPER:
      return ProductSource.SCRAPER;
    case ImportSourceType.MANUAL:
      return ProductSource.MANUAL;
    default:
      return ProductSource.IMPORT;
  }
}

function parseConfiguration(configuration: Prisma.JsonValue | null): ImportSourceConfiguration | null {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return null;
  }

  return configuration as unknown as ImportSourceConfiguration;
}

async function createImportLog(jobId: string, level: ImportLogLevel, message: string): Promise<void> {
  await prisma.importLog.create({
    data: {
      jobId,
      level,
      message,
    },
  });
}

async function buildUniqueProductSlug(baseValue: string): Promise<string> {
  const baseSlug = slugify(baseValue) || `imported-product-${Date.now()}`;
  let candidate = baseSlug;
  let suffix = 2;

  while (await prisma.product.findUnique({ where: { slug: candidate } })) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function buildProductSku(normalizedProduct: NormalizedImportProduct): string {
  const hash = createHash("sha1")
    .update(
      JSON.stringify({
        sourceProductId: normalizedProduct.sourceProductId,
        sourceUrl: normalizedProduct.sourceUrl,
        sourceStore: normalizedProduct.sourceStore,
        name: normalizedProduct.name,
      }),
    )
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();

  return `IMP-${hash}`;
}

function shouldReportSprinterProduct(normalizedProduct: Pick<NormalizedImportProduct, "sourceStore" | "sourceUrl" | "brand">) {
  const sourceStore = normalizedProduct.sourceStore.toLowerCase();
  const sourceUrl = (normalizedProduct.sourceUrl ?? "").toLowerCase();
  const brand = normalizedProduct.brand.toLowerCase();
  return (
    sourceStore.includes("sprinter") ||
    sourceStore.includes("sport zone") ||
    sourceStore.includes("nike") ||
    sourceUrl.includes("sprinter") ||
    sourceUrl.includes("nike") ||
    brand.includes("sprinter") ||
    brand.includes("nike")
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

async function ensureBrand(name: string): Promise<string> {
  const slug = slugify(name);
  const existing = await prisma.brand.findFirst({
    where: {
      OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }],
    },
  });

  if (existing) {
    return existing.id;
  }

  const brand = await prisma.brand.create({
    data: {
      name,
      slug,
      isActive: true,
    },
  });

  return brand.id;
}

async function ensureCategory(name: string): Promise<string> {
  const slug = slugify(name);
  const existing = await prisma.category.findFirst({
    where: {
      OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }],
    },
  });

  if (existing) {
    return existing.id;
  }

  const category = await prisma.category.create({
    data: {
      name,
      slug,
      sortOrder: 0,
    },
  });

  return category.id;
}

export class ImportManager {
  public async createJob(input: {
    sourceId?: string;
    scraperRunId?: string;
    connectorRunId?: string;
    triggerMode: "manual" | "upload" | "schedule" | "scraper";
  }) {
    const job = await prisma.importJob.create({
      data: {
        sourceId: input.sourceId ?? null,
        scraperRunId: input.scraperRunId ?? null,
        status: ImportJobStatus.PENDING,
        triggerMode: input.triggerMode,
        connectorRun:
          input.connectorRunId !== undefined
            ? {
                connect: { id: input.connectorRunId },
              }
            : undefined,
      },
    });

    await createImportLog(job.id, ImportLogLevel.INFO, `Import job created with trigger ${input.triggerMode}.`);
    return job;
  }

  public async importNormalizedProducts(
    jobId: string,
    normalizedProducts: NormalizedImportProduct[],
    options: DirectImportOptions = {},
    metrics?: Partial<Pick<ImportRunStats, "discoveredCount" | "fetchedCount" | "normalizedCount" | "validatedCount">> & {
      initialResults?: ImportProductProcessingResult[];
    },
  ): Promise<ImportRunStats> {
    return this.processNormalizedProducts(
      jobId,
      options.source ?? null,
      normalizedProducts,
      options.productSourceType,
      metrics,
    );
  }

  public async runJob(payload: QueuedImportPayload) {
    const job = await prisma.importJob.findUnique({
      where: { id: payload.jobId },
      include: {
        source: true,
      },
    });

    if (!job) {
      throw new ApiError(404, "Import job not found.");
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.RUNNING,
        startedAt: new Date(),
        errorMessage: null,
        errorPayload: Prisma.JsonNull,
      },
    });

    await createImportLog(job.id, ImportLogLevel.INFO, "Import job started.");

    try {
      const context = await this.resolveContext(job.source, payload);
      const parser =
        context.parserMode === "upload" && context.uploadFormat
          ? importParserRegistry.getByUploadFormat(context.uploadFormat)
          : importParserRegistry.getBySourceType(context.sourceType);

      await parser.validate({
        sourceType: context.sourceType,
        content: context.content,
        configuration: context.configuration,
        sourceStore: context.sourceStore,
        website: context.website,
      });

      const parsedRecords = await parser.parse({
        sourceType: context.sourceType,
        content: context.content,
        configuration: context.configuration,
        sourceStore: context.sourceStore,
        website: context.website,
      });

      await prisma.importSnapshot.create({
        data: {
          jobId: job.id,
          productCount: parsedRecords.length,
        },
      });

      await createImportLog(job.id, ImportLogLevel.INFO, `Parsed ${parsedRecords.length} records from import payload.`);

      const normalizedProducts = await parser.normalize(parsedRecords, {
        configuration: context.configuration,
        sourceStore: context.sourceStore,
        website: context.website,
      });
      const validatedProducts: NormalizedImportProduct[] = [];
      const validationFailures: ImportProductProcessingResult[] = [];

      normalizedProducts.forEach((product, index) => {
        const failures = validateNormalizedProduct(product);
        if (failures.length === 0) {
          validatedProducts.push(product);
          return;
        }

        failures.forEach((reason) => {
          validationFailures.push({
            status: "FAILED",
            failureReason: reason,
            stage: "VALIDATE",
            productName: product.name,
            brand: product.brand,
            category: product.category,
            sourceUrl: product.sourceUrl,
            imageUrl: product.imageUrl,
            currentPrice: product.price,
            oldPrice: product.oldPrice,
            existingContentHash: null,
            newContentHash: product.contentHash,
            metadata: { index },
          });
        });
      });

      // #region debug-point B:validation-summary
      if (normalizedProducts.some((product) => shouldReportSprinterProduct(product))) {
        reportSprinterDebugEvent("B", "import-manager:runJob:validation-summary", "[DEBUG] Validation completed for normalized products.", {
          jobId: job.id,
          parsedCount: parsedRecords.length,
          normalizedCount: normalizedProducts.length,
          validatedCount: validatedProducts.length,
          rejectedCount: validationFailures.length,
          sampleValidationErrors: validationFailures.slice(0, 10).map((failure) => ({
            failureReason: failure.failureReason,
            stage: failure.stage,
            productName: failure.productName,
            brand: failure.brand,
            category: failure.category,
            sourceUrl: failure.sourceUrl,
            imageUrl: failure.imageUrl,
            metadata: failure.metadata,
          })),
        });
      }
      // #endregion

      const stats = await this.processNormalizedProducts(job.id, job.source, validatedProducts, undefined, {
        discoveredCount: parsedRecords.length,
        fetchedCount: parsedRecords.length,
        normalizedCount: normalizedProducts.length,
        validatedCount: validatedProducts.length,
        initialResults: validationFailures,
      });
      await this.completeJob(job.id, stats, job.source?.id ?? null, normalizedProducts.length);
      return stats;
    } catch (error) {
      await this.failJob(job.id, error);
      throw error;
    }
  }

  public async completeJob(
    jobId: string,
    stats: ImportRunStats,
    sourceId: string | null,
    snapshotProductCount: number,
  ): Promise<void> {
    const completedAt = new Date();

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: ImportJobStatus.COMPLETED,
        completedAt,
        totalCount: stats.totalCount,
        discoveredCount: stats.discoveredCount,
        fetchedCount: stats.fetchedCount,
        normalizedCount: stats.normalizedCount,
        validatedCount: stats.validatedCount,
        processedCount: stats.processedCount,
        importedCount: stats.importedCount,
        updatedCount: stats.updatedCount,
        unchangedCount: stats.unchangedCount,
        failedCount: stats.failedCount,
      },
    });

    if (sourceId) {
      await prisma.importSource.update({
        where: { id: sourceId },
        data: {
          lastSyncAt: completedAt,
          productCount: snapshotProductCount,
        },
      });
    }

    await createImportLog(
      jobId,
      ImportLogLevel.INFO,
      `Import job completed. Imported ${stats.importedCount}, updated ${stats.updatedCount}, unchanged ${stats.unchangedCount}, failed ${stats.failedCount}.`,
    );
  }

  public async failJob(jobId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : "Import job failed.";
    const payload = error instanceof Error ? { name: error.name, message: error.message } : { error };

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: ImportJobStatus.FAILED,
        completedAt: new Date(),
        errorMessage: message,
        errorPayload: payload as Prisma.InputJsonValue,
      },
    });

    await createImportLog(jobId, ImportLogLevel.ERROR, message);
  }

  private async resolveContext(source: ImportSource | null, payload: QueuedImportPayload): Promise<ResolvedImportContext> {
    if (payload.mode === "upload" && payload.upload) {
      const sourceType =
        payload.upload.sourceType ??
        (payload.upload.format === "xml" ? ImportSourceType.XML_FEED : ImportSourceType.JSON_FEED);

      return {
        source,
        sourceType,
        website: payload.upload.website ?? source?.website ?? null,
        sourceStore: payload.upload.name ?? source?.name ?? "Admin Upload",
        configuration: (payload.upload.configuration as ImportSourceConfiguration | null | undefined) ?? parseConfiguration(source?.configuration ?? null),
        content: payload.upload.content,
        parserMode: "upload",
        uploadFormat: payload.upload.format,
      };
    }

    if (!source) {
      throw new ApiError(400, "Import source is required for source-based jobs.");
    }

    const configuration = parseConfiguration(source.configuration);
    const feedUrl = configuration?.feedUrl;

    if (!feedUrl) {
      throw new ApiError(400, "Import source is missing configuration.feedUrl.");
    }

    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new ApiError(502, `Failed to fetch import source content (${response.status}).`);
    }

    return {
      source,
      sourceType: source.sourceType,
      website: source.website,
      sourceStore: source.name,
      configuration,
      content: await response.text(),
      parserMode: "source",
    };
  }

  private async processNormalizedProducts(
    jobId: string,
    source: ImportSource | null,
    normalizedProducts: NormalizedImportProduct[],
    productSourceTypeOverride?: ProductSource,
    metrics?: Partial<Pick<ImportRunStats, "discoveredCount" | "fetchedCount" | "normalizedCount" | "validatedCount">> & {
      initialResults?: ImportProductProcessingResult[];
    },
  ): Promise<ImportRunStats> {
    const activeRules = await prisma.importRule.findMany({
      where: { isActive: true },
      orderBy: [{ minDiscount: "desc" }, { createdAt: "asc" }],
    });

    const stats: ImportRunStats = {
      totalCount: (metrics?.normalizedCount ?? normalizedProducts.length) + (metrics?.initialResults?.length ?? 0),
      discoveredCount: metrics?.discoveredCount ?? normalizedProducts.length,
      fetchedCount: metrics?.fetchedCount ?? normalizedProducts.length,
      normalizedCount: metrics?.normalizedCount ?? normalizedProducts.length,
      validatedCount: metrics?.validatedCount ?? normalizedProducts.length,
      processedCount: metrics?.initialResults?.length ?? 0,
      importedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      failedCount: 0,
      rejectedCount: 0,
      results: metrics?.initialResults ? [...metrics.initialResults] : [],
    };

    // #region debug-point B:import-batch-start
    if (normalizedProducts.some((product) => shouldReportSprinterProduct(product))) {
      reportSprinterDebugEvent("B", "import-manager:processNormalizedProducts:start", "[DEBUG] Import manager received normalized Sprinter products.", {
        jobId,
        sourceId: source?.id ?? null,
        totalCount: normalizedProducts.length,
        activeRuleCount: activeRules.length,
        activeRules: activeRules.map((rule) => ({
          minDiscount: rule.minDiscount,
          allowedBrands: rule.allowedBrands,
          allowedCategories: rule.allowedCategories,
        })),
      });
    }
    // #endregion

    for (const [index, normalizedProduct] of normalizedProducts.entries()) {
      stats.processedCount += 1;

      try {
        // #region debug-point B:validation-entry
        if (shouldReportSprinterProduct(normalizedProduct) && index < 5) {
          reportSprinterDebugEvent("B", "import-manager:processNormalizedProducts:entry", "[DEBUG] Evaluating normalized Sprinter product for import.", {
            index,
            jobId,
            name: normalizedProduct.name,
            sourceUrl: normalizedProduct.sourceUrl,
            price: normalizedProduct.price,
            oldPrice: normalizedProduct.oldPrice,
            imageUrl: normalizedProduct.imageUrl,
            brand: normalizedProduct.brand,
            category: normalizedProduct.category,
            discountPercent: normalizedProduct.discountPercent,
            sourceProductId: normalizedProduct.sourceProductId,
          });
        }
        // #endregion
        const matchesRules = this.matchesRules(normalizedProduct, activeRules);
        if (!matchesRules) {
          // #region debug-point B:rule-rejection
          if (shouldReportSprinterProduct(normalizedProduct)) {
            reportSprinterDebugEvent("B", "import-manager:processNormalizedProducts:rule-rejection", "[DEBUG] Sprinter product rejected by import rules.", {
              jobId,
              index,
              name: normalizedProduct.name,
              brand: normalizedProduct.brand,
              category: normalizedProduct.category,
              discountPercent: normalizedProduct.discountPercent,
              activeRules: activeRules.map((rule) => ({
                minDiscount: rule.minDiscount,
                allowedBrands: rule.allowedBrands,
                allowedCategories: rule.allowedCategories,
              })),
            });
          }
          // #endregion
          await createImportLog(
            jobId,
            ImportLogLevel.WARN,
            `Skipped ${normalizedProduct.name} because it did not match any active import rule.`,
          );
          stats.failedCount += 1;
          stats.rejectedCount += 1;
          stats.results.push({
            status: "FAILED",
            failureReason: "RULE_REJECTED",
            stage: "UPSERT",
            productName: normalizedProduct.name,
            brand: normalizedProduct.brand,
            category: normalizedProduct.category,
            sourceUrl: normalizedProduct.sourceUrl,
            imageUrl: normalizedProduct.imageUrl,
            currentPrice: normalizedProduct.price,
            oldPrice: normalizedProduct.oldPrice,
            existingContentHash: null,
            newContentHash: normalizedProduct.contentHash,
          });
          continue;
        }

        const result = await this.upsertImportedProduct(jobId, source, normalizedProduct, productSourceTypeOverride);
        // #region debug-point E:upsert-result
        if (shouldReportSprinterProduct(normalizedProduct)) {
          reportSprinterDebugEvent("E", "import-manager:processNormalizedProducts:upsert-result", "[DEBUG] Sprinter product completed import upsert stage.", {
            jobId,
            index,
            result,
            name: normalizedProduct.name,
            sourceUrl: normalizedProduct.sourceUrl,
            sourceProductId: normalizedProduct.sourceProductId,
          });
        }
        // #endregion
        if (result.status === "created") {
          stats.importedCount += 1;
          stats.results.push({
            status: "NEW",
            failureReason: null,
            stage: "CATALOG",
            productName: normalizedProduct.name,
            brand: normalizedProduct.brand,
            category: normalizedProduct.category,
            sourceUrl: normalizedProduct.sourceUrl,
            imageUrl: normalizedProduct.imageUrl,
            currentPrice: normalizedProduct.price,
            oldPrice: normalizedProduct.oldPrice,
            existingContentHash: null,
            newContentHash: normalizedProduct.contentHash,
            productId: result.productId,
          });
        } else if (result.status === "updated") {
          stats.updatedCount += 1;
          stats.results.push({
            status: "UPDATED",
            failureReason: null,
            stage: "CATALOG",
            productName: normalizedProduct.name,
            brand: normalizedProduct.brand,
            category: normalizedProduct.category,
            sourceUrl: normalizedProduct.sourceUrl,
            imageUrl: normalizedProduct.imageUrl,
            currentPrice: normalizedProduct.price,
            oldPrice: normalizedProduct.oldPrice,
            existingContentHash: result.existingContentHash,
            newContentHash: normalizedProduct.contentHash,
            productId: result.productId,
          });
        } else {
          stats.unchangedCount += 1;
          stats.results.push({
            status: "UNCHANGED",
            failureReason: null,
            stage: "CATALOG",
            productName: normalizedProduct.name,
            brand: normalizedProduct.brand,
            category: normalizedProduct.category,
            sourceUrl: normalizedProduct.sourceUrl,
            imageUrl: normalizedProduct.imageUrl,
            currentPrice: normalizedProduct.price,
            oldPrice: normalizedProduct.oldPrice,
            existingContentHash: result.existingContentHash,
            newContentHash: normalizedProduct.contentHash,
            productId: result.productId,
          });
        }
      } catch (error) {
        // #region debug-point E:upsert-failure
        if (shouldReportSprinterProduct(normalizedProduct)) {
          reportSprinterDebugEvent("E", "import-manager:processNormalizedProducts:failure", "[DEBUG] Sprinter product failed during import processing.", {
            jobId,
            index,
            name: normalizedProduct.name,
            sourceUrl: normalizedProduct.sourceUrl,
            error: error instanceof Error ? error.message : "Unknown import error",
          });
        }
        // #endregion
        stats.failedCount += 1;
        stats.results.push({
          status: "FAILED",
          failureReason: mapFailureReason(error instanceof Error ? error.message : "Unknown error"),
          stage: "UPSERT",
          productName: normalizedProduct.name,
          brand: normalizedProduct.brand,
          category: normalizedProduct.category,
          sourceUrl: normalizedProduct.sourceUrl,
          imageUrl: normalizedProduct.imageUrl,
          currentPrice: normalizedProduct.price,
          oldPrice: normalizedProduct.oldPrice,
          existingContentHash: null,
          newContentHash: normalizedProduct.contentHash,
          metadata: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
        await createImportLog(
          jobId,
          ImportLogLevel.ERROR,
          `Failed to import ${normalizedProduct.name}: ${error instanceof Error ? error.message : "Unknown error."}`,
        );
      }
    }

    await this.persistProductResults(jobId, stats.results);

    return stats;
  }

  private matchesRules(
    normalizedProduct: NormalizedImportProduct,
    activeRules: Array<{ minDiscount: number; allowedBrands: string[]; allowedCategories: string[] }>,
  ): boolean {
    if (activeRules.length === 0) {
      return true;
    }

    const brandSlug = slugify(normalizedProduct.brand);
    const categorySlug = slugify(normalizedProduct.category);

    return activeRules.some((rule) => {
      if (normalizedProduct.discountPercent < rule.minDiscount) {
        return false;
      }

      const brandMatches = rule.allowedBrands.length === 0 || rule.allowedBrands.includes(brandSlug);
      const categoryMatches = rule.allowedCategories.length === 0 || rule.allowedCategories.includes(categorySlug);

      return brandMatches && categoryMatches;
    });
  }

  private async upsertImportedProduct(
    jobId: string,
    source: ImportSource | null,
    normalizedProduct: NormalizedImportProduct,
    productSourceTypeOverride?: ProductSource,
  ): Promise<{ status: "created" | "updated" | "unchanged"; productId: string; existingContentHash: string | null }> {
    const productSourceType =
      productSourceTypeOverride ?? mapImportSourceTypeToProductSource(source?.sourceType ?? ImportSourceType.MANUAL);
    const dealEvaluation = dealEngine.evaluate(normalizedProduct.discountPercent);
    const brandId = await ensureBrand(normalizedProduct.brand);
    const categoryId = await ensureCategory(normalizedProduct.category);
    const existing = await prisma.product.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(normalizedProduct.sourceUrl ? [{ sourceUrl: normalizedProduct.sourceUrl }] : []),
          ...(normalizedProduct.sourceProductId
            ? [
                {
                  sourceProductId: normalizedProduct.sourceProductId,
                  ...(source?.id ? { importSourceId: source.id } : {}),
                },
              ]
            : []),
          {
            sku: buildProductSku(normalizedProduct),
          },
        ],
      },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
      },
    });

    // #region debug-point E:catalog-lookup
    if (shouldReportSprinterProduct(normalizedProduct)) {
      reportSprinterDebugEvent("E", "import-manager:upsertImportedProduct:lookup", "[DEBUG] Catalog lookup completed for Sprinter product.", {
        jobId,
        name: normalizedProduct.name,
        sourceUrl: normalizedProduct.sourceUrl,
        sourceProductId: normalizedProduct.sourceProductId,
        existingProductId: existing?.id ?? null,
        existingContentHash: existing?.contentHash ?? null,
        incomingContentHash: normalizedProduct.contentHash,
      });
    }
    // #endregion

    if (existing?.contentHash && existing.contentHash === normalizedProduct.contentHash) {
      // #region debug-point E:unchanged-skip
      if (shouldReportSprinterProduct(normalizedProduct)) {
        reportSprinterDebugEvent("E", "import-manager:upsertImportedProduct:unchanged", "[DEBUG] Product skipped because incoming content hash matches existing content hash.", {
          jobId,
          name: normalizedProduct.name,
          sourceUrl: normalizedProduct.sourceUrl,
          sourceProductId: normalizedProduct.sourceProductId,
          existingProductId: existing.id,
          existingContentHash: existing.contentHash,
          incomingContentHash: normalizedProduct.contentHash,
        });
      }
      // #endregion
      return {
        status: "unchanged",
        productId: existing.id,
        existingContentHash: existing.contentHash ?? null,
      };
    }

    if (existing) {
      const pricing = await pricingService.calculateProductPricing({
        id: existing.id,
        brandId,
        categoryId,
        supplierPrice: normalizedProduct.price,
        fallbackPrice: existing.supplierPrice ?? existing.price,
        currency: normalizedProduct.currency,
        useCustomPricing: existing.useCustomPricing,
        customPrice: existing.customPrice,
      });

      const updatePayload = {
        name: normalizedProduct.name,
        description: normalizedProduct.description,
        brandId,
        categoryId,
        supplierPrice: pricing.supplierPrice,
        price: pricing.customerPrice,
        oldPrice: toDecimal(normalizedProduct.oldPrice),
        outletPrice: new Prisma.Decimal(normalizedProduct.price),
        profitAmount: pricing.profitAmount,
        discountPercent: normalizedProduct.discountPercent,
        currency: pricing.currency,
        sourceStore: normalizedProduct.sourceStore,
        sourceUrl: normalizedProduct.sourceUrl,
        sourceProductId: normalizedProduct.sourceProductId,
        sourceType: productSourceType,
        importSourceId: source?.id ?? null,
        contentHash: normalizedProduct.contentHash,
        stockStatus: normalizedProduct.stockStatus ?? StockStatus.UNKNOWN,
        status: ProductStatus.ACTIVE,
        dealLevel: dealEvaluation.dealLevel,
        isFeatured: dealEvaluation.isFeatured,
        isTrending: dealEvaluation.isTrending,
        lastSyncedAt: new Date(),
      } satisfies Prisma.ProductUncheckedUpdateInput;

      // #region debug-point E:update-payload
      if (shouldReportSprinterProduct(normalizedProduct)) {
        reportSprinterDebugEvent("E", "import-manager:upsertImportedProduct:update-payload", "[DEBUG] Prisma update payload prepared for existing product.", {
          jobId,
          existingProductId: existing.id,
          sourceUrl: normalizedProduct.sourceUrl,
          sourceProductId: normalizedProduct.sourceProductId,
          payload: {
            ...updatePayload,
            supplierPrice: pricing.supplierPrice.toString(),
            price: pricing.customerPrice.toString(),
            oldPrice: updatePayload.oldPrice?.toString?.() ?? null,
            outletPrice: updatePayload.outletPrice.toString(),
            profitAmount: pricing.profitAmount.toString(),
          },
        });
      }
      // #endregion

      const updated = await prisma.product.update({
        where: { id: existing.id },
        data: updatePayload,
      });
      if (normalizedProduct.sourceUrl) {
        await productMonitoringService.ensureWebsiteProfileForSource({
          sourceUrl: normalizedProduct.sourceUrl,
          sourceStore: normalizedProduct.sourceStore,
        });
      }

      if (normalizedProduct.imageUrl) {
        if (existing.images[0]) {
          await prisma.productImage.update({
            where: { id: existing.images[0].id },
            data: {
              imageUrl: normalizedProduct.imageUrl,
              altText: normalizedProduct.name,
            },
          });
        } else {
          await prisma.productImage.create({
            data: {
              productId: existing.id,
              imageUrl: normalizedProduct.imageUrl,
              altText: normalizedProduct.name,
              sortOrder: 0,
            },
          });
        }
      }

      const priceChanged =
        !decimalEquals(existing.price, updated.price) ||
        !decimalEquals(existing.oldPrice, updated.oldPrice) ||
        existing.discountPercent !== updated.discountPercent;

      if (priceChanged) {
        await prisma.priceHistory.create({
          data: {
            productId: existing.id,
            importJobId: jobId,
            oldPrice: updated.oldPrice,
            newPrice: updated.price,
            discountPercent: updated.discountPercent,
          },
        });
      }

      return {
        status: "updated",
        productId: updated.id,
        existingContentHash: existing.contentHash ?? null,
      };
    }

    const pricing = await pricingService.calculateProductPricing({
      brandId,
      categoryId,
      supplierPrice: normalizedProduct.price,
      currency: normalizedProduct.currency,
      useCustomPricing: false,
      customPrice: null,
    });

    const createPayload = {
      sku: buildProductSku(normalizedProduct),
      slug: await buildUniqueProductSlug(`${normalizedProduct.brand} ${normalizedProduct.name}`),
      name: normalizedProduct.name,
      description: normalizedProduct.description,
      brandId,
      categoryId,
      importSourceId: source?.id ?? null,
      sourceProductId: normalizedProduct.sourceProductId,
      supplierPrice: pricing.supplierPrice,
      price: pricing.customerPrice,
      oldPrice: toDecimal(normalizedProduct.oldPrice),
      outletPrice: new Prisma.Decimal(normalizedProduct.price),
      profitAmount: pricing.profitAmount,
      discountPercent: normalizedProduct.discountPercent,
      currency: pricing.currency,
      sourceStore: normalizedProduct.sourceStore,
      sourceUrl: normalizedProduct.sourceUrl,
      sourceType: productSourceType,
      status: ProductStatus.ACTIVE,
      stock: 0,
      stockStatus: normalizedProduct.stockStatus ?? StockStatus.UNKNOWN,
      contentHash: normalizedProduct.contentHash,
      dealLevel: dealEvaluation.dealLevel,
      isFeatured: dealEvaluation.isFeatured,
      isTrending: dealEvaluation.isTrending,
      importedAt: new Date(),
      lastSyncedAt: new Date(),
    } satisfies Prisma.ProductUncheckedCreateInput;

    // #region debug-point E:create-payload
    if (shouldReportSprinterProduct(normalizedProduct)) {
      reportSprinterDebugEvent("E", "import-manager:upsertImportedProduct:create-payload", "[DEBUG] Prisma create payload prepared for new product.", {
        jobId,
        sourceUrl: normalizedProduct.sourceUrl,
        sourceProductId: normalizedProduct.sourceProductId,
        payload: {
          ...createPayload,
          supplierPrice: pricing.supplierPrice.toString(),
          price: pricing.customerPrice.toString(),
          oldPrice: createPayload.oldPrice?.toString?.() ?? null,
          outletPrice: createPayload.outletPrice.toString(),
          profitAmount: pricing.profitAmount.toString(),
        },
      });
    }
    // #endregion

    const created = await prisma.product.create({
      data: createPayload,
    });
    if (normalizedProduct.sourceUrl) {
      await productMonitoringService.ensureWebsiteProfileForSource({
        sourceUrl: normalizedProduct.sourceUrl,
        sourceStore: normalizedProduct.sourceStore,
      });
    }

    if (normalizedProduct.imageUrl) {
      await prisma.productImage.create({
        data: {
          productId: created.id,
          imageUrl: normalizedProduct.imageUrl,
          altText: normalizedProduct.name,
          sortOrder: 0,
        },
      });
    }

    await prisma.priceHistory.create({
      data: {
        productId: created.id,
        importJobId: jobId,
        oldPrice: toDecimal(normalizedProduct.oldPrice),
        newPrice: new Prisma.Decimal(normalizedProduct.price),
        discountPercent: normalizedProduct.discountPercent,
      },
    });

    return {
      status: "created",
      productId: created.id,
      existingContentHash: null,
    };
  }

  private async persistProductResults(jobId: string, results: ImportProductProcessingResult[]) {
    if (results.length === 0) {
      return;
    }

    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: {
        scraperRun: {
          include: {
            connectorRun: true,
          },
        },
      },
    });

    await prisma.importProductResult.createMany({
      data: results.map((result) => ({
        importJobId: jobId,
        scraperRunId: job?.scraperRunId ?? null,
        connectorRunId: job?.scraperRun?.connectorRun?.id ?? null,
        productId: result.productId ?? null,
        status: result.status,
        failureReason: result.failureReason,
        stage: result.stage,
        productName: result.productName,
        brand: result.brand,
        category: result.category,
        sourceUrl: result.sourceUrl,
        imageUrl: result.imageUrl,
        currentPrice: toDecimal(result.currentPrice),
        oldPrice: toDecimal(result.oldPrice),
        existingContentHash: result.existingContentHash,
        newContentHash: result.newContentHash,
        metadata: result.metadata
          ? (result.metadata as Prisma.InputJsonValue)
          : undefined,
      })),
    });
  }
}

export const importManager = new ImportManager();
