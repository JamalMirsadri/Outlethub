import {
  forgotPassword,
  getAccessToken,
  getCurrentUser,
  login,
  logout,
  refreshSession,
  register,
  resendVerification,
  resetPassword,
  setAccessToken,
  verifyEmail,
} from "@/services/auth.service";
import { http } from "@/services/http";
import type { AuthResponse, AuthUser } from "@/types/auth";

type EntityRecord = Record<string, unknown>;

interface EntityClient<TRecord extends EntityRecord> {
  list: (..._args: unknown[]) => Promise<TRecord[]>;
  filter: (..._args: unknown[]) => Promise<TRecord[]>;
  get: (_id: string) => Promise<TRecord>;
  create: (_payload: Partial<TRecord>) => Promise<TRecord>;
  update: (_id: string, _payload: Partial<TRecord>) => Promise<TRecord>;
  delete: (_id: string) => Promise<void>;
}

interface MessageResponse {
  message: string;
}

interface AppClientContract {
  auth: {
    me: () => Promise<AuthUser>;
    loginViaEmailPassword: (email: string, password: string) => Promise<AuthResponse>;
    register: (payload: { email: string; password: string }) => Promise<AuthResponse>;
    verifyOtp: (payload: { otpCode: string }) => Promise<MessageResponse>;
    resendOtp: (email: string) => Promise<MessageResponse>;
    resetPasswordRequest: (email: string) => Promise<MessageResponse>;
    resetPassword: (payload: { resetToken: string; newPassword: string }) => Promise<MessageResponse>;
    logout: (redirectUrl?: string) => Promise<void>;
    redirectToLogin: (redirectUrl?: string) => void;
    loginWithProvider: () => never;
    setToken: (token: string) => void;
    refresh: () => Promise<AuthResponse>;
  };
  entities: {
    Product: EntityClient<EntityRecord>;
    Brand: EntityClient<EntityRecord>;
    Category: EntityClient<EntityRecord>;
    Order: EntityClient<EntityRecord>;
    Wishlist: EntityClient<EntityRecord>;
    PriceAlert: EntityClient<EntityRecord>;
    Address: EntityClient<EntityRecord>;
    PricingRule: EntityClient<EntityRecord>;
    AffiliateIntegration: EntityClient<EntityRecord>;
    ImportSource: EntityClient<EntityRecord>;
    ImportLog: EntityClient<EntityRecord>;
  };
}

interface AdminListResponse<TItem> {
  items: TItem[];
}

