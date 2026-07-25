import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";

export default function TrendingDeals({ products }) {
  return (
    <section className="py-20 lg:py-32 bg-secondary/30">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-12"
        >
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[hsl(var(--accent))] uppercase mb-3">
              Don't Miss Out
            </p>
            <h2 className="font-display text-3xl lg:text-5xl font-bold">Trending Deals</h2>
          </div>
          <Button asChild variant="ghost" className="mt-4 sm:mt-0 group">
            <Link to="/shop?is_trending=true" className="flex items-center gap-2 text-sm">
              View All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}