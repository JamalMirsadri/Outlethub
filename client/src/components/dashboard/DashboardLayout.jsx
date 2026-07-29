import React, { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Package, Heart, Bell, User, MapPin, CreditCard, ChevronLeft, Menu, X, Gift } from "lucide-react";
import Navbar from "@/components/landing/Navbar";

const NAV_ITEMS = [
  { icon: Package, label: "Orders", path: "/dashboard" },
  { icon: Bell, label: "Notifications", path: "/notifications" },
  { icon: Heart, label: "Wishlist", path: "/dashboard/wishlist" },
  { icon: Bell, label: "Price Alerts", path: "/dashboard/alerts" },
  { icon: Gift, label: "My Rewards", path: "/dashboard/rewards" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
  { icon: MapPin, label: "Addresses", path: "/dashboard/addresses" },
  { icon: CreditCard, label: "Payments", path: "/dashboard/payments" },
];

export default function DashboardLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="luxe-shell pt-28 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 mb-2">
              <ChevronLeft className="w-3 h-3" /> Home
            </Link>
            <h1 className="font-display text-3xl font-semibold lg:text-4xl">My Account</h1>
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-lg hover:bg-secondary">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex gap-8">
          <aside className={`${sidebarOpen ? 'block' : 'hidden'} lg:block w-full lg:w-56 flex-shrink-0`}>
            <nav className="luxe-panel space-y-1 p-3">
              {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
                const active = location.pathname === path;
                return (
                  <Link key={path} to={path} onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm transition-all ${active ? "bg-[hsl(var(--accent))/0.14] font-medium text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className={`flex-1 min-w-0 ${sidebarOpen ? 'hidden lg:block' : ''}`}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
