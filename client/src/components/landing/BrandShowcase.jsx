import React from "react";
import { motion } from "framer-motion";

const BRANDS = [
  { name: "Nike", tagline: "Up to 55% Off" },
  { name: "Adidas", tagline: "Up to 50% Off" },
  { name: "Tommy Hilfiger", tagline: "Up to 60% Off" },
  { name: "Calvin Klein", tagline: "Up to 65% Off" },
  { name: "Guess", tagline: "Up to 50% Off" },
  { name: "Hugo Boss", tagline: "Up to 45% Off" },
  { name: "Michael Kors", tagline: "Up to 70% Off" },
  { name: "Coach", tagline: "Up to 60% Off" },
];

export default function BrandShowcase() {
  return (
    <section className="py-18 lg:py-24">
      <div className="luxe-shell">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="luxe-eyebrow mb-3">Top Brands</p>
            <h2 className="luxe-heading text-3xl lg:text-5xl">A curated luxury brand wall.</h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-muted-foreground">
            The layout echoes a premium fashion storefront while still using your own categories, products, and data.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {BRANDS.map((brand, i) => (
            <motion.div
              key={brand.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="group relative overflow-hidden rounded-[22px] border border-border/70 bg-card px-6 py-8 transition-all duration-500 hover:-translate-y-1 hover:border-[hsl(var(--accent))/0.35] hover:shadow-[0_16px_32px_hsl(var(--foreground)/0.06)] lg:px-8"
            >
              <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--accent))/0.12,transparent_55%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative text-center">
                <h3 className="font-display text-xl font-semibold transition-colors group-hover:text-[hsl(var(--accent))] lg:text-2xl">
                  {brand.name}
                </h3>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {brand.tagline}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
