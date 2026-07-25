import { BrandSourceStatus, BrandSourceType, ScraperStatus, ScraperType, SyncFrequency, type Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { calculateConnectorHealthScore, type ConnectorHealthRunSample } from "../imports/import-observability.js";
import { enqueueScraperRun } from "../scrapers/scraper-queue.js";
import { scraperManager } from "../scrapers/scraper-manager.js";
import { syncScheduler } from "../monitoring/sync-scheduler.js";
import { connectorAnalyzerService } from "./connector-analyzer.service.js";
import { connectorBuilderRuntime, DEFAULT_CONNECTOR_FIELD_MAPPINGS } from "./connector-builder.runtime.js";

type UpsertConnectorInput = {
  templateKey?: string;
  syncFrequency?: SyncFrequency;
  isEnabled?: boolean;
  feedUrl?: string | null;
  recordPath?: string | null;
  fieldMappings?: Array<{ externalField: string; internalField: string }>;
  executionProfile?: Partial<{
    listingUrl: string | null;
    headless: boolean;
    timeoutMs: number;
    retryAttempts: number;
    userAgent: string | null;
    maxRequestsPerMinute: number | null;
    maxConcurrentPages: number | null;
    pageLimit: number;
    sampleSize: number;
    productCardSelector: string | null;
    productNameSelector: string | null;
    productPriceSelector: string | null;
    productOldPriceSelector: string | null;
    productImageSelector: string | null;
    productUrlSelector: string | null;
    paginationSelector: string | null;
    nextPageSelector: string | null;
  }>;
};

function getDefaultTemplateMetadata(sourceType: BrandSourceType) {
  switch (sourceType) {
    case BrandSourceType.PLAYWRIGHT:
      return {
        key: "system-playwright-template",
        name: "System Playwright Template",
        description: "Selector-based storefront template for product-card scraping.",
      };
    case BrandSourceType.JSON_FEED:
      return {
        key: "system-json-feed-template",
        name: "System JSON Feed Template",
        description: "Feed-driven template for JSON catalog imports.",
      };
    case BrandSourceType.XML_FEED:
      return {
        key: "system-xml-feed-template",
        name: "System XML Feed Template",
        description: "Feed-driven template for XML catalog imports.",
      };
    case BrandSourceType.MANUAL_IMPORT:
    default:
      return {
        key: "system-manual-import-template",
        name: "System Manual Import Template",
        description: "Manual import template for non-automated catalog updates.",
      };
  }
}

function mapBrandStatusToScraperStatus(status: BrandSourceStatus, isEnabled: boolean, sourceType: BrandSourceType): ScraperStatus {
  if (!isEnabled || sourceType === BrandSourceType.MANUAL_IMPORT) {
    return ScraperStatus.DISABLED;
  }

  switch (status) {
    case BrandSourceStatus.ERROR:
      return ScraperStatus.ERROR;
    case BrandSourceStatus.DISABLED:
      return ScraperStatus.DISABLED;
    case BrandSourceStatus.ACTIVE:
    default:
      return ScraperStatus.ACTIVE;
  }
}

function buildScraperSourceName(source: {
  brandName: string;
  countryCode: string | null;
  region: string | null;
}) {
  return [source.brandName, source.countryCode ?? source.region ?? null].filter(Boolean).join(" ").trim();
}

function defaultExecutionProfile(sourceType: BrandSourceType) {
  return {
    listingUrl: null,
    headless: true,
    timeoutMs: 30000,
    retryAttempts: 2,
    userAgent: null,
    maxRequestsPerMinute: 60,
    maxConcurrentPages: 2,
    pageLimit: 1,
    sampleSize: 6,
    productCardSelector: sourceType === BrandSourceType.PLAYWRIGHT ? "[data-product-card], .product-card, article" : null,
    productNameSelector: sourceType === BrandSourceType.PLAYWRIGHT ? "[data-product-name], .product-card__title, .product-name, h2, h3" : null,
    productPriceSelector: sourceType === BrandSourceType.PLAYWRIGHT ? "[data-product-price], .price, .product-price, [class*='price']" : null,
    productOldPriceSelector:
      sourceType === BrandSourceType.PLAYWRIGHT ? "[data-product-old-price], .old-price, .price--old, [class*='old-price']" : null,
    productImageSelector: sourceType === BrandSourceType.PLAYWRIGHT ? "img" : null,
    productUrlSelector: sourceType === BrandSourceType.PLAYWRIGHT ? "a" : null,
    paginationSelector: null,
    nextPageSelector: null,
  };
}

function toNullableString(value: string | null | undefined) {
  return value && value.trim() ? value.trim() : null;
}

function mapConfiguration(configuration: Prisma.ConnectorConfigurationGetPayload<{
  include: {
    brandSource: true;
    template: true;
    fieldMappings: true;
    executionProfile: true;
    runs: {
      orderBy: { createdAt: "desc" };
      take: 10;
    };
    scraperSource: {
      include: {
        runs: {
          orderBy: { createdAt: "desc" };
          take: 1;
        };
        syncRuns: {
          orderBy: { createdAt: "desc" };
          take: 1;
        };
      };
    };
  };
}>) {
  const latestConnectorRun = configuration.runs[0] ?? null;
  const latestScraperRun = configuration.scraperSource?.runs[0] ?? null;
  const latestRun = latestConnectorRun ?? latestScraperRun;
  const latestSync = configuration.scraperSource?.syncRuns[0] ?? null;
  const healthSamples: ConnectorHealthRunSample[] =
    configuration.runs.length > 0
      ? configuration.runs.map((run) => ({
          status: run.status,
          discoveredCount: run.discoveredCount,
          validatedCount: run.validatedCount,
          importedCount: run.importedCount,
          updatedCount: run.updatedCount,
          unchangedCount: run.unchangedCount,
          failedCount: run.failedCount,
          durationMs: run.durationMs,
        }))
      : (configuration.scraperSource?.runs ?? []).map((run) => ({
          status: run.status,
          discoveredCount: run.discoveredCount || run.productsFound,
          validatedCount: run.validatedCount || run.productsFound,
          importedCount: run.productsImported,
          updatedCount: run.productsUpdated,
          unchangedCount: run.unchangedCount,
          failedCount: run.failedCount,
          durationMs: run.startedAt && run.completedAt ? Math.max(0, run.completedAt.getTime() - run.startedAt.getTime()) : null,
        }));

  return {
    id: configuration.id,
    brandSourceId: configuration.brandSourceId,
    template: {
      id: configuration.template.id,
      key: configuration.template.key,
      name: configuration.template.name,
      sourceType: configuration.template.sourceType,
    },
    brandSource: {
      id: configuration.brandSource.id,
      brandName: configuration.brandSource.brandName,
      website: configuration.brandSource.website,
      countryCode: configuration.brandSource.countryCode,
      currencyCode: configuration.brandSource.currencyCode,
      region: configuration.brandSource.region,
      sourceType: configuration.brandSource.sourceType,
      status: configuration.brandSource.status,
    },
    isEnabled: configuration.isEnabled,
    feedUrl: configuration.feedUrl,
    recordPath: configuration.recordPath,
    lastTestedAt: configuration.lastTestedAt,
    lastTestStatus: configuration.lastTestStatus,
    lastTestMessage: configuration.lastTestMessage,
    importApprovedAt: configuration.importApprovedAt,
    fieldMappings: configuration.fieldMappings.map((mapping) => ({
      id: mapping.id,
      externalField: mapping.externalField,
      internalField: mapping.internalField,
    })),
    executionProfile: configuration.executionProfile
      ? {
          id: configuration.executionProfile.id,
          listingUrl: configuration.executionProfile.listingUrl,
          headless: configuration.executionProfile.headless,
          timeoutMs: configuration.executionProfile.timeoutMs,
          retryAttempts: configuration.executionProfile.retryAttempts,
          userAgent: configuration.executionProfile.userAgent,
          maxRequestsPerMinute: configuration.executionProfile.maxRequestsPerMinute,
          maxConcurrentPages: configuration.executionProfile.maxConcurrentPages,
          pageLimit: configuration.executionProfile.pageLimit,
          sampleSize: configuration.executionProfile.sampleSize,
          productCardSelector: configuration.executionProfile.productCardSelector,
          productNameSelector: configuration.executionProfile.productNameSelector,
          productPriceSelector: configuration.executionProfile.productPriceSelector,
          productOldPriceSelector: configuration.executionProfile.productOldPriceSelector,
          productImageSelector: configuration.executionProfile.productImageSelector,
          productUrlSelector: configuration.executionProfile.productUrlSelector,
          paginationSelector: configuration.executionProfile.paginationSelector,
          nextPageSelector: configuration.executionProfile.nextPageSelector,
        }
      : null,
    scraperSource: configuration.scraperSource
      ? {
          id: configuration.scraperSource.id,
          name: configuration.scraperSource.name,
          status: configuration.scraperSource.status,
          syncFrequency: configuration.scraperSource.syncFrequency,
          connectorKey: configuration.scraperSource.connectorKey,
          lastRunAt: configuration.scraperSource.lastRunAt,
          runCount: configuration.scraperSource.runCount,
        }
      : null,
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          productsFound: "productsFound" in latestRun ? latestRun.productsFound : latestRun.discoveredCount,
          productsImported: "productsImported" in latestRun ? latestRun.productsImported : latestRun.importedCount,
          productsUpdated: "productsUpdated" in latestRun ? latestRun.productsUpdated : latestRun.updatedCount,
          failedCount: latestRun.failedCount,
          completedAt: latestRun.completedAt,
          errorMessage: latestRun.errorMessage,
        }
      : null,
    latestSync: latestSync
      ? {
          id: latestSync.id,
          status: latestSync.status,
          productsChecked: latestSync.productsChecked,
          productsChanged: latestSync.productsChanged,
          completedAt: latestSync.completedAt,
        }
      : null,
    createdAt: configuration.createdAt,
    updatedAt: configuration.updatedAt,
    healthSamples,
    recentConnectorRuns: configuration.runs.map((run) => ({
      status: run.status,
      failedCount: run.failedCount,
      importedCount: run.importedCount,
      updatedCount: run.updatedCount,
      unchangedCount: run.unchangedCount,
      completedAt: run.completedAt,
    })),
  };
}

