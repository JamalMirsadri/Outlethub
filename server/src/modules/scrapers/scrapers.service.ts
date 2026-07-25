import { Prisma, type ScraperArtifact, type ScraperRun, type ScraperSource } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import type {
  createScraperSourceSchema,
  listScraperRunsQuerySchema,
  updateScraperSourceSchema,
} from "./scrapers.schemas.js";

type CreateScraperSourceInput = z.infer<typeof createScraperSourceSchema>;
type UpdateScraperSourceInput = z.infer<typeof updateScraperSourceSchema>;
type ListScraperRunsQuery = z.infer<typeof listScraperRunsQuerySchema>;

type ScraperRunWithRelations = Prisma.ScraperRunGetPayload<{
  include: {
    source: true;
    artifacts: {
      orderBy: { createdAt: "desc" };
      take: 5;
    };
    importJobs: {
      orderBy: { createdAt: "desc" };
      take: 1;
    };
  };
}>;

function parseConfiguration(configuration: Prisma.JsonValue | null) {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return null;
  }

  return configuration as Record<string, unknown>;
}

function mapSource(source: ScraperSource) {
  return {
    id: source.id,
    name: source.name,
    website: source.website,
    status: source.status,
    scraperType: source.scraperType,
    connectorKey: source.connectorKey,
    lastRunAt: source.lastRunAt,
    configuration: parseConfiguration(source.configuration),
    runCount: source.runCount,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function mapArtifact(artifact: ScraperArtifact) {
  return {
    id: artifact.id,
    scraperRunId: artifact.scraperRunId,
    type: artifact.type,
    filePath: artifact.filePath,
    createdAt: artifact.createdAt,
  };
}

function mapRun(run: ScraperRunWithRelations | ScraperRun) {
  const source = "source" in run ? run.source : null;
  const artifacts = "artifacts" in run ? run.artifacts : [];
  const importJob = "importJobs" in run && Array.isArray(run.importJobs) ? run.importJobs[0] ?? null : null;

  return {
    id: run.id,
    sourceId: run.sourceId,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    productsFound: run.productsFound,
    productsImported: run.productsImported,
    productsUpdated: run.productsUpdated,
    failedCount: run.failedCount,
    errorMessage: run.errorMessage,
    artifacts: artifacts.map(mapArtifact),
    importJob: importJob
      ? {
          id: importJob.id,
          status: importJob.status,
          importedCount: importJob.importedCount,
          updatedCount: importJob.updatedCount,
        }
      : null,
    source: source
      ? {
          id: source.id,
          name: source.name,
          scraperType: source.scraperType,
          connectorKey: source.connectorKey,
        }
      : null,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

export class ScrapersService {
  public async listSources() {
    const sources = await prisma.scraperSource.findMany({
      orderBy: [{ createdAt: "desc" }],
    });

    return sources.map(mapSource);
  }

  public async createSource(input: CreateScraperSourceInput) {
    const source = await prisma.scraperSource.create({
      data: {
        name: input.name,
        website: input.website ?? null,
        status: input.status ?? "ACTIVE",
        scraperType: input.scraperType,
        connectorKey: input.connectorKey,
        configuration:
          input.configuration !== undefined
            ? ((input.configuration ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull)
            : undefined,
      },
    });

    return mapSource(source);
  }

  public async updateSource(id: string, input: UpdateScraperSourceInput) {
    const existing = await prisma.scraperSource.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Scraper source not found.");
    }

    const source = await prisma.scraperSource.update({
      where: { id },
      data: {
        name: input.name,
        website: input.website,
        status: input.status,
        scraperType: input.scraperType,
        connectorKey: input.connectorKey,
        configuration:
          input.configuration !== undefined
            ? ((input.configuration ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull)
            : undefined,
      },
    });

    return mapSource(source);
  }

  public async deleteSource(id: string) {
    const source = await prisma.scraperSource.findUnique({
      where: { id },
      include: {
        runs: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!source) {
      throw new ApiError(404, "Scraper source not found.");
    }

    if (source.runs.length > 0) {
      throw new ApiError(409, "Scraper source cannot be deleted because runs already exist.");
    }

    await prisma.scraperSource.delete({ where: { id } });
  }

  public async listRuns(query: ListScraperRunsQuery) {
    const runs = await prisma.scraperRun.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      },
      include: {
        source: true,
        artifacts: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        importJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: query.limit,
    });

    return runs.map(mapRun);
  }

  public async getDashboardSummary() {
    const [activeScrapers, latestRun, runAggregation, failedRuns] = await Promise.all([
      prisma.scraperSource.count({ where: { status: "ACTIVE" } }),
      prisma.scraperRun.findFirst({
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
      }),
      prisma.scraperRun.aggregate({
        _sum: {
          productsFound: true,
          productsImported: true,
        },
      }),
      prisma.scraperRun.count({
        where: { status: "FAILED" },
      }),
    ]);

    return {
      activeScrapers,
      lastRunAt: latestRun?.completedAt ?? null,
      productsFound: runAggregation._sum.productsFound ?? 0,
      productsImported: runAggregation._sum.productsImported ?? 0,
      failedRuns,
    };
  }
}

export const scrapersService = new ScrapersService();
