import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
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

const HERO_SLIDES = [
  {
    eyebrow: "Luxury Outlet Edit",
    discount: "Up To 70% Off",
    titleTop: "Luxury Brands",
    titleAccent: "Outlet Prices.",
    description:
      "Discover premium fashion from the world's top brands in a refined marketplace designed for elegant, effortless shopping.",
    primaryLabel: "Shop Women",
    secondaryLabel: "Shop Men",
    toneClass:
      "from-[rgba(250,250,235,0.08)] via-[rgba(16,34,72,0.40)] to-[rgba(21,91,78,0.48)]",
    cardEyebrow: "Elegant Selection",
    cardTitle: "A graceful edit for modern wardrobes.",
    cardDescription: "Layered neutrals, tailored shapes, and polished styling in a softer boutique-inspired mood.",
  },
  {
    eyebrow: "New Season Style",
    discount: "Fresh Weekly Drops",
    titleTop: "Refined Fashion",
    titleAccent: "Curated Daily.",
    description:
      "A polished storefront experience with elevated layouts, premium contrast, and a cleaner luxury presentation across the site.",
    primaryLabel: "Explore New In",
    secondaryLabel: "View Collections",
    toneClass:
      "from-[rgba(250,250,235,0.10)] via-[rgba(88,70,45,0.26)] to-[rgba(34,56,92,0.42)]",
    cardEyebrow: "Signature Mood",
    cardTitle: "Soft light tones with luxury depth.",
    cardDescription: "Balanced highlights and elegant panels create a more refined first impression for the storefront.",
  },
  {
    eyebrow: "Premium Fashion Space",
    discount: "Outlet Icons",
    titleTop: "Timeless Looks",
    titleAccent: "Styled Better.",
    description:
      "Designed to feel cleaner, brighter, and more premium while keeping all of your own product data, images, and workflows intact.",
    primaryLabel: "Shop All",
    secondaryLabel: "See Best Sellers",
    toneClass:
      "from-[rgba(250,250,235,0.08)] via-[rgba(61,52,38,0.26)] to-[rgba(14,67,73,0.42)]",
    cardEyebrow: "Boutique Layout",
    cardTitle: "A brighter luxury storefront feel.",
    cardDescription: "Hero storytelling, soft cream body color, and layered content blocks for a richer visual presentation.",
  },
];

export default function HeroSection({ heroImage }) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % HERO_SLIDES.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  const currentSlide = HERO_SLIDES[activeSlide];
  const showPreviousSlide = () => setActiveSlide((current) => (current === 0 ? HERO_SLIDES.length - 1 : current - 1));
  const showNextSlide = () => setActiveSlide((current) => (current + 1) % HERO_SLIDES.length);

  return (
    <section className="relative overflow-hidden pt-28 lg:pt-36 pb-16 lg:pb-20">
      <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.12),transparent_42%)]" />
      <div className="luxe-shell relative">
        <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-stretch">
          <div className="luxe-panel relative overflow-hidden px-7 py-8 lg:px-10 lg:py-12">
            <motion.div
              key={`eyebrow-${activeSlide}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="mb-5 flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
              <span className="luxe-eyebrow">{currentSlide.eyebrow}</span>
            </motion.div>

            <motion.p
              key={`discount-${activeSlide}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--accent))]"
            >
              {currentSlide.discount}
            </motion.p>

            <motion.h1
              key={`title-${activeSlide}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="luxe-heading mb-6 text-5xl leading-[0.94] sm:text-6xl lg:text-[84px]"
            >
              {currentSlide.titleTop}
              <br />
              <span className="text-[hsl(var(--accent))]">{currentSlide.titleAccent}</span>
            </motion.h1>

            <motion.p
              key={`desc-${activeSlide}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-xl text-base leading-8 text-muted-foreground lg:text-lg"
            >
              {currentSlide.description}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-10 flex flex-wrap gap-3"
            >
              <Button asChild size="lg" className="h-12 px-7 text-xs font-semibold uppercase tracking-[0.22em]">
                <Link to="/shop">{currentSlide.primaryLabel}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-7 text-xs font-semibold uppercase tracking-[0.22em]">
                <Link to="/shop?sort=newest">{currentSlide.secondaryLabel}</Link>
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
            className="relative overflow-hidden rounded-[34px] border border-border/70 bg-[#eef0e1]"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`slide-${activeSlide}`}
                initial={{ opacity: 0.2, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.2, scale: 0.98 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                <img
                  src={heroImage}
                  alt="Luxury fashion"
                  className="h-full min-h-[560px] w-full object-cover"
                />
                <div className={`absolute inset-0 bg-gradient-to-r ${currentSlide.toneClass}`} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_35%),radial-gradient(circle_at_bottom,rgba(15,24,48,0.24),transparent_42%)]" />
              </motion.div>
            </AnimatePresence>

            <div className="absolute left-5 top-5 flex gap-2">
              <button
                type="button"
                onClick={showPreviousSlide}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white/75 text-[hsl(var(--primary))] shadow-sm backdrop-blur transition hover:bg-white"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={showNextSlide}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white/75 text-[hsl(var(--primary))] shadow-sm backdrop-blur transition hover:bg-white"
                aria-label="Next slide"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="absolute bottom-7 left-7 flex gap-2">
              {HERO_SLIDES.map((_, index) => (
                <button
                  key={`indicator-${index}`}
                  type="button"
                  onClick={() => setActiveSlide(index)}
                  className={`h-2.5 rounded-full transition-all ${activeSlide === index ? "w-10 bg-white" : "w-2.5 bg-white/45"}`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            <div className="absolute bottom-7 right-7 w-full max-w-[280px] rounded-[26px] border border-white/40 bg-white/78 p-6 shadow-[0_20px_40px_rgba(42,32,24,0.12)] backdrop-blur">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--accent))]">
                {currentSlide.cardEyebrow}
              </p>
              <h3 className="font-display text-2xl leading-tight text-[hsl(var(--primary))]">
                {currentSlide.cardTitle}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[hsl(var(--primary))/0.75]">
                {currentSlide.cardDescription}
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