interface ProductListResponse<TItem> {
  items: TItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface CatalogBrandResponse {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  cloudinaryPublicId: string | null;
  description: string | null;
  website: string | null;
  isActive: boolean;
  marginPercent: number | null;
  isLuxury: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CatalogCategoryResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parent: { id: string; name: string; slug: string } | null;
  children: Array<{ id: string; name: string; slug: string; parentId: string | null }>;
  icon: string | null;
  sortOrder: number;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface CatalogPriceHistoryResponse {
  id: string;
  oldPrice: number | null;
  newPrice: number | null;
  discountPercent: number | null;
  capturedAt: string;
}

interface CatalogVariantResponse {
  id: string;
  size: string | null;
  color: string | null;
  stockQuantity: number;
  createdAt: string;
  updatedAt: string;
}

interface CatalogImageResponse {
  id: string;
  imageUrl: string;
  cloudinaryPublicId: string | null;
  altText: string | null;
  sortOrder: number;
}

interface CatalogProductResponse {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  brandId: string;
  categoryId: string;
  price: number;
  supplierPrice: number | null;
  oldPrice: number | null;
  outletPrice: number | null;
  discountPercent: number;
  currency: string;
  sourceUrl: string | null;
  sourceStore: string | null;
  sourceProductId: string | null;
  sourceType: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  stock: number;
  stockStatus: string;
  isFeatured: boolean;
  isTrending: boolean;
  deletedAt: string | null;
  brand: { id: string; name: string; slug: string; logo: string | null };
  category: { id: string; name: string; slug: string; parentId: string | null };
  gender: string | null;
  material: string | null;
  sizes: string[];
  colors: string[];
  images: CatalogImageResponse[];
  variants: CatalogVariantResponse[];
  priceHistory: CatalogPriceHistoryResponse[];
  views: number;
  purchases: number;
  createdAt: string;
  lastSyncedAt: string | null;
  updatedAt: string;
}

interface ProductMutationPayload extends EntityRecord {
  name?: string;
  title?: string;
  sku?: string;
  description?: string;
  brand?: string;
  brandId?: string;
  category?: string;
  categoryId?: string;
  supplier_price?: unknown;
  supplierPrice?: unknown;
  original_price?: unknown;
  oldPrice?: unknown;
  outlet_price?: unknown;
  outletPrice?: unknown;
  final_price?: unknown;
  price?: unknown;
  discount_percent?: unknown;
  discountPercent?: unknown;
  status?: unknown;
  stock?: unknown;
  stock_status?: unknown;
  is_featured?: unknown;
  isFeatured?: unknown;
  is_trending?: unknown;
  isTrending?: unknown;
  gender?: unknown;
  material?: unknown;
  source_store?: unknown;
  source_url?: unknown;
  source_product_id?: unknown;
  source_type?: unknown;
  sizes_text?: unknown;
  sizes?: unknown;
  colors_text?: unknown;
  colors?: unknown;
  variants_text?: unknown;
  variants?: unknown;
  image_urls_text?: unknown;
  image_url?: unknown;
  images?: unknown;
}

function getRequiredToken(): string {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

function toLegacyStatus(status: string | null | undefined): string {
  if (status === "ACTIVE") {
    return "active";
  }

  if (status === "ARCHIVED") {
    return "archived";
  }

  return "draft";
}

function toApiStatus(status: unknown): "ACTIVE" | "DRAFT" | "ARCHIVED" | undefined {
  if (typeof status !== "string") {
    return undefined;
  }

  if (status.toLowerCase() === "active") {
    return "ACTIVE";
  }

  if (status.toLowerCase() === "archived") {
    return "ARCHIVED";
  }

  return "DRAFT";
}

function toApiSourceType(sourceType: unknown): "MANUAL" | "IMPORT" | "AWIN" | "CJ" | "SCRAPER" {
  if (typeof sourceType !== "string") {
    return "MANUAL";
  }

  const normalized = sourceType.toUpperCase();
  if (normalized === "IMPORT" || normalized === "AWIN" || normalized === "CJ" || normalized === "SCRAPER") {
    return normalized;
  }

  return "MANUAL";
}

function toApiStockStatus(stockStatus: unknown): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNKNOWN" {
  if (typeof stockStatus !== "string") {
    return "UNKNOWN";
  }

  const normalized = stockStatus.toUpperCase();
  if (
    normalized === "IN_STOCK" ||
    normalized === "LOW_STOCK" ||
    normalized === "OUT_OF_STOCK" ||
    normalized === "UNKNOWN"
  ) {
    return normalized;
  }

  return "UNKNOWN";
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function toLegacyBrand(brand: CatalogBrandResponse) {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logo: brand.logo,
    description: brand.description,
    website: brand.website,
    is_active: brand.isActive,
    status: brand.isActive ? "active" : "inactive",
    margin_percent: brand.marginPercent ?? 0,
    is_luxury: brand.isLuxury,
    is_featured: brand.isFeatured,
    created_date: brand.createdAt,
    updated_date: brand.updatedAt,
  };
}

function toLegacyCategory(category: CatalogCategoryResponse) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    parent_id: category.parentId,
    parent_name: category.parent?.name ?? null,
    icon: category.icon,
    sort_order: category.sortOrder,
    created_date: category.createdAt,
    updated_date: category.updatedAt,
  };
}