function deriveHealth(item: ReturnType<typeof mapConfiguration>) {
  const breakdown = calculateConnectorHealthScore(item.healthSamples);
  const websiteReachable = item.lastTestStatus === "PASSED" || breakdown.successRate > 0 || item.latestRun?.status === "COMPLETED";
  const selectorsValid = (item.lastTestStatus === "PASSED" && (item.latestRun?.productsFound ?? 1) >= 1) || (item.latestRun?.productsFound ?? 0) > 0;
  const testedProductsFound =
    item.lastTestMessage && /Preview resolved (\d+) products/i.test(item.lastTestMessage)
      ? Number(item.lastTestMessage.match(/Preview resolved (\d+) products/i)?.[1] ?? 0)
      : 0;
  const productsFound = item.latestRun?.productsFound ?? testedProductsFound;
  const lastSuccessfulRun = item.recentConnectorRuns.find(
    (run) => run.status === "COMPLETED" && run.importedCount + run.updatedCount + run.unchangedCount > 0,
  );
  const lastFailedRun = item.recentConnectorRuns.find((run) => run.status === "FAILED" || run.failedCount > 0);
  const lastSuccessAt = lastSuccessfulRun?.completedAt ?? (item.lastTestStatus === "PASSED" ? item.lastTestedAt : null);
  const lastFailureAt = lastFailedRun?.completedAt ?? (item.lastTestStatus === "FAILED" ? item.lastTestedAt : null);

  return {
    healthScore: breakdown.healthScore,
    websiteReachable: Boolean(websiteReachable),
    selectorsValid: Boolean(selectorsValid),
    productsFound,
    lastSuccessAt,
    lastFailureAt,
    successRate: breakdown.successRate,
    failureRate: breakdown.failureRate,
    productYield: breakdown.productYield,
    runtimeStability: breakdown.runtimeStability,
  };
}

