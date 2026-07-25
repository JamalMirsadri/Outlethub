import { BrandSourceType, SyncFrequency } from "@prisma/client";
import { z } from "zod";

const cuidSchema = z.string().cuid();

const nullableTrimmedString = z.union([z.string().trim().min(1), z.null()]).optional();

export const connectorEntityParamsSchema = z.object({
  brandSourceId: cuidSchema,
});

export const connectorFieldMappingSchema = z.object({
  externalField: z.string().trim().min(1).max(120),
  internalField: z.enum([
    "name",
    "brand",
    "category",
    "price",
    "oldPrice",
    "discountPercent",
    "imageUrl",
    "sourceUrl",
    "sourceProductId",
    "description",
    "currency",
  ]),
});

export const connectorExecutionProfileSchema = z
  .object({
    listingUrl: nullableTrimmedString,
    headless: z.boolean().optional(),
    timeoutMs: z.coerce.number().int().positive().optional(),
    retryAttempts: z.coerce.number().int().min(0).max(10).optional(),
    userAgent: z.union([z.string().trim().min(1), z.null()]).optional(),
    maxRequestsPerMinute: z.coerce.number().int().positive().optional().nullable(),
    maxConcurrentPages: z.coerce.number().int().positive().optional().nullable(),
    pageLimit: z.coerce.number().int().positive().max(20).optional(),
    sampleSize: z.coerce.number().int().positive().max(20).optional(),
    productCardSelector: nullableTrimmedString,
    productNameSelector: nullableTrimmedString,
    productPriceSelector: nullableTrimmedString,
    productOldPriceSelector: nullableTrimmedString,
    productImageSelector: nullableTrimmedString,
    productUrlSelector: nullableTrimmedString,
    paginationSelector: nullableTrimmedString,
    nextPageSelector: nullableTrimmedString,
  })
  .optional();

export const upsertConnectorConfigurationSchema = z
  .object({
    templateKey: z.string().trim().min(2).max(120).optional(),
    syncFrequency: z.nativeEnum(SyncFrequency).optional(),
    isEnabled: z.boolean().optional(),
    feedUrl: z.union([z.string().trim().url(), z.null()]).optional(),
    recordPath: z.union([z.string().trim().min(1), z.null()]).optional(),
    fieldMappings: z.array(connectorFieldMappingSchema).min(1).optional(),
    executionProfile: connectorExecutionProfileSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const runConnectorSchema = z.object({
  trigger: z.enum(["manual", "schedule"]).default("manual"),
});

export const connectorTemplateSeedSchema = z.object({
  sourceType: z.nativeEnum(BrandSourceType).optional(),
});

export const analyzeConnectorWebsiteSchema = z.object({
  websiteUrl: z.string().trim().url(),
  brandName: z.string().trim().min(1).max(120).optional().nullable(),
  currencyCode: z.string().trim().min(3).max(10).optional().nullable(),
});
