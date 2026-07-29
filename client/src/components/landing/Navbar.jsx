import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, ShoppingBag, Heart, User, Sun, Moon, Menu, X } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useCart } from "@/contexts/CartContext";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { http } from "@/services/http";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { itemCount } = useCart();
  const { settings } = useSiteContent();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    http("/products/meta/filters")
      .then((response) => {
        setCategories(Array.isArray(response.categories) ? response.categories : []);
      })
      .catch(() => {});
  }, []);

  const menuCategories = (() => {
    const rootCategories = categories.filter((category) => !category.parentId);
    const source = rootCategories.length > 0 ? rootCategories : categories;
    return source.slice(0, 5);
  })();

  const mobileMenuItems = [
    { label: settings.header.shopLabel.toUpperCase(), to: "/shop" },
    ...menuCategories.map((category) => ({
      label: category.name.toUpperCase(),
      to: `/shop?category=${encodeURIComponent(category.slug)}`,
    })),
    { label: settings.header.cartLabel.toUpperCase(), to: "/cart" },
    { label: settings.header.accountLabel.toUpperCase(), to: "/dashboard" },
    { label: settings.header.wishlistLabel.toUpperCase(), to: "/dashboard/wishlist" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "glass border-b border-border/60" : "bg-background/95 border-b border-border/40"
        }`}
      >
        {settings.announcementBar.enabled ? (
        <div className="border-b border-border/50 bg-[hsl(var(--secondary))/0.45]">
          <div className="luxe-shell hidden lg:flex h-10 items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <div className="flex items-center gap-5">
              <span>{settings.announcementBar.leftText}</span>
              <span className="h-3.5 w-px bg-border" />
              <span>{settings.announcementBar.rightText}</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/login" className="luxe-link">
                {settings.announcementBar.signInLabel}
              </Link>
              <Link to="/dashboard/wishlist" className="luxe-link">
                {settings.announcementBar.wishlistLabel}
              </Link>
            </div>
          </div>
        </div>
        ) : null}

        <div className="luxe-shell">
          <div className="flex h-20 items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3">
              <span className="flex flex-col">
                <span className="font-display text-[30px] font-semibold leading-none tracking-[-0.05em] text-[hsl(var(--accent))]">
                  {settings.header.logoTop}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.34em] text-muted-foreground">
                  {settings.header.logoBottom}
                </span>
              </span>
            </Link>

            <div className="hidden flex-1 items-center justify-center gap-8 lg:flex">
              <Link to="/shop" className="text-[12px] font-semibold tracking-[0.2em] text-foreground/80 hover:text-[hsl(var(--accent))] transition-colors">
                {settings.header.shopLabel.toUpperCase()}
              </Link>
              {menuCategories.map((category) => (
                <Link
                  key={category.id}
                  to={`/shop?category=${encodeURIComponent(category.slug)}`}
                  className="text-[12px] font-semibold tracking-[0.2em] text-foreground/80 hover:text-[hsl(var(--accent))] transition-colors"
                >
                  {category.name.toUpperCase()}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              <Link
                to="/shop"
                className="hidden h-11 w-[260px] items-center gap-3 rounded-full border border-border bg-card/75 px-4 text-sm text-muted-foreground shadow-sm transition hover:border-[hsl(var(--accent))/0.45] lg:flex"
              >
                <Search className="h-4 w-4" />
                <span>{settings.header.searchPlaceholder}</span>
              </Link>
              <button onClick={toggleTheme} className="rounded-full border border-border bg-card/80 p-2.5 hover:border-[hsl(var(--accent))/0.55]">
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Link to="/dashboard/wishlist" className="hidden rounded-full border border-border bg-card/80 p-2.5 hover:border-[hsl(var(--accent))/0.55] sm:flex">
                <Heart className="w-5 h-5" />
              </Link>
              <Link to="/dashboard" className="hidden rounded-full border border-border bg-card/80 p-2.5 hover:border-[hsl(var(--accent))/0.55] sm:flex">
                <User className="w-5 h-5" />
              </Link>
              <Link to="/cart" className="relative rounded-full border border-border bg-card/80 p-2.5 hover:border-[hsl(var(--accent))/0.55]">
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[10px] font-semibold flex items-center justify-center">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                ) : null}
              </Link>
              <button onClick={() => setMobileOpen(true)} className="rounded-full border border-border bg-card/80 p-2.5 lg:hidden">
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
              <div className="mb-10 flex items-center justify-between">
                <span className="flex flex-col">
                  <span className="font-display text-3xl font-semibold tracking-[-0.05em] text-[hsl(var(--accent))]">
                    {settings.header.logoTop}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.34em] text-muted-foreground">
                    {settings.header.logoBottom}
                  </span>
                </span>
                <button onClick={() => setMobileOpen(false)} className="rounded-full border border-border p-2.5">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <Link
                to="/shop"
                onClick={() => setMobileOpen(false)}
                className="mb-8 flex h-12 items-center gap-3 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground"
              >
                <Search className="h-4 w-4" />
                <span>{settings.header.searchPlaceholder}</span>
              </Link>
              <div className="flex flex-col gap-6">
                {mobileMenuItems.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className="text-3xl font-display font-semibold hover:text-[hsl(var(--accent))] transition-colors"
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
