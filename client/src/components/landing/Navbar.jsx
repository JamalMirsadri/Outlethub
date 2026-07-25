import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, ShoppingBag, Heart, User, Sun, Moon, Menu, X } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useCart } from "@/contexts/CartContext";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { itemCount } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "glass border-b border-border/50 shadow-lg" : "bg-transparent"
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-display text-xl lg:text-2xl font-bold tracking-tight">
                OUTLET<span className="text-[hsl(var(--accent))]">HUB</span>
              </span>
            </Link>

            <div className="hidden lg:flex items-center gap-8">
              <Link to="/shop" className="text-sm font-medium tracking-wide hover:text-[hsl(var(--accent))] transition-colors">
                SHOP
              </Link>
              <Link to="/shop?gender=women" className="text-sm font-medium tracking-wide hover:text-[hsl(var(--accent))] transition-colors">
                WOMEN
              </Link>
              <Link to="/shop?gender=men" className="text-sm font-medium tracking-wide hover:text-[hsl(var(--accent))] transition-colors">
                MEN
              </Link>
              <Link to="/shop?is_trending=true" className="text-sm font-medium tracking-wide hover:text-[hsl(var(--accent))] transition-colors">
                TRENDING
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/shop" className="p-2 rounded-full hover:bg-secondary transition-colors">
                <Search className="w-5 h-5" />
              </Link>
              <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-secondary transition-colors">
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Link to="/dashboard/wishlist" className="p-2 rounded-full hover:bg-secondary transition-colors hidden sm:flex">
                <Heart className="w-5 h-5" />
              </Link>
              <Link to="/dashboard" className="p-2 rounded-full hover:bg-secondary transition-colors hidden sm:flex">
                <User className="w-5 h-5" />
              </Link>
              <Link to="/cart" className="p-2 rounded-full hover:bg-secondary transition-colors relative">
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-[hsl(var(--accent))] text-black text-[10px] font-semibold flex items-center justify-center">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                ) : null}
              </Link>
              <button onClick={() => setMobileOpen(true)} className="p-2 rounded-full hover:bg-secondary transition-colors lg:hidden">
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-12">
                <span className="font-display text-xl font-bold">
                  OUTLET<span className="text-[hsl(var(--accent))]">HUB</span>
                </span>
                <button onClick={() => setMobileOpen(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex flex-col gap-6">
                {[
                  { label: "SHOP ALL", to: "/shop" },
                  { label: "WOMEN", to: "/shop?gender=women" },
                  { label: "MEN", to: "/shop?gender=men" },
                  { label: "TRENDING", to: "/shop?is_trending=true" },
                  { label: "CART", to: "/cart" },
                  { label: "MY ACCOUNT", to: "/dashboard" },
                  { label: "WISHLIST", to: "/dashboard/wishlist" },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className="text-3xl font-display font-bold hover:text-[hsl(var(--accent))] transition-colors"
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
