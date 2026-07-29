import {
  DealLevel,
  Prisma,
  ProductSource,
  ProductStatus,
  StockStatus,
  type Brand,
  type Category,
  type PriceHistory,
  type Product,
  type ProductImage,
  type ProductVariant,
} from "@prisma/client";
import { z } from "zod";

import { cloudinary } from "../../config/cloudinary.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { pricingService } from "../commerce/pricing.service.js";
import { productMonitoringService } from "../monitoring/product-monitoring.service.js";
import type {
  adminProductListQuerySchema,
  createBrandSchema,
  createCategorySchema,
  createProductImageSchema,
  createProductSchema,
  createProductVariantSchema,
  publicProductListQuerySchema,
  reorderProductImagesSchema,
  updateBrandSchema,
  updateCategorySchema,
  updateProductSchema,
  updateProductVariantSchema,
  uploadBrandLogoSchema,
} from "./catalog.schemas.js";

type CreateBrandInput = z.infer<typeof createBrandSchema>;
type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
type UploadBrandLogoInput = z.infer<typeof uploadBrandLogoSchema>;
type CreateCategoryInput = z.infer<typeof createCategorySchema>;
type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;
type CreateVariantInput = z.infer<typeof createProductVariantSchema>;
type UpdateVariantInput = z.infer<typeof updateProductVariantSchema>;
type CreateProductImageInput = z.infer<typeof createProductImageSchema>;
type ReorderImagesInput = z.infer<typeof reorderProductImagesSchema>;
type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;
type PublicProductListQuery = z.infer<typeof publicProductListQuerySchema>;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    brand: true;
    category: true;
    images: { orderBy: { sortOrder: "asc" } };
    variants: { orderBy: [{ size: "asc" }, { color: "asc" }] };
    priceHistory: { orderBy: { capturedAt: "desc" }; take: 20 };
  };
}>;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function toDecimal(value: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal | null {
  if (value === undefined || value === null) {
    return null;
  }

  return new Prisma.Decimal(value);
}

function decimalEquals(
  left: number | string | Prisma.Decimal | null | undefined,
  right: number | string | Prisma.Decimal | null | undefined,
): boolean {
  if (left === null || left === undefined) {
    return right === null || right === undefined;
  }

  if (right === null || right === undefined) {
    return false;
  }

  return new Prisma.Decimal(left).equals(new Prisma.Decimal(right));
}

function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (!value) {
    return null;
  }

  return Number(value);
}

function normalizeDiscountPercent(price: number, oldPrice?: number | null, discountPercent?: number): number {
  if (discountPercent !== undefined) {
    return Math.max(0, Math.min(100, discountPercent));
  }

  if (!oldPrice || oldPrice <= 0 || price >= oldPrice) {
    return 0;
  }

  return Math.round((1 - price / oldPrice) * 100);
}

function resolveDealLevel(discountPercent: number | null | undefined): DealLevel {
  if ((discountPercent ?? 0) >= 70) {
    return DealLevel.FEATURED;
  }

  if ((discountPercent ?? 0) >= 60) {
    return DealLevel.HOT;
  }

  if ((discountPercent ?? 0) >= 50) {
    return DealLevel.GOOD;
  }

  return DealLevel.NONE;
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

async function resolveCategoryFilterIds(categoryFilter: string): Promise<string[]> {
  const normalizedFilter = categoryFilter.trim().toLowerCase();

  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
    },
  });

  const matchedCategories = categories.filter(
    (category) =>
      category.id === categoryFilter ||
      category.slug === categoryFilter ||
      category.name.trim().toLowerCase() === normalizedFilter,
  );

  if (matchedCategories.length === 0) {
    return [];
  }

  const categoryIds = new Set(matchedCategories.map((category) => category.id));
  const queue = [...categoryIds];

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId) {
      continue;
    }

    for (const category of categories) {
      if (category.parentId === currentId && !categoryIds.has(category.id)) {
        categoryIds.add(category.id);
        queue.push(category.id);
      }
    }
  }

  return [...categoryIds];
}

