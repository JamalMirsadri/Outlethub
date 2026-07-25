import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { Zap, Flame, Star, TrendingUp } from "lucide-react";

const DEAL_RULES = [
  { min: 70, label: "Featured Deal", badge: "featured", icon: Star, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20", barColor: "bg-yellow-400" },
  { min: 60, label: "Hot Deal", badge: "hot", icon: Flame, color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20", barColor: "bg-red-400" },
  { min: 50, label: "Good Deal", badge: "good", icon: Zap, color: "text-[hsl(var(--accent))]", bg: "bg-[hsl(var(--accent))]/10", border: "border-[hsl(var(--accent))]/20", barColor: "bg-[hsl(var(--accent))]" },
];

function getDealTier(discount) {
  for (const rule of DEAL_RULES) {
    if (discount >= rule.min) return rule;
  }
  return null;
}

export default function ImportsDeals() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appClient.entities.Product.filter({ status: "active" }, "-discount_percent", 200)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const dealProducts = products.filter(p => (p.discount_percent || 0) >= 50);
  const featured = dealProducts.filter(p => p.discount_percent >= 70);
  const hot = dealProducts.filter(p => p.discount_percent >= 60 && p.discount_percent < 70);
  const good = dealProducts.filter(p => p.discount_percent >= 50 && p.discount_percent < 60);

  const summary = [
    { ...DEAL_RULES[0], count: featured.length },
    { ...DEAL_RULES[1], count: hot.length },
    { ...DEAL_RULES[2], count: good.length },
  ];

  if (loading) return <div className="space-y-4">{Array.from({length: 6}).map((_, i) => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-8">
      {/* Rules */}
      <div>
        <h2 className="font-semibold text-sm mb-4 text-muted-foreground uppercase tracking-wider">Deal Detection Rules</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summary.map(({ label, min, count, icon: Icon, color, bg, border, barColor }) => (
            <div key={label} className={`p-5 rounded-xl border ${border} ${bg}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className={`font-semibold text-sm ${color}`}>{label}</span>
                </div>
                <span className={`font-mono text-2xl font-bold ${color}`}>{count}</span>
              </div>
              <p className="text-xs text-muted-foreground">{min}%+ discount required</p>
              <div className="mt-3 h-1.5 bg-black/20 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min((count / Math.max(dealProducts.length, 1)) * 100, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Products table */}
      <div>
        <h2 className="font-semibold text-sm mb-4 text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Detected Deals ({dealProducts.length})
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Product", "Brand", "Original Price", "Outlet Price", "Discount", "Deal Badge"].map(h => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dealProducts.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-16">No deal products found (50%+ discount)</td></tr>
              ) : dealProducts.map(p => {
                const tier = getDealTier(p.discount_percent || 0);
                const Icon = tier?.icon || Zap;
                return (
                  <tr key={p.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium max-w-xs truncate">{p.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.brand}</td>
                    <td className="px-4 py-3 font-mono line-through text-muted-foreground">${p.original_price?.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono font-semibold">${p.final_price?.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-[hsl(var(--accent))]">-{p.discount_percent}%</span>
                    </td>
                    <td className="px-4 py-3">
                      {tier ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${tier.border} ${tier.bg} ${tier.color}`}>
                          <Icon className="w-3 h-3" />{tier.label}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

