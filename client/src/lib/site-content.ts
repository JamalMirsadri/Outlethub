export type TrustBadgeIcon = "truck" | "shield" | "return" | "support";

export interface HeroStatContent {
  id: string;
  label: string;
  value: number;
  suffix: string;
}

export interface FooterLinkContent {
  id: string;
  label: string;
  href: string;
}

export interface HeroSlideContent {
  id: string;
  eyebrow: string;
  titleTop: string;
  titleAccent: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  imageUrl: string;
  overlayFrom: string;
  overlayVia: string;
  overlayTo: string;
  cardEyebrow: string;
  cardTitle: string;
  cardDescription: string;
}

export interface TrustBadgeContent {
  id: string;
  icon: TrustBadgeIcon;
  title: string;
  description: string;
}

export interface SiteContentSettings {
  siteName: string;
  siteTagline: string;
  announcementBar: {
    enabled: boolean;
    leftText: string;
    rightText: string;
    signInLabel: string;
    wishlistLabel: string;
  };
  header: {
    logoTop: string;
    logoBottom: string;
    shopLabel: string;
    searchPlaceholder: string;
    accountLabel: string;
    cartLabel: string;
    wishlistLabel: string;
  };
  seo: {
    defaultTitle: string;
    titleSuffix: string;
    description: string;
    keywords: string;
    ogImageUrl: string;
    canonicalBaseUrl: string;
    robots: string;
  };
  heroSlides: HeroSlideContent[];
  heroStats: HeroStatContent[];
  brandMarquee: string[];
  homeSections: {
    newArrivalsTitle: string;
    newArrivalsCtaLabel: string;
    newArrivalsCtaHref: string;
    categoriesTitle: string;
    promoTitle: string;
    promoButtonLabel: string;
    promoButtonHref: string;
    bestSellersTitle: string;
    bestSellersCtaLabel: string;
    bestSellersCtaHref: string;
    trustBadgesTitle: string;
  };
  trustBadges: TrustBadgeContent[];
  footer: {
    newsletterEyebrow: string;
    newsletterTitle: string;
    newsletterPlaceholder: string;
    newsletterButtonLabel: string;
    description: string;
    shopTitle: string;
    supportTitle: string;
    aboutTitle: string;
    copyright: string;
    instagramUrl: string;
    twitterUrl: string;
    facebookUrl: string;
    shopLinks: FooterLinkContent[];
    supportLinks: FooterLinkContent[];
    aboutLinks: FooterLinkContent[];
  };
}

