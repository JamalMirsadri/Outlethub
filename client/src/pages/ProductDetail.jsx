import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { appClient } from "@/api/appClient";
import { http } from "@/services/http";
import { Heart, ShoppingBag, Bell, ChevronLeft, ChevronRight, Minus, Plus, Check, Shield, Truck, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/lib/currency";
import { normalizeCatalogProduct } from "@/lib/catalogProduct";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ProductCard from "@/components/ProductCard";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholders";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function ProductDetail() {
  const { id, slug } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const { addItem } = useCart();
  const { preferredCurrency, convertAmount } = useCurrency();

  useEffect(() => {
    setLoading(true);
    const request = slug
      ? http(`/products/${slug}`).then((result) => ({
          product: normalizeCatalogProduct(result.product),
          relatedProducts: Array.isArray(result.relatedProducts)
            ? result.relatedProducts.map(normalizeCatalogProduct)
            : [],
        }))
      : appClient.entities.Product.get(id).then((legacyProduct) => ({
          product: legacyProduct,
          relatedProducts: null,
        }));

    request
      .then(async ({ product: fetchedProduct, relatedProducts }) => {
        setProduct(fetchedProduct);
        setSelectedImage(0);
        setSelectedColor("");
        setSelectedSize("");
        setIsZoomed(false);

        if (relatedProducts) {
          setRelated(relatedProducts.filter((relatedProduct) => relatedProduct.id !== fetchedProduct.id));
          return;
        }

        const fallbackRelated = await appClient.entities.Product.filter(
          { brand: fetchedProduct.brand, status: "active" },
          "-created_date",
          5,
        );
        setRelated(fallbackRelated.filter((relatedProduct) => relatedProduct.id !== fetchedProduct.id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, slug]);

  useEffect(() => {
    if (!product) {
      return;
    }

    const variantColors = Array.isArray(product.variants)
      ? [...new Set(product.variants.map((variant) => variant?.color).filter(Boolean))]
      : [];
    const fallbackColors = Array.isArray(product.colors) ? product.colors.filter(Boolean) : [];
    const colors = variantColors.length > 0 ? variantColors : fallbackColors;

    if (colors.length > 0 && !colors.includes(selectedColor)) {
      setSelectedColor(colors[0]);
      return;
    }

    if (colors.length === 0 && selectedColor) {
      setSelectedColor("");
    }
  }, [product, selectedColor]);

  useEffect(() => {
    if (!product) {
      return;
    }

    const normalizedVariants = Array.isArray(product.variants)
      ? product.variants
          .map((variant) => ({
            id: variant?.id ?? null,
            size: typeof variant?.size === "string" ? variant.size.trim() : "",
            color: typeof variant?.color === "string" ? variant.color.trim() : "",
            stockQuantity: Number(variant?.stockQuantity ?? 0),
          }))
          .filter((variant) => variant.size || variant.color)
      : [];

    const sizesForSelectedColor = normalizedVariants.length > 0
      ? [
          ...new Set(
            normalizedVariants
              .filter((variant) => {
                if (selectedColor) {
                  return variant.color === selectedColor && variant.stockQuantity > 0;
                }

                return variant.stockQuantity > 0;
              })
              .map((variant) => variant.size)
              .filter(Boolean),
          ),
        ]
      : Array.isArray(product.sizes)
        ? product.sizes.filter(Boolean)
        : [];

    if (sizesForSelectedColor.length > 0 && !sizesForSelectedColor.includes(selectedSize)) {
      setSelectedSize(sizesForSelectedColor[0]);
      return;
    }

    if (sizesForSelectedColor.length === 0 && selectedSize) {
      setSelectedSize("");
    }
  }, [product, selectedColor, selectedSize]);

  if (loading) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 max-w-[1440px] mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-12 animate-pulse">
          <div className="aspect-square bg-secondary rounded-xl" />
          <div className="space-y-4 pt-8">
            <div className="h-4 bg-secondary rounded w-24" />
            <div className="h-8 bg-secondary rounded w-64" />
            <div className="h-4 bg-secondary rounded w-full" />
            <div className="h-12 bg-secondary rounded w-40 mt-6" />
          </div>
        </div>
      </div>
    </div>
  );

  if (!product) return (
    <div className="min-h-screen flex items-center justify-center">
      <Navbar />
      <p className="text-muted-foreground">Product not found.</p>
    </div>
  );

  const originalPrice = Number(product.original_price ?? 0);
  const outletPrice = Number(product.outlet_price ?? product.supplier_price ?? product.final_price ?? 0);
  const finalPrice = Number(product.final_price ?? 0);
  const hasOutletPrice = originalPrice > 0 && outletPrice > 0 && outletPrice < originalPrice;
  const displayedProductPrice = hasOutletPrice
    ? outletPrice
    : originalPrice > 0
      ? originalPrice
      : outletPrice > 0
        ? outletPrice
        : finalPrice;
  const discount = hasOutletPrice
    ? product.discount_percent || Math.max(0, Math.round((1 - outletPrice / originalPrice) * 100))
    : 0;
  const savings = hasOutletPrice ? originalPrice - outletPrice : 0;
  const images = product.images?.length ? product.images : [PRODUCT_PLACEHOLDER_IMAGE];
  const currency = product.currency || "EUR";
  const displayCurrency = preferredCurrency || currency;
  const normalizedVariants = Array.isArray(product.variants)
    ? product.variants
        .map((variant) => ({
          id: variant?.id ?? null,
          size: typeof variant?.size === "string" ? variant.size.trim() : "",
          color: typeof variant?.color === "string" ? variant.color.trim() : "",
          stockQuantity: Number(variant?.stockQuantity ?? 0),
        }))
        .filter((variant) => variant.size || variant.color)
    : [];
  const availableColors = normalizedVariants.length > 0
    ? [...new Set(normalizedVariants.map((variant) => variant.color).filter(Boolean))]
    : Array.isArray(product.colors)
      ? product.colors.filter(Boolean)
      : [];
  const availableSizes = normalizedVariants.length > 0
    ? [
        ...new Set(
          normalizedVariants
            .filter((variant) => {
              if (selectedColor) {
                return variant.color === selectedColor && variant.stockQuantity > 0;
              }

              return variant.stockQuantity > 0;
            })
            .map((variant) => variant.size)
            .filter(Boolean),
        ),
      ]
    : Array.isArray(product.sizes)
      ? product.sizes.filter(Boolean)
      : [];
  const selectedVariant = normalizedVariants.find((variant) => {
    if (selectedColor && selectedSize) {
      return variant.color === selectedColor && variant.size === selectedSize;
    }

    if (selectedColor && !availableSizes.length) {
      return variant.color === selectedColor;
    }

    if (selectedSize) {
      return selectedColor ? variant.color === selectedColor && variant.size === selectedSize : variant.size === selectedSize;
    }

    return false;
  });
  const selectedVariantStock = normalizedVariants.length > 0
    ? selectedVariant?.stockQuantity ?? 0
    : product.stock;
  const priceHistory = product.price_history?.length
    ? product.price_history
        .slice()
        .reverse()
        .map((entry) => ({
          date: new Date(entry.captured_at).toLocaleDateString(undefined, { month: "short" }),
          price: entry.new_price ?? product.final_price,
        }))
    : [{ date: "Now", price: product.final_price }];

  const handleAddToCart = async () => {
    if (!product.id) {
      toast({
        title: "Product unavailable",
        description: "This product cannot be added right now.",
        variant: "destructive",
      });
      return;
    }

    if (availableColors.length > 0 && !selectedColor) {
      toast({
        title: "Select a color",
        description: "Choose a color before adding this product to your cart.",
        variant: "destructive",
      });
      return;
    }

    if (availableSizes.length > 0 && !selectedSize) {
      toast({
        title: "Select a size",
        description: "Choose an available size before adding this product to your cart.",
        variant: "destructive",
      });
      return;
    }

    if (availableSizes.length > 0 && selectedVariantStock <= 0) {
      toast({
        title: "Selected variant is out of stock",
        description: "Please choose another available size or color.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingToCart(true);

    try {
      await addItem({
        productId: product.id,
        variantId: selectedVariant?.id ?? null,
        quantity,
      });
      toast({
        title: "Added to cart",
        description: `${quantity} item${quantity > 1 ? "s" : ""} added to your cart.`,
      });
    } catch (error) {
      toast({
        title: "Add to cart failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const showPreviousImage = () => {
    setSelectedImage((current) => (current === 0 ? images.length - 1 : current - 1));
    setIsZoomed(false);
  };

  const showNextImage = () => {
    setSelectedImage((current) => (current === images.length - 1 ? 0 : current + 1));
    setIsZoomed(false);
  };

  const openGallery = () => {
    setIsZoomed(false);
    setGalleryOpen(true);
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="luxe-shell pt-28 pb-16">
        {/* Breadcrumb */}
        <Link to="/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Back to Shop
        </Link>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Images */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="relative mb-4 aspect-square overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-[0_18px_45px_hsl(var(--foreground)/0.06)]">
              <button
                type="button"
                onClick={openGallery}
                className="absolute inset-0 z-10 flex items-center justify-center"
                aria-label="Open product image gallery"
              >
                <img src={images[selectedImage]} alt={product.title} className="h-full w-full object-contain bg-white/5 p-2" />
              </button>
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      showPreviousImage();
                    }}
                    className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground transition hover:bg-background"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      showNextImage();
                    }}
                    className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground transition hover:bg-background"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
              <div className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                Click to zoom
              </div>
            </div>
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === i ? "border-[hsl(var(--accent))]" : "border-transparent opacity-60 hover:opacity-100"}`}>
                    <img src={img} alt="" className="w-full h-full object-contain bg-white/5" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="luxe-panel lg:sticky lg:top-28 lg:self-start p-6 lg:p-8"
          >
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase mb-2">{product.brand}</p>
            <h1 className="font-display text-2xl lg:text-4xl font-semibold mb-4">{product.title}</h1>

            {/* Pricing */}
            <div className="flex items-end gap-3 mb-2">
              <span className="font-mono text-3xl font-bold text-foreground">
                {formatCurrency(convertAmount(displayedProductPrice, currency, displayCurrency), displayCurrency)}
              </span>
              {hasOutletPrice ? (
                <>
                  <span className="font-mono text-lg text-muted-foreground line-through">
                    {formatCurrency(convertAmount(originalPrice, currency, displayCurrency), displayCurrency)}
                  </span>
                  <Badge className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-mono">-{discount}%</Badge>
                </>
              ) : null}
            </div>
            <div className="mb-6 space-y-2">
              <p className="text-sm text-muted-foreground">
                Original retail price: {formatCurrency(convertAmount(originalPrice, currency, displayCurrency), displayCurrency)}
              </p>
              {hasOutletPrice ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Outlet price: {formatCurrency(convertAmount(outletPrice, currency, displayCurrency), displayCurrency)}
                  </p>
                  <p className="text-sm text-[hsl(var(--accent))] font-medium">
                    You save {formatCurrency(convertAmount(savings, currency, displayCurrency), displayCurrency)} vs original retail price
                  </p>
                </>
              ) : null}
            </div>
            <div className="mb-6 rounded-[22px] border border-border/70 bg-background/60 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Original Retail Price</span>
                  <span>{formatCurrency(convertAmount(originalPrice, currency, displayCurrency), displayCurrency)}</span>
                </div>
                {hasOutletPrice ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Outlet Price</span>
                    <span>{formatCurrency(convertAmount(outletPrice, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              {product.description || "Premium quality from the official outlet store. Authentic product with brand tags and packaging included."}
            </p>

            {/* Size */}
            {availableSizes.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">
                  SIZE {selectedColor ? `- ${selectedColor}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map(s => (
                    <button key={s} onClick={() => setSelectedSize(s)}
                      className={`px-4 py-2 text-sm rounded-lg border transition-all ${selectedSize === s ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-black font-semibold" : "border-border hover:border-foreground"}`}>
                      {s}
                    </button>
                  ))}
                </div>
                {normalizedVariants.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Showing only sizes available for the selected color.
                  </p>
                ) : null}
              </div>
            )}

            {/* Color */}
            {availableColors.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">COLOR — {selectedColor || "Select"}</p>
                <div className="flex gap-2">
                  {availableColors.map(c => (
                    <button key={c} onClick={() => setSelectedColor(c)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c === "White" ? "#fff" : c === "Black" ? "#000" : c === "Navy" ? "#1a237e" : c.toLowerCase() }}>
                      {selectedColor === c && <Check className="w-4 h-4 text-white mix-blend-difference" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-8">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">QUANTITY</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-mono text-lg w-8 text-center">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-8">
              <Button
                className="flex-1 h-14 rounded-full text-sm font-semibold tracking-wide"
                size="lg"
                onClick={handleAddToCart}
                disabled={isAddingToCart || (availableSizes.length > 0 ? selectedVariantStock <= 0 : product.stock <= 0)}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                {isAddingToCart ? "ADDING..." : "ADD TO BAG"}
              </Button>
              <Button variant="outline" size="icon" className="h-14 w-14 rounded-full" onClick={() => setLiked(!liked)}>
                <Heart className={`w-5 h-5 ${liked ? "fill-red-500 text-red-500" : ""}`} />
              </Button>
              <Button variant="outline" size="icon" className="h-14 w-14 rounded-full">
                <Bell className="w-5 h-5" />
              </Button>
            </div>

            {/* Availability */}
            <div className="mb-6 rounded-[22px] border border-border/70 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${(availableSizes.length > 0 ? selectedVariantStock : product.stock) > 0 ? "bg-[hsl(var(--accent))]" : "bg-destructive"}`} />
                {(availableSizes.length > 0 ? selectedVariantStock : product.stock) > 0 ? (
                  <span>
                    {availableSizes.length > 0 && selectedSize
                      ? `${selectedVariantStock} in stock for ${selectedColor} / ${selectedSize}`
                      : `${product.stock} in stock`}
                  </span>
                ) : (
                  <span className="text-destructive">
                    {availableSizes.length > 0 ? "Selected size is out of stock" : "Out of stock"}
                  </span>
                )}
              </div>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Shield, label: "Authentic" },
                { icon: Truck, label: "Free Shipping" },
                { icon: RotateCcw, label: "30-Day Returns" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-[18px] border border-border/70 bg-background/60 p-3 text-center">
                  <Icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Price History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20"
        >
          <h2 className="font-display text-2xl font-bold mb-6">Price History</h2>
          <div className="luxe-panel p-6">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={priceHistory}>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(convertAmount(Number(value), currency, displayCurrency), displayCurrency)}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(convertAmount(Number(value), currency, displayCurrency), displayCurrency), "Price"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="price" stroke="hsl(150, 100%, 50%)" strokeWidth={2} dot={{ fill: "hsl(150, 100%, 50%)", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Related */}
        {related.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20"
          >
            <h2 className="font-display text-2xl font-bold mb-6">More from {product.brand}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
              {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          </motion.div>
        )}
      </div>
      <Dialog
        open={galleryOpen}
        onOpenChange={(open) => {
          setGalleryOpen(open);
          if (!open) {
            setIsZoomed(false);
          }
        }}
      >
        <DialogContent className="max-w-[96vw] w-[96vw] border-border bg-background/95 p-3 sm:p-4">
          <div className="relative">
            <div className="mb-3 flex items-center justify-between gap-3 pr-10">
              <p className="text-sm text-muted-foreground">
                Image {selectedImage + 1} of {images.length}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsZoomed((current) => !current)}
                className="rounded-full"
              >
                {isZoomed ? <ZoomOut className="mr-2 h-4 w-4" /> : <ZoomIn className="mr-2 h-4 w-4" />}
                {isZoomed ? "Zoom Out" : "Zoom In"}
              </Button>
            </div>
            <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden rounded-xl bg-black/40">
              <img
                src={images[selectedImage]}
                alt={product.title}
                onClick={() => setIsZoomed((current) => !current)}
                className={`max-h-[70vh] w-full object-contain transition duration-300 ${isZoomed ? "scale-150 cursor-zoom-out" : "scale-100 cursor-zoom-in"}`}
              />
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={showPreviousImage}
                    className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground transition hover:bg-background"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={showNextImage}
                    className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground transition hover:bg-background"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>
            {images.length > 1 ? (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {images.map((img, index) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => {
                      setSelectedImage(index);
                      setIsZoomed(false);
                    }}
                    className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${selectedImage === index ? "border-[hsl(var(--accent))]" : "border-transparent opacity-60 hover:opacity-100"}`}
                  >
                    <img src={img} alt="" className="h-full w-full object-contain bg-white/5" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}
