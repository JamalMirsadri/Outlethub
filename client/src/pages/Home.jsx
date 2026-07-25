import React, { useEffect, useMemo, useState } from "react";
import { appClient } from "@/api/appClient";
import { http } from "@/services/http";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import BrandShowcase from "@/components/landing/BrandShowcase";
import HomeProductSpotlights from "@/components/landing/HomeProductSpotlights";
import TrendingDeals from "@/components/landing/TrendingDeals";
import HowItWorks from "@/components/landing/HowItWorks";
import ReviewsSection from "@/components/landing/ReviewsSection";
import FAQSection from "@/components/landing/FAQSection";
import Footer from "@/components/landing/Footer";
import { normalizeCatalogProduct } from "@/lib/catalogProduct";
import { HERO_PLACEHOLDER_IMAGE } from "@/lib/placeholders";

const HERO_IMAGE = HERO_PLACEHOLDER_IMAGE;

export default function Home() {
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [mostViewedProducts, setMostViewedProducts] = useState([]);
  const [mostSoldProducts, setMostSoldProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      appClient.entities.Product.filter({ status: "active", is_trending: true }, "-created_date", 8),
      http("/products?page=1&pageSize=24&sort=newest"),
      http("/products?page=1&pageSize=4&sort=views"),
      http("/products?page=1&pageSize=4&sort=purchases"),
    ])
      .then(([trendingItems, latestProductsResponse, viewedProductsResponse, soldProductsResponse]) => {
        const latestProducts = Array.isArray(latestProductsResponse.items)
          ? latestProductsResponse.items.map(normalizeCatalogProduct).filter(Boolean)
          : [];
        const viewedProducts = Array.isArray(viewedProductsResponse.items)
          ? viewedProductsResponse.items.map(normalizeCatalogProduct).filter((product) => (product?.views ?? 0) > 0)
          : [];
        const soldProducts = Array.isArray(soldProductsResponse.items)
          ? soldProductsResponse.items.map(normalizeCatalogProduct).filter((product) => (product?.purchases ?? 0) > 0)
          : [];

        setTrendingProducts(trendingItems);
        setCatalogProducts(latestProducts);
        setMostViewedProducts(viewedProducts);
        setMostSoldProducts(soldProducts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const newestProducts = useMemo(
    () =>
      [...catalogProducts].sort(
        (left, right) =>
          new Date(right.created_date ?? 0).getTime() - new Date(left.created_date ?? 0).getTime(),
      ),
    [catalogProducts],
  );

  const featuredRandomNewProduct = useMemo(() => {
    if (newestProducts.length === 0) {
      return null;
    }

    const candidatePool = newestProducts.slice(0, Math.min(newestProducts.length, 8));
    return candidatePool[Math.floor(Math.random() * candidatePool.length)] ?? candidatePool[0];
  }, [newestProducts]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection heroImage={HERO_IMAGE} />
      <BrandShowcase />
      <HomeProductSpotlights
        loading={loading}
        featuredProduct={featuredRandomNewProduct}
        mostViewedProducts={mostViewedProducts}
        mostSoldProducts={mostSoldProducts}
      />
      <TrendingDeals products={trendingProducts} />
      <HowItWorks />
      <ReviewsSection />
      <FAQSection />
      <Footer />
    </div>
  );
}

