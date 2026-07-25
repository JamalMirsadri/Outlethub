import { Prisma, type ImportJob, type ImportLog, type ImportProductResult, type ImportRule, type ImportSource } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import type {
  createImportRuleSchema,
  createImportSourceSchema,
  listImportJobsQuerySchema,
  listImportLogsQuerySchema,
  updateImportRuleSchema,
  updateImportSourceSchema,
} from "./imports.schemas.js";
import type { ImportSourceConfiguration } from "./import-normalizer.js";
import { z } from "zod";

type CreateImportSourceInput = z.infer<typeof createImportSourceSchema>;
type UpdateImportSourceInput = z.infer<typeof updateImportSourceSchema>;
type CreateImportRuleInput = z.infer<typeof createImportRuleSchema>;
type UpdateImportRuleInput = z.infer<typeof updateImportRuleSchema>;
type ListImportJobsQuery = z.infer<typeof listImportJobsQuerySchema>;
type ListImportLogsQuery = z.infer<typeof listImportLogsQuerySchema>;

type ImportJobWithSource = Prisma.ImportJobGetPayload<{
  include: {
    source: true;
    scraperRun: {
      include: {
        source: true;
        connectorRun: true;
      };
    };
    snapshots: { orderBy: { createdAt: "desc" }; take: 1 };
  };
}>;

type ImportLogWithJob = Prisma.ImportLogGetPayload<{
  include: {
    job: {
      include: {
        source: true;
      };
    };
  };
}>;

function parseConfiguration(configuration: Prisma.JsonValue | null): ImportSourceConfiguration | null {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return null;
  }

  return configuration as unknown as ImportSourceConfiguration;
}

