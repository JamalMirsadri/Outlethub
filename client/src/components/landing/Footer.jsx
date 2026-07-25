import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div>
            <span className="font-display text-xl font-bold mb-4 block">
              OUTLET<span className="text-[hsl(var(--accent))]">HUB</span>
            </span>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Discover luxury brands at outlet prices. We source authentic products from official outlets and deliver them directly to you.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm tracking-wide mb-4">SHOP</h4>
            <div className="flex flex-col gap-2.5">
              <Link to="/shop?gender=women" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Women</Link>
              <Link to="/shop?gender=men" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Men</Link>
              <Link to="/shop?is_trending=true" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Trending</Link>
              <Link to="/shop" className="text-sm text-muted-foreground hover:text-foreground transition-colors">All Products</Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-sm tracking-wide mb-4">SUPPORT</h4>
            <div className="flex flex-col gap-2.5">
              <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact Us</Link>
              <Link to="/shipping" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Shipping Info</Link>
              <Link to="/returns" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Returns & Exchanges</Link>
              <Link to="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-sm tracking-wide mb-4">COMPANY</h4>
            <div className="flex flex-col gap-2.5">
              <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">© 2026 OutletHub. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Instagram</a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Twitter</a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Facebook</a>
          </div>
        </div>
      </div>
    </footer>
  );
}