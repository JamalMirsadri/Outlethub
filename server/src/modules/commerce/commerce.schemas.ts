import { PaymentProvider, PricingTargetType } from "@prisma/client";
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

const optionalNullableString = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) {
      return value ?? null;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    return value.length > 0 ? value : null;
  });

const moneySchema = z.coerce.number().nonnegative();
const optionalMoneySchema = z.coerce.number().nonnegative().optional();
const optionalNullableMoneySchema = z.union([z.coerce.number().nonnegative(), z.null()]).optional();

export const entityIdParamsSchema = z.object({
  id: cuidSchema,
});

export const cartItemParamsSchema = z.object({
  id: cuidSchema,
});

export const addCartItemSchema = z.object({
  productId: cuidSchema,
  variantId: cuidSchema.optional().nullable(),
  quantity: z.coerce.number().int().positive().default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(0),
});

export const updateCartCountrySchema = z.object({
  countryCode: z.string().trim().min(2).max(8),
  shippingMethodId: cuidSchema.optional().nullable(),
});

export const mergeGuestCartSchema = z.object({
  guestToken: optionalNullableString,
});

export const previewProfitSchema = z.object({
  supplierPrice: moneySchema,
  marginPercent: z.coerce.number().min(0).max(1000),
  localShippingFee: z.coerce.number().min(0),
  internationalShippingFee: z.coerce.number().min(0),
  handlingFee: z.coerce.number().min(0),
  minimumProfitAmount: z.coerce.number().min(0),
  vatPercent: z.coerce.number().min(0).max(1000),
});

export const updateBusinessSettingsSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120).optional(),
    supportEmail: z.string().trim().email().optional(),
    defaultCurrency: z.string().trim().min(3).max(10).optional(),
    defaultCountryCode: z.string().trim().min(2).max(8).optional(),
    defaultMarginPercent: z.coerce.number().min(0).max(1000).optional(),
    minimumProfitAmount: z.coerce.number().min(0).optional(),
    portugalShippingFee: z.coerce.number().min(0).optional(),
    spainShippingFee: z.coerce.number().min(0).optional(),
    iranShippingFee: z.coerce.number().min(0).optional(),
    fixedProfitAmount: z.coerce.number().min(0).optional(),
    handlingFee: z.coerce.number().min(0).optional(),
    paymentFee: z.coerce.number().min(0).optional(),
    vatPercent: z.coerce.number().min(0).max(1000).optional(),
    freeShippingThreshold: z.coerce.number().min(0).optional(),
    minimumOrderValue: z.coerce.number().min(0).optional(),
    returnPeriodDays: z.coerce.number().int().positive().max(365).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const createPricingRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  targetType: z.nativeEnum(PricingTargetType),
  brandId: cuidSchema.optional(),
  categoryId: cuidSchema.optional(),
  countryCode: z.string().trim().min(2).max(8).optional(),
  currency: z.string().trim().min(3).max(10).optional(),
  marginPercent: optionalMoneySchema,
  localShippingFee: optionalMoneySchema,
  minimumProfitAmount: optionalMoneySchema,
  fixedFee: optionalMoneySchema,
  shippingFee: optionalMoneySchema,
  handlingFee: optionalMoneySchema,
  paymentFee: optionalMoneySchema,
  taxPercent: optionalMoneySchema,
  freeShippingThreshold: optionalMoneySchema,
  minimumOrderValue: optionalMoneySchema,
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
});

export const updatePricingRuleSchema = createPricingRuleSchema.partial().extend({
  brandId: z.union([cuidSchema, z.null()]).optional(),
  categoryId: z.union([cuidSchema, z.null()]).optional(),
  countryCode: z.union([z.string().trim().min(2).max(8), z.null()]).optional(),
  marginPercent: optionalNullableMoneySchema,
  localShippingFee: optionalNullableMoneySchema,
  minimumProfitAmount: optionalNullableMoneySchema,
  fixedFee: optionalNullableMoneySchema,
  shippingFee: optionalNullableMoneySchema,
  handlingFee: optionalNullableMoneySchema,
  paymentFee: optionalNullableMoneySchema,
  taxPercent: optionalNullableMoneySchema,
  freeShippingThreshold: optionalNullableMoneySchema,
  minimumOrderValue: optionalNullableMoneySchema,
});

export const upsertShippingMethodSchema = z.object({
  id: cuidSchema.optional(),
  name: z.string().trim().min(2).max(120),
  countryCode: z.string().trim().min(2).max(8),
  originCountryCode: z.union([z.string().trim().min(2).max(8), z.null()]).optional(),
  currency: z.string().trim().min(3).max(10).optional(),
  minWeightKg: optionalNullableMoneySchema,
  maxWeightKg: optionalNullableMoneySchema,
  minDeliveryDays: z.coerce.number().int().min(0).max(365),
  maxDeliveryDays: z.coerce.number().int().min(0).max(365),
  baseFee: moneySchema,
  freeShippingThreshold: optionalNullableMoneySchema,
  deliveryEstimate: optionalNullableString,
  isActive: z.boolean().optional(),
});

