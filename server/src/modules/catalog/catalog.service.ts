import { createHash } from "node:crypto";

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
import { randomUUID } from "node:crypto";
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
  importProductsCsvSchema,
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
type ImportProductsCsvInput = z.infer<typeof importProductsCsvSchema>;
type ImportProductsCsvMode = ImportProductsCsvInput["mode"];
type CreateVariantInput = z.infer<typeof createProductVariantSchema>;
type UpdateVariantInput = z.infer<typeof updateProductVariantSchema>;
type CreateProductImageInput = z.infer<typeof createProductImageSchema>;
type ReorderImagesInput = z.infer<typeof reorderProductImagesSchema>;
type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;
type PublicProductListQuery = z.infer<typeof publicProductListQuerySchema>;
type BusinessSettingsRecord = Awaited<ReturnType<typeof pricingService.getBusinessSettings>>;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    brand: true;
    category: true;
    images: { orderBy: { sortOrder: "asc" } };
    variants: { orderBy: [{ size: "asc" }, { color: "asc" }] };
    priceHistory: { orderBy: { capturedAt: "desc" }; take: 20 };
  };
}>;

const PRODUCT_CSV_REQUIRED_COLUMNS = [
  "Title",
  "OriginalPrice",
  "OutletPrice",
  "SourceStore",
  "SourceURL",
  "Brand",
  "Category",
  "ProductImages",
  "Description",
  "Color",
  "Size",
  "Stock",
  "Status",
  "Gender",
] as const;

const PRODUCT_CSV_IMPORT_BATCH_SIZE = 100;
const DEFAULT_IMPORTED_STOCK_QUANTITY = 10;

interface ParsedCsvDocument {
  headers: string[];
  rows: string[][];
}

interface ProductCsvImportRowIssue {
  rowNumber: number;
  status: "SKIPPED" | "FAILED";
  reason: string;
  sourceUrl: string | null;
  title: string | null;
}

interface ProductCsvImportSummary {
  total: number;
  previousMatchingProductCount: number;
  deleted: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  finalProductCount: number;
}

interface ProductCsvImportSelectionSummary {
  brand: {
    id: string;
    name: string;
  };
  mainCategory: {
    id: string;
    name: string;
  };
  destinationCategory: {
    id: string;
    name: string;
    parentId: string | null;
  };
}

interface ProductCsvImportResult {
  mode: ImportProductsCsvMode;
  readyToImport: boolean;
  confirmationMessage: string | null;
  selection: ProductCsvImportSelectionSummary;
  summary: ProductCsvImportSummary;
  issues: ProductCsvImportRowIssue[];
}

interface PreparedProductCsvImport {
  selection: ProductCsvImportSelectionSummary;
  destinationCategoryId: string;
  scopeCategoryIds: string[];
  rows: PreparedImportedProductCsvRow[];
  issues: ProductCsvImportRowIssue[];
  summary: ProductCsvImportSummary;
}

interface ProductCsvRow {
  Title: string;
  OriginalPrice: string;
  OutletPrice: string;
  SourceStore: string;
  SourceURL: string;
  Brand: string;
  Category: string;
  ProductImages: string;
  Description: string;
  Color: string;
  Size: string;
  Stock: string;
  Status: string;
  Gender: string;
}

interface NormalizedProductCsvRow {
  rowNumber: number;
  title?: string;
  originalPrice?: number;
  outletPrice?: number;
  sourceStore?: string;
  sourceUrl: string;
  brand?: string;
  category?: string;
  imageUrls?: string[];
  description?: string;
  colors?: string[];
  sizes?: string[];
  stockQuantity?: number;
  stockStatus?: StockStatus;
  status?: ProductStatus;
  gender?: string;
}

interface PreparedImportedProductCsvRow {
  rowNumber: number;
  title: string;
  sourceUrl: string;
  sourceStore: string | null;
  productId: string;
  product: Prisma.ProductCreateManyInput;
  images: Prisma.ProductImageCreateManyInput[];
  variants: Prisma.ProductVariantCreateManyInput[];
  priceHistory: Prisma.PriceHistoryCreateManyInput;
  monitoringSource: {
    sourceUrl: string;
    sourceStore: string | null;
  } | null;
}

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

function stripUtf8Bom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

function parseCsvDocument(content: string): ParsedCsvDocument {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    currentRow.push(currentField);
    currentField = "";
  };

  const pushRow = () => {
    if (currentRow.length === 1 && currentRow[0] === "") {
      currentRow = [];
      return;
    }

    rows.push(currentRow);
    currentRow = [];
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      pushField();
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      pushField();
      pushRow();
      continue;
    }

    currentField += character;
  }

  if (inQuotes) {
    throw new ApiError(400, "CSV parsing failed because a quoted field was not closed.");
  }

  pushField();
  if (currentRow.length > 1 || currentRow[0] !== "") {
    pushRow();
  }

  if (rows.length === 0) {
    throw new ApiError(400, "CSV file is empty.");
  }

  const headerRow = rows[0];
  if (!headerRow) {
    throw new ApiError(400, "CSV file is empty.");
  }

  const headers = headerRow.map((value, index) => {
    const normalized = index === 0 ? stripUtf8Bom(value) : value;
    return normalized.trim();
  });

  return {
    headers,
    rows: rows.slice(1),
  };
}