function toLegacyProduct(product: CatalogProductResponse) {
  const originalPrice = product.oldPrice ?? product.price;
  const outletPrice = product.outletPrice ?? product.price;
  const finalPrice = product.price;
  const discountedPrice =
    typeof outletPrice === "number" && outletPrice >= 0 && outletPrice < originalPrice
      ? outletPrice
      : finalPrice;
  const discountPercent =
    originalPrice > 0 && discountedPrice >= 0 && discountedPrice < originalPrice
      ? Math.max(0, Math.min(100, Math.round(((originalPrice - discountedPrice) / originalPrice) * 100)))
      : 0;

  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    title: product.name,
    description: product.description,
    brand: product.brand.name,
    brand_id: product.brand.id,
    category: product.category.name,
    category_id: product.category.id,
    supplier_price: product.supplierPrice,
    original_price: originalPrice,
    outlet_price: outletPrice,
    final_price: finalPrice,
    discount_percent: discountPercent,
    currency: product.currency,
    status: toLegacyStatus(product.status),
    stock: product.stock,
    stock_status: product.stockStatus.toLowerCase(),
    is_featured: product.isFeatured,
    is_trending: product.isTrending,
    gender: product.gender,
    material: product.material,
    sizes: product.sizes,
    colors: product.colors,
    images: product.images.map((image) => image.imageUrl),
    image_records: product.images,
    variants: product.variants,
    views: product.views,
    purchases: product.purchases,
    price_history: product.priceHistory.map((entry) => ({
      id: entry.id,
      old_price: entry.oldPrice,
      new_price: entry.newPrice,
      discount_percent: entry.discountPercent,
      captured_at: entry.capturedAt,
    })),
    source_url: product.sourceUrl,
    source_store: product.sourceStore,
    source_product_id: product.sourceProductId,
    source_type: product.sourceType.toLowerCase(),
    created_date: product.createdAt,
    last_synced_at: product.lastSyncedAt,
    updated_date: product.updatedAt,
  };
}

async function fetchAdminBrands(): Promise<CatalogBrandResponse[]> {
  const token = getRequiredToken();
  const response = await http<AdminListResponse<CatalogBrandResponse>>("/admin/brands", {
    token,
  });

  return response.items;
}

async function fetchAdminCategories(): Promise<CatalogCategoryResponse[]> {
  const token = getRequiredToken();
  const response = await http<AdminListResponse<CatalogCategoryResponse>>("/admin/categories", {
    token,
  });

  return response.items;
}

async function resolveBrandId(input: Partial<EntityRecord>): Promise<string> {
  const directId = typeof input.brandId === "string" ? input.brandId : undefined;
  if (directId) {
    return directId;
  }

  const brandName = typeof input.brand === "string" ? input.brand.trim() : undefined;
  if (!brandName) {
    throw new Error("Brand is required.");
  }

  const brands = await fetchAdminBrands();
  const existing = brands.find((brand) => brand.name.toLowerCase() === brandName.toLowerCase());
  if (existing) {
    return existing.id;
  }

  const token = getRequiredToken();
  const created = await http<CatalogBrandResponse>("/admin/brands", {
    method: "POST",
    token,
    body: JSON.stringify({
      name: brandName,
      isActive: true,
    }),
  });

  return created.id;
}

async function resolveCategoryId(input: Partial<EntityRecord>): Promise<string> {
  const directId = typeof input.categoryId === "string" ? input.categoryId : undefined;
  if (directId) {
    return directId;
  }

  const categoryName = typeof input.category === "string" ? input.category.trim() : undefined;
  if (!categoryName) {
    throw new Error("Category is required.");
  }

  const categories = await fetchAdminCategories();
  const existing = categories.find((category) => category.name.toLowerCase() === categoryName.toLowerCase());
  if (existing) {
    return existing.id;
  }

  const token = getRequiredToken();
  const created = await http<CatalogCategoryResponse>("/admin/categories", {
    method: "POST",
    token,
    body: JSON.stringify({
      name: categoryName,
    }),
  });

  return created.id;
}

