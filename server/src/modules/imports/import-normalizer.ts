import { createHash } from "node:crypto";

import { type StockStatus } from "@prisma/client";

import { ApiError } from "../../utils/api-error.js";

export interface ImportSourceConfiguration {
  feedUrl?: string;
  recordPath?: string;
  fieldMap?: Partial<Record<NormalizedFieldName, string>>;
  defaultBrand?: string;
  defaultCategory?: string;
  sourceStore?: string;
}

export interface NormalizedImportProduct {
  name: string;
  brand: string;
  category: string;
  price: number;
  oldPrice: number | null;
  discountPercent: number;
  imageUrl: string | null;
  sourceStore: string;
  sourceUrl: string | null;
  sourceProductId: string | null;
  description: string | null;
  currency: string;
  stockStatus?: StockStatus;
  contentHash: string;
}

type NormalizedFieldName =
  | "name"
  | "brand"
  | "category"
  | "price"
  | "oldPrice"
  | "discountPercent"
  | "imageUrl"
  | "sourceUrl"
  | "sourceProductId"
  | "description"
  | "currency";

export interface NormalizeContext {
  configuration?: ImportSourceConfiguration | null;
  sourceStore?: string | null;
  website?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "Import record must be an object.");
  }

  return value as Record<string, unknown>;
}

function getPathValue(record: Record<string, unknown>, path: string | undefined): unknown {
  if (!path) {
    return undefined;
  }

  return path.split(".").reduce<unknown>((currentValue, key) => {
    if (!currentValue || typeof currentValue !== "object" || Array.isArray(currentValue)) {
      return undefined;
    }

    return (currentValue as Record<string, unknown>)[key];
  }, record);
}

function readValue(
  record: Record<string, unknown>,
  configuration: ImportSourceConfiguration | null | undefined,
  fieldName: NormalizedFieldName,
  fallbackKeys: string[],
): unknown {
  const configuredValue = getPathValue(record, configuration?.fieldMap?.[fieldName]);
  if (configuredValue !== undefined) {
    return configuredValue;
  }

  for (const key of fallbackKeys) {
    const value = getPathValue(record, key);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function toRequiredString(value: unknown, fieldName: string): string {
  const normalizedValue = toOptionalString(value);
  if (!normalizedValue) {
    throw new ApiError(400, `Import record is missing required field: ${fieldName}.`);
  }

  return normalizedValue;
}

function toOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const normalizedValue = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(normalizedValue) ? normalizedValue : null;
  }

  return null;
}

function normalizeDiscountPercent(price: number, oldPrice: number | null, discountPercent: number | null): number {
  if (discountPercent !== null) {
    return Math.max(0, Math.min(100, Math.round(discountPercent)));
  }

  if (!oldPrice || oldPrice <= 0 || oldPrice <= price) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((1 - price / oldPrice) * 100)));
}

function buildContentHash(input: Omit<NormalizedImportProduct, "contentHash">): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

export class ImportNormalizer {
  public normalizeRecord(recordValue: unknown, context: NormalizeContext): NormalizedImportProduct {
    const record = asRecord(recordValue);
    const configuration = context.configuration ?? null;

    const name = toRequiredString(
      readValue(record, configuration, "name", ["name", "title", "productName"]),
      "name",
    );
    const brand =
      toOptionalString(readValue(record, configuration, "brand", ["brand", "brandName"])) ??
      configuration?.defaultBrand;
    const category =
      toOptionalString(readValue(record, configuration, "category", ["category", "categoryName"])) ??
      configuration?.defaultCategory;
    const price = toOptionalNumber(readValue(record, configuration, "price", ["price", "finalPrice", "salePrice"]));
    const oldPrice = toOptionalNumber(
      readValue(record, configuration, "oldPrice", ["oldPrice", "originalPrice", "compareAtPrice", "listPrice"]),
    );
    const discountPercent = normalizeDiscountPercent(
      price ?? 0,
      oldPrice,
      toOptionalNumber(readValue(record, configuration, "discountPercent", ["discountPercent", "discount"])),
    );
    const imageUrl = toOptionalString(
      readValue(record, configuration, "imageUrl", ["imageUrl", "image", "image.url", "images.0"]),
    );
    const sourceUrl =
      toOptionalString(readValue(record, configuration, "sourceUrl", ["sourceUrl", "url", "link"])) ?? context.website ?? null;
    const sourceProductId = toOptionalString(
      readValue(record, configuration, "sourceProductId", ["sourceProductId", "externalId", "id"]),
    );
    const description = toOptionalString(
      readValue(record, configuration, "description", ["description", "summary", "details"]),
    );
    const currency =
      toOptionalString(readValue(record, configuration, "currency", ["currency", "currencyCode"])) ?? "USD";
    const sourceStore = context.sourceStore ?? configuration?.sourceStore ?? "Imported Source";

    if (!brand) {
      throw new ApiError(400, "Import record is missing required field: brand.");
    }

    if (!category) {
      throw new ApiError(400, "Import record is missing required field: category.");
    }

    if (price === null || price < 0) {
      throw new ApiError(400, "Import record is missing required field: price.");
    }

    const normalizedRecord = {
      name,
      brand,
      category,
      price,
      oldPrice,
      discountPercent,
      imageUrl,
      sourceStore,
      sourceUrl,
      sourceProductId,
      description,
      currency,
    };

    return {
      ...normalizedRecord,
      contentHash: buildContentHash(normalizedRecord),
    };
  }

  public normalizeRecords(records: unknown[], context: NormalizeContext): NormalizedImportProduct[] {
    return records.map((record) => this.normalizeRecord(record, context));
  }
}

export const importNormalizer = new ImportNormalizer();
