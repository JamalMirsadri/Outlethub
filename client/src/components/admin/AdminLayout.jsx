import React, { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Tag, Layers3, Link2, Upload, Bot, DollarSign, BarChart3, Activity, Bell, History, ChevronLeft, Menu, Sun, Moon, Globe, Truck, ClipboardList, CreditCard, Landmark, Users, FilePenLine, Award } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Package, label: "Products", path: "/admin/products" },
  { icon: ShoppingCart, label: "Orders", path: "/admin/orders" },
  { icon: Users, label: "Users", path: "/admin/users" },
  { icon: CreditCard, label: "Payments", path: "/admin/payments" },
  { icon: CreditCard, label: "Pay Review", path: "/admin/payments/review" },
  { icon: Landmark, label: "Bank Accts", path: "/admin/bank-accounts" },
  { icon: DollarSign, label: "FX Rates", path: "/admin/exchange-rates" },
  { icon: ClipboardList, label: "Procurement", path: "/admin/procurement" },
  { icon: Tag, label: "Brands", path: "/admin/brands" },
  { icon: Layers3, label: "Categories", path: "/admin/categories" },
  { icon: DollarSign, label: "Pricing", path: "/admin/pricing" },
  { icon: Truck, label: "Shipping", path: "/admin/shipping" },
  { icon: FilePenLine, label: "Site Content", path: "/admin/site-content" },
  { icon: Award, label: "Loyalty", path: "/admin/loyalty" },
  { icon: Globe, label: "Sources", path: "/admin/sources" },
  { icon: Bot, label: "Connectors", path: "/admin/connectors" },
  { icon: Bot, label: "Wizard", path: "/admin/connectors/wizard" },
  { icon: Activity, label: "Conn. Health", path: "/admin/connectors/health" },
  { icon: Activity, label: "Diagnostics", path: "/admin/connectors/diagnostics" },
  { icon: Link2, label: "Integrations", path: "/admin/integrations" },
  { icon: Activity, label: "Imp. Observe", path: "/admin/import-observability" },
  { icon: Upload, label: "Imports", path: "/admin/imports", matchPrefix: true },
  { icon: Bot, label: "Scrapers", path: "/admin/scrapers", matchPrefix: true },
  { icon: Activity, label: "Monitoring", path: "/admin/monitoring" },
  { icon: Bell, label: "Alerts", path: "/admin/alerts" },
  { icon: Bell, label: "Ops Center", path: "/admin/notifications" },
  { icon: Bell, label: "Email Tmpl", path: "/admin/email-templates" },
  { icon: History, label: "Sync History", path: "/admin/sync-history" },
  { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
];

export default function AdminLayout() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 ${collapsed ? "w-16" : "w-60"} bg-card border-r border-border transition-all duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex flex-col h-full">
          <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} p-4 border-b border-border h-16`}>
            {!collapsed && (
              <Link to="/admin" className="font-display text-lg font-bold">
                OUTLET<span className="text-[hsl(var(--accent))]">HUB</span>
              </Link>
            )}
            <button onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }} className="p-1 rounded hover:bg-secondary">
              <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {NAV.map((item) => {
              const { icon: Icon, label, path } = item;
              const active = item.matchPrefix ? location.pathname.startsWith(path) : location.pathname === path;
              return (
                <Link key={path} to={path} onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${active ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"} ${collapsed ? "justify-center" : ""}`}
                  title={collapsed ? label : undefined}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && label}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-border space-y-1">
            <button onClick={toggleTheme}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 w-full ${collapsed ? "justify-center" : ""}`}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {!collapsed && (theme === "dark" ? "Light Mode" : "Dark Mode")}
            </button>
            <Link to="/"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 ${collapsed ? "justify-center" : ""}`}>
              <ChevronLeft className="w-4 h-4" />
              {!collapsed && "Back to Store"}
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="h-16 border-b border-border flex items-center px-6 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-secondary">
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 font-display text-lg font-bold">
            OUTLET<span className="text-[hsl(var(--accent))]">HUB</span>
          </span>
        </div>
        <div className="p-6 lg:p-8 max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
