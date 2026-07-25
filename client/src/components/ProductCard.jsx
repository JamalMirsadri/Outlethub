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
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-secondary">
          <img
            src={normalizedProduct.images?.[0] || PRODUCT_PLACEHOLDER_IMAGE}
            alt={normalizedProduct.title}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute top-3 left-3 flex gap-2">
            {discount > 0 && (
              <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-[hsl(var(--accent))] text-black rounded-full">
                -{discount}%
              </span>
            )}
            {normalizedProduct.is_trending && (
              <span className="px-2.5 py-1 text-xs font-semibold bg-foreground text-background rounded-full">
                TRENDING
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.preventDefault(); setLiked(!liked); }}
            className="absolute top-3 right-3 p-2 rounded-full glass opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-red-500 text-red-500" : ""}`} />
          </button>
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {normalizedProduct.brand}
          </p>
          <p className="text-sm font-medium truncate">{normalizedProduct.title}</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-[hsl(var(--accent))]">
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
      </Link>
    </motion.div>
  );
}