function validateProductCsvHeaders(headers: string[]): void {
  const missingColumns = PRODUCT_CSV_REQUIRED_COLUMNS.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    throw new ApiError(400, `CSV is missing required columns: ${missingColumns.join(", ")}.`);
  }
}

function mapCsvRow(headers: string[], values: string[]): ProductCsvRow {
  const record = headers.reduce<Record<string, string>>((accumulator, header, index) => {
    accumulator[header] = (values[index] ?? "").trim();
    return accumulator;
  }, {});

  return {
    Title: record.Title ?? "",
    OriginalPrice: record.OriginalPrice ?? "",
    OutletPrice: record.OutletPrice ?? "",
    SourceStore: record.SourceStore ?? "",
    SourceURL: record.SourceURL ?? "",
    Brand: record.Brand ?? "",
    Category: record.Category ?? "",
    ProductImages: record.ProductImages ?? "",
    Description: record.Description ?? "",
    Color: record.Color ?? "",
    Size: record.Size ?? "",
    Stock: record.Stock ?? "",
    Status: record.Status ?? "",
    Gender: record.Gender ?? "",
  };
}

function normalizeCsvString(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseCsvMoney(value: string, fieldName: string, rowNumber: number): number | undefined {
  const normalized = normalizeCsvString(value);
  if (!normalized) {
    return undefined;
  }

  const sanitized = normalized.replace(/\s+/g, "").replace(/[^0-9,.-]/g, "");
  if (!sanitized) {
    throw new ApiError(400, `Row ${rowNumber}: ${fieldName} must be a valid number.`);
  }

  let decimalValue = sanitized;
  const lastCommaIndex = sanitized.lastIndexOf(",");
  const lastDotIndex = sanitized.lastIndexOf(".");

  if (lastCommaIndex >= 0 && lastDotIndex >= 0) {
    if (lastCommaIndex > lastDotIndex) {
      decimalValue = sanitized.replace(/\./g, "").replace(",", ".");
    } else {
      decimalValue = sanitized.replace(/,/g, "");
    }
  } else if (lastCommaIndex >= 0) {
    const commaParts = sanitized.split(",");
    const fractionalPart = commaParts.at(-1) ?? "";
    if (commaParts.length === 2 && fractionalPart.length > 0 && fractionalPart.length <= 2) {
      decimalValue = `${commaParts[0] ?? "0"}.${fractionalPart}`;
    } else if (commaParts.length > 1 && fractionalPart.length > 0 && fractionalPart.length <= 2) {
      decimalValue = `${commaParts.slice(0, -1).join("")}.${fractionalPart}`;
    } else {
      decimalValue = sanitized.replace(/,/g, "");
    }
  } else if (lastDotIndex >= 0) {
    const dotParts = sanitized.split(".");
    const fractionalPart = dotParts.at(-1) ?? "";
    if (!(dotParts.length > 1 && fractionalPart.length === 3)) {
      decimalValue = sanitized;
    } else {
      decimalValue = sanitized.replace(/\./g, "");
    }
  }

  const parsed = Number(decimalValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ApiError(400, `Row ${rowNumber}: ${fieldName} must be a valid non-negative number.`);
  }

  return parsed;
}

function parseCsvStockField(value: string): Pick<NormalizedProductCsvRow, "stockQuantity" | "stockStatus"> {
  const normalized = normalizeCsvString(value);
  if (!normalized) {
    return {
      stockQuantity: DEFAULT_IMPORTED_STOCK_QUANTITY,
      stockStatus: StockStatus.IN_STOCK,
    };
  }

  const parsedQuantity = Number(normalized);
  if (Number.isInteger(parsedQuantity) && parsedQuantity >= 0) {
    return {
      stockQuantity: parsedQuantity,
      stockStatus: deriveStockStatus(parsedQuantity),
    };
  }

  const stockStatusValue = normalized
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  switch (stockStatusValue) {
    case "in stock":
    case "available":
    case "availability":
      return {
        stockQuantity: DEFAULT_IMPORTED_STOCK_QUANTITY,
        stockStatus: StockStatus.IN_STOCK,
      };
    case "limited":
    case "limited stock":
    case "low stock":
    case "few left":
      return {
        stockQuantity: DEFAULT_IMPORTED_STOCK_QUANTITY,
        stockStatus: StockStatus.LOW_STOCK,
      };
    case "out of stock":
    case "sold out":
    case "unavailable":
      return {
        stockQuantity: 0,
        stockStatus: StockStatus.OUT_OF_STOCK,
      };
    default:
      return {
        stockQuantity: DEFAULT_IMPORTED_STOCK_QUANTITY,
        stockStatus: StockStatus.IN_STOCK,
      };
  }
}

function normalizeSourceUrl(value: string, rowNumber: number): string {
  const normalized = normalizeCsvString(value);
  if (!normalized) {
    throw new ApiError(400, `Row ${rowNumber}: SourceURL is required.`);
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalized);
  } catch {
    throw new ApiError(400, `Row ${rowNumber}: SourceURL must be a valid URL.`);
  }

  parsedUrl.hash = "";
  return parsedUrl.toString();
}

function parseCsvList(value: string, separator: string | RegExp): string[] | undefined {
  const normalized = normalizeCsvString(value);
  if (!normalized) {
    return undefined;
  }

  const items = [...new Set(normalized.split(separator).map((item) => item.trim()).filter(Boolean))];
  return items.length > 0 ? items : undefined;
}

function parseCsvImageUrls(value: string): string[] | undefined {
  const items = parseCsvList(value, "|");
  if (!items) {
    return undefined;
  }

  const validUrls = items.flatMap((item) => {
    try {
      return [new URL(item).toString()];
    } catch {
      return [];
    }
  });

  return validUrls.length > 0 ? validUrls : undefined;
}

function parseCsvStatus(value: string, rowNumber: number): ProductStatus | undefined {
  const normalized = normalizeCsvString(value);
  if (!normalized) {
    return undefined;
  }

  switch (normalized.toLowerCase()) {
    case "active":
    case "published":
    case "live":
      return ProductStatus.ACTIVE;
    case "draft":
    case "pending":
      return ProductStatus.DRAFT;
    case "archived":
    case "inactive":
    case "hidden":
      return ProductStatus.ARCHIVED;
    default:
      throw new ApiError(400, `Row ${rowNumber}: Status must be active, draft, or archived.`);
  }
}

function deriveStockStatus(stock: number): StockStatus {
  if (stock <= 0) {
    return StockStatus.OUT_OF_STOCK;
  }

  if (stock <= 3) {
    return StockStatus.LOW_STOCK;
  }

  return StockStatus.IN_STOCK;
}

function getCsvImportFailureReason(error: unknown, rowNumber: number): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta.target as string[]).join(", ")
        : typeof error.meta?.target === "string"
          ? error.meta.target
          : "a unique field";
      return `Row ${rowNumber}: Product data conflicts with an existing unique value (${target}).`;
    }

    if (error.code === "P2003") {
      return `Row ${rowNumber}: Product data references a related record that no longer exists or cannot be deleted safely.`;
    }

    if (error.code === "P2025") {
      return `Row ${rowNumber}: A required related product record was not found during import.`;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return `Row ${rowNumber}: ${error.message}`;
  }

  return `Row ${rowNumber}: Product import failed unexpectedly.`;
}

function buildCsvImportSku(sourceUrl: string, brandId?: string, categoryId?: string): string {
  const digest = createHash("sha1")
    .update([sourceUrl.toLowerCase(), brandId ?? "", categoryId ?? ""].join("|"))
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
  return `CSV-${digest}`;
}

function buildImportEntityId(seed: string): string {
  return `c${createHash("sha1").update(seed).digest("hex").slice(0, 24)}`;
}

function buildCsvImportSlug(name: string, sourceUrl: string, brandId: string, categoryId: string): string {
  const baseSlug = slugify(name) || "imported-item";
  const suffix = createHash("sha1")
    .update([sourceUrl.toLowerCase(), brandId, categoryId].join("|"))
    .digest("hex")
    .slice(0, 8);

  return `${baseSlug.slice(0, 80)}-${suffix}`;
}

