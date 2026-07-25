import { ScraperStatus, SyncFrequency, SyncRunStatus } from "@prisma/client";
import { z } from "zod";

const cuidSchema = z.string().cuid();

export const listAlertsQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const listSyncHistoryQuerySchema = z.object({
  sourceId: cuidSchema.optional(),
  status: z.nativeEnum(SyncRunStatus).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const entityIdParamsSchema = z.object({
  id: cuidSchema,
});

export const monitoringDashboardQuerySchema = z.object({
  sourceId: cuidSchema.optional(),
});

export const productMonitoringLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const runSyncSchema = z.object({
  sourceId: cuidSchema,
  trigger: z.enum(["manual", "schedule"]).default("manual"),
});

export const runProductMonitoringSchema = z.object({
  trigger: z.enum(["manual", "schedule"]).default("manual"),
});

export const updateSourceSettingsSchema = z
  .object({
    sourceId: cuidSchema,
    syncFrequency: z.nativeEnum(SyncFrequency).optional(),
    status: z.nativeEnum(ScraperStatus).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const updateGlobalProductMonitoringSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    intervalMinutes: z.coerce.number().int().min(5).max(10080).optional(),
    timeoutMs: z.coerce.number().int().min(5000).max(120000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const updateProductMonitoringSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    intervalMinutes: z.coerce.number().int().min(5).max(10080).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });
