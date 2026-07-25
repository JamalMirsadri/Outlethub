import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getCommerceAnalytics } from "@/api/commerce";
import { formatCurrency } from "@/lib/currency";

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCommerceAnalytics().then(setAnalytics).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !analytics) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 bg-secondary rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold">Commerce Analytics</h1>
        <p className="text-sm text-muted-foreground">Revenue, profit, AOV, top sellers, and brand-level profit.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        {[
          { label: "Total Revenue", value: formatCurrency(analytics.totalRevenue, "EUR") },
          { label: "Total Profit", value: formatCurrency(analytics.totalProfit, "EUR") },
          { label: "Orders Count", value: analytics.ordersCount.toString() },
          { label: "Average Order Value", value: formatCurrency(analytics.averageOrderValue, "EUR") },
        ].map((card, index) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * index }} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-2">{card.label}</p>
            <p className="font-display text-2xl font-bold">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-xl border border-border bg-card">
          <h3 className="font-semibold text-sm mb-4">Profit By Product</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={analytics.profitByProduct.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="title" hide />
              <YAxis tickFormatter={(value) => `EUR ${Math.round(value)}`} />
              <Tooltip formatter={(value) => [formatCurrency(Number(value), "EUR"), "Profit"]} />
              <Bar dataKey="profitAmount" fill="hsl(150, 100%, 50%)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-xl border border-border bg-card">
          <h3 className="font-semibold text-sm mb-4">Profit By Brand</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={analytics.profitByBrand.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tickFormatter={(value) => `EUR ${Math.round(value)}`} />
              <YAxis type="category" dataKey="brandName" width={110} />
              <Tooltip formatter={(value) => [formatCurrency(Number(value), "EUR"), "Profit"]} />
              <Bar dataKey="profitAmount" fill="hsl(150, 100%, 40%)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-xl border border-border bg-card">
          <h3 className="font-semibold text-sm mb-4">Top Selling Products</h3>
          <div className="space-y-3">
            {analytics.topSellingProducts.map((product, index) => (
              <div key={`${product.productId}-${index}`} className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
                <div>
                  <p className="text-sm font-medium">{product.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{product.quantitySold} sold</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">{formatCurrency(product.revenueAmount, "EUR")}</p>
                  <p className="text-xs text-muted-foreground mt-1">Profit {formatCurrency(product.profitAmount, "EUR")}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-xl border border-border bg-card">
          <h3 className="font-semibold text-sm mb-4">Profit By Product Table</h3>
          <div className="space-y-3">
            {analytics.profitByProduct.slice(0, 8).map((product) => (
              <div key={`${product.productId}-${product.title}`} className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
                <div>
                  <p className="text-sm font-medium">{product.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{product.quantitySold} units</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">{formatCurrency(product.profitAmount, "EUR")}</p>
                  <p className="text-xs text-muted-foreground mt-1">Revenue {formatCurrency(product.revenueAmount, "EUR")}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