async function buildUniqueSlug(
  baseValue: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const baseSlug = slugify(baseValue) || `item-${Date.now()}`;
  let candidate = baseSlug;
  let suffix = 2;

  while (await exists(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function uploadCatalogAsset(input: { dataUrl?: string; imageUrl?: string }, folder: string, publicId?: string) {
  if (input.imageUrl) {
    return {
      imageUrl: input.imageUrl,
      cloudinaryPublicId: null,
      width: null,
      height: null,
      format: null,
      bytes: null,
    };
  }

  if (!input.dataUrl) {
    throw new ApiError(400, "No image payload was provided.");
  }

  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new ApiError(503, "Cloudinary is not configured.");
  }

  const result = await cloudinary.uploader.upload(input.dataUrl, {
    folder,
    public_id: publicId,
    overwrite: Boolean(publicId),
    resource_type: "image",
  });

  return {
    imageUrl: result.secure_url,
    cloudinaryPublicId: result.public_id,
    width: result.width ?? null,
    height: result.height ?? null,
    format: result.format ?? null,
    bytes: result.bytes ?? null,
  };
}

async function destroyCloudinaryAsset(publicId: string | null | undefined): Promise<void> {
  if (!publicId || !env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    return;
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });
}

function mapBrandResponse(brand: Brand) {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logo: brand.logo,
    cloudinaryPublicId: brand.cloudinaryPublicId,
    description: brand.description,
    website: brand.website,
    isActive: brand.isActive,
    marginPercent: toNumber(brand.marginPercent),
    isLuxury: brand.isLuxury,
    isFeatured: brand.isFeatured,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}

function mapCategoryResponse(
  category: Category & { parent: Category | null; children: Category[]; _count?: { products: number } },
) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    parentId: category.parentId,
    parent: category.parent
      ? {
          id: category.parent.id,
          name: category.parent.name,
          slug: category.parent.slug,
        }
      : null,
    children: category.children.map((child) => ({
      id: child.id,
      name: child.name,
      slug: child.slug,
      parentId: child.parentId,
    })),
    icon: category.icon,
    sortOrder: category.sortOrder,
    productCount: category._count?.products ?? undefined,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function mapPriceHistoryResponse(entry: PriceHistory) {
  return {
    id: entry.id,
    oldPrice: toNumber(entry.oldPrice),
    newPrice: toNumber(entry.newPrice),
    discountPercent: entry.discountPercent,
    capturedAt: entry.capturedAt,
  };
}

function mapProductImageResponse(image: ProductImage) {
  return {
    id: image.id,
    imageUrl: image.imageUrl,
    cloudinaryPublicId: image.cloudinaryPublicId,
    altText: image.altText,
    sortOrder: image.sortOrder,
    width: image.width,
    height: image.height,
    format: image.format,
    bytes: image.bytes,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
  };
}

function mapVariantResponse(variant: ProductVariant) {
  return {
    id: variant.id,
    size: variant.size,
    color: variant.color,
    stockQuantity: variant.stockQuantity,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };
}

function mapProductResponse(product: ProductWithRelations) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    description: product.description,
    brandId: product.brandId,
    categoryId: product.categoryId,
    price: toNumber(product.price),
    supplierPrice: toNumber(product.supplierPrice),
    customerPrice: toNumber(product.price),
    customPrice: toNumber(product.customPrice),
    profitAmount: toNumber(product.profitAmount),
    oldPrice: toNumber(product.oldPrice),
    outletPrice: toNumber(product.outletPrice),
    discountPercent: product.discountPercent ?? 0,
    dealLevel: product.dealLevel,
    contentHash: product.contentHash,
    currency: product.currency,
    sourceUrl: product.sourceUrl,
    sourceStore: product.sourceStore,
    sourceProductId: product.sourceProductId,
    sourceType: product.sourceType,
    status: product.status,
    stock: product.stock,
    stockStatus: product.stockStatus,
    isFeatured: product.isFeatured,
    isTrending: product.isTrending,
    useCustomPricing: product.useCustomPricing,
    deletedAt: product.deletedAt,
    brand: {
      id: product.brand.id,
      name: product.brand.name,
      slug: product.brand.slug,
      logo: product.brand.logo,
    },
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
      parentId: product.category.parentId,
    },
    gender: product.gender,
    material: product.material,
    sizes: product.sizes,
    colors: product.colors,
    images: product.images.map(mapProductImageResponse),
    variants: product.variants.map(mapVariantResponse),
    priceHistory: product.priceHistory.map(mapPriceHistoryResponse),
    views: product.views,
    purchases: product.purchases,
    importedAt: product.importedAt,
    lastSyncedAt: product.lastSyncedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