export class ConnectorsService {
  private async ensureSystemTemplate(sourceType: BrandSourceType, templateKey?: string) {
    const metadata = getDefaultTemplateMetadata(sourceType);

    return prisma.connectorTemplate.upsert({
      where: {
        key: templateKey ?? metadata.key,
      },
      update: {
        name: metadata.name,
        sourceType,
        description: metadata.description,
        isSystemTemplate: templateKey ? false : true,
      },
      create: {
        key: templateKey ?? metadata.key,
        name: metadata.name,
        sourceType,
        description: metadata.description,
        isSystemTemplate: templateKey ? false : true,
      },
    });
  }

  private async getBrandSourceOrThrow(brandSourceId: string) {
    const source = await prisma.brandSource.findUnique({
      where: { id: brandSourceId },
    });

    if (!source) {
      throw new ApiError(404, "Brand source not found.");
    }

    return source;
  }

  public async ensureConnectorForBrandSourceId(brandSourceId: string) {
    return this.upsertConnectorConfiguration(brandSourceId, {});
  }

  public async upsertConnectorConfiguration(brandSourceId: string, input: UpsertConnectorInput) {
    const brandSource = await this.getBrandSourceOrThrow(brandSourceId);
    const template = await this.ensureSystemTemplate(brandSource.sourceType, input.templateKey);
    const existing = await prisma.connectorConfiguration.findUnique({
      where: { brandSourceId },
      include: {
        brandSource: true,
        template: true,
        fieldMappings: true,
        executionProfile: true,
        runs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        scraperSource: true,
      },
    });

    const configuration = existing
      ? await prisma.connectorConfiguration.update({
          where: { id: existing.id },
          data: {
            templateId: template.id,
            isEnabled: input.isEnabled ?? existing.isEnabled,
            feedUrl: input.feedUrl !== undefined ? toNullableString(input.feedUrl) : existing.feedUrl,
            recordPath: input.recordPath !== undefined ? toNullableString(input.recordPath) : existing.recordPath,
          },
        })
      : await prisma.connectorConfiguration.create({
          data: {
            brandSourceId,
            templateId: template.id,
            isEnabled: input.isEnabled ?? brandSource.status === BrandSourceStatus.ACTIVE,
            feedUrl: toNullableString(input.feedUrl) ?? null,
            recordPath: toNullableString(input.recordPath) ?? null,
          },
        });

    const fieldMappings = input.fieldMappings && input.fieldMappings.length > 0 ? input.fieldMappings : null;
    if (fieldMappings || !existing || existing.fieldMappings.length === 0) {
      await prisma.connectorFieldMapping.deleteMany({
        where: { configurationId: configuration.id },
      });
      await prisma.connectorFieldMapping.createMany({
        data: (fieldMappings ?? DEFAULT_CONNECTOR_FIELD_MAPPINGS).map((mapping) => ({
          configurationId: configuration.id,
          externalField: mapping.externalField,
          internalField: mapping.internalField,
        })),
      });
    }

    const executionDefaults = defaultExecutionProfile(brandSource.sourceType);
    const executionInput = {
      ...executionDefaults,
      ...(input.executionProfile ?? {}),
    };

    await prisma.connectorExecutionProfile.upsert({
      where: { configurationId: configuration.id },
      update: executionInput,
      create: {
        configurationId: configuration.id,
        ...executionInput,
      },
    });

    const hydrated = await connectorBuilderRuntime.resolveByBrandSourceId(brandSourceId);
    const syncFrequency =
      input.syncFrequency ??
      hydrated.scraperSource?.syncFrequency ??
      (brandSource.sourceType === BrandSourceType.MANUAL_IMPORT ? SyncFrequency.MANUAL : SyncFrequency.DAILY);

    const scraperSourcePayload = {
      name: buildScraperSourceName(brandSource),
      website: brandSource.website,
      status: mapBrandStatusToScraperStatus(brandSource.status, hydrated.isEnabled, brandSource.sourceType),
      scraperType: ScraperType.PLAYWRIGHT,
      connectorKey: "dynamic-template",
      countryCode: brandSource.countryCode,
      currencyCode: brandSource.currencyCode,
      region: brandSource.region,
      syncFrequency,
      configuration: connectorBuilderRuntime.buildScraperConfiguration(hydrated) as Prisma.InputJsonValue,
    };

    const scraperSource =
      hydrated.scraperSource
        ? await prisma.scraperSource.update({
            where: { id: hydrated.scraperSource.id },
            data: scraperSourcePayload,
          })
        : await prisma.scraperSource.create({
            data: scraperSourcePayload,
          });

    await prisma.connectorConfiguration.update({
      where: { id: configuration.id },
      data: {
        scraperSourceId: scraperSource.id,
      },
    });

    await syncScheduler.syncSchedules();
    return this.getConnectorDetail(brandSourceId);
  }