function mapSource(source: ImportSource) {
  return {
    id: source.id,
    name: source.name,
    sourceType: source.sourceType,
    website: source.website,
    status: source.status,
    lastSyncAt: source.lastSyncAt,
    syncFrequency: source.syncFrequency,
    configuration: parseConfiguration(source.configuration),
    productCount: source.productCount,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function mapRule(rule: ImportRule) {
  return {
    id: rule.id,
    name: rule.name,
    minDiscount: rule.minDiscount,
    allowedBrands: rule.allowedBrands,
    allowedCategories: rule.allowedCategories,
    isActive: rule.isActive,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

function mapJob(job: ImportJobWithSource | ImportJob) {
  const latestSnapshot =
    "snapshots" in job && Array.isArray(job.snapshots) && job.snapshots.length > 0 ? job.snapshots[0] : null;
  const source = "source" in job ? job.source : null;
  const scraperRun = "scraperRun" in job ? job.scraperRun : null;
  const resolvedSource = source ?? scraperRun?.source ?? null;

  return {
    id: job.id,
    sourceId: job.sourceId,
    status: job.status,
    triggerMode: job.triggerMode,
    totalCount: job.totalCount,
    discoveredCount: job.discoveredCount,
    fetchedCount: job.fetchedCount,
    normalizedCount: job.normalizedCount,
    validatedCount: job.validatedCount,
    processedCount: job.processedCount,
    importedCount: job.importedCount,
    updatedCount: job.updatedCount,
    unchangedCount: job.unchangedCount,
    failedCount: job.failedCount,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    latestSnapshot,
    source: resolvedSource
      ? {
          id: resolvedSource.id,
          name: resolvedSource.name,
          sourceType: "sourceType" in resolvedSource ? resolvedSource.sourceType : "SCRAPER",
          website: "website" in resolvedSource ? resolvedSource.website : null,
        }
      : null,
    scraperRun: scraperRun
      ? {
          id: scraperRun.id,
          status: scraperRun.status,
          productsFound: scraperRun.productsFound,
          discoveredCount: scraperRun.discoveredCount,
          fetchedCount: scraperRun.fetchedCount,
          normalizedCount: scraperRun.normalizedCount,
          validatedCount: scraperRun.validatedCount,
          productsImported: scraperRun.productsImported,
          productsUpdated: scraperRun.productsUpdated,
          unchangedCount: scraperRun.unchangedCount,
          failedCount: scraperRun.failedCount,
          connectorRun: scraperRun.connectorRun
            ? {
                id: scraperRun.connectorRun.id,
                strategyUsed: scraperRun.connectorRun.strategyUsed,
                httpStatus: scraperRun.connectorRun.httpStatus,
                protectionType: scraperRun.connectorRun.protectionType,
              }
            : null,
          source: scraperRun.source
            ? {
                id: scraperRun.source.id,
                name: scraperRun.source.name,
                connectorKey: scraperRun.source.connectorKey,
              }
            : null,
        }
      : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function mapProductResult(result: ImportProductResult) {
  return {
    id: result.id,
    status: result.status,
    failureReason: result.failureReason,
    stage: result.stage,
    productName: result.productName,
    brand: result.brand,
    category: result.category,
    sourceUrl: result.sourceUrl,
    imageUrl: result.imageUrl,
    currentPrice: result.currentPrice ? Number(result.currentPrice) : null,
    oldPrice: result.oldPrice ? Number(result.oldPrice) : null,
    existingContentHash: result.existingContentHash,
    newContentHash: result.newContentHash,
    productId: result.productId,
    metadata: result.metadata,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

function mapLog(log: ImportLogWithJob | ImportLog) {
  const job = "job" in log ? log.job : null;

  return {
    id: log.id,
    jobId: log.jobId,
    level: log.level,
    message: log.message,
    createdAt: log.createdAt,
    job: job
      ? {
          id: job.id,
          status: job.status,
          source: job.source
            ? {
                id: job.source.id,
                name: job.source.name,
                sourceType: job.source.sourceType,
              }
            : null,
        }
      : null,
  };
}

export class ImportsService {
  public async listSources() {
    const sources = await prisma.importSource.findMany({
      orderBy: [{ createdAt: "desc" }],
    });

    return sources.map(mapSource);
  }

  public async createSource(input: CreateImportSourceInput) {
    const source = await prisma.importSource.create({
      data: {
        name: input.name,
        sourceType: input.sourceType,
        website: input.website ?? null,
        status: input.status ?? "ACTIVE",
        syncFrequency: input.syncFrequency,
        configuration:
          input.configuration !== undefined
            ? ((input.configuration ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull)
            : undefined,
      },
    });

    return mapSource(source);
  }

  public async updateSource(id: string, input: UpdateImportSourceInput) {
    const existing = await prisma.importSource.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Import source not found.");
    }

    const source = await prisma.importSource.update({
      where: { id },
      data: {
        name: input.name,
        sourceType: input.sourceType,
        website: input.website,
        status: input.status,
        syncFrequency: input.syncFrequency,
        configuration:
          input.configuration !== undefined
            ? ((input.configuration ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull)
            : undefined,
      },
    });

    return mapSource(source);
  }

  public async deleteSource(id: string) {
    const source = await prisma.importSource.findUnique({
      where: { id },
      include: {
        jobs: {
          select: { id: true },
          take: 1,
        },
        products: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!source) {
      throw new ApiError(404, "Import source not found.");
    }

    if (source.jobs.length || source.products.length) {
      throw new ApiError(409, "Import source cannot be deleted because it is already linked to jobs or products.");
    }

    await prisma.importSource.delete({ where: { id } });
  }

  public async listRules() {
    const rules = await prisma.importRule.findMany({
      orderBy: [{ isActive: "desc" }, { minDiscount: "desc" }, { createdAt: "desc" }],
    });

    return rules.map(mapRule);
  }

  public async createRule(input: CreateImportRuleInput) {
    const rule = await prisma.importRule.create({
      data: {
        name: input.name,
        minDiscount: input.minDiscount,
        allowedBrands: input.allowedBrands,
        allowedCategories: input.allowedCategories,
        isActive: input.isActive ?? true,
      },
    });

    return mapRule(rule);
  }

  public async updateRule(id: string, input: UpdateImportRuleInput) {
    const existing = await prisma.importRule.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Import rule not found.");
    }

    const rule = await prisma.importRule.update({
      where: { id },
      data: {
        name: input.name,
        minDiscount: input.minDiscount,
        allowedBrands: input.allowedBrands,
        allowedCategories: input.allowedCategories,
        isActive: input.isActive,
      },
    });

    return mapRule(rule);
  }

  public async deleteRule(id: string) {
    const existing = await prisma.importRule.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Import rule not found.");
    }

    await prisma.importRule.delete({ where: { id } });
  }

  public async listJobs(query: ListImportJobsQuery) {
    const where: Prisma.ImportJobWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
    };

    const jobs = await prisma.importJob.findMany({
      where,
      include: {
        source: true,
        scraperRun: {
          include: {
            source: true,
            connectorRun: true,
          },
        },
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: query.limit,
    });

    return jobs.map(mapJob);
  }

  public async listLogs(query: ListImportLogsQuery) {
    const logs = await prisma.importLog.findMany({
      where: {
        ...(query.jobId ? { jobId: query.jobId } : {}),
        ...(query.level ? { level: query.level } : {}),
      },
      include: {
        job: {
          include: {
            source: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: query.limit,
    });

    return logs.map(mapLog);
  }

  public async getDashboardSummary() {
    const [activeSources, latestJob, jobAggregation, dealCount] = await Promise.all([
      prisma.importSource.count({ where: { status: "ACTIVE" } }),
      prisma.importJob.findFirst({
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
      }),
      prisma.importJob.aggregate({
        _sum: {
          importedCount: true,
          failedCount: true,
        },
      }),
      prisma.product.count({
        where: {
          dealLevel: {
            in: ["GOOD", "HOT", "FEATURED"],
          },
          deletedAt: null,
        },
      }),
    ]);

    return {
      activeSources,
      lastSyncAt: latestJob?.completedAt ?? null,
      importedProducts: (jobAggregation._sum.importedCount ?? 0) + 0,
      failedImports: jobAggregation._sum.failedCount ?? 0,
      dealCount,
    };
  }

  public async getObservabilityDashboard() {
    const [summary, recentConnectorRuns, failureSummary, throughput, sources] = await Promise.all([
      prisma.importJob.aggregate({
        _sum: {
          discoveredCount: true,
          fetchedCount: true,
          normalizedCount: true,
          validatedCount: true,
          importedCount: true,
          updatedCount: true,
          unchangedCount: true,
          failedCount: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.connectorRun.findMany({
        include: {
          brandSource: true,
          connectorConfiguration: {
            include: {
              scraperSource: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
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
      prisma.importJob.findMany({
        where: {
          completedAt: { not: null },
        },
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
          validatedCount: true,
          importedCount: true,
          updatedCount: true,
          unchangedCount: true,
          failedCount: true,
        },
        orderBy: { completedAt: "desc" },
        take: 20,
      }),
      prisma.importSource.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);

    const totalRuns = summary._count.id || 0;
    const successfulRuns = throughput.filter(
      (item) => item.failedCount === 0 && item.importedCount + item.updatedCount + item.unchangedCount > 0,
    ).length;
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;
    const averageThroughput =
      throughput.length > 0
        ? Math.round(
            throughput.reduce((sum, item) => {
              if (!item.startedAt || !item.completedAt) {
                return sum;
              }

              const durationSeconds = Math.max(1, (item.completedAt.getTime() - item.startedAt.getTime()) / 1000);
              return sum + item.validatedCount / durationSeconds;
            }, 0) / throughput.length,
          )
        : 0;

    return {
      summary: {
        totalRuns,
        discoveredCount: summary._sum.discoveredCount ?? 0,
        fetchedCount: summary._sum.fetchedCount ?? 0,
        normalizedCount: summary._sum.normalizedCount ?? 0,
        validatedCount: summary._sum.validatedCount ?? 0,
        importedCount: summary._sum.importedCount ?? 0,
        updatedCount: summary._sum.updatedCount ?? 0,
        unchangedCount: summary._sum.unchangedCount ?? 0,
        failedCount: summary._sum.failedCount ?? 0,
        successRate,
        averageThroughput,
      },
      connectors: recentConnectorRuns.map((run) => ({
        id: run.id,
        status: run.status,
        connectorConfigurationId: run.connectorConfigurationId,
        connectorName: run.brandSource.brandName,
        strategyUsed: run.strategyUsed,
        httpStatus: run.httpStatus,
        protectionType: run.protectionType,
        urlsDiscovered: run.urlsDiscovered,
        urlsProcessed: run.urlsProcessed,
        discoveredCount: run.discoveredCount,
        fetchedCount: run.fetchedCount,
        normalizedCount: run.normalizedCount,
        validatedCount: run.validatedCount,
        importedCount: run.importedCount,
        updatedCount: run.updatedCount,
        unchangedCount: run.unchangedCount,
        failedCount: run.failedCount,
        duplicateUrlsRemoved: run.duplicateUrlsRemoved,
        urlsSkipped: run.urlsSkipped,
        validationFailureCount: run.validationFailureCount,
        rejectedCount: run.rejectedCount,
        durationMs: run.durationMs,
        completedAt: run.completedAt,
      })),
      failureReasons: failureSummary.map((item) => ({
        reason: item.failureReason,
        count: item._count.failureReason,
      })),
      sources: sources.map(mapSource),
    };
  }

  public async getJobDetail(id: string) {
    const job = await prisma.importJob.findUnique({
      where: { id },
      include: {
        source: true,
        scraperRun: {
          include: {
            source: true,
            connectorRun: true,
          },
        },
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        logs: {
          orderBy: { createdAt: "asc" },
        },
        productResults: {
          orderBy: { createdAt: "asc" },
          take: 50,
        },
      },
    });

    if (!job) {
      throw new ApiError(404, "Import job not found.");
    }

    const catalogRecords = await prisma.product.findMany({
      where: {
        id: {
          in: job.productResults
            .map((result) => result.productId)
            .filter((value): value is string => Boolean(value)),
        },
      },
      include: {
        brand: true,
        category: true,
      },
      take: 20,
    });
    const productResultStatusByProductId = new Map(
      job.productResults
        .filter((result): result is typeof result & { productId: string } => Boolean(result.productId))
        .map((result) => [result.productId, result.status] as const),
    );

    const durationMs =
      job.startedAt && job.completedAt ? Math.max(0, job.completedAt.getTime() - job.startedAt.getTime()) : null;

    return {
      job: mapJob(job),
      executionTrace: {
        discovery: job.discoveredCount,
        fetch: job.fetchedCount,
        normalize: job.normalizedCount,
        validate: job.validatedCount,
        upsert: job.processedCount,
        catalog: job.importedCount + job.updatedCount + job.unchangedCount,
      },
      processingDurationMs: durationMs,
      logs: job.logs.map(mapLog),
      firstProcessedProducts: job.productResults.map(mapProductResult),
      catalogRecords: catalogRecords.map((product) => ({
        id: product.id,
        name: product.name,
        brand: product.brand.name,
        currentPrice: Number(product.price),
        sourceUrl: product.sourceUrl,
        lastSync: product.lastSyncedAt,
        importStatus: productResultStatusByProductId.get(product.id) ?? "UNKNOWN",
      })),
      connectorRun: job.scraperRun?.connectorRun
        ? {
            id: job.scraperRun.connectorRun.id,
            strategyUsed: job.scraperRun.connectorRun.strategyUsed,
            httpStatus: job.scraperRun.connectorRun.httpStatus,
            protectionType: job.scraperRun.connectorRun.protectionType,
            diagnosticsPayload: job.scraperRun.connectorRun.diagnosticsPayload,
            discoveryPayload: job.scraperRun.connectorRun.discoveryPayload,
            normalizationPayload: job.scraperRun.connectorRun.normalizationPayload,
            upsertPayload: job.scraperRun.connectorRun.upsertPayload,
          }
        : null,
    };
  }
}

export const importsService = new ImportsService();