function parseLegacySort(orderBy: unknown): string | null {
  if (orderBy === "-discount_percent") {
    return "discount";
  }

  if (orderBy === "final_price") {
    return "price_low";
  }

  if (orderBy === "-final_price") {
    return "price_high";
  }

  return null;
}

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

function parseProductVariants(payload: Partial<EntityRecord>) {
  if (typeof payload.variants_text === "string") {
    return payload.variants_text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [size = "", color = "", stockQuantity = "0"] = line.split("|").map((part) => part.trim());
        return {
          size: size || undefined,
          color: color || undefined,
          stockQuantity: Number(stockQuantity) || 0,
        };
      });
  }

  if (Array.isArray(payload.variants)) {
    return payload.variants;
  }

  return undefined;
}

function parseProductImageUrls(payload: Partial<EntityRecord>) {
  if (typeof payload.image_urls_text === "string") {
    return [...new Set(payload.image_urls_text.split("\n").map((item) => item.trim()).filter(Boolean))];
  }

  if (Array.isArray(payload.images)) {
    return [
      ...new Set(
        payload.images
          .map((image) => (typeof image === "string" ? image : image?.imageUrl ?? ""))
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }

  const imageUrl = typeof payload.image_url === "string" ? payload.image_url.trim() : "";
  return imageUrl ? [imageUrl] : [];
}

async function syncProductImages(
  productId: string,
  imageUrls: string[],
  existingImages: CatalogImageResponse[],
  token: string,
) {
  await Promise.all(
    existingImages.map((image) =>
      http<void>(`/admin/products/${productId}/images/${image.id}`, {
        method: "DELETE",
        token,
      }),
    ),
  );

  for (const [index, imageUrl] of imageUrls.entries()) {
    await http(`/admin/products/${productId}/images`, {
      method: "POST",
      token,
      body: JSON.stringify({
        imageUrl,
        sortOrder: index,
      }),
    });
  }
}

async function syncProductVariants(
  productId: string,
  variants: Array<{ size?: string; color?: string; stockQuantity?: number }>,
  existingVariants: CatalogVariantResponse[],
  token: string,
) {
  await Promise.all(
    existingVariants.map((variant) =>
      http<void>(`/admin/products/${productId}/variants/${variant.id}`, {
        method: "DELETE",
        token,
      }),
    ),
  );

  for (const variant of variants) {
    await http(`/admin/products/${productId}/variants`, {
      method: "POST",
      token,
      body: JSON.stringify({
        size: variant.size,
        color: variant.color,
        stockQuantity: variant.stockQuantity ?? 0,
      }),
    });
  }
}

async function createOrUpdateProduct(method: "POST" | "PATCH", id: string | null, payload: Partial<EntityRecord>) {
  const token = getRequiredToken();
  const existingProduct =
    method === "PATCH" && id
      ? toLegacyProduct(
          await http<CatalogProductResponse>(`/admin/products/${id}`, {
            token,
          }),
        )
      : null;
  const mergedPayload = (existingProduct ? { ...existingProduct, ...payload } : payload) as ProductMutationPayload;
  const brandId = await resolveBrandId(mergedPayload);
  const categoryId = await resolveCategoryId(mergedPayload);
  const title = typeof mergedPayload.title === "string" ? mergedPayload.title.trim() : "";
  const name = typeof mergedPayload.name === "string" ? mergedPayload.name.trim() : title;
  const variants = parseProductVariants(mergedPayload);
  const imageUrls = parseProductImageUrls(mergedPayload);
  const supplierBasePrice =
    toNumber(
      mergedPayload.supplier_price ??
        mergedPayload.supplierPrice ??
        mergedPayload.outlet_price ??
        mergedPayload.outletPrice ??
        mergedPayload.original_price ??
        mergedPayload.oldPrice ??
        mergedPayload.final_price ??
        mergedPayload.price,
    ) ?? 0;
  const shouldSyncVariants =
    method === "POST" ||
    typeof payload.variants_text === "string" ||
    Array.isArray(payload.variants);
  const shouldSyncImages =
    method === "POST" ||
    typeof payload.image_urls_text === "string" ||
    typeof payload.image_url === "string" ||
    Array.isArray(payload.images);

  const body = {
    sku:
      typeof mergedPayload.sku === "string" && mergedPayload.sku.trim() ? mergedPayload.sku.trim() : `SKU-${Date.now()}`,
    name,
    description: typeof mergedPayload.description === "string" ? mergedPayload.description : undefined,
    brandId,
    categoryId,
    price: supplierBasePrice,
    supplierPrice: supplierBasePrice,
    oldPrice: toNumber(mergedPayload.original_price ?? mergedPayload.oldPrice),
    outletPrice: toNumber(mergedPayload.outlet_price ?? mergedPayload.outletPrice),
    discountPercent: toNumber(mergedPayload.discount_percent ?? mergedPayload.discountPercent),
    status: toApiStatus(mergedPayload.status),
    stock: toNumber(mergedPayload.stock) ?? 0,
    stockStatus: toApiStockStatus(mergedPayload.stock_status),
    isFeatured: Boolean(mergedPayload.is_featured ?? mergedPayload.isFeatured),
    isTrending: Boolean(mergedPayload.is_trending ?? mergedPayload.isTrending),
    gender: typeof mergedPayload.gender === "string" ? mergedPayload.gender : undefined,
    material: typeof mergedPayload.material === "string" ? mergedPayload.material : undefined,
    sourceStore: typeof mergedPayload.source_store === "string" ? mergedPayload.source_store : undefined,
    sourceUrl: typeof mergedPayload.source_url === "string" ? mergedPayload.source_url : undefined,
    sourceProductId: typeof mergedPayload.source_product_id === "string" ? mergedPayload.source_product_id : undefined,
    sourceType: toApiSourceType(mergedPayload.source_type),
    sizes:
      typeof mergedPayload.sizes_text === "string"
        ? mergedPayload.sizes_text.split(",").map((item: string) => item.trim()).filter(Boolean)
        : Array.isArray(mergedPayload.sizes)
          ? mergedPayload.sizes
          : undefined,
    colors:
      typeof mergedPayload.colors_text === "string"
        ? mergedPayload.colors_text.split(",").map((item: string) => item.trim()).filter(Boolean)
        : Array.isArray(mergedPayload.colors)
          ? mergedPayload.colors
          : undefined,
    variants,
  };

  const path = id ? `/admin/products/${id}` : "/admin/products";
  let response = await http<CatalogProductResponse>(path, {
    method,
    token,
    body: JSON.stringify(body),
  });

  if (shouldSyncImages) {
    await syncProductImages(response.id, imageUrls, response.images, token);
  }

  if (shouldSyncVariants && variants) {
    await syncProductVariants(response.id, variants, response.variants, token);
  }

  if (shouldSyncImages || shouldSyncVariants) {
    response = await http<CatalogProductResponse>(`/admin/products/${response.id}`, {
      token,
    });
  }

  return toLegacyProduct(response);
}

const brandEntityClient: EntityClient<EntityRecord> = {
  async list() {
    const items = await fetchAdminBrands();
    return items.map(toLegacyBrand);
  },
  async filter(...args: unknown[]) {
    const filters = (args[0] ?? {}) as EntityRecord;
    const items = await fetchAdminBrands();
    return items
      .filter((brand) => {
        if (filters.status === "active") {
          return brand.isActive;
        }

        return true;
      })
      .map(toLegacyBrand);
  },
  async get(id) {
    const items = await fetchAdminBrands();
    const brand = items.find((item) => item.id === id);
    if (!brand) {
      throw new Error("Brand not found.");
    }

    return toLegacyBrand(brand);
  },
  async create(payload) {
    const token = getRequiredToken();
    let response = await http<CatalogBrandResponse>("/admin/brands", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: payload.name,
        description: payload.description,
        website: payload.website,
        isActive: payload.status !== "inactive",
        marginPercent: toNumber(payload.margin_percent ?? payload.marginPercent),
        isLuxury: Boolean(payload.is_luxury ?? payload.isLuxury),
        isFeatured: Boolean(payload.is_featured ?? payload.isFeatured),
      }),
    });

    const logoUrl = typeof payload.logo_url === "string" ? payload.logo_url.trim() : "";
    if (logoUrl) {
      response = await http<CatalogBrandResponse>(`/admin/brands/${response.id}/logo`, {
        method: "POST",
        token,
        body: JSON.stringify({
          imageUrl: logoUrl,
        }),
      });
    }

    return toLegacyBrand(response);
  },
  async update(id, payload) {
    const token = getRequiredToken();
    let response = await http<CatalogBrandResponse>(`/admin/brands/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        name: payload.name,
        description: payload.description,
        website: payload.website,
        isActive: payload.status !== "inactive",
        marginPercent: toNumber(payload.margin_percent ?? payload.marginPercent),
        isLuxury: payload.is_luxury ?? payload.isLuxury,
        isFeatured: payload.is_featured ?? payload.isFeatured,
      }),
    });

    const logoUrl = typeof payload.logo_url === "string" ? payload.logo_url.trim() : "";
    if (logoUrl) {
      response = await http<CatalogBrandResponse>(`/admin/brands/${id}/logo`, {
        method: "POST",
        token,
        body: JSON.stringify({
          imageUrl: logoUrl,
        }),
      });
    }

    return toLegacyBrand(response);
  },
  async delete(id) {
    const token = getRequiredToken();
    await http<void>(`/admin/brands/${id}`, {
      method: "DELETE",
      token,
    });
  },
};

const categoryEntityClient: EntityClient<EntityRecord> = {
  async list() {
    const items = await fetchAdminCategories();
    return items.map(toLegacyCategory);
  },
  async filter(...args: unknown[]) {
    const filters = (args[0] ?? {}) as EntityRecord;
    const items = await fetchAdminCategories();
    const parentId = typeof filters.parent_id === "string" ? filters.parent_id : null;
    return items
      .filter((category) => {
        if (!parentId) {
          return true;
        }

        return category.parentId === parentId;
      })
      .map(toLegacyCategory);
  },
  async get(id) {
    const items = await fetchAdminCategories();
    const category = items.find((item) => item.id === id);
    if (!category) {
      throw new Error("Category not found.");
    }

    return toLegacyCategory(category);
  },
  async create(payload) {
    const token = getRequiredToken();
    const response = await http<CatalogCategoryResponse>("/admin/categories", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: payload.name,
        description: payload.description,
        parentId: payload.parent_id ?? payload.parentId ?? null,
        sortOrder: toNumber(payload.sort_order ?? payload.sortOrder) ?? 0,
      }),
    });

    return toLegacyCategory(response);
  },
  async update(id, payload) {
    const token = getRequiredToken();
    const response = await http<CatalogCategoryResponse>(`/admin/categories/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        name: payload.name,
        description: payload.description,
        parentId: payload.parent_id ?? payload.parentId ?? null,
        sortOrder: toNumber(payload.sort_order ?? payload.sortOrder),
      }),
    });

    return toLegacyCategory(response);
  },
  async delete(id) {
    const token = getRequiredToken();
    await http<void>(`/admin/categories/${id}`, {
      method: "DELETE",
      token,
    });
  },
};