async function getProductOrThrow(productId: string): Promise<ProductWithRelations> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      brand: true,
      category: true,
      images: {
        orderBy: { sortOrder: "asc" },
      },
      variants: {
        orderBy: [{ size: "asc" }, { color: "asc" }],
      },
      priceHistory: {
        orderBy: { capturedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!product) {
    throw new ApiError(404, "Product not found.");
  }

  return product;
}

function buildProductData(input: CreateProductInput | UpdateProductInput) {
  const price = input.price;
  const supplierPrice = input.supplierPrice ?? input.price;
  const oldPrice = input.oldPrice ?? null;
  const outletPrice = input.outletPrice ?? null;
  const discountPercent = price !== undefined ? normalizeDiscountPercent(price, oldPrice, input.discountPercent) : undefined;

  return {
    sku: input.sku,
    name: input.name,
    slug: input.slug,
    description: input.description,
    brandId: input.brandId,
    categoryId: input.categoryId,
    price: price !== undefined ? new Prisma.Decimal(price) : undefined,
    supplierPrice: supplierPrice !== undefined ? toDecimal(supplierPrice) : undefined,
    oldPrice: oldPrice !== undefined ? toDecimal(oldPrice) : undefined,
    outletPrice: outletPrice !== undefined ? toDecimal(outletPrice) : undefined,
    customPrice: input.customPrice !== undefined ? toDecimal(input.customPrice) : undefined,
    discountPercent,
    dealLevel: discountPercent !== undefined ? resolveDealLevel(discountPercent) : undefined,
    currency: input.currency,
    sourceUrl: input.sourceUrl,
    sourceStore: input.sourceStore,
    sourceProductId: input.sourceProductId,
    sourceType: input.sourceType,
    status: input.status,
    stock: input.stock,
    stockStatus: input.stockStatus,
    useCustomPricing: input.useCustomPricing,
    isFeatured: input.isFeatured,
    isTrending: input.isTrending,
    gender: input.gender,
    material: input.material,
  };
}

async function syncVariantDerivedFields(productId: string, transaction: Prisma.TransactionClient): Promise<void> {
  const variants = await transaction.productVariant.findMany({
    where: { productId },
    orderBy: [{ size: "asc" }, { color: "asc" }],
  });

  await transaction.product.update({
    where: { id: productId },
    data: {
      sizes: uniqueValues(variants.map((variant) => variant.size)),
      colors: uniqueValues(variants.map((variant) => variant.color)),
      stock: variants.reduce((total, variant) => total + variant.stockQuantity, 0),
    },
  });
}

async function maybeRecordPriceHistory(
  transaction: Prisma.TransactionClient,
  previous: Product | null,
  current: Product,
): Promise<void> {
  const changed =
    !previous ||
    !decimalEquals(previous.price, current.price) ||
    !decimalEquals(previous.oldPrice, current.oldPrice) ||
    previous.discountPercent !== current.discountPercent;

  if (!changed) {
    return;
  }

  await transaction.priceHistory.create({
    data: {
      productId: current.id,
      oldPrice: current.oldPrice,
      newPrice: current.price,
      discountPercent: current.discountPercent,
    },
  });
}

export class CatalogService {
  public async listAdminBrands() {
    const brands = await prisma.brand.findMany({
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    });

    return brands.map(mapBrandResponse);
  }

  public async createBrand(input: CreateBrandInput) {
    const slug =
      input.slug ??
      (await buildUniqueSlug(input.name, async (candidate) => {
        const existing = await prisma.brand.findUnique({ where: { slug: candidate } });
        return Boolean(existing);
      }));

    const brand = await prisma.brand.create({
      data: {
        name: input.name,
        slug,
        logo: input.logo ?? null,
        description: input.description ?? null,
        website: input.website ?? null,
        isActive: input.isActive,
        marginPercent: toDecimal(input.marginPercent),
        isLuxury: input.isLuxury,
        isFeatured: input.isFeatured,
      },
    });

    return mapBrandResponse(brand);
  }

