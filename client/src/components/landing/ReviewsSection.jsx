import React from "react";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

const REVIEWS = [
  { name: "Sarah M.", rating: 5, comment: "Found a Michael Kors bag at 65% off retail. Absolutely authentic and arrived in perfect condition. My new go-to for luxury shopping.", location: "New York" },
  { name: "James T.", rating: 5, comment: "The Hugo Boss suit I ordered was impeccable. Saved over $400 compared to the full-price store. OutletHub is legitimate.", location: "London" },
  { name: "Maria L.", rating: 5, comment: "I've been shopping here for 6 months. The price alerts feature is genius — got notified when my dream Calvin Klein dress dropped 70%.", location: "Milan" },
  { name: "David K.", rating: 4, comment: "Great selection of Nike and Adidas. Shipping took a bit longer than expected but the savings made it worthwhile. Will shop again.", location: "Berlin" },
];

export default function ReviewsSection() {
  return (
    <section className="py-20 lg:py-32 bg-secondary/30">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14"
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase mb-3">
            Trusted by Thousands
          </p>
          <h2 className="font-display text-3xl lg:text-5xl font-bold">Customer Reviews</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {REVIEWS.map((review, i) => (
            <motion.div
              key={review.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="p-6 rounded-xl border border-border bg-card"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className={`w-4 h-4 ${s < review.rating ? "fill-[hsl(var(--accent))] text-[hsl(var(--accent))]" : "text-muted"}`} />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                "{review.comment}"
              </p>
              <div>
                <p className="text-sm font-semibold">{review.name}</p>
                <p className="text-xs text-muted-foreground">{review.location}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}