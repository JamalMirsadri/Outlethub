import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { HERO_PLACEHOLDER_IMAGE } from "@/lib/placeholders";

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

export default function HeroSection() {
  const { settings } = useSiteContent();
  const [activeSlide, setActiveSlide] = useState(0);
  const slides = settings.heroSlides.length > 0 ? settings.heroSlides : [];
  const currentSlide = slides[activeSlide] ?? null;
  const brandRow = useMemo(() => {
    const items = settings.brandMarquee.filter(Boolean);
    return items.length > 0 ? [...items, ...items] : [];
  }, [settings.brandMarquee]);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    if (activeSlide >= slides.length) {
      setActiveSlide(0);
    }
  }, [activeSlide, slides.length]);

  const showPreviousSlide = () =>
    setActiveSlide((current) => (current === 0 ? slides.length - 1 : current - 1));
  const showNextSlide = () => setActiveSlide((current) => (current + 1) % slides.length);

  if (!currentSlide) {
    return null;
  }

  return (
    <section className="relative overflow-hidden pt-28 lg:pt-36 pb-16 lg:pb-20">
      <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,hsl(var(--accent)/0.10),transparent_45%)]" />
      <div className="luxe-shell relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[30px] border border-border/70 bg-[#f6f6ec] shadow-[0_22px_60px_hsl(var(--foreground)/0.08)]"
        >
          <div className="relative min-h-[520px] lg:min-h-[560px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={`slide-${activeSlide}`}
                initial={{ opacity: 0.2, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.2 }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                <img
                  src={currentSlide.imageUrl || HERO_PLACEHOLDER_IMAGE}
                  alt={currentSlide.titleTop}
                  className="h-full min-h-[520px] w-full object-cover lg:min-h-[560px]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,21,31,0.68)_0%,rgba(16,21,31,0.28)_42%,rgba(16,21,31,0.12)_100%)]" />
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(90deg, ${currentSlide.overlayFrom} 0%, ${currentSlide.overlayVia} 45%, ${currentSlide.overlayTo} 100%)`,
                  }}
                />
              </motion.div>
            </AnimatePresence>

            <div className="absolute left-6 top-6 flex gap-2">
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

            <div className="absolute inset-y-0 left-0 flex w-full max-w-[420px] items-center">
              <div className="px-8 py-10 text-white lg:px-12">
                <motion.div
                  key={`copy-${activeSlide}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                    {currentSlide.eyebrow}
                  </p>
                  <h1 className="mb-4 max-w-[320px] font-display text-4xl font-semibold leading-[1.02] lg:text-6xl">
                    {currentSlide.titleTop}
                    <br />
                    {currentSlide.titleAccent}
                  </h1>
                  <p className="max-w-[340px] text-sm leading-7 text-white/84 lg:text-base">
                    {currentSlide.description}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Button asChild size="lg" className="h-11 bg-[hsl(var(--accent))] px-6 text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent))/0.9]">
                      <Link to={currentSlide.primaryHref}>{currentSlide.primaryLabel}</Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="h-11 border-white/50 bg-white/10 px-6 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:bg-white/20">
                      <Link to={currentSlide.secondaryHref}>{currentSlide.secondaryLabel}</Link>
                    </Button>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="absolute bottom-6 left-8 flex gap-2">
              {slides.map((_, index) => (
                <button
                  key={`indicator-${index}`}
                  type="button"
                  onClick={() => setActiveSlide(index)}
                  className={`h-2.5 rounded-full transition-all ${activeSlide === index ? "w-10 bg-white" : "w-2.5 bg-white/45"}`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            <div className="absolute bottom-7 right-7 hidden w-full max-w-[300px] rounded-[26px] border border-white/40 bg-white/82 p-6 shadow-[0_20px_40px_rgba(42,32,24,0.12)] backdrop-blur md:block">
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
                <Link to={currentSlide.primaryHref}>
                  Shop Now <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {settings.heroStats.map((stat) => (
            <div key={stat.label} className="luxe-panel px-5 py-6 text-center">
              <AnimatedCounter end={stat.value} suffix={stat.suffix} />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
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
              {brandRow.map((brand, i) => (
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
