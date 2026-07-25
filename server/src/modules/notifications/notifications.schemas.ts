import { NotificationCategory } from "@prisma/client";
import { z } from "zod";

const cuidSchema = z.string().cuid();
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value.length > 0 ? value : undefined;
  });

const jsonRecordSchema: z.ZodType<Record<string, unknown>> = z.record(z.unknown());

export const notificationIdParamsSchema = z.object({
  id: cuidSchema,
});

export const listNotificationsQuerySchema = z.object({
  category: z.nativeEnum(NotificationCategory).optional(),
  unreadOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => String(value ?? "false") === "true"),
  dateFrom: optionalString,
  dateTo: optionalString,
});

export const updateNotificationPreferencesSchema = z
  .object({
    orderNotifications: z.boolean().optional(),
    paymentNotifications: z.boolean().optional(),
    shippingNotifications: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
    systemNotifications: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const updateEmailTemplateSchema = z
  .object({
    name: optionalString,
    subjectTemplate: optionalString,
    htmlTemplate: optionalString,
    textTemplate: optionalString,
    samplePayload: jsonRecordSchema.optional(),
    variablesSchema: jsonRecordSchema.optional(),
    description: z.union([z.string().trim(), z.null()]).optional(),
    isActive: z.boolean().optional(),
    changeNotes: z.union([z.string().trim(), z.null()]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const previewEmailTemplateSchema = z.object({
  variables: jsonRecordSchema.default({}),
});

export const sendTestEmailSchema = z.object({
  targetEmail: z.string().trim().email(),
  variables: jsonRecordSchema.default({}),
});

export const rollbackTemplateSchema = z.object({
  version: z.coerce.number().int().positive(),
});
