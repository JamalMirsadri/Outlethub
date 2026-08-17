import { ProductSource, ProductStatus, StockStatus } from "@prisma/client";
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
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value.length > 0 ? value : null;
  });

const optionalMoney = z
  .union([z.coerce.number(), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    return Number(value);
  });

export const entityIdParamsSchema = z.object({
  id: cuidSchema,
});

export const entitySlugParamsSchema = z.object({
  slug: z.string().trim().min(1),
});

export const productVariantParamsSchema = z.object({
  id: cuidSchema,
  variantId: cuidSchema,
});

export const productImageParamsSchema = z.object({
  id: cuidSchema,
  imageId: cuidSchema,
});

export const createBrandSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: optionalString,
  logo: optionalNullableString,
  description: optionalNullableString,
  website: z.string().trim().url().optional().or(z.literal("")).transform((value) => {
    if (!value) {
      return undefined;
    }

    return value;
  }),
  isActive: z.boolean().optional().default(true),
  marginPercent: optionalMoney,
  isLuxury: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
});

export const updateBrandSchema = createBrandSchema.partial();

export const uploadBrandLogoSchema = z
  .object({
    dataUrl: z.string().trim().min(1).optional(),
    imageUrl: z.string().trim().url().optional(),
  })
  .refine((value) => Boolean(value.dataUrl || value.imageUrl), {
    message: "Provide either dataUrl or imageUrl.",
  });

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: optionalString,
  description: optionalNullableString,
  parentId: cuidSchema.optional().nullable(),
  icon: optionalNullableString,
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createProductVariantSchema = z.object({
  size: optionalNullableString,
  color: optionalNullableString,
  stockQuantity: z.coerce.number().int().min(0).optional().default(0),
});

export const updateProductVariantSchema = createProductVariantSchema.partial();

export const createProductImageSchema = z
  .object({
    dataUrl: z.string().trim().min(1).optional(),
    imageUrl: z.string().trim().url().optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    altText: optionalNullableString,
  })
  .refine((value) => Boolean(value.dataUrl || value.imageUrl), {
    message: "Provide either dataUrl or imageUrl.",
  });

export const reorderProductImagesSchema = z.object({
  imageIds: z.array(cuidSchema).min(1),
});

export const createProductSchema = z.object({
  sku: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(255),
  slug: optionalString,
  description: optionalNullableString,
  brandId: cuidSchema,
  categoryId: cuidSchema,
  price: z.coerce.number().nonnegative(),
  supplierPrice: optionalMoney,
  oldPrice: optionalMoney,
  outletPrice: optionalMoney,
  customPrice: optionalMoney,
  discountPercent: z.coerce.number().int().min(0).max(100).optional(),
  currency: z.string().trim().min(3).max(10).optional().default("EUR"),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")).transform((value) => {
    if (!value) {
      return undefined;
    }

    return value;
  }),
  sourceStore: optionalNullableString,
  sourceProductId: optionalNullableString,
  sourceType: z.nativeEnum(ProductSource).optional().default(ProductSource.MANUAL),
  status: z.nativeEnum(ProductStatus).optional().default(ProductStatus.DRAFT),
  stockStatus: z.nativeEnum(StockStatus).optional().default(StockStatus.UNKNOWN),
  stock: z.coerce.number().int().min(0).optional().default(0),
  useCustomPricing: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
  isTrending: z.boolean().optional().default(false),
  gender: optionalNullableString,
  material: optionalNullableString,
  sizes: z.array(z.string().trim().min(1)).optional(),
  colors: z.array(z.string().trim().min(1)).optional(),
  variants: z.array(createProductVariantSchema).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const importProductsCsvSchema = z.object({
  mode: z.enum(["PREVIEW", "IMPORT"]).default("PREVIEW"),
  content: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(255).optional(),
  brandId: cuidSchema,
  mainCategoryId: cuidSchema,
  subcategoryId: cuidSchema.optional().nullable(),
});

export const toggleFeaturedSchema = z.object({
  isFeatured: z.boolean(),
});

export const adminProductListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  search: optionalString,
  brandId: cuidSchema.optional(),
  categoryId: cuidSchema.optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

export const publicProductListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(60).optional().default(24),
  search: optionalString,
  brand: optionalString,
  category: optionalString,
  minDiscount: z.coerce.number().int().min(0).max(100).optional(),
  featured: z.coerce.boolean().optional(),
  sort: z
    .enum(["newest", "price_low", "price_high", "discount", "featured", "views", "purchases"])
    .optional()
    .default("newest"),
});
