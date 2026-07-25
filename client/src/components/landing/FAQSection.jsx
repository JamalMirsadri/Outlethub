import React from "react";
import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  { q: "Are the products authentic?", a: "Yes, 100%. Every product on OutletHub is sourced directly from official brand outlets, authorized retailers, and verified affiliate networks. We never sell counterfeits." },
  { q: "How are the prices so low?", a: "We aggregate products from official outlet stores, end-of-season sales, and overstock inventory. These are genuine discounts from the brands themselves — we simply bring them all to one place." },
  { q: "How long does shipping take?", a: "Standard shipping takes 5-10 business days. Express shipping (2-4 days) is available at checkout. Some items may ship directly from the outlet source, which can add 1-2 days." },
  { q: "Can I return products?", a: "Yes. We offer a 30-day return policy on all unworn, unwashed items with original tags attached. Returns are free for orders above $100." },
  { q: "How do Price Alerts work?", a: "Set a target price on any product, and we'll notify you via email the moment the price drops to or below your target. It's the smartest way to shop luxury on a budget." },
  { q: "Do you ship internationally?", a: "Yes, we ship to over 40 countries. International shipping rates and times vary by destination. Check our shipping page for details." },
];

export default function FAQSection() {
  return (
    <section className="py-20 lg:py-32">
      <div className="max-w-3xl mx-auto px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14"
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase mb-3">
            Got Questions?
          </p>
          <h2 className="font-display text-3xl lg:text-5xl font-bold">FAQ</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl px-6 data-[state=open]:border-[hsl(var(--accent))/30]">
                <AccordionTrigger className="text-sm font-semibold text-left hover:no-underline py-5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}