  public async getConnectorDetail(brandSourceId: string) {
    const configuration = await prisma.connectorConfiguration.findUnique({
      where: { brandSourceId },
      include: {
        brandSource: true,
        template: true,
        fieldMappings: {
          orderBy: { createdAt: "asc" },
        },
        executionProfile: true,
        runs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        scraperSource: {
          include: {
            runs: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            syncRuns: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!configuration) {
      throw new ApiError(404, "Connector configuration not found.");
    }

    return mapConfiguration(configuration);
  }

  public async listTemplates() {
    const templates = await prisma.connectorTemplate.findMany({
      orderBy: [{ isSystemTemplate: "desc" }, { name: "asc" }],
    });

    return templates.map((template) => ({
      id: template.id,
      key: template.key,
      name: template.name,
      sourceType: template.sourceType,
      description: template.description,
      isSystemTemplate: template.isSystemTemplate,
    }));
  }

  public async getDashboard() {
    const [configurations, runs] = await Promise.all([
      prisma.connectorConfiguration.findMany({
        include: {
          brandSource: true,
          template: true,
          fieldMappings: true,
          executionProfile: true,
          runs: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          scraperSource: {
            include: {
              runs: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
              syncRuns: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
      }),
      prisma.scraperRun.findMany({
        where: {
          source: {
            connectorConfiguration: {
              isNot: null,
            },
          },
        },
        select: {
          productsImported: true,
          productsUpdated: true,
        },
      }),
    ]);

    const items = configurations.map((configuration) => {
      const mapped = mapConfiguration(configuration);
      return {
        ...mapped,
        health: deriveHealth(mapped),
      };
    });

    return {
      summary: {
        dynamicConnectorsCreated: items.length,
        activeConnectors: items.filter((item) => item.isEnabled && item.scraperSource?.status === ScraperStatus.ACTIVE).length,
        failedConnectors: items.filter((item) => item.scraperSource?.status === ScraperStatus.ERROR || item.latestRun?.status === "FAILED").length,
        importedProducts: runs.reduce((sum, run) => sum + run.productsImported, 0),
        productsUpdated: runs.reduce((sum, run) => sum + run.productsUpdated, 0),
      },
      items,
    };
  }

  public async testConnection(brandSourceId: string) {
    try {
      const preview = await connectorBuilderRuntime.previewByBrandSourceId(brandSourceId);

      await prisma.connectorConfiguration.update({
        where: { brandSourceId },
        data: {
          lastTestedAt: new Date(),
          lastTestStatus: preview.selectorsWorking ? "PASSED" : "FAILED",
          lastTestMessage: preview.selectorsWorking
            ? `Preview resolved ${preview.productsFound} products.`
            : "Website reachable but selectors did not resolve products.",
        },
      });

      return {
        websiteReachable: preview.websiteReachable,
        selectorsWorking: preview.selectorsWorking,
        productsFound: preview.productsFound,
        parsedFields: preview.parsedFields,
        sampleProducts: preview.sampleNormalizedProducts,
        strategyUsed: preview.strategyUsed,
        diagnostics: preview.diagnostics,
        autoRepair: null,
      };
    } catch (error) {
      const repair = await this.autoRepairSelectors(brandSourceId).catch(() => null);
      await prisma.connectorConfiguration.update({
        where: { brandSourceId },
        data: {
          lastTestedAt: new Date(),
          lastTestStatus: "FAILED",
          lastTestMessage: error instanceof Error ? error.message : "Connector test failed.",
        },
      });

      return {
        websiteReachable: false,
        selectorsWorking: false,
        productsFound: 0,
        parsedFields: [],
        sampleProducts: [],
        strategyUsed: null,
        diagnostics: null,
        autoRepair: repair,
      };
    }
  }

  public async previewImport(brandSourceId: string) {
    const preview = await connectorBuilderRuntime.previewByBrandSourceId(brandSourceId);

    return {
      productCount: preview.productsFound,
      parsedFields: preview.parsedFields,
      sampleProducts: preview.sampleNormalizedProducts,
      rawSamples: preview.sampleRawRecords,
      strategyUsed: preview.strategyUsed,
      diagnostics: preview.diagnostics,
    };
  }

  public async getConnectorDiagnostics(brandSourceId: string) {
    return connectorBuilderRuntime.diagnoseByBrandSourceId(brandSourceId);
  }

  public async runImport(brandSourceId: string) {
    const connector = await this.ensureConnectorForBrandSourceId(brandSourceId);
    if (!connector.scraperSource?.id) {
      throw new ApiError(400, "Connector is missing a runtime scraper source.");
    }

    if (connector.brandSource.sourceType === BrandSourceType.MANUAL_IMPORT) {
      throw new ApiError(400, "Manual import connectors do not support automated run execution.");
    }

    const run = await scraperManager.createRun({
      sourceId: connector.scraperSource.id,
    });

    await enqueueScraperRun({
      runId: run.id,
    });

    await prisma.connectorConfiguration.update({
      where: { brandSourceId },
      data: {
        importApprovedAt: new Date(),
      },
    });

    return {
      runId: run.id,
      status: run.status,
      sourceId: connector.scraperSource.id,
    };
  }

  public async getImportHistory(brandSourceId: string) {
    const configuration = await prisma.connectorConfiguration.findUnique({
      where: { brandSourceId },
      select: { scraperSourceId: true },
    });

    if (!configuration?.scraperSourceId) {
      return [];
    }

    const runs = await prisma.scraperRun.findMany({
      where: {
        sourceId: configuration.scraperSourceId,
      },
      include: {
        importJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return runs.map((run) => ({
      id: run.id,
      status: run.status,
      productsFound: run.productsFound,
      productsImported: run.productsImported,
      productsUpdated: run.productsUpdated,
      failedCount: run.failedCount,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      importJob: run.importJobs[0]
        ? {
            id: run.importJobs[0].id,
            status: run.importJobs[0].status,
            importedCount: run.importJobs[0].importedCount,
            updatedCount: run.importJobs[0].updatedCount,
          }
        : null,
    }));
  }

  public async analyzeWebsite(input: {
    websiteUrl: string;
    brandName?: string | null;
    currencyCode?: string | null;
  }) {
    return connectorAnalyzerService.analyzeWebsite(input);
  }

  public async autoRepairSelectors(brandSourceId: string) {
    const configuration = await prisma.connectorConfiguration.findUnique({
      where: { brandSourceId },
      include: {
        brandSource: true,
        executionProfile: true,
      },
    });

    if (!configuration) {
      throw new ApiError(404, "Connector configuration not found.");
    }

    const websiteUrl = configuration.executionProfile?.listingUrl ?? configuration.feedUrl ?? configuration.brandSource.website;
    const analysis = await connectorAnalyzerService.analyzeWebsite({
      websiteUrl,
      brandName: configuration.brandSource.brandName,
      currencyCode: configuration.brandSource.currencyCode,
    });

    return {
      brandSourceId,
      websiteUrl,
      suggestedExecutionProfile: {
        listingUrl: analysis.analyzedUrl,
        ...analysis.selectors,
        sampleSize: 10,
      },
      sampleProducts: analysis.sampleProducts,
      productsFound: analysis.productsFound,
      parsedFields: analysis.parsedFields,
    };
  }

  public async getHealthDashboard() {
    const configurations = await prisma.connectorConfiguration.findMany({
      include: {
        brandSource: true,
        template: true,
        fieldMappings: true,
        executionProfile: true,
        runs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        scraperSource: {
          include: {
            runs: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
            syncRuns: {
              orderBy: { createdAt: "desc" },
              take: 3,
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    const items = configurations.map((configuration) => {
      const mapped = mapConfiguration(configuration);
      const health = deriveHealth(mapped);

      return {
        ...mapped,
        health,
        recommendedAction:
          health.healthScore >= 80
            ? "Healthy"
            : health.selectorsValid
              ? "Retest connector"
              : "Run auto-repair",
      };
    });

    return {
      summary: {
        averageHealthScore: items.length > 0 ? Math.round(items.reduce((sum, item) => sum + item.health.healthScore, 0) / items.length) : 0,
        healthyConnectors: items.filter((item) => item.health.healthScore >= 80).length,
        needsAttention: items.filter((item) => item.health.healthScore < 80).length,
      },
      items,
    };
  }

  public async cleanupForBrandSourceDeletion(brandSourceId: string) {
    const configuration = await prisma.connectorConfiguration.findUnique({
      where: { brandSourceId },
      include: {
        scraperSource: {
          include: {
            runs: {
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!configuration) {
      return;
    }

    if (configuration.scraperSource) {
      if (configuration.scraperSource.runs.length > 0) {
        await prisma.scraperSource.update({
          where: { id: configuration.scraperSource.id },
          data: {
            status: ScraperStatus.DISABLED,
            syncFrequency: SyncFrequency.MANUAL,
          },
        });
      } else {
        await prisma.scraperSource.delete({
          where: { id: configuration.scraperSource.id },
        });
      }
    }

    await prisma.connectorConfiguration.delete({
      where: { id: configuration.id },
    });

    await syncScheduler.syncSchedules();
  }
}

export const connectorsService = new ConnectorsService();
