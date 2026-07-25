import { ImportJobStatus, ImportLogLevel, ImportSourceStatus, ImportSourceType, SyncFrequency } from "@prisma/client";
import { z } from "zod";

const cuidSchema = z.string().cuid();
const configurationSchema = z.record(z.string(), z.unknown()).optional();

export const createImportSourceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sourceType: z.nativeEnum(ImportSourceType),
  website: z.string().trim().url().optional().nullable(),
  status: z.nativeEnum(ImportSourceStatus).optional(),
  syncFrequency: z.nativeEnum(SyncFrequency),
  configuration: configurationSchema.nullable(),
});

export const updateImportSourceSchema = createImportSourceSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided.",
});

export const createImportRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  minDiscount: z.coerce.number().int().min(0).max(100),
  allowedBrands: z.array(z.string().trim().min(1)).default([]),
  allowedCategories: z.array(z.string().trim().min(1)).default([]),
  isActive: z.boolean().optional(),
});

export const updateImportRuleSchema = createImportRuleSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided.",
});

export const entityIdParamsSchema = z.object({
  id: cuidSchema,
});

export const runImportJobSchema = z.object({
  sourceId: cuidSchema,
});

export const uploadImportSchema = z.object({
  sourceId: cuidSchema.optional(),
  name: z.string().trim().min(2).max(120).optional(),
  sourceType: z.nativeEnum(ImportSourceType).optional(),
  website: z.string().trim().url().optional().nullable(),
  format: z.enum(["json", "xml"]),
  content: z.string().min(1),
  configuration: configurationSchema.nullable().optional(),
});

export const listImportJobsQuerySchema = z.object({
  status: z.nativeEnum(ImportJobStatus).optional(),
  sourceId: cuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const listImportLogsQuerySchema = z.object({
  jobId: cuidSchema.optional(),
  level: z.nativeEnum(ImportLogLevel).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
