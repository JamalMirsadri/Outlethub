import { ScraperRunStatus, ScraperStatus, ScraperType } from "@prisma/client";
import { z } from "zod";

const cuidSchema = z.string().cuid();

const proxySchema = z
  .object({
    server: z.string().trim().min(1),
    username: z.string().trim().min(1).optional(),
    password: z.string().trim().min(1).optional(),
  })
  .optional()
  .nullable();

const requestLimiterSchema = z
  .object({
    maxRequestsPerMinute: z.coerce.number().int().positive().optional(),
    maxConcurrentPages: z.coerce.number().int().positive().optional(),
  })
  .optional()
  .nullable();

export const scraperConfigurationSchema = z
  .object({
    headless: z.boolean().optional(),
    timeoutMs: z.coerce.number().int().positive().optional(),
    retryAttempts: z.coerce.number().int().min(0).max(10).optional(),
    userAgent: z.string().trim().min(1).optional(),
    proxy: proxySchema,
    requestLimiter: requestLimiterSchema,
  })
  .optional();

export const createScraperSourceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  website: z.string().trim().url().optional().nullable(),
  status: z.nativeEnum(ScraperStatus).optional(),
  scraperType: z.nativeEnum(ScraperType),
  connectorKey: z.string().trim().min(2).max(120),
  configuration: scraperConfigurationSchema.nullable().optional(),
});

export const updateScraperSourceSchema = createScraperSourceSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const entityIdParamsSchema = z.object({
  id: cuidSchema,
});

export const runScraperSchema = z.object({
  sourceId: cuidSchema,
});

export const listScraperRunsQuerySchema = z.object({
  status: z.nativeEnum(ScraperRunStatus).optional(),
  sourceId: cuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
