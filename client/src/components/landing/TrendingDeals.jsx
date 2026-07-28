import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";

export default function TrendingDeals({ products }) {
  return (
    <section className="py-18 lg:py-24">
      <div className="luxe-shell">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
        >
          <div>
            <p className="luxe-eyebrow mb-3">Today&apos;s Top Deals</p>
            <h2 className="luxe-heading text-3xl lg:text-5xl">Trending Deals</h2>
          </div>
          <Button asChild variant="ghost" className="group mt-4 rounded-full px-0 sm:mt-0">
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