function buildImportedVariants(row: NormalizedProductCsvRow): CreateVariantInput[] {
  const stockQuantity = row.stockQuantity ?? DEFAULT_IMPORTED_STOCK_QUANTITY;
  const colors = row.colors?.length ? row.colors : [undefined];

  if (row.sizes?.length) {
    return row.sizes.flatMap((size) =>
      colors.map((color) => ({
        size,
        color,
        stockQuantity,
      })),
    );
  }

  if (row.colors?.length) {
    return row.colors.map((color) => ({
      color,
      stockQuantity,
    }));
  }

  return [];
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function collectCategoryTreeIds(
  categories: Array<{ id: string; parentId: string | null }>,
  rootCategoryId: string,
): string[] {
  const categoryIds = new Set<string>([rootCategoryId]);
  const queue = [rootCategoryId];

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

function getMonitoringSourceKey(sourceUrl: string, sourceStore: string | null): string {
  let host = sourceUrl;

  try {
    host = new URL(sourceUrl).host.toLowerCase();
  } catch {}

  return `${host}|${sourceStore ?? ""}`;
}

function normalizeProductCsvRow(row: ProductCsvRow, rowNumber: number): NormalizedProductCsvRow {
  const stockField = parseCsvStockField(row.Stock);

  return {
    rowNumber,
    title: normalizeCsvString(row.Title),
    originalPrice: parseCsvMoney(row.OriginalPrice, "OriginalPrice", rowNumber),
    outletPrice: parseCsvMoney(row.OutletPrice, "OutletPrice", rowNumber),
    sourceStore: normalizeCsvString(row.SourceStore),
    sourceUrl: normalizeSourceUrl(row.SourceURL, rowNumber),
    brand: normalizeCsvString(row.Brand),
    category: normalizeCsvString(row.Category),
    imageUrls: parseCsvImageUrls(row.ProductImages),
    description: normalizeCsvString(row.Description),
    colors: parseCsvList(row.Color, /\s*,\s*/),
    sizes: parseCsvList(row.Size, /\s*,\s*/),
    stockQuantity: stockField.stockQuantity,
    stockStatus: stockField.stockStatus,
    status: parseCsvStatus(row.Status, rowNumber),
    gender: normalizeCsvString(row.Gender),
  };
}

async function replaceProductImages(
  transaction: Prisma.TransactionClient,
  productId: string,
  imageUrls: string[],
  productName: string,
): Promise<void> {
  await transaction.productImage.deleteMany({
    where: { productId },
  });

  if (imageUrls.length === 0) {
    return;
  }

  await transaction.productImage.createMany({
    data: imageUrls.map((imageUrl, index) => ({
      productId,
      imageUrl,
      altText: productName,
      sortOrder: index,
    })),
  });
}

async function cleanupImportedProductDependencies(
  transaction: Prisma.TransactionClient,
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) {
    return;
  }

  const linkedPriceAlertIds = (
    await transaction.priceAlert.findMany({
      where: {
        productId: {
          in: productIds,
        },
      },
      select: {
        id: true,
      },
    })
  ).map((alert) => alert.id);

  if (linkedPriceAlertIds.length > 0) {
    await transaction.notification.updateMany({
      where: {
        priceAlertId: {
          in: linkedPriceAlertIds,
        },
      },
      data: {
        priceAlertId: null,
      },
    });
  }

  await transaction.cartItem.deleteMany({
    where: {
      productId: {
        in: productIds,
      },
    },
  });

  await transaction.wishlist.deleteMany({
    where: {
      productId: {
        in: productIds,
      },
    },
  });

  await transaction.review.deleteMany({
    where: {
      productId: {
        in: productIds,
      },
    },
  });

  await transaction.priceAlert.deleteMany({
    where: {
      productId: {
        in: productIds,
      },
    },
  });

  await transaction.procurementTask.updateMany({
    where: {
      productId: {
        in: productIds,
      },
    },
    data: {
      productId: null,
    },
  });

  await transaction.orderItem.updateMany({
    where: {
      productId: {
        in: productIds,
      },
    },
    data: {
      productId: null,
    },
  });

  await transaction.importProductResult.updateMany({
    where: {
      productId: {
        in: productIds,
      },
    },
    data: {
      productId: null,
    },
  });

  await transaction.priceHistory.deleteMany({
    where: {
      productId: {
        in: productIds,
      },
    },
  });

  await transaction.priceChange.deleteMany({
    where: {
      productId: {
        in: productIds,
      },
    },
  });

  await transaction.stockChange.deleteMany({
    where: {
      productId: {
        in: productIds,
      },
    },
  });

  await transaction.productImage.deleteMany({
    where: {
      productId: {
        in: productIds,
      },
    },
  });

  await transaction.productVariant.deleteMany({
    where: {
      productId: {
        in: productIds,
      },
    },
  });
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

async function resolveBrandFilterIds(brandFilter: string): Promise<string[]> {
  const normalizedFilter = brandFilter.trim().toLowerCase();

  const brands = await prisma.brand.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  return brands
    .filter(
      (brand) =>
        brand.id === brandFilter
        || brand.slug === brandFilter
        || brand.name.trim().toLowerCase() === normalizedFilter,
    )
    .map((brand) => brand.id);
}

function buildPublicProductWhere(input: {
  query: PublicProductListQuery;
  categoryIds: string[];
  brandIds: string[];
  requireAvailable?: boolean;
}): Prisma.ProductWhereInput {
  const { query, categoryIds, brandIds, requireAvailable } = input;

  return {
    status: ProductStatus.ACTIVE,
    deletedAt: null,
    ...(requireAvailable
      ? {
          stock: {
            gt: 0,
          },
          stockStatus: {
            not: StockStatus.OUT_OF_STOCK,
          },
        }
      : {}),
    ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
    ...(query.minDiscount !== undefined ? { discountPercent: { gte: query.minDiscount } } : {}),
    ...(query.brand
      ? {
          brandId: {
            in: brandIds,
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
    ...(query.sizes && query.sizes.length > 0
      ? {
          sizes: {
            hasSome: query.sizes,
          },
        }
      : {}),
    ...(query.colors && query.colors.length > 0
      ? {
          colors: {
            hasSome: query.colors,
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
}

function buildPublicProductFilterSql(input: {
  query: PublicProductListQuery;
  categoryIds: string[];
  brandIds: string[];
  requireAvailable?: boolean;
}) {
  const { query, categoryIds, brandIds, requireAvailable } = input;
  const filters: Prisma.Sql[] = [
    Prisma.sql`p."status" = CAST(${ProductStatus.ACTIVE} AS "ProductStatus")`,
    Prisma.sql`p."deletedAt" IS NULL`,
  ];

  if (requireAvailable) {
    filters.push(Prisma.sql`p."stock" > 0`);
    filters.push(Prisma.sql`p."stockStatus" <> CAST(${StockStatus.OUT_OF_STOCK} AS "StockStatus")`);
  }

  if (query.featured !== undefined) {
    filters.push(Prisma.sql`p."isFeatured" = ${query.featured}`);
  }

  if (query.minDiscount !== undefined) {
    filters.push(Prisma.sql`COALESCE(p."discountPercent", 0) >= ${query.minDiscount}`);
  }

  if (query.brand) {
    filters.push(Prisma.sql`p."brandId" IN (${Prisma.join(brandIds)})`);
  }

  if (query.category) {
    filters.push(Prisma.sql`p."categoryId" IN (${Prisma.join(categoryIds)})`);
  }

  if (query.sizes && query.sizes.length > 0) {
    filters.push(Prisma.sql`p."sizes" && ARRAY[${Prisma.join(query.sizes)}]::text[]`);
  }

  if (query.colors && query.colors.length > 0) {
    filters.push(Prisma.sql`p."colors" && ARRAY[${Prisma.join(query.colors)}]::text[]`);
  }

  if (query.search) {
    const term = `%${query.search}%`;
    filters.push(
      Prisma.sql`(
        p."title" ILIKE ${term}
        OR p."sku" ILIKE ${term}
        OR EXISTS (
          SELECT 1
          FROM "Brand" b
          WHERE b."id" = p."brandId"
            AND b."name" ILIKE ${term}
        )
        OR EXISTS (
          SELECT 1
          FROM "Category" c
          WHERE c."id" = p."categoryId"
            AND c."name" ILIKE ${term}
        )
      )`,
    );
  }

  return filters.reduce<Prisma.Sql>(
    (sql, filter, index) =>
      index === 0
        ? Prisma.sql`WHERE ${filter}`
        : Prisma.sql`${sql} AND ${filter}`,
    Prisma.empty,
  );
}

async function listPublicProductIdsByRandomOrder(input: {
  query: PublicProductListQuery;
  categoryIds: string[];
  brandIds: string[];
  requireAvailable?: boolean;
}): Promise<string[]> {
  const effectiveSeed = input.query.seed ?? randomUUID();
  const skip = (input.query.page - 1) * input.query.pageSize;
  const whereSql = buildPublicProductFilterSql(input);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH filtered_products AS (
      SELECT
        p."id",
        p."brandId",
        md5(${effectiveSeed} || ':' || p."id") AS product_hash,
        md5(${effectiveSeed} || ':' || p."brandId") AS brand_hash
      FROM "Product" p
      ${whereSql}
    ),
    ranked_products AS (
      SELECT
        fp."id",
        fp.brand_hash,
        fp.product_hash,
        ROW_NUMBER() OVER (
          PARTITION BY fp."brandId"
          ORDER BY fp.product_hash ASC, fp."id" ASC
        ) AS brand_rank
      FROM filtered_products fp
    )
    SELECT rp."id"
    FROM ranked_products rp
    ORDER BY rp.brand_rank ASC, rp.brand_hash ASC, rp.product_hash ASC, rp."id" ASC
    OFFSET ${skip}
    LIMIT ${input.query.pageSize}
  `);

  return rows.map((row) => row.id);
}

async function listPublicProductIdsByBestSellerOrder(input: {
  query: PublicProductListQuery;
  categoryIds: string[];
  brandIds: string[];
}): Promise<string[]> {
  const skip = (input.query.page - 1) * input.query.pageSize;
  const whereSql = buildPublicProductFilterSql({
    ...input,
    requireAvailable: true,
  });
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH ranked_products AS (
      SELECT
        p."id",
        p."brandId",
        p."purchases" AS sales_count,
        p."views" AS view_count,
        (COALESCE(p."purchases", 0) * 1000000 + COALESCE(p."views", 0)) AS popularity_score,
        ROW_NUMBER() OVER (
          PARTITION BY p."brandId"
          ORDER BY
            COALESCE(p."purchases", 0) DESC,
            COALESCE(p."views", 0) DESC,
            p."createdAt" DESC,
            p."id" ASC
        ) AS brand_rank
      FROM "Product" p
      ${whereSql}
    )
    SELECT rp."id"
    FROM ranked_products rp
    ORDER BY
      rp.brand_rank ASC,
      rp.sales_count DESC,
      rp.popularity_score DESC,
      rp.view_count DESC,
      rp."id" ASC
    OFFSET ${skip}
    LIMIT ${input.query.pageSize}
  `);

  return rows.map((row) => row.id);
}

async function resolveProductCsvImportSelection(
  input: ImportProductsCsvInput,
): Promise<{
  selection: ProductCsvImportSelectionSummary;
  destinationCategoryId: string;
  scopeCategoryIds: string[];
}> {
  const [brand, categories] = await Promise.all([
    prisma.brand.findUnique({ where: { id: input.brandId } }),
    prisma.category.findMany({
      select: {
        id: true,
        name: true,
        parentId: true,
      },
    }),
  ]);
  const mainCategory = categories.find((category) => category.id === input.mainCategoryId) ?? null;
  const subcategory = input.subcategoryId
    ? categories.find((category) => category.id === input.subcategoryId) ?? null
    : null;

  if (!brand) {
    throw new ApiError(404, "Selected brand/site was not found.");
  }

  if (!mainCategory) {
    throw new ApiError(404, "Selected main category was not found.");
  }

  if (subcategory && subcategory.parentId !== mainCategory.id) {
    throw new ApiError(400, "Selected subcategory does not belong to the selected main category.");
  }

  const destinationCategory = subcategory ?? mainCategory;
  const scopeCategoryIds = collectCategoryTreeIds(categories, mainCategory.id);

  return {
    selection: {
      brand: {
        id: brand.id,
        name: brand.name,
      },
      mainCategory: {
        id: mainCategory.id,
        name: mainCategory.name,
      },
      destinationCategory: {
        id: destinationCategory.id,
        name: destinationCategory.name,
        parentId: destinationCategory.parentId,
      },
    },
    destinationCategoryId: destinationCategory.id,
    scopeCategoryIds,
  };
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

async function buildUniqueSku(
  baseValue: string,
  exists: (sku: string) => Promise<boolean>,
): Promise<string> {
  let candidate = baseValue;
  let suffix = 2;

  while (await exists(candidate)) {
    candidate = `${baseValue}-${suffix}`;
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

  public async importProductsCsv(input: ImportProductsCsvInput): Promise<ProductCsvImportResult> {
    const prepared = await this.prepareProductsCsvImport(input);
    const readyToImport = prepared.summary.failed === 0;
    const confirmationMessage = readyToImport
      ? `This will replace ${prepared.summary.previousMatchingProductCount} existing ${prepared.selection.brand.name} products in ${prepared.selection.destinationCategory.name}. Continue?`
      : null;

    if (input.mode === "PREVIEW" || !readyToImport) {
      return {
        mode: input.mode,
        readyToImport,
        confirmationMessage,
        selection: prepared.selection,
        summary: prepared.summary,
        issues: prepared.issues,
      };
    }

    const importedRows = prepared.rows;
    const issues = [...prepared.issues];
    const importedProductIds: string[] = [];
    const monitoringSources = new Map<string, { sourceUrl: string; sourceStore: string | null }>();
    let deletedCount = 0;
    let failedCount = 0;

    try {
      deletedCount = await prisma.$transaction(async (transaction) => {
        const scopedProducts = await transaction.product.findMany({
          where: {
            deletedAt: null,
            brandId: prepared.selection.brand.id,
            categoryId: {
              in: prepared.scopeCategoryIds,
            },
          },
          select: {
            id: true,
          },
        });
        const scopedProductIds = scopedProducts.map((product) => product.id);

        if (scopedProductIds.length > 0) {
          await cleanupImportedProductDependencies(transaction, scopedProductIds);
          await transaction.product.deleteMany({
            where: {
              id: {
                in: scopedProductIds,
              },
            },
          });
        }

        return scopedProductIds.length;
      });

      for (let startIndex = 0; startIndex < importedRows.length; startIndex += PRODUCT_CSV_IMPORT_BATCH_SIZE) {
        const batch = importedRows.slice(startIndex, startIndex + PRODUCT_CSV_IMPORT_BATCH_SIZE);
        let importedBatchRows: PreparedImportedProductCsvRow[] = [];

        try {
          await prisma.$transaction(async (transaction) => {
            await this.insertPreparedImportedProductBatch(transaction, batch);
          });
          importedBatchRows = batch;
        } catch (batchError) {
          for (const row of batch) {
            try {
              await prisma.$transaction(async (transaction) => {
                await this.insertPreparedImportedProductBatch(transaction, [row]);
              });
              importedBatchRows.push(row);
            } catch (rowError) {
              failedCount += 1;
              issues.push({
                rowNumber: row.rowNumber,
                status: "FAILED",
                reason: getCsvImportFailureReason(rowError, row.rowNumber),
                sourceUrl: row.sourceUrl,
                title: row.title,
              });
            }
          }
          void batchError;
        }

        for (const row of importedBatchRows) {
          importedProductIds.push(row.productId);
          if (row.monitoringSource) {
            monitoringSources.set(
              getMonitoringSourceKey(row.monitoringSource.sourceUrl, row.monitoringSource.sourceStore),
              row.monitoringSource,
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ApiError(
          409,
          "CSV import could not replace the selected products because related records still reference one or more existing products in this brand/category scope.",
        );
      }

      throw error instanceof ApiError
        ? error
        : new ApiError(500, `CSV import failed: ${error instanceof Error ? error.message : "Unknown error"}.`);
    }

    const finalProductCount = await prisma.product.count({
      where: {
        deletedAt: null,
        brandId: prepared.selection.brand.id,
        categoryId: {
          in: prepared.scopeCategoryIds,
        },
      },
    });

    const monitoringResults = await Promise.allSettled(
      [...monitoringSources.values()].map((source) =>
        productMonitoringService.ensureWebsiteProfileForSource(source),
      ),
    );
    void monitoringResults;

    return {
      mode: input.mode,
      readyToImport: true,
      confirmationMessage: null,
      selection: prepared.selection,
      summary: {
        total: prepared.summary.total,
        previousMatchingProductCount: prepared.summary.previousMatchingProductCount,
        deleted: deletedCount,
        imported: importedProductIds.length,
        updated: 0,
        skipped: prepared.summary.skipped,
        failed: failedCount,
        finalProductCount,
      },
      issues,
    };
  }

  private async prepareProductsCsvImport(input: ImportProductsCsvInput): Promise<PreparedProductCsvImport> {
    const selection = await resolveProductCsvImportSelection(input);
    const businessSettings = await pricingService.getBusinessSettings();
    const parsedDocument = parseCsvDocument(input.content);
    validateProductCsvHeaders(parsedDocument.headers);
    const previousMatchingProductCount = await prisma.product.count({
      where: {
        deletedAt: null,
        brandId: selection.selection.brand.id,
        categoryId: {
          in: selection.scopeCategoryIds,
        },
      },
    });

    const issues: ProductCsvImportRowIssue[] = [];
    const rows: PreparedImportedProductCsvRow[] = [];
    let skipped = 0;
    let failed = 0;
    const seenSourceUrls = new Set<string>();

    for (let startIndex = 0; startIndex < parsedDocument.rows.length; startIndex += PRODUCT_CSV_IMPORT_BATCH_SIZE) {
      const batch = parsedDocument.rows.slice(startIndex, startIndex + PRODUCT_CSV_IMPORT_BATCH_SIZE);

      for (const [offset, values] of batch.entries()) {
        const rowNumber = startIndex + offset + 2;
        const rawRow = mapCsvRow(parsedDocument.headers, values);

        try {
          const normalizedRow = normalizeProductCsvRow(rawRow, rowNumber);

          if (seenSourceUrls.has(normalizedRow.sourceUrl)) {
            skipped += 1;
            issues.push({
              rowNumber,
              status: "SKIPPED",
              reason: "Duplicate SourceURL detected in this CSV upload.",
              sourceUrl: normalizedRow.sourceUrl,
              title: normalizedRow.title ?? null,
            });
            continue;
          }

          const preparedRow = this.prepareImportedProductCsvRow(normalizedRow, {
            brandId: selection.selection.brand.id,
            categoryId: selection.destinationCategoryId,
          }, businessSettings);

          seenSourceUrls.add(normalizedRow.sourceUrl);
          rows.push(preparedRow);
        } catch (error) {
          failed += 1;
          issues.push({
            rowNumber,
            status: "FAILED",
            reason: error instanceof Error ? error.message : "CSV row import failed.",
            sourceUrl: normalizeCsvString(rawRow.SourceURL) ?? null,
            title: normalizeCsvString(rawRow.Title) ?? null,
          });
        }
      }
    }
    return {
      selection: selection.selection,
      destinationCategoryId: selection.destinationCategoryId,
      scopeCategoryIds: selection.scopeCategoryIds,
      rows,
      issues,
      summary: {
        total: parsedDocument.rows.length,
        previousMatchingProductCount,
        deleted: 0,
        imported: 0,
        updated: 0,
        skipped,
        failed,
        finalProductCount: failed === 0 ? rows.length : previousMatchingProductCount,
      },
    };
  }

  private prepareImportedProductCsvRow(
    row: NormalizedProductCsvRow,
    scope: { brandId: string; categoryId: string },
    businessSettings: BusinessSettingsRecord,
  ): PreparedImportedProductCsvRow {
    if (!row.title) {
      throw new ApiError(400, `Row ${row.rowNumber}: Title is required.`);
    }

    const supplierBasePrice = row.outletPrice ?? row.originalPrice ?? null;
    if (supplierBasePrice === null) {
      throw new ApiError(400, `Row ${row.rowNumber}: OriginalPrice or OutletPrice is required.`);
    }

    const variants = buildImportedVariants(row);
    const variantKeys = new Set<string>();
    for (const variant of variants) {
      const key = `${variant.size ?? ""}::${variant.color ?? ""}`;
      if (variantKeys.has(key)) {
        throw new ApiError(400, `Row ${row.rowNumber}: Duplicate size/color combinations were found.`);
      }
      variantKeys.add(key);
    }

    const pricing = pricingService.calculateProductPricingWithSettings(businessSettings, {
      brandId: scope.brandId,
      categoryId: scope.categoryId,
      supplierPrice: supplierBasePrice,
      fallbackPrice: supplierBasePrice,
      currency: null,
      useCustomPricing: false,
      customPrice: null,
    });
    const name = row.title;
    const resolvedOldPrice = row.originalPrice ?? null;
    const resolvedOutletPrice = row.outletPrice ?? supplierBasePrice;
    const resolvedDescription = row.description ?? null;
    const resolvedSourceStore = row.sourceStore ?? null;
    const resolvedGender = row.gender ?? null;
    const resolvedSizes = row.sizes ?? [];
    const resolvedColors = row.colors ?? [];
    const resolvedStock = variants.length
      ? variants.reduce((total, variant) => total + variant.stockQuantity, 0)
      : row.stockQuantity ?? DEFAULT_IMPORTED_STOCK_QUANTITY;
    const resolvedStockStatus = row.stockStatus ?? deriveStockStatus(resolvedStock);
    const discountPercent = normalizeDiscountPercent(resolvedOutletPrice, resolvedOldPrice);
    const resolvedDealLevel = resolveDealLevel(discountPercent);
    const nextImageUrls = row.imageUrls ?? [];
    const productId = buildImportEntityId(`${scope.brandId}|${scope.categoryId}|${row.sourceUrl}|product`);
    const capturedAt = new Date();

    return {
      rowNumber: row.rowNumber,
      title: name,
      sourceUrl: row.sourceUrl,
      sourceStore: resolvedSourceStore,
      productId,
      product: {
        id: productId,
        sku: buildCsvImportSku(row.sourceUrl, scope.brandId, scope.categoryId),
        slug: buildCsvImportSlug(name, row.sourceUrl, scope.brandId, scope.categoryId),
        name,
        description: resolvedDescription,
        brandId: scope.brandId,
        categoryId: scope.categoryId,
        supplierPrice: pricing.supplierPrice,
        price: pricing.customerPrice,
        oldPrice: toDecimal(resolvedOldPrice),
        outletPrice: toDecimal(resolvedOutletPrice),
        profitAmount: pricing.profitAmount,
        discountPercent,
        dealLevel: resolvedDealLevel,
        currency: pricing.currency,
        sourceUrl: row.sourceUrl,
        sourceStore: resolvedSourceStore,
        sourceType: ProductSource.IMPORT,
        status: row.status ?? ProductStatus.ACTIVE,
        stock: resolvedStock,
        stockStatus: resolvedStockStatus,
        gender: resolvedGender,
        sizes: resolvedSizes,
        colors: resolvedColors,
        importedAt: capturedAt,
        lastSyncedAt: capturedAt,
      },
      images: nextImageUrls.map((imageUrl, index) => ({
        id: buildImportEntityId(`${productId}|image|${index}|${imageUrl}`),
        productId,
        imageUrl,
        altText: name,
        sortOrder: index,
      })),
      variants: variants.map((variant, index) => ({
        id: buildImportEntityId(`${productId}|variant|${index}|${variant.size ?? ""}|${variant.color ?? ""}`),
        productId,
        size: variant.size ?? null,
        color: variant.color ?? null,
        stockQuantity: variant.stockQuantity,
      })),
      priceHistory: {
        id: buildImportEntityId(`${productId}|price-history`),
        productId,
        oldPrice: toDecimal(resolvedOldPrice),
        newPrice: pricing.customerPrice,
        discountPercent,
        capturedAt,
      },
      monitoringSource: row.sourceUrl
        ? {
            sourceUrl: row.sourceUrl,
            sourceStore: resolvedSourceStore,
          }
        : null,
    };
  }

  private async insertPreparedImportedProductBatch(
    transaction: Prisma.TransactionClient,
    rows: PreparedImportedProductCsvRow[],
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await transaction.product.createMany({
      data: rows.map((row) => row.product),
    });

    const imageRows = rows.flatMap((row) => row.images);
    if (imageRows.length > 0) {
      await transaction.productImage.createMany({
        data: imageRows,
      });
    }

    const variantRows = rows.flatMap((row) => row.variants);
    if (variantRows.length > 0) {
      await transaction.productVariant.createMany({
        data: variantRows,
      });
    }

    await transaction.priceHistory.createMany({
      data: rows.map((row) => row.priceHistory),
    });
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

  public async bulkDeleteProducts(ids: string[]) {
    const uniqueIds = [...new Set(ids)];

    if (uniqueIds.length === 0) {
      throw new ApiError(400, "At least one product must be selected.");
    }

    const result = await prisma.product.deleteMany({
      where: {
        id: {
          in: uniqueIds,
        },
      },
    });

    return {
      deletedCount: result.count,
    };
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
    const brandIds = query.brand ? await resolveBrandFilterIds(query.brand) : [];
    const requireAvailable = query.sort === "best_sellers";
    const where = buildPublicProductWhere({
      query,
      categoryIds,
      brandIds,
      requireAvailable,
    });
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
                  : query.sort === "best_sellers"
                    ? [{ purchases: "desc" }, { views: "desc" }, { createdAt: "desc" }]
                : [{ createdAt: "desc" }];

    if ((query.brand && brandIds.length === 0) || (query.category && categoryIds.length === 0)) {
      return {
        items: [],
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: 0,
          totalPages: 1,
        },
      };
    }

    const [pageProductIds, total] = await Promise.all([
      query.sort === "random"
        ? listPublicProductIdsByRandomOrder({
            query,
            categoryIds,
            brandIds,
          })
        : query.sort === "best_sellers"
          ? listPublicProductIdsByBestSellerOrder({
              query,
              categoryIds,
              brandIds,
            })
        : prisma.product
            .findMany({
              where,
              select: {
                id: true,
              },
              orderBy,
              skip: (query.page - 1) * query.pageSize,
              take: query.pageSize,
            })
            .then((items) => items.map((item) => item.id)),
      prisma.product.count({ where }),
    ]);

    if (pageProductIds.length === 0) {
      return {
        items: [],
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
      };
    }

    const items = await prisma.product.findMany({
      where: {
        id: {
          in: pageProductIds,
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

    const itemOrder = new Map(pageProductIds.map((id, index) => [id, index]));
    const orderedItems = items.sort((left, right) => {
      return (itemOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (itemOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    });

    return {
      items: orderedItems.map(mapProductResponse),
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
