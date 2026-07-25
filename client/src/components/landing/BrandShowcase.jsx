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
    <section className="py-20 lg:py-32">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14"
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase mb-3">
            Official Partners
          </p>
          <h2 className="font-display text-3xl lg:text-5xl font-bold">
            Shop by Brand
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {BRANDS.map((brand, i) => (
            <motion.div
              key={brand.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="group relative p-8 lg:p-10 rounded-xl border border-border bg-card hover:border-[hsl(var(--accent))/30] transition-all duration-500 cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--accent))/5] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative text-center">
                <h3 className="font-display text-lg lg:text-xl font-bold mb-2 group-hover:text-[hsl(var(--accent))] transition-colors">
                  {brand.name}
                </h3>
                <p className="text-xs font-mono text-muted-foreground">{brand.tagline}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}