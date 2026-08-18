import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { appClient } from "@/api/appClient";
import { http } from "@/services/http";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import Footer from "@/components/landing/Footer";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { normalizeCatalogProduct } from "@/lib/catalogProduct";
import { HERO_PLACEHOLDER_IMAGE } from "@/lib/placeholders";

const HERO_IMAGE = HERO_PLACEHOLDER_IMAGE;

const TRUST_ICON_MAP = {
  truck: Truck,
  shield: ShieldCheck,
  return: RotateCcw,
  support: Headphones,
};

function createRandomSeed() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Home() {
  const { t } = useTranslation();
  const { settings } = useSiteContent();
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [mostViewedProducts, setMostViewedProducts] = useState([]);
  const [mostSoldProducts, setMostSoldProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogSeed] = useState(() => createRandomSeed());

  useEffect(() => {
    Promise.all([
      appClient.entities.Product.filter({ status: "active", is_trending: true }, "-created_date", 8),
      http(`/products?page=1&pageSize=24&sort=random&seed=${encodeURIComponent(catalogSeed)}`),
      http("/products?page=1&pageSize=4&sort=views"),
      http("/products?page=1&pageSize=4&sort=purchases"),
      http("/products/meta/filters"),
    ])
      .then(([trendingItems, latestProductsResponse, viewedProductsResponse, soldProductsResponse, filtersResponse]) => {
        const latestProducts = Array.isArray(latestProductsResponse.items)
          ? latestProductsResponse.items.map(normalizeCatalogProduct).filter(Boolean)
          : [];
        const viewedProducts = Array.isArray(viewedProductsResponse.items)
          ? viewedProductsResponse.items.map(normalizeCatalogProduct).filter((product) => (product?.views ?? 0) > 0)
          : [];
        const soldProducts = Array.isArray(soldProductsResponse.items)
          ? soldProductsResponse.items.map(normalizeCatalogProduct).filter((product) => (product?.purchases ?? 0) > 0)
          : [];

        setTrendingProducts(trendingItems);
        setCatalogProducts(latestProducts);
        setMostViewedProducts(viewedProducts);
        setMostSoldProducts(soldProducts);
        setCategories(Array.isArray(filtersResponse.categories) ? filtersResponse.categories.filter((category) => !category.parentId).slice(0, 4) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [catalogSeed]);

  const featuredRandomNewProduct = useMemo(() => {
    if (catalogProducts.length === 0) {
      return null;
    }

    const candidatePool = catalogProducts.slice(0, Math.min(catalogProducts.length, 8));
    return candidatePool[Math.floor(Math.random() * candidatePool.length)] ?? candidatePool[0];
  }, [catalogProducts]);

  const newArrivalProducts = catalogProducts.slice(0, 8);
  const bestsellerProducts = mostSoldProducts.length > 0
    ? mostSoldProducts.slice(0, 4)
    : trendingProducts.length > 0
      ? trendingProducts.slice(0, 4)
      : catalogProducts.slice(0, 4);

  const categoryCards = useMemo(
    () =>
      categories.map((category, index) => {
        const matchingProduct =
          catalogProducts.find((product) => product.category?.toLowerCase() === category.name?.toLowerCase()) ??
          catalogProducts[index] ??
          null;

        return {
          ...category,
          image: matchingProduct?.images?.[0] || HERO_IMAGE,
        };
      }),
    [categories, catalogProducts],
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <main className="luxe-shell pb-16">
        <section className="py-12">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-display text-3xl font-semibold uppercase tracking-tight">
              {settings.homeSections.newArrivalsTitle || t("home.newArrivalsTitle")}
            </h2>
            <Button asChild variant="ghost" className="rounded-full px-0">
              <Link to={settings.homeSections.newArrivalsCtaHref}>
                {settings.homeSections.newArrivalsCtaLabel || t("home.newArrivalsCta")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="luxe-panel p-4 animate-pulse">
                  <div className="aspect-[4/5] rounded-[20px] bg-secondary" />
                  <div className="mt-4 h-4 w-24 rounded bg-secondary" />
                  <div className="mt-2 h-4 w-16 rounded bg-secondary" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {newArrivalProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          )}
        </section>

        <section className="py-8">
          <h2 className="mb-8 text-center font-display text-3xl font-semibold uppercase tracking-tight">
            {settings.homeSections.categoriesTitle || t("home.categoriesTitle")}
          </h2>
          <div className="grid gap-4 md:grid-cols-4">
            {categoryCards.map((category) => (
              <Link
                key={category.id}
                to={`/shop?category=${encodeURIComponent(category.slug)}`}
                className="group relative overflow-hidden rounded-[22px] border border-border/70 shadow-[0_12px_32px_hsl(var(--foreground)/0.06)]"
              >
                <img src={category.image} alt={category.name} className="h-48 w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,21,31,0.08),rgba(16,21,31,0.58))]" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="font-display text-2xl font-semibold text-white">{category.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="py-8">
          <div className="relative overflow-hidden rounded-[24px] border border-border/70">
            <img src={featuredRandomNewProduct?.images?.[0] || HERO_IMAGE} alt="Seasonal sale" className="h-48 w-full object-cover md:h-56" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,21,31,0.68),rgba(16,21,31,0.3))]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white">
              <p className="text-xl font-semibold uppercase tracking-[0.14em] md:text-3xl">
                {settings.homeSections.promoTitle}
              </p>
              <Button asChild className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.2em]">
                <Link to={settings.homeSections.promoButtonHref}>{settings.homeSections.promoButtonLabel}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-display text-3xl font-semibold uppercase tracking-tight">
              {settings.homeSections.bestSellersTitle || t("home.bestsellersTitle")}
            </h2>
            <Button asChild variant="ghost" className="rounded-full px-0">
              <Link to={settings.homeSections.bestSellersCtaHref}>
                {settings.homeSections.bestSellersCtaLabel || t("home.bestsellersCta")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {bestsellerProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        </section>

        <section className="luxe-panel py-8">
          <h2 className="mb-8 text-center font-display text-3xl font-semibold uppercase tracking-tight">
            {settings.homeSections.trustBadgesTitle}
          </h2>
          <div className="grid gap-6 px-6 md:grid-cols-4">
            {settings.trustBadges.map(({ icon, title, description }) => {
              const Icon = TRUST_ICON_MAP[icon] ?? ShieldCheck;

              return (
              <div key={title} className="flex items-center justify-center gap-3 text-center md:justify-start">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em]">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
