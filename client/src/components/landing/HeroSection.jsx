import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const DEAL_STATS = [
  { label: "Brands", end: 200, suffix: "+" },
  { label: "Products", end: 15000, suffix: "+" },
  { label: "Avg. Savings", end: 45, suffix: "%" },
];

function AnimatedCounter({ end, suffix, duration = 2000 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);

  return (
    <span className="font-mono font-bold text-2xl lg:text-4xl text-[hsl(var(--accent))]">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

const BRANDS_ROW = ["NIKE", "ADIDAS", "TOMMY HILFIGER", "CALVIN KLEIN", "GUESS", "HUGO BOSS", "MICHAEL KORS", "COACH"];

export default function HeroSection({ heroImage }) {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Luxury fashion"
          className="w-full h-full object-cover opacity-30 dark:opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/50" />
      </div>

      <div className="relative max-w-[1440px] mx-auto px-6 lg:px-10 pt-28 pb-16 w-full">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2 mb-6"
          >
            <Sparkles className="w-4 h-4 text-[hsl(var(--accent))]" />
            <span className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Premium Outlet Marketplace
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.05] mb-6"
          >
            Discover Luxury
            <br />
            Brands at{" "}
            <span className="text-[hsl(var(--accent))]">Outlet Prices</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg lg:text-xl text-muted-foreground max-w-xl mb-10 font-light leading-relaxed"
          >
            Find the best deals from hundreds of fashion brands in one place. Authentic products sourced directly from official outlets.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row gap-4 mb-16"
          >
            <Button asChild size="lg" className="h-14 px-8 text-sm font-semibold tracking-wide rounded-full">
              <Link to="/shop">
                SHOP NOW <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-8 text-sm font-semibold tracking-wide rounded-full">
              <Link to="/shop?is_trending=true">
                TRENDING DEALS
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-3 gap-8 max-w-md"
          >
            {DEAL_STATS.map((stat) => (
              <div key={stat.label}>
                <AnimatedCounter end={stat.end} suffix={stat.suffix} />
                <p className="text-xs text-muted-foreground mt-1 tracking-wide">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Brand ticker */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-border/50 py-4 glass">
        <div className="overflow-hidden">
          <motion.div
            animate={{ x: [0, -1200] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="flex items-center gap-12 whitespace-nowrap"
          >
            {[...BRANDS_ROW, ...BRANDS_ROW].map((brand, i) => (
              <span key={i} className="text-xs font-semibold tracking-[0.3em] text-muted-foreground">
                {brand}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}