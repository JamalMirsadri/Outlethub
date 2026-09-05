import { z } from "zod";

const amountSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount");

export const updateShippingSettingsSchema = z.object({
  firstProductFee: amountSchema,
  secondProductFee: amountSchema,
  thirdProductFee: amountSchema,
  fourthProductFee: amountSchema,
  fifthProductFee: amountSchema,
  additionalProductFee: amountSchema,
  threshold: z.coerce.number().int().min(1).max(5),
});