const productEntityClient: EntityClient<EntityRecord> = {
  async list(_orderBy, limit) {
    const token = getRequiredToken();
    const query = buildQueryString({
      page: 1,
      pageSize: typeof limit === "number" ? limit : 50,
      includeDeleted: false,
    });
    const response = await http<ProductListResponse<CatalogProductResponse>>(`/admin/products${query}`, {
      token,
    });
    return response.items.map(toLegacyProduct);
  },
  async filter(...args: unknown[]) {
    const filters = (args[0] ?? {}) as EntityRecord;
    const orderBy = args[1];
    const limit = args[2];
    const sort = parseLegacySort(orderBy) ?? "newest";
    const search = typeof filters.search === "string" ? filters.search : undefined;
    const query = buildQueryString({
      page: 1,
      pageSize: typeof limit === "number" ? limit : 50,
      search,
      brand: typeof filters.brand === "string" ? filters.brand : undefined,
      category: typeof filters.category === "string" ? filters.category : undefined,
      minDiscount: toNumber(filters.min_discount ?? filters.discountRange ?? filters.discount_percent),
      sort,
    });
    const response = await http<ProductListResponse<CatalogProductResponse>>(`/products${query}`);

    let items = response.items.map(toLegacyProduct);

    if (filters.status === "active") {
      items = items.filter((product) => product.status === "active");
    }

    if (filters.is_trending === true) {
      items = items.filter((product) => product.is_trending);
    }

    if (filters.is_featured === true) {
      items = items.filter((product) => product.is_featured);
    }

    return items;
  },
  async get(id) {
    const response = await http<CatalogProductResponse>(`/products/id/${id}`);
    return toLegacyProduct(response);
  },
  async create(payload) {
    return createOrUpdateProduct("POST", null, payload);
  },
  async update(id, payload) {
    return createOrUpdateProduct("PATCH", id, payload);
  },
  async delete(id) {
    const token = getRequiredToken();
    await http<void>(`/admin/products/${id}`, {
      method: "DELETE",
      token,
    });
  },
};

