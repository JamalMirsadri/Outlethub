import React from "react";
import { Search, ShoppingCart, Truck } from "lucide-react";
import { motion } from "framer-motion";

const STEPS = [
  { icon: Search, title: "Discover", description: "Browse thousands of products from premium brands at outlet prices. Filter by brand, size, style, and savings." },
  { icon: ShoppingCart, title: "Order", description: "Place your order securely. We verify availability and reserve the item from the official outlet source." },
  { icon: Truck, title: "We Source & Deliver", description: "We purchase from the official outlet, verify authenticity, and ship directly to your door." },
];

export default function HowItWorks() {
  return (
    <section className="py-18 lg:py-24">
      <div className="luxe-shell">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <p className="luxe-eyebrow mb-3">Curated Process</p>
          <h2 className="luxe-heading text-3xl lg:text-5xl">How It Works</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="luxe-panel px-6 py-8 text-center"
            >
              <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[20px] bg-secondary">
                <step.icon className="w-7 h-7" />
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-xs font-mono font-bold text-[hsl(var(--accent-foreground))]">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
