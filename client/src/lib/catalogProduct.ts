type LegacyOrCatalogProduct = {
  id?: string;
  sku?: string;
  slug?: string;
  title?: string;
  name?: string;
  description?: string | null;
  brand?: string | { id?: string; name?: string; slug?: string; logo?: string | null } | null;
  brand_id?: string;
  category?: string | { id?: string; name?: string; slug?: string; parentId?: string | null } | null;
  category_id?: string;
  original_price?: number;
  outlet_price?: number;
  final_price?: number;
  price?: number;
  supplierPrice?: number | null;
  profitAmount?: number | null;
  oldPrice?: number | null;
  outletPrice?: number | null;
  discount_percent?: number;
  discountPercent?: number | null;
  currency?: string;
  status?: string;
  stock?: number;
  stock_status?: string;
  stockStatus?: string;
  is_featured?: boolean;
  isFeatured?: boolean;
  is_trending?: boolean;
  isTrending?: boolean;
  gender?: string | null;
  material?: string | null;
  sizes?: string[];
  colors?: string[];
  images?: Array<string | { imageUrl?: string | null }>;
  variants?: unknown[];
  price_history?: Array<{
    id?: string;
    old_price?: number | null;
    new_price?: number | null;
    discount_percent?: number | null;
    captured_at?: string;
  }>;
  priceHistory?: Array<{
    id?: string;
    oldPrice?: number | null;
    newPrice?: number | null;
    discountPercent?: number | null;
    capturedAt?: string;
  }>;
  source_url?: string | null;
  source_store?: string | null;
  source_product_id?: string | null;
  source_type?: string;
  sourceUrl?: string | null;
  sourceStore?: string | null;
  sourceProductId?: string | null;
  sourceType?: string;
  views?: number;
  purchases?: number;
  created_date?: string;
  updated_date?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function normalizeCatalogProduct(product: LegacyOrCatalogProduct | null | undefined) {
  if (!product) {
    return null;
  }

  const brandName =
    typeof product.brand === "string"
      ? product.brand
      : product.brand?.name ?? "";
  const brandId =
    typeof product.brand === "string"
      ? product.brand_id ?? ""
      : product.brand?.id ?? product.brand_id ?? "";

  const categoryName =
    typeof product.category === "string"
      ? product.category
      : product.category?.name ?? "";
  const categoryId =
    typeof product.category === "string"
      ? product.category_id ?? ""
      : product.category?.id ?? product.category_id ?? "";

  const finalPrice = product.final_price ?? product.price ?? 0;
  const originalPrice = product.original_price ?? product.oldPrice ?? finalPrice;
  const outletPrice = product.outlet_price ?? product.outletPrice ?? finalPrice;
  const discountPercent = product.discount_percent ?? product.discountPercent ?? 0;
  const stockStatus = product.stock_status ?? product.stockStatus?.toLowerCase?.() ?? "unknown";
  const sourceType = product.source_type ?? product.sourceType?.toLowerCase?.() ?? "manual";
  const status =
    typeof product.status === "string" && product.status === product.status.toUpperCase()
      ? product.status.toLowerCase()
      : product.status ?? "draft";

  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    title: product.title ?? product.name ?? "",
    description: product.description ?? "",
    brand: brandName,
    brand_id: brandId,
    category: categoryName,
    category_id: categoryId,
    original_price: originalPrice,
    outlet_price: outletPrice,
    final_price: finalPrice,
    supplier_price: product.supplierPrice ?? finalPrice,
    profit_amount: product.profitAmount ?? 0,
    discount_percent: discountPercent,
    currency: product.currency,
    status,
    stock: product.stock ?? 0,
    stock_status: stockStatus,
    is_featured: Boolean(product.is_featured ?? product.isFeatured),
    is_trending: Boolean(product.is_trending ?? product.isTrending),
    gender: product.gender,
    material: product.material,
    sizes: Array.isArray(product.sizes) ? product.sizes : [],
    colors: Array.isArray(product.colors) ? product.colors : [],
    images: Array.isArray(product.images)
      ? product.images
          .map((image) => (typeof image === "string" ? image : image?.imageUrl ?? ""))
          .filter(Boolean)
      : [],
    variants: Array.isArray(product.variants) ? product.variants : [],
    price_history: Array.isArray(product.price_history)
      ? product.price_history
      : Array.isArray(product.priceHistory)
        ? product.priceHistory.map((entry) => ({
            id: entry.id,
            old_price: entry.oldPrice,
            new_price: entry.newPrice,
            discount_percent: entry.discountPercent,
            captured_at: entry.capturedAt,
          }))
        : [],
    source_url: product.source_url ?? product.sourceUrl,
    source_store: product.source_store ?? product.sourceStore,
    source_product_id: product.source_product_id ?? product.sourceProductId,
    source_type: sourceType,
    views: product.views ?? 0,
    purchases: product.purchases ?? 0,
    created_date: product.created_date ?? product.createdAt,
    updated_date: product.updated_date ?? product.updatedAt,
  };
}