export const DEFAULT_SITE_CONTENT_SETTINGS: SiteContentSettings = {
  siteName: "OutletHub",
  siteTagline: "Luxe Hub",
  announcementBar: {
    enabled: true,
    leftText: "Premium brands, outlet prices",
    rightText: "Free shipping on qualifying orders",
    signInLabel: "Sign in / Register",
    wishlistLabel: "Wishlist",
  },
  header: {
    logoTop: "OUTLET",
    logoBottom: "Luxe Hub",
    shopLabel: "Shop",
    searchPlaceholder: "Search for products, brands...",
    accountLabel: "My Account",
    cartLabel: "Cart",
    wishlistLabel: "Wishlist",
  },
  seo: {
    defaultTitle: "OutletHub | Luxury Outlet Fashion",
    titleSuffix: "OutletHub",
    description: "Shop premium fashion brands at outlet prices with a refined luxury storefront experience.",
    keywords: "outlet fashion,luxury brands,designer outlet,premium clothing,OutletHub",
    ogImageUrl: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1400&q=80",
    canonicalBaseUrl: "",
    robots: "index,follow",
  },
  heroSlides: [
    {
      id: "slide-1",
      eyebrow: "Fall Essentials",
      titleTop: "Update Your Wardrobe.",
      titleAccent: "Shop the New Collection",
      description: "A polished storefront experience with premium fashion, refined layouts, and elevated visual storytelling.",
      primaryLabel: "Shop Men",
      primaryHref: "/shop?gender=men",
      secondaryLabel: "Shop Women",
      secondaryHref: "/shop?gender=women",
      imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1600&q=80",
      overlayFrom: "rgba(14,18,26,0.72)",
      overlayVia: "rgba(14,18,26,0.35)",
      overlayTo: "rgba(14,18,26,0.10)",
      cardEyebrow: "Season Spotlight",
      cardTitle: "A refined edit for modern wardrobes.",
      cardDescription: "Tailored silhouettes, premium textures, and elevated essentials for a boutique-style first impression.",
    },
    {
      id: "slide-2",
      eyebrow: "New Arrival Edit",
      titleTop: "Luxury Layers.",
      titleAccent: "Refined Daily Style",
      description: "Present your products with cleaner composition, softer body tones, and premium campaign-style hero content.",
      primaryLabel: "New Arrivals",
      primaryHref: "/shop?sort=newest",
      secondaryLabel: "Shop All",
      secondaryHref: "/shop",
      imageUrl: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1600&q=80",
      overlayFrom: "rgba(18,22,32,0.65)",
      overlayVia: "rgba(18,22,32,0.28)",
      overlayTo: "rgba(18,22,32,0.08)",
      cardEyebrow: "Storefront Styling",
      cardTitle: "Every hero slide is editable from admin.",
      cardDescription: "Update slide images, CTA labels, overlay mood, and all supporting text without touching code.",
    },
  ],
  heroStats: [
    { id: "stat-1", label: "Brands", value: 200, suffix: "+" },
    { id: "stat-2", label: "Products", value: 15000, suffix: "+" },
    { id: "stat-3", label: "Avg. Savings", value: 45, suffix: "%" },
  ],
  brandMarquee: [
    "NIKE",
    "ADIDAS",
    "TOMMY HILFIGER",
    "CALVIN KLEIN",
    "GUESS",
    "HUGO BOSS",
    "MICHAEL KORS",
    "COACH",
  ],
  homeSections: {
    newArrivalsTitle: "New Arrivals",
    newArrivalsCtaLabel: "View all",
    newArrivalsCtaHref: "/shop?sort=newest",
    categoriesTitle: "Shop By Category",
    promoTitle: "Mid-Season Edit | Refined Outlet Picks",
    promoButtonLabel: "Shop Sale",
    promoButtonHref: "/shop?is_trending=true",
    bestSellersTitle: "Best Sellers",
    bestSellersCtaLabel: "View all",
    bestSellersCtaHref: "/shop",
    trustBadgesTitle: "Trust Badges",
  },
  trustBadges: [
    { id: "badge-1", icon: "truck", title: "Free Shipping", description: "On qualifying orders" },
    { id: "badge-2", icon: "shield", title: "Secure Payment", description: "Protected checkout" },
    { id: "badge-3", icon: "return", title: "30-Day Returns", description: "Easy returns support" },
    { id: "badge-4", icon: "support", title: "24/7 Support", description: "We are here to help" },
  ],
  footer: {
    newsletterEyebrow: "Join The OutletHub Club",
    newsletterTitle: "New arrivals, private offers, and curated outlet drops.",
    newsletterPlaceholder: "Enter your email address",
    newsletterButtonLabel: "Subscribe",
    description: "Premium brands, curated outlet prices, and a refined shopping journey from discovery to delivery.",
    shopTitle: "SHOP",
    supportTitle: "CUSTOMER CARE",
    aboutTitle: "ABOUT",
    copyright: "© 2026 OutletHub. All rights reserved.",
    instagramUrl: "https://instagram.com",
    twitterUrl: "https://twitter.com",
    facebookUrl: "https://facebook.com",
    shopLinks: [
      { id: "shop-link-1", label: "Women", href: "/shop?gender=women" },
      { id: "shop-link-2", label: "Men", href: "/shop?gender=men" },
      { id: "shop-link-3", label: "Trending", href: "/shop?is_trending=true" },
      { id: "shop-link-4", label: "All Products", href: "/shop" },
    ],
    supportLinks: [
      { id: "support-link-1", label: "Contact Us", href: "/contact" },
      { id: "support-link-2", label: "Shipping Info", href: "/shipping" },
      { id: "support-link-3", label: "Returns & Exchanges", href: "/returns" },
      { id: "support-link-4", label: "FAQ", href: "/faq" },
    ],
    aboutLinks: [
      { id: "about-link-1", label: "About", href: "/about" },
      { id: "about-link-2", label: "Privacy Policy", href: "/privacy" },
      { id: "about-link-3", label: "Terms of Service", href: "/terms" },
      { id: "about-link-4", label: "My Account", href: "/dashboard" },
    ],
  },
};

export function cloneSiteContentSettings(settings: SiteContentSettings): SiteContentSettings {
  return JSON.parse(JSON.stringify(settings)) as SiteContentSettings;
}
