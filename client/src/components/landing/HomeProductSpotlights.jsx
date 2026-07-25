import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Eye, ShoppingBag, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/lib/currency";
import { normalizeCatalogProduct } from "@/lib/catalogProduct";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholders";

function SectionHeader({ eyebrow, title, cta }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-[hsl(var(--accent))] uppercase mb-3">
          {eyebrow}
        </p>
        <h2 className="font-display text-3xl lg:text-5xl font-bold">{title}</h2>
      </div>
      {cta ? (
        <Button asChild variant="ghost" className="group w-fit">
          <Link to={cta.to} className="flex items-center gap-2 text-sm">
            {cta.label}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-3">
          <div className="aspect-[4/5] rounded-lg bg-secondary animate-pulse" />
          <div className="h-3 w-24 rounded bg-secondary animate-pulse" />
          <div className="h-4 w-40 rounded bg-secondary animate-pulse" />
          <div className="h-4 w-20 rounded bg-secondary animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title }) {
  return (
    <div className="rounded-3xl border border-border bg-secondary/20 p-8 text-sm text-muted-foreground">
      {title}
    </div>
  );
}

export default function HomeProductSpotlights({ loading, featuredProduct, mostViewedProducts, mostSoldProducts }) {
  const { preferredCurrency, convertAmount } = useCurrency();
  const featured = normalizeCatalogProduct(featuredProduct);

  return (
    <>
      <section className="py-20 lg:py-28">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
          <SectionHeader
            eyebrow="Fresh Discovery"
            title="Random New Arrival"
            cta={{ to: "/shop?sort=newest", label: "Browse New Products" }}
          />
          {loading ? (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="aspect-[16/10] rounded-[32px] bg-secondary animate-pulse" />
              <div className="rounded-[32px] bg-secondary animate-pulse min-h-[320px]" />
            </div>
          ) : !featured ? (
            <EmptyState title="No new product is available yet." />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
            >
              <Link
                to={`/products/${featured.slug || featured.id}`}
                className="group relative overflow-hidden rounded-[32px] border border-border bg-secondary/30"
              >
                <img
                  src={featured.images?.[0] || PRODUCT_PLACEHOLDER_IMAGE}
                  alt={featured.title}
                  className="h-full w-full min-h-[360px] object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/65 to-transparent" />
                <div className="absolute inset-0 flex items-end p-8 lg:p-10">
                  <div className="max-w-xl">
                    <div className="mb-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[hsl(var(--accent))] px-3 py-1 text-xs font-semibold text-black">
                        RANDOM PICK
                      </span>
                      <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                        NEW ARRIVAL
                      </span>
                    </div>
                    <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase mb-3">
                      {featured.brand || "OutletHub"}
                    </p>
                    <h3 className="font-display text-3xl lg:text-5xl font-bold mb-4">{featured.title}</h3>
                    <p className="text-sm lg:text-base text-muted-foreground max-w-lg mb-6 line-clamp-3">
                      {featured.description || "Freshly added to the catalog and ready to discover."}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg font-semibold text-[hsl(var(--accent))]">
                        {formatCurrency(
                          convertAmount(featured.final_price ?? 0, featured.currency || "EUR", preferredCurrency),
                          preferredCurrency,
                        )}
                      </span>
                      {featured.original_price > featured.final_price ? (
                        <span className="font-mono text-sm text-muted-foreground line-through">
                          {formatCurrency(
                            convertAmount(featured.original_price ?? 0, featured.currency || "EUR", preferredCurrency),
                            preferredCurrency,
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
              <div className="rounded-[32px] border border-border bg-secondary/20 p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Why this pick</p>
                    <p className="text-sm text-muted-foreground">A new product chosen from the latest arrivals.</p>
                  </div>
                </div>
                <div className="space-y-5">
                  <div className="rounded-2xl border border-border bg-background/40 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Category</p>
                    <p className="text-sm font-medium">{featured.category || "Uncategorized"}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/40 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Views</p>
                    <p className="text-sm font-medium">{(featured.views ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/40 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Sales</p>
                    <p className="text-sm font-medium">{(featured.purchases ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      <section className="py-20 bg-secondary/20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
          <SectionHeader
            eyebrow="Most Viewed"
            title="Products Shoppers Watch The Most"
            cta={{ to: "/shop?sort=featured", label: "See More Products" }}
          />
          {loading ? (
            <ProductGridSkeleton />
          ) : mostViewedProducts.length === 0 ? (
            <EmptyState title="No viewed products are available yet." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {mostViewedProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
          <SectionHeader
            eyebrow="Best Sellers"
            title="Products With The Most Sales"
            cta={{ to: "/shop", label: "Shop All Products" }}
          />
          {loading ? (
            <ProductGridSkeleton />
          ) : mostSoldProducts.length === 0 ? (
            <EmptyState title="No top-selling products are available yet." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {mostSoldProducts.map((product, index) => (
                <div key={product.id} className="space-y-3">
                  <div className="flex items-center gap-2 px-1 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                    <ShoppingBag className="w-4 h-4 text-[hsl(var(--accent))]" />
                    <span>{(product.purchases ?? 0).toLocaleString()} Sales</span>
                  </div>
                  <ProductCard product={product} index={index} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="pb-4">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
          {!loading && mostViewedProducts.length > 0 ? (
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              <Eye className="w-4 h-4 text-[hsl(var(--accent))]" />
              <span>Live product ranking based on current catalog views and purchases</span>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