function createPlaceholderEntityClient<TRecord extends EntityRecord>(entityName: string): EntityClient<TRecord> {
  return {
    async list() {
      return [];
    },
    async filter() {
      return [];
    },
    async get() {
      throw new Error(`${entityName} detail API is not connected yet.`);
    },
    async create() {
      throw new Error(`${entityName} create API is not connected yet.`);
    },
    async update() {
      throw new Error(`${entityName} update API is not connected yet.`);
    },
    async delete() {
      throw new Error(`${entityName} delete API is not connected yet.`);
    },
  };
}

// Temporary internal facade so unmigrated pages stop depending on Base44 naming
// while the remaining domain APIs are replaced sprint by sprint.
export const appClient: AppClientContract = {
  auth: {
    async me() {
      return getCurrentUser();
    },
    async loginViaEmailPassword(email: string, password: string) {
      return login({ email, password });
    },
    async register(payload: { email: string; password: string }) {
      return register({
        ...payload,
        confirmPassword: payload.password,
      });
    },
    async verifyOtp(payload: { otpCode: string }) {
      return verifyEmail(payload.otpCode);
    },
    async resendOtp(email: string) {
      return resendVerification(email);
    },
    async resetPasswordRequest(email: string) {
      return forgotPassword(email);
    },
    async resetPassword(payload: { resetToken: string; newPassword: string }) {
      return resetPassword({
        token: payload.resetToken,
        newPassword: payload.newPassword,
        confirmPassword: payload.newPassword,
      });
    },
    async logout(redirectUrl?: string) {
      await logout();
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    },
    redirectToLogin(redirectUrl?: string) {
      const target = redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : "";
      window.location.href = `/login${target}`;
    },
    loginWithProvider() {
      throw new Error("OAuth providers are not available yet.");
    },
    setToken(token: string) {
      setAccessToken(token);
    },
    async refresh() {
      return refreshSession();
    },
  },
  entities: {
    Product: productEntityClient,
    Brand: brandEntityClient,
    Category: categoryEntityClient,
    Order: createPlaceholderEntityClient("Order"),
    Wishlist: createPlaceholderEntityClient("Wishlist"),
    PriceAlert: createPlaceholderEntityClient("PriceAlert"),
    Address: createPlaceholderEntityClient("Address"),
    PricingRule: createPlaceholderEntityClient("PricingRule"),
    AffiliateIntegration: createPlaceholderEntityClient("AffiliateIntegration"),
    ImportSource: createPlaceholderEntityClient("ImportSource"),
    ImportLog: createPlaceholderEntityClient("ImportLog"),
  },
};
