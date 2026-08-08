import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { http } from "@/services/http";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { normalizeCatalogProduct } from "@/lib/catalogProduct";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ProductCard from "@/components/ProductCard";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "36", "37", "38", "39", "40", "41", "42", "43", "44"];
const COLORS = [
  { name: "Black", value: "#000000" },
  { name: "White", value: "#FFFFFF" },
  { name: "Navy", value: "#1a237e" },
  { name: "Grey", value: "#9e9e9e" },
  { name: "Red", value: "#e53935" },
  { name: "Brown", value: "#795548" },
  { name: "Green", value: "#388e3c" },
  { name: "Blue", value: "#1976d2" },
];
const PAGE_SIZE = 12;

export default function Shop() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") ?? "");
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [discountRange, setDiscountRange] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const brandParam = searchParams.get("brand") ?? "";
  const categoryParam = searchParams.get("category") ?? "";

  const updateCatalogParams = (updates) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    });

    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    http("/products/meta/filters")
      .then((response) => {
        setBrands(response.brands || []);
        setCategories(response.categories || []);
      })
      .catch(() => {})
  }, []);

  useEffect(() => {
    setSelectedCategory(categoryParam);
  }, [categoryParam]);

  useEffect(() => {
    setSelectedBrands(brandParam ? [brandParam] : []);
  }, [brandParam]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sort", sortBy);
    if (search) params.set("search", search);
    if (selectedCategory) params.set("category", selectedCategory);
    if (selectedBrands.length === 1) params.set("brand", selectedBrands[0]);
    if (discountRange > 0) params.set("minDiscount", String(discountRange));

    http(`/products?${params.toString()}`)
      .then((response) => {
        setProducts(Array.isArray(response.items) ? response.items.map(normalizeCatalogProduct).filter(Boolean) : []);
        setPagination(response.pagination || { page: 1, totalPages: 1, total: response.items?.length || 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, selectedBrands, selectedCategory, sortBy, discountRange]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedBrands, selectedCategory, sortBy, discountRange]);

  const filtered = useMemo(() => {
    let result = [...products];
    if (selectedBrands.length) {
      result = result.filter((product) => {
        const productBrandName = String(product.brand ?? "").trim().toLowerCase();
        const productBrandSlug = String(product.brand_slug ?? "").trim().toLowerCase();

        return selectedBrands.some((selectedBrand) => {
          const normalizedSelectedBrand = selectedBrand.trim().toLowerCase();
          return normalizedSelectedBrand === productBrandSlug || normalizedSelectedBrand === productBrandName;
        });
      });
    }
    if (selectedSizes.length) result = result.filter(p => p.sizes?.some(s => selectedSizes.includes(s)));
    if (selectedColors.length) result = result.filter(p => p.colors?.some(c => selectedColors.includes(c)));

    return result;
  }, [products, selectedBrands, selectedSizes, selectedColors]);

  const handleCategoryChange = (categorySlug) => {
    const nextCategory = selectedCategory === categorySlug ? "" : categorySlug;
    setSelectedCategory(nextCategory);
    updateCatalogParams({ category: nextCategory });
  };

  const toggleBrand = (brandSlug) => {
    const nextBrand = selectedBrands.includes(brandSlug) ? "" : brandSlug;
    setSelectedBrands(nextBrand ? [nextBrand] : []);
    updateCatalogParams({ brand: nextBrand });
  };
  const toggleSize = (s) => setSelectedSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleColor = (c) => setSelectedColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const clearFilters = () => {
    setSelectedBrands([]);
    setSelectedCategory("");
    setSelectedSizes([]);
    setSelectedColors([]);
    setDiscountRange(0);
    setSearch("");
    setPage(1);
    updateCatalogParams({ category: "", brand: "" });
  };
  const activeFilters = selectedBrands.length + (selectedCategory ? 1 : 0) + selectedSizes.length + selectedColors.length + (discountRange > 0 ? 1 : 0);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="luxe-shell pt-28 pb-16">
        {/* Header */}
        <div className="luxe-panel mb-8 flex flex-col gap-4 px-6 py-7 md:flex-row md:items-end md:justify-between lg:px-8">
          <div>
            <p className="luxe-eyebrow mb-3">{t("shop.eyebrow")}</p>
            <h1 className="luxe-heading text-3xl lg:text-5xl">{t("shop.title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("shop.productsCount", { count: pagination.total || filtered.length })}</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("shop.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 rounded-full bg-background border-border/70"
              />
            </div>
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-full relative lg:hidden" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilters > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[hsl(var(--accent))] text-black text-[10px] font-bold flex items-center justify-center">{activeFilters}</span>}
            </Button>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40 h-11 rounded-full hidden md:flex">
                <SelectValue placeholder={t("shop.sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t("shop.newest")}</SelectItem>
                <SelectItem value="price_low">{t("shop.priceLowHigh")}</SelectItem>
                <SelectItem value="price_high">{t("shop.priceHighLow")}</SelectItem>
                <SelectItem value="discount">{t("shop.biggestDiscount")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <aside className={`${showFilters ? 'fixed inset-0 z-50 bg-background p-6 overflow-y-auto' : 'hidden'} lg:block lg:relative lg:w-60 lg:flex-shrink-0`}>
            <div className="flex justify-between items-center mb-6 lg:mb-0">
              <h3 className="font-semibold text-sm tracking-wide lg:hidden">{t("shop.filters")}</h3>
              <button onClick={() => setShowFilters(false)} className="lg:hidden"><X className="w-5 h-5" /></button>
            </div>

            <div className="luxe-panel p-5 lg:sticky lg:top-28">

            {activeFilters > 0 && (
              <button onClick={clearFilters} className="text-xs text-[hsl(var(--accent))] font-semibold mb-6 hover:underline">
                {t("shop.clearFiltersWithCount", { count: activeFilters })}
              </button>
            )}

            {/* Categories */}
            <div className="mb-8">
              <h4 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">{t("shop.category")}</h4>
              <div className="space-y-2">
                {categories.map(c => (
                  <button key={c.id} onClick={() => handleCategoryChange(c.slug)}
                    className={`block text-sm w-full text-left py-1 transition-colors ${selectedCategory === c.slug ? "text-[hsl(var(--accent))] font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Brands */}
            <div className="mb-8">
              <h4 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">{t("shop.brand")}</h4>
              <div className="space-y-2">
                {brands.map(b => (
                  <label key={b.id} className="flex items-center gap-2.5 cursor-pointer group">
                    <Checkbox checked={selectedBrands.includes(b.slug)} onCheckedChange={() => toggleBrand(b.slug)} />
                    <span className={`text-sm ${selectedBrands.includes(b.slug) ? "font-medium" : "text-muted-foreground group-hover:text-foreground"} transition-colors`}>
                      {b.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Discount */}
            <div className="mb-8">
              <h4 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">{t("shop.minDiscount")}</h4>
              <div className="space-y-2">
                {[10, 20, 30, 40, 50].map(d => (
                  <button key={d} onClick={() => setDiscountRange(discountRange === d ? 0 : d)}
                    className={`block text-sm w-full text-left py-1 transition-colors ${discountRange === d ? "text-[hsl(var(--accent))] font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                    {t("shop.discountRange", { percent: d })}
                  </button>
                ))}
              </div>
            </div>

            {/* Sizes */}
            <div className="mb-8">
              <h4 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">{t("shop.size")}</h4>
              <div className="flex flex-wrap gap-2">
                {SIZES.map(s => (
                  <button key={s} onClick={() => toggleSize(s)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all ${selectedSizes.includes(s) ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-black font-semibold" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="mb-8">
              <h4 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">{t("shop.color")}</h4>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c.name} onClick={() => toggleColor(c.name)} title={c.name}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColors.includes(c.name) ? "border-[hsl(var(--accent))] scale-110" : "border-transparent hover:border-muted-foreground"}`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            <Button className="w-full rounded-full lg:hidden" onClick={() => setShowFilters(false)}>
              {t("shop.showAllProducts")}
            </Button>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 lg:gap-6">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[4/5] bg-secondary rounded-lg" />
                    <div className="mt-3 space-y-2">
                      <div className="h-3 bg-secondary rounded w-16" />
                      <div className="h-3 bg-secondary rounded w-32" />
                      <div className="h-3 bg-secondary rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground">{t("shop.noProducts")}</p>
                <p className="text-sm text-muted-foreground mt-2">{t("shop.tryClearingFilters")}</p>
                <Button variant="outline" onClick={clearFilters} className="mt-4 rounded-full">{t("shop.clearFilters")}</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 lg:gap-6">
                {filtered.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} />
                ))}
              </div>
            )}

            {!loading && pagination.totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  {t("common.previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("shop.page")} {page} {t("shop.of")} {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                >
                  {t("common.next")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