export const updateProductPricingOverrideSchema = z.object({
  useCustomPricing: z.boolean().optional(),
  customPrice: optionalNullableMoneySchema,
});

export const upsertCustomerAddressSchema = z.object({
  id: cuidSchema.optional(),
  fullName: z.string().trim().min(2).max(120),
  phone: optionalNullableString,
  countryCode: z.string().trim().min(2).max(8),
  city: z.string().trim().min(2).max(120),
  postalCode: z.string().trim().min(2).max(32),
  addressLine1: z.string().trim().min(2).max(255),
  addressLine2: optionalNullableString,
  isDefaultShipping: z.boolean().optional(),
  isDefaultBilling: z.boolean().optional(),
});

export const createOrderSchema = z.object({
  customerEmail: z.string().trim().email(),
  shippingAddressId: cuidSchema,
  billingAddressId: cuidSchema.optional().nullable(),
  shippingMethodId: cuidSchema.optional().nullable(),
  paymentProvider: z.nativeEnum(PaymentProvider).default(PaymentProvider.BANK_TRANSFER),
  displayCurrency: z.string().trim().min(3).max(10).optional(),
  paymentMethodLabel: optionalNullableString,
  notes: optionalNullableString,
});

export const updatePreferredCurrencySchema = z.object({
  currency: z.string().trim().min(3).max(10),
});

export const uploadPaymentReceiptSchema = z.object({
  dataUrl: z.string().trim().min(1),
  fileName: optionalNullableString,
  mimeType: optionalNullableString,
  paymentReference: optionalNullableString,
  notes: optionalNullableString,
});

export const reviewPaymentSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  internalNotes: optionalNullableString,
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "PAYMENT_APPROVED",
    "PAID",
    "PROCESSING",
    "PURCHASED_FROM_SUPPLIER",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ]),
});

export const updateTrackingSchema = z.object({
  trackingNumber: optionalNullableString,
  carrier: optionalNullableString,
  trackingUrl: z.string().trim().url().optional().nullable(),
  estimatedDeliveryDate: z.string().datetime().optional().nullable(),
  shipmentNotes: optionalNullableString,
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided.",
});

export const updateAdminOrderSchema = z
  .object({
    status: z
      .enum([
        "PENDING",
        "PAYMENT_APPROVED",
        "PAID",
        "PROCESSING",
        "PURCHASED_FROM_SUPPLIER",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
      ])
      .optional(),
    trackingNumber: optionalNullableString,
    carrier: optionalNullableString,
    trackingUrl: z.string().trim().url().optional().nullable(),
    estimatedDeliveryDate: z.string().datetime().optional().nullable(),
    shipmentNotes: optionalNullableString,
    internalNotes: optionalNullableString,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const refundOrderSchema = z.object({
  amount: optionalNullableMoneySchema,
  internalNotes: optionalNullableString,
});

export const updateProcurementTaskSchema = z
  .object({
    status: z
      .enum(["PURCHASE_REQUIRED", "PURCHASED_FROM_SUPPLIER", "RECEIVED_AT_WAREHOUSE", "READY_TO_SHIP"])
      .optional(),
    supplierPrice: optionalMoneySchema,
    shippingToPortugal: optionalMoneySchema,
    customsCost: optionalMoneySchema,
    notes: optionalNullableString,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const upsertBankAccountSchema = z.object({
  id: cuidSchema.optional(),
  bankName: z.string().trim().min(2).max(120),
  accountHolder: z.string().trim().min(2).max(120),
  iban: optionalNullableString,
  accountNumber: optionalNullableString,
  cardNumber: optionalNullableString,
  swift: optionalNullableString,
  country: z.string().trim().min(2).max(120),
  currency: z.string().trim().min(3).max(10),
  isActive: z.boolean().optional(),
  notes: optionalNullableString,
});

export const upsertExchangeRateSchema = z.object({
  id: cuidSchema.optional(),
  baseCurrency: z.string().trim().min(3).max(10),
  quoteCurrency: z.string().trim().min(3).max(10),
  rate: z.coerce.number().positive(),
  isActive: z.boolean().optional(),
  notes: optionalNullableString,
});

export const upsertSourceSchema = z.object({
  id: cuidSchema.optional(),
  brandName: z.string().trim().min(2).max(120),
  website: z.string().trim().min(4).max(255),
  countryCode: z.union([z.string().trim().min(2).max(8), z.null()]).optional(),
  currencyCode: z.union([z.string().trim().min(3).max(10), z.null()]).optional(),
  region: z.union([z.string().trim().min(2).max(120), z.null()]).optional(),
  sourceType: z.enum(["PLAYWRIGHT", "JSON_FEED", "XML_FEED", "MANUAL_IMPORT"]),
  status: z.enum(["ACTIVE", "DISABLED", "ERROR"]).optional(),
  pricingRuleId: z.union([cuidSchema, z.null()]).optional(),
  shippingMethodId: z.union([cuidSchema, z.null()]).optional(),
  notes: optionalNullableString,
});
