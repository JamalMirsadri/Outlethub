import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholders";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/lib/currency";
import { normalizeCatalogProduct } from "@/lib/catalogProduct";

export default function ProductCard({ product, index = 0 }) {
  const [liked, setLiked] = useState(false);
  const normalizedProduct = normalizeCatalogProduct(product);
  const { preferredCurrency, convertAmount } = useCurrency();

  if (!normalizedProduct) {
    return null;
  }

  const hasRetailDiscount =
    Number(normalizedProduct.original_price) > 0 &&
    Number(normalizedProduct.final_price) < Number(normalizedProduct.original_price);
  const discount = hasRetailDiscount
    ? normalizedProduct.discount_percent ||
      Math.max(0, Math.round((1 - normalizedProduct.final_price / normalizedProduct.original_price) * 100))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="group relative"
    >
      <Link to={`/products/${normalizedProduct.slug || normalizedProduct.id}`} className="block">
        <div className="relative overflow-hidden rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--secondary))/0.35)] shadow-[0_18px_42px_hsl(var(--foreground)/0.07)] transition-all duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_24px_58px_hsl(var(--foreground)/0.12)]">
          <div className="relative aspect-[4/5] overflow-hidden bg-secondary/45">
          <img
            src={normalizedProduct.images?.[0] || PRODUCT_PLACEHOLDER_IMAGE}
            alt={normalizedProduct.title}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute top-3 left-3 flex gap-2">
            {discount > 0 && (
              <span className="rounded-full bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] px-2.5 py-1 text-xs font-mono font-semibold text-[hsl(var(--primary-foreground))] shadow-[0_10px_24px_hsl(var(--accent)/0.22)]">
                -{discount}%
              </span>
            )}
            {normalizedProduct.is_trending && (
              <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-[0_10px_20px_hsl(var(--primary)/0.18)]">
                TRENDING
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.preventDefault(); setLiked(!liked); }}
            className="absolute top-3 right-3 rounded-full border border-white/70 bg-white/85 p-2 opacity-0 transition-all duration-300 hover:scale-110 group-hover:opacity-100"
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-red-500 text-red-500" : ""}`} />
          </button>
        </div>
        <div className="space-y-1.5 px-4 pb-4 pt-4">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {normalizedProduct.brand}
          </p>
          <p className="truncate text-sm font-medium lg:text-[15px]">{normalizedProduct.title}</p>
          <div className="flex items-center gap-2 pt-1">
            <span className="font-mono text-sm font-semibold text-foreground">
              {formatCurrency(convertAmount(normalizedProduct.final_price ?? 0, normalizedProduct.currency || "EUR", preferredCurrency), preferredCurrency)}
            </span>
            {hasRetailDiscount && (
              <span className="font-mono text-xs text-muted-foreground line-through">
                {formatCurrency(convertAmount(normalizedProduct.original_price ?? 0, normalizedProduct.currency || "EUR", preferredCurrency), preferredCurrency)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Outlet price {formatCurrency(convertAmount(normalizedProduct.outlet_price ?? normalizedProduct.final_price ?? 0, normalizedProduct.currency || "EUR", preferredCurrency), preferredCurrency)}
          </p>
        </div>
        </div>
      </Link>
    </motion.div>
  );
}
