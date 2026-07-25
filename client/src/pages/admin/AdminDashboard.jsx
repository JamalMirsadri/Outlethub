import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { DollarSign, ShoppingCart, Package, Tag, Users, TrendingUp, Percent } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const REVENUE_DATA = [
  { month: "Jan", revenue: 12400 }, { month: "Feb", revenue: 18200 }, { month: "Mar", revenue: 22100 },
  { month: "Apr", revenue: 19800 }, { month: "May", revenue: 28500 }, { month: "Jun", revenue: 34200 },
];
const ORDER_DATA = [
  { month: "Jan", orders: 85 }, { month: "Feb", orders: 120 }, { month: "Mar", orders: 145 },
  { month: "Apr", orders: 130 }, { month: "May", orders: 190 }, { month: "Jun", orders: 225 },
];

function StatCard({ icon: Icon, label, value, change, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="p-5 rounded-xl border border-border bg-card"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        {change && <span className={`text-xs font-mono font-semibold ${change > 0 ? "text-[hsl(var(--accent))]" : "text-destructive"}`}>{change > 0 ? "+" : ""}{change}%</span>}
      </div>
      <p className="font-mono text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, brands: 0 });

  useEffect(() => {
    Promise.all([
      appClient.entities.Product.filter({ status: "active" }, null, 1).then(r => r.length),
      appClient.entities.Order.list(null, 1).then(r => r.length),
      appClient.entities.Brand.filter({ status: "active" }, null, 1).then(r => r.length),
    ]).then(([products, orders, brands]) => setStats({ products, orders, brands })).catch(() => {});
  }, []);

  const STATS = [
    { icon: DollarSign, label: "Total Revenue", value: "$134,200", change: 12.5 },
    { icon: ShoppingCart, label: "Total Orders", value: stats.orders || "895", change: 8.2 },
    { icon: Package, label: "Active Products", value: stats.products || "15,420", change: 3.1 },
    { icon: Tag, label: "Brands", value: stats.brands || "200", change: 2 },
    { icon: Users, label: "Active Users", value: "8,240", change: 15.3 },
    { icon: TrendingUp, label: "Conversion Rate", value: "3.8%", change: 0.5 },
    { icon: Percent, label: "Avg. Margin", value: "18.5%", change: -1.2 },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your marketplace performance</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map((s, i) => <StatCard key={s.label} {...s} index={i} />)}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.3}} className="p-6 rounded-xl border border-border bg-card">
          <h3 className="font-semibold text-sm mb-4">Revenue</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={REVENUE_DATA}>
              <defs>
                <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(150, 100%, 50%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(150, 100%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize:12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize:12}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v=>[`$${v.toLocaleString()}`,"Revenue"]} contentStyle={{background:"hsl(var(--card))",border:"1px solid hsl(var(--border))",borderRadius:8}} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(150, 100%, 50%)" fill="url(#revenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.4}} className="p-6 rounded-xl border border-border bg-card">
          <h3 className="font-semibold text-sm mb-4">Orders</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ORDER_DATA}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize:12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize:12}} />
              <Tooltip contentStyle={{background:"hsl(var(--card))",border:"1px solid hsl(var(--border))",borderRadius:8}} />
              <Bar dataKey="orders" fill="hsl(var(--foreground))" radius={[4,4,0,0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}

