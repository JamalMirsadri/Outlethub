import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border/70 bg-card/85">
      <div className="luxe-shell py-16 lg:py-20">
        <div className="mb-10 rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary))/0.75)] p-8 shadow-[0_18px_55px_hsl(var(--foreground)/0.05)] lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="luxe-eyebrow mb-3">Join The OutletHub Club</p>
              <h3 className="luxe-heading text-3xl">New arrivals, private offers, and curated outlet drops.</h3>
            </div>
            <div className="flex w-full max-w-md items-center gap-3 rounded-full border border-border bg-background/75 p-2">
              <input
                type="email"
                placeholder="Enter your email address"
                className="h-11 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button className="rounded-full bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4 mb-12">
          <div>
            <span className="mb-4 flex flex-col">
              <span className="font-display text-[34px] font-semibold leading-none tracking-[-0.05em] text-[hsl(var(--accent))]">
                OUTLET
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.34em] text-muted-foreground">
                Luxe Hub
              </span>
            </span>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Premium brands, curated outlet prices, and a refined shopping journey from discovery to delivery.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-semibold tracking-[0.22em] text-muted-foreground">SHOP</h4>
            <div className="flex flex-col gap-2.5">
              <Link to="/shop?gender=women" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Women</Link>
              <Link to="/shop?gender=men" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Men</Link>
              <Link to="/shop?is_trending=true" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Trending</Link>
              <Link to="/shop" className="text-sm text-muted-foreground transition-colors hover:text-foreground">All Products</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-semibold tracking-[0.22em] text-muted-foreground">CUSTOMER CARE</h4>
            <div className="flex flex-col gap-2.5">
              <Link to="/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Contact Us</Link>
              <Link to="/shipping" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Shipping Info</Link>
              <Link to="/returns" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Returns & Exchanges</Link>
              <Link to="/faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground">FAQ</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-semibold tracking-[0.22em] text-muted-foreground">ABOUT</h4>
            <div className="flex flex-col gap-2.5">
              <Link to="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">About</Link>
              <Link to="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Terms of Service</Link>
              <Link to="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-foreground">My Account</Link>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">© 2026 OutletHub. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Instagram</a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Twitter</a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Facebook</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
