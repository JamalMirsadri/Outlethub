import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
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

const GOOGLE_ANALYTICS_ID = "G-216CW6YP13";
const GOOGLE_ANALYTICS_SCRIPT_ID = "outlethub-google-analytics";

function initGoogleAnalytics() {
  if (typeof window === "undefined") {
    return;
  }

  if (document.getElementById(GOOGLE_ANALYTICS_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement("script");
  script.id = GOOGLE_ANALYTICS_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args) {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ANALYTICS_ID);
}

function normalizeItems(response) {
  return Array.isArray(response?.items)
    ? response.items.map(normalizeCatalogProduct).filter(Boolean)
    : [];
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getSectionMeta(section, settings) {
  switch (section.id) {
    case "outlet":
      return {
        title: settings.homeSections?.newArrivalsTitle || "Outlet",
        cta: {
          to: settings.homeSections?.newArrivalsCtaHref || "/shop",
          label: settings.homeSections?.newArrivalsCtaLabel || "View all",
        },
      };
    case "sport": {
      const brandIds = Array.isArray(section.brandIds) ? section.brandIds.filter(Boolean) : [];
      const to = brandIds.length > 0 ? `/shop?brand=${encodeURIComponent(brandIds.join(","))}` : "/shop";
      return { title: "Sport", cta: { to, label: "View All" } };
    }
    case "best_sellers":
      return {
        title: settings.homeSections?.bestSellersTitle || "Best Sellers",
        cta: {
          to: settings.homeSections?.bestSellersCtaHref || "/shop",
          label: settings.homeSections?.bestSellersCtaLabel || "View all",
        },
      };
    default:
      return { title: "", cta: null };
  }
}

async function fetchSectionProducts(section, seed) {
  if (section.id === "best_sellers") {
    const response = await http(
      `/products?page=1&pageSize=${section.productCount}&sort=best_sellers`,
    );
    return normalizeItems(response);
  }

  const brandIds = Array.isArray(section.brandIds) ? section.brandIds.filter(Boolean) : [];
  if (brandIds.length === 0) {
    if (section.id === "sport") {
      return [];
    }
    const response = await http(
      `/products?page=1&pageSize=${section.productCount}&sort=random&seed=${encodeURIComponent(seed)}`,
    );
    return normalizeItems(response);
  }

  const responses = await Promise.all(
    brandIds.map((brandId) =>
      http(
        `/products?page=1&pageSize=${section.productCount}&brand=${encodeURIComponent(brandId)}&sort=random&seed=${encodeURIComponent(seed)}`,
      ),
    ),
  );

  const seen = new Set();
  const combined = responses
    .flatMap((response) => normalizeItems(response))
    .filter((product) => {
      if (!product?.id || seen.has(product.id)) {
        return false;
      }
      seen.add(product.id);
      return true;
    });

  return shuffle(combined).slice(0, section.productCount);
}

export default function Home() {
  const { t } = useTranslation();
  const { settings } = useSiteContent();
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sectionProducts, setSectionProducts] = useState({
    outlet: [],
    sport: [],
    best_sellers: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadingSections, setLoadingSections] = useState(true);
  const [catalogSeed] = useState(() => createRandomSeed());

  useEffect(() => {
    Promise.all([
      http(`/products?page=1&pageSize=24&sort=random&seed=${encodeURIComponent(catalogSeed)}`),
      http("/products/meta/filters"),
    ])
      .then(([catalogResponse, filtersResponse]) => {
        setCatalogProducts(normalizeItems(catalogResponse));
        setCategories(
          Array.isArray(filtersResponse.categories)
            ? filtersResponse.categories.filter((category) => !category.parentId).slice(0, 4)
            : [],
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [catalogSeed]);

  const sections = Array.isArray(settings.homepageSections) ? settings.homepageSections : [];

  useEffect(() => {
    let cancelled = false;
    const loadSections = async () => {
      const next = { outlet: [], sport: [], best_sellers: [] };
      await Promise.all(
        sections
          .filter((section) => section.enabled)
          .map(async (section) => {
            try {
              next[section.id] = await fetchSectionProducts(section, catalogSeed);
            } catch {
              next[section.id] = [];
            }
          }),
      );
      if (!cancelled) {
        setSectionProducts(next);
      }
    };

    setLoadingSections(true);
    loadSections().finally(() => {
      if (!cancelled) {
        setLoadingSections(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [settings.homepageSections, catalogSeed]);

  useEffect(() => {
    initGoogleAnalytics();
  }, []);

  const featuredRandomNewProduct = useMemo(() => {
    if (catalogProducts.length === 0) {
      return null;
    }

    const candidatePool = catalogProducts.slice(0, Math.min(catalogProducts.length, 8));
    return candidatePool[Math.floor(Math.random() * candidatePool.length)] ?? candidatePool[0];
  }, [catalogProducts]);

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
        {sections
          .filter((section) => section.enabled)
          .map((section) => {
            const products = sectionProducts[section.id] ?? [];
            const meta = getSectionMeta(section, settings);
            if (!loadingSections && products.length === 0) {
              return null;
            }

            return (
              <section className="py-12" key={section.id}>
                <div className="mb-8 flex items-center justify-between">
                  <h2 className="font-display text-3xl font-semibold uppercase tracking-tight">
                    {meta.title}
                  </h2>
                  {meta.cta ? (
                    <Button asChild variant="ghost" className="rounded-full px-0">
                      <Link to={meta.cta.to}>
                        {meta.cta.label} <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>

                {loadingSections ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {Array.from({ length: section.productCount || 4 }).map((_, index) => (
                      <div key={index} className="luxe-panel p-4 animate-pulse">
                        <div className="aspect-[4/5] rounded-[20px] bg-secondary" />
                        <div className="mt-4 h-4 w-24 rounded bg-secondary" />
                        <div className="mt-2 h-4 w-16 rounded bg-secondary" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {products.map((product, index) => (
                      <ProductCard key={product.id} product={product} index={index} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

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
