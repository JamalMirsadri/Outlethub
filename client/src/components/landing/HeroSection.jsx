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
    <section className="relative overflow-hidden pt-28 lg:pt-36 pb-16 lg:pb-20">
      <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.16),transparent_42%)]" />
      <div className="luxe-shell relative">
        <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-stretch">
          <div className="luxe-panel relative overflow-hidden px-7 py-8 lg:px-10 lg:py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="mb-5 flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
              <span className="luxe-eyebrow">Luxury Outlet Edit</span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--accent))]"
            >
              Up To 70% Off
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="luxe-heading mb-6 text-5xl leading-[0.94] sm:text-6xl lg:text-[84px]"
            >
              Luxury Brands
              <br />
              <span className="text-[hsl(var(--accent))]">Outlet Prices.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-xl text-base leading-8 text-muted-foreground lg:text-lg"
            >
              Discover premium fashion from the world&apos;s top brands in a refined marketplace designed for elegant, effortless shopping.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-10 flex flex-wrap gap-3"
            >
              <Button asChild size="lg" className="h-12 px-7 text-xs font-semibold uppercase tracking-[0.22em]">
                <Link to="/shop">Shop Women</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-7 text-xs font-semibold uppercase tracking-[0.22em]">
                <Link to="/shop?gender=men">Shop Men</Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="mt-12 grid grid-cols-3 gap-3"
            >
              {DEAL_STATS.map((stat) => (
                <div key={stat.label} className="rounded-[22px] border border-border/70 bg-background/65 px-4 py-5">
                  <AnimatedCounter end={stat.end} suffix={stat.suffix} />
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-[34px] border border-border/70 bg-[#e9e1d6]"
          >
            <img
              src={heroImage}
              alt="Luxury fashion"
              className="h-full min-h-[560px] w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(42,32,24,0.1),rgba(42,32,24,0.02))]" />
            <div className="absolute bottom-7 right-7 w-full max-w-[280px] rounded-[26px] border border-white/40 bg-white/78 p-6 shadow-[0_20px_40px_rgba(42,32,24,0.12)] backdrop-blur">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--accent))]">
                Extra Style Offer
              </p>
              <h3 className="font-display text-2xl leading-tight text-[hsl(var(--primary))]">
                A refined look for every season.
              </h3>
              <p className="mt-3 text-sm leading-6 text-[hsl(var(--primary))/0.75]">
                Clean silhouettes, premium textures, and a softer color palette inspired by timeless luxury boutiques.
              </p>
              <Button asChild className="mt-5 h-11 px-5 text-xs font-semibold uppercase tracking-[0.2em]">
                <Link to="/shop">
                  Shop Now <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
      <div className="luxe-shell mt-8">
        <div className="luxe-panel overflow-hidden py-4">
          <div className="overflow-hidden">
            <motion.div
              animate={{ x: [0, -1200] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="flex items-center gap-12 whitespace-nowrap px-6"
            >
              {[...BRANDS_ROW, ...BRANDS_ROW].map((brand, i) => (
                <span key={i} className="text-[11px] font-semibold tracking-[0.34em] text-muted-foreground">
                  {brand}
                </span>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