  public async updateBrand(id: string, input: UpdateBrandInput) {
    const existing = await prisma.brand.findUnique({ where: { id } });

    if (!existing) {
      throw new ApiError(404, "Brand not found.");
    }

    const slug =
      input.slug ??
      (input.name
        ? await buildUniqueSlug(input.name, async (candidate) => {
            const conflict = await prisma.brand.findFirst({
              where: {
                slug: candidate,
                id: { not: id },
              },
            });
            return Boolean(conflict);
          })
        : undefined);

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        logo: input.logo,
        description: input.description,
        website: input.website,
        isActive: input.isActive,
        marginPercent: input.marginPercent !== undefined ? toDecimal(input.marginPercent) : undefined,
        isLuxury: input.isLuxury,
        isFeatured: input.isFeatured,
      },
    });

    return mapBrandResponse(brand);
  }

  public async uploadBrandLogo(id: string, input: UploadBrandLogoInput) {
    const existing = await prisma.brand.findUnique({ where: { id } });

    if (!existing) {
      throw new ApiError(404, "Brand not found.");
    }

    const upload = await uploadCatalogAsset(input, "outlethub/brands", existing.cloudinaryPublicId ?? undefined);

    if (existing.cloudinaryPublicId && existing.cloudinaryPublicId !== upload.cloudinaryPublicId) {
      await destroyCloudinaryAsset(existing.cloudinaryPublicId);
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        logo: upload.imageUrl,
        cloudinaryPublicId: upload.cloudinaryPublicId,
      },
    });

    return mapBrandResponse(brand);
  }

  public async deleteBrand(id: string) {
    const productCount = await prisma.product.count({
      where: {
        brandId: id,
        deletedAt: null,
      },
    });

    if (productCount > 0) {
      throw new ApiError(409, "Brand cannot be deleted while products are still assigned to it.");
    }

    const existing = await prisma.brand.findUnique({ where: { id } });

    if (!existing) {
      throw new ApiError(404, "Brand not found.");
    }

    await prisma.brand.delete({ where: { id } });
    await destroyCloudinaryAsset(existing.cloudinaryPublicId);
  }

  public async listAdminCategories() {
    const categories = await prisma.category.findMany({
      include: {
        parent: true,
        children: {
          orderBy: { name: "asc" },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return categories.map(mapCategoryResponse);
  }

  public async createCategory(input: CreateCategoryInput) {
    if (input.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: input.parentId } });

      if (!parent) {
        throw new ApiError(404, "Parent category not found.");
      }
    }

    const slug =
      input.slug ??
      (await buildUniqueSlug(input.name, async (candidate) => {
        const existing = await prisma.category.findUnique({ where: { slug: candidate } });
        return Boolean(existing);
      }));

    const category = await prisma.category.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
        icon: input.icon ?? null,
        sortOrder: input.sortOrder,
      },
      include: {
        parent: true,
        children: true,
      },
    });

    return mapCategoryResponse(category);
  }

  public async updateCategory(id: string, input: UpdateCategoryInput) {
    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing) {
      throw new ApiError(404, "Category not found.");
    }

    if (input.parentId === id) {
      throw new ApiError(400, "A category cannot be its own parent.");
    }

    if (input.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: input.parentId } });

      if (!parent) {
        throw new ApiError(404, "Parent category not found.");
      }
    }

    const slug =
      input.slug ??
      (input.name
        ? await buildUniqueSlug(input.name, async (candidate) => {
            const conflict = await prisma.category.findFirst({
              where: {
                slug: candidate,
                id: { not: id },
              },
            });
            return Boolean(conflict);
          })
        : undefined);

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        description: input.description,
        parentId: input.parentId,
        icon: input.icon,
        sortOrder: input.sortOrder,
      },
      include: {
        parent: true,
        children: true,
      },
    });

    return mapCategoryResponse(category);
  }

  public async deleteCategory(id: string) {
    const [productCount, childCount] = await Promise.all([
      prisma.product.count({
        where: {
          categoryId: id,
          deletedAt: null,
        },
      }),
      prisma.category.count({
        where: { parentId: id },
      }),
    ]);

    if (productCount > 0 || childCount > 0) {
      throw new ApiError(409, "Category cannot be deleted while it still has products or child categories.");
    }

    await prisma.category.delete({ where: { id } });
  }

  public async listAdminProducts(query: AdminProductListQuery) {
    const where: Prisma.ProductWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { sku: { contains: query.search, mode: "insensitive" } },
              { brand: { name: { contains: query.search, mode: "insensitive" } } },
              { category: { name: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          brand: true,
          category: true,
          images: { orderBy: { sortOrder: "asc" } },
          variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
          priceHistory: { orderBy: { capturedAt: "desc" }, take: 20 },
        },
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: query.pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items: items.map(mapProductResponse),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  public async getAdminProduct(id: string) {
    const product = await getProductOrThrow(id);
    return mapProductResponse(product);
  }

  public async createProduct(input: CreateProductInput) {
    const productId = await prisma.$transaction(async (transaction) => {
      const slug =
        input.slug ??
        (await buildUniqueSlug(input.name, async (candidate) => {
          const existing = await transaction.product.findUnique({ where: { slug: candidate } });
          return Boolean(existing);
        }));

      const normalized = buildProductData(input);
      const created = await transaction.product.create({
        data: {
          sku: normalized.sku!,
          name: normalized.name!,
          slug,
          description: normalized.description ?? null,
          brandId: normalized.brandId!,
          categoryId: normalized.categoryId!,
          price: normalized.price!,
          supplierPrice: normalized.supplierPrice,
          oldPrice: normalized.oldPrice,
          outletPrice: normalized.outletPrice,
          customPrice: normalized.customPrice,
          discountPercent: normalized.discountPercent ?? 0,
          dealLevel: normalized.dealLevel ?? DealLevel.NONE,
          currency: normalized.currency ?? "EUR",
          sourceUrl: normalized.sourceUrl ?? null,
          sourceStore: normalized.sourceStore ?? null,
          sourceProductId: normalized.sourceProductId ?? null,
          sourceType: normalized.sourceType ?? ProductSource.MANUAL,
          status: normalized.status ?? ProductStatus.DRAFT,
          stock: normalized.stock ?? 0,
          stockStatus: normalized.stockStatus ?? StockStatus.UNKNOWN,
          useCustomPricing: normalized.useCustomPricing ?? false,
          isFeatured: normalized.isFeatured ?? false,
          isTrending: normalized.isTrending ?? false,
          gender: normalized.gender ?? null,
          material: normalized.material ?? null,
          importedAt: new Date(),
          lastSyncedAt: new Date(),
          sizes: input.sizes ?? [],
          colors: input.colors ?? [],
        },
      });

      if (input.variants?.length) {
        await transaction.productVariant.createMany({
          data: input.variants.map((variant: CreateVariantInput) => ({
            productId: created.id,
            size: variant.size ?? null,
            color: variant.color ?? null,
            stockQuantity: variant.stockQuantity,
          })),
        });

        await syncVariantDerivedFields(created.id, transaction);
      }

      const current = await transaction.product.findUniqueOrThrow({
        where: { id: created.id },
      });

      await maybeRecordPriceHistory(transaction, null, current);
      return created.id;
    });

    await pricingService.repriceProduct(productId);
    await productMonitoringService.ensureWebsiteProfileForProduct(productId);
    const product = await getProductOrThrow(productId);
    return mapProductResponse(product);
  }

  public async updateProduct(id: string, input: UpdateProductInput) {
    const productId = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.product.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new ApiError(404, "Product not found.");
      }

      const slug =
        input.slug ??
        (input.name
          ? await buildUniqueSlug(input.name, async (candidate) => {
              const conflict = await transaction.product.findFirst({
                where: {
                  slug: candidate,
                  id: { not: id },
                },
              });
              return Boolean(conflict);
            })
          : undefined);

      const normalized = buildProductData(input);
      const updated = await transaction.product.update({
        where: { id },
        data: {
          sku: normalized.sku,
          name: normalized.name,
          slug,
          description: normalized.description,
          brandId: normalized.brandId,
          categoryId: normalized.categoryId,
          price: normalized.price ?? undefined,
          supplierPrice: normalized.supplierPrice !== undefined ? normalized.supplierPrice : undefined,
          oldPrice: normalized.oldPrice !== undefined ? normalized.oldPrice : undefined,
          outletPrice: normalized.outletPrice !== undefined ? normalized.outletPrice : undefined,
          customPrice: normalized.customPrice !== undefined ? normalized.customPrice : undefined,
          discountPercent: normalized.discountPercent,
          dealLevel: normalized.dealLevel,
          currency: normalized.currency,
          sourceUrl: normalized.sourceUrl,
          sourceStore: normalized.sourceStore,
          sourceProductId: normalized.sourceProductId,
          sourceType: normalized.sourceType,
          status: normalized.status,
          stock: normalized.stock,
          stockStatus: normalized.stockStatus,
          useCustomPricing: normalized.useCustomPricing,
          isFeatured: normalized.isFeatured,
          isTrending: normalized.isTrending,
          gender: normalized.gender,
          material: normalized.material,
          lastSyncedAt: new Date(),
          sizes: input.sizes,
          colors: input.colors,
        },
      });

      await maybeRecordPriceHistory(transaction, existing, updated);
      return id;
    });

    await pricingService.repriceProduct(productId);
    await productMonitoringService.ensureWebsiteProfileForProduct(productId);
    const product = await getProductOrThrow(productId);
    return mapProductResponse(product);
  }

  public async bulkCreateProducts(inputs: CreateProductInput[]) {
    const items: ReturnType<CatalogService["createProduct"]>[] = [];

    for (const input of inputs) {
      items.push(this.createProduct(input));
    }

    return Promise.all(items);
  }

  public async bulkUpdateProducts(inputs: Array<{ id: string; data: UpdateProductInput }>) {
    const items: ReturnType<CatalogService["updateProduct"]>[] = [];

    for (const input of inputs) {
      items.push(this.updateProduct(input.id, input.data));
    }

    return Promise.all(items);
  }

  public async deleteProduct(id: string) {
    const existing = await prisma.product.findUnique({ where: { id } });

    if (!existing) {
      throw new ApiError(404, "Product not found.");
    }

    await prisma.product.delete({
      where: { id },
    });
  }

  public async setFeatured(id: string, isFeatured: boolean) {
    const product = await prisma.product.update({
      where: { id },
      data: {
        isFeatured,
      },
    });

    return {
      id: product.id,
      isFeatured: product.isFeatured,
    };
  }

  public async listPriceHistory(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    const history = await prisma.priceHistory.findMany({
      where: { productId: id },
      orderBy: { capturedAt: "desc" },
      take: 100,
    });

    return history.map(mapPriceHistoryResponse);
  }

  public async createVariant(productId: string, input: CreateVariantInput) {
    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        size: input.size ?? null,
        color: input.color ?? null,
        stockQuantity: input.stockQuantity,
      },
    });

    await prisma.$transaction(async (transaction) => {
      await syncVariantDerivedFields(productId, transaction);
    });

    return mapVariantResponse(variant);
  }

  public async updateVariant(productId: string, variantId: string, input: UpdateVariantInput) {
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
      },
    });

    if (!variant) {
      throw new ApiError(404, "Variant not found.");
    }

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        size: input.size,
        color: input.color,
        stockQuantity: input.stockQuantity,
      },
    });

    await prisma.$transaction(async (transaction) => {
      await syncVariantDerivedFields(productId, transaction);
    });

    return mapVariantResponse(updated);
  }

  public async deleteVariant(productId: string, variantId: string) {
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
      },
    });

    if (!variant) {
      throw new ApiError(404, "Variant not found.");
    }

    await prisma.productVariant.delete({ where: { id: variantId } });
    await prisma.$transaction(async (transaction) => {
      await syncVariantDerivedFields(productId, transaction);
    });
  }

  public async uploadProductImage(productId: string, input: CreateProductImageInput) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: {
          orderBy: { sortOrder: "desc" },
          take: 1,
        },
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    const upload = await uploadCatalogAsset(input, "outlethub/products");
    const image = await prisma.productImage.create({
      data: {
        productId,
        imageUrl: upload.imageUrl,
        cloudinaryPublicId: upload.cloudinaryPublicId,
        sortOrder: input.sortOrder ?? (product.images[0]?.sortOrder ?? -1) + 1,
        altText: input.altText ?? product.name,
        width: upload.width,
        height: upload.height,
        format: upload.format,
        bytes: upload.bytes,
      },
    });

    return mapProductImageResponse(image);
  }

  public async deleteProductImage(productId: string, imageId: string) {
    const image = await prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new ApiError(404, "Product image not found.");
    }

    await prisma.productImage.delete({
      where: { id: imageId },
    });

    await destroyCloudinaryAsset(image.cloudinaryPublicId);
  }

  public async reorderProductImages(productId: string, input: ReorderImagesInput) {
    const images = await prisma.productImage.findMany({
      where: {
        productId,
      },
    });

    if (images.length !== input.imageIds.length) {
      throw new ApiError(400, "The supplied image order does not match the stored product images.");
    }

    await prisma.$transaction(
      input.imageIds.map((imageId: string, index: number) =>
        prisma.productImage.update({
          where: { id: imageId },
          data: { sortOrder: index },
        }),
      ),
    );

    const updated = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: "asc" },
    });

    return updated.map(mapProductImageResponse);
  }

  public async listPublicProducts(query: PublicProductListQuery) {
    const categoryIds = query.category ? await resolveCategoryFilterIds(query.category) : [];

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
      ...(query.minDiscount !== undefined ? { discountPercent: { gte: query.minDiscount } } : {}),
      ...(query.brand
        ? {
            brand: {
              OR: [
                { id: query.brand },
                { slug: query.brand },
                { name: { equals: query.brand, mode: "insensitive" } },
              ],
            },
          }
        : {}),
      ...(query.category
        ? {
            categoryId: {
              in: categoryIds,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { sku: { contains: query.search, mode: "insensitive" } },
              { brand: { name: { contains: query.search, mode: "insensitive" } } },
              { category: { name: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.pageSize;
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === "price_low"
        ? [{ price: "asc" }, { createdAt: "desc" }]
        : query.sort === "price_high"
          ? [{ price: "desc" }, { createdAt: "desc" }]
          : query.sort === "discount"
            ? [{ discountPercent: "desc" }, { createdAt: "desc" }]
            : query.sort === "featured"
              ? [{ isFeatured: "desc" }, { createdAt: "desc" }]
              : query.sort === "views"
                ? [{ views: "desc" }, { createdAt: "desc" }]
                : query.sort === "purchases"
                  ? [{ purchases: "desc" }, { createdAt: "desc" }]
              : [{ createdAt: "desc" }];

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          brand: true,
          category: true,
          images: { orderBy: { sortOrder: "asc" } },
          variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
          priceHistory: { orderBy: { capturedAt: "desc" }, take: 20 },
        },
        orderBy,
        skip,
        take: query.pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items: items.map(mapProductResponse),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  public async getPublicProductBySlug(slug: string) {
    const product = await prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        brand: true,
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
        priceHistory: { orderBy: { capturedAt: "desc" }, take: 20 },
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    const [viewedProduct, relatedProducts] = await Promise.all([
      prisma.product.update({
        where: { id: product.id },
        data: {
          views: {
            increment: 1,
          },
        },
        include: {
          brand: true,
          category: true,
          images: { orderBy: { sortOrder: "asc" } },
          variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
          priceHistory: { orderBy: { capturedAt: "desc" }, take: 20 },
        },
      }),
      prisma.product.findMany({
        where: {
          id: { not: product.id },
          brandId: product.brandId,
          status: ProductStatus.ACTIVE,
          deletedAt: null,
        },
        include: {
          brand: true,
          category: true,
          images: { orderBy: { sortOrder: "asc" } },
          variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
          priceHistory: { orderBy: { capturedAt: "desc" }, take: 5 },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      product: mapProductResponse(viewedProduct),
      relatedProducts: relatedProducts.map(mapProductResponse),
    };
  }

  public async getPublicProductById(id: string) {
    const product = await prisma.product.findFirst({
      where: {
        id,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        brand: true,
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
        priceHistory: { orderBy: { capturedAt: "desc" }, take: 20 },
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    const viewedProduct = await prisma.product.update({
      where: { id: product.id },
      data: {
        views: {
          increment: 1,
        },
      },
      include: {
        brand: true,
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
        priceHistory: { orderBy: { capturedAt: "desc" }, take: 20 },
      },
    });

    return mapProductResponse(viewedProduct);
  }

  public async getCatalogFilters() {
    const [brands, categories] = await Promise.all([
      prisma.brand.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.category.findMany({
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);

    return {
      brands: brands.map(mapBrandResponse),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        parentId: category.parentId,
      })),
    };
  }
}

export const catalogService = new CatalogService();
