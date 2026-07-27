import { Link } from "react-router-dom";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency, shouldShowTomanAmounts } from "@/lib/currency";

const COUNTRY_OPTIONS = [
  { code: "PT", label: "Portugal" },
  { code: "ES", label: "Spain" },
  { code: "IR", label: "Iran" },
];

export default function Cart() {
  const { cart, cartReady, isLoadingCart, isMutatingCart, updateItemQuantity, removeItem, clearItems, changeCountry } =
    useCart();
  const { preferredCurrency, supportedCurrencies, setPreferredCurrency, convertAmount } = useCurrency();

  const handleQuantityChange = async (itemId: string, quantity: number) => {
    try {
      await updateItemQuantity(itemId, quantity);
    } catch (error: unknown) {
      toast({
        title: "Cart update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItem(itemId);
      toast({
        title: "Item removed",
        description: "The product was removed from your cart.",
      });
    } catch (error: unknown) {
      toast({
        title: "Remove failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClearCart = async () => {
    try {
      await clearItems();
      toast({
        title: "Cart cleared",
        description: "Your cart is now empty.",
      });
    } catch (error: unknown) {
      toast({
        title: "Clear cart failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCountryChange = async (countryCode: string) => {
    try {
      await changeCountry({ countryCode });
    } catch (error: unknown) {
      toast({
        title: "Shipping zone update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const currency = cart.currency || "EUR";
  const showTomanAmounts = shouldShowTomanAmounts({ countryCode: cart.countryCode });
  const displayCurrency = showTomanAmounts ? "TOMAN" : preferredCurrency || currency;
  const productPriceBeforeMarginAndVat = cart.items.reduce(
    (sum, item) => sum + item.supplierCost * item.quantity,
    0,
  );
  const websiteMarginAmount = cart.items.reduce(
    (sum, item) => sum + item.profitAmount * item.quantity,
    0,
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 max-w-[1440px] mx-auto px-6 lg:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-10">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase mb-2">Cart</p>
            <h1 className="font-display text-3xl lg:text-5xl font-bold">Your bag</h1>
            <p className="text-sm text-muted-foreground mt-3">
              Verified against the persisted backend cart with shipping and VAT totals.
            </p>
          </div>
          <div className="w-full md:w-56">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">Shipping zone</p>
            <Select value={cart.countryCode} onValueChange={handleCountryChange} disabled={isLoadingCart || isMutatingCart}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-56">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">Display currency</p>
            <Select value={displayCurrency} onValueChange={(value) => void setPreferredCurrency(value)} disabled={showTomanAmounts}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {supportedCurrencies.map((entry) => (
                  <SelectItem key={entry.code} value={entry.code}>
                    {entry.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!cartReady || isLoadingCart ? (
          <div className="grid gap-6 lg:grid-cols-[1.5fr,0.9fr]">
            <Card className="border-border/60">
              <CardContent className="p-6 space-y-4">
                <div className="h-24 rounded-xl bg-secondary animate-pulse" />
                <div className="h-24 rounded-xl bg-secondary animate-pulse" />
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-6 space-y-4">
                <div className="h-6 rounded bg-secondary animate-pulse" />
                <div className="h-6 rounded bg-secondary animate-pulse" />
                <div className="h-10 rounded bg-secondary animate-pulse" />
              </CardContent>
            </Card>
          </div>
        ) : cart.items.length === 0 ? (
          <Card className="border-border/60 bg-card/70">
            <CardContent className="p-12 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h2 className="font-display text-2xl font-bold mb-3">Your cart is empty</h2>
              <p className="text-sm text-muted-foreground mb-8">
                Add a product to verify persistence, guest cart behavior, and the live navbar badge.
              </p>
              <Button asChild size="lg" className="rounded-full px-8">
                <Link to="/shop">Continue shopping</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.5fr,0.9fr]">
            <Card className="border-border/60 bg-card/70">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xl">Cart items</CardTitle>
                <Button variant="ghost" onClick={handleClearCart} disabled={isMutatingCart}>
                  Clear cart
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {cart.items.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <Link
                        to={item.product.slug ? `/products/${item.product.slug}` : `/product/${item.product.id}`}
                        className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-secondary"
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            No image
                          </div>
                        )}
                      </Link>
                      <div className="flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase mb-2">
                              {item.brand || item.product.brand}
                            </p>
                            <Link
                              to={item.product.slug ? `/products/${item.product.slug}` : `/product/${item.product.id}`}
                              className="font-semibold text-lg hover:text-[hsl(var(--accent))] transition-colors"
                            >
                              {item.title}
                            </Link>
                            <p className="text-sm text-muted-foreground mt-2">
                              Supplier cost {formatCurrency(item.supplierCost, currency)}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
                                Size: {item.size || "Not selected"}
                              </span>
                              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
                                Color: {item.color || "Not selected"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Final {formatCurrency(convertAmount(item.customerPaid, currency, displayCurrency), displayCurrency)}
                            </p>
                            {showTomanAmounts ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                EUR {formatCurrency(item.customerPaid, currency)}
                              </p>
                            ) : null}
                            {item.sourceUrl ? (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                View source product
                              </a>
                            ) : null}
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-semibold text-lg">{formatCurrency(item.customerPaid, currency)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Profit {formatCurrency(item.profitAmount, currency)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                          <div className="inline-flex items-center rounded-full border border-border">
                            <button
                              className="h-10 w-10 inline-flex items-center justify-center"
                              onClick={() => handleQuantityChange(item.id, Math.max(1, item.quantity - 1))}
                              disabled={isMutatingCart}
                              aria-label={`Decrease quantity for ${item.title}`}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-10 text-center font-mono text-sm">{item.quantity}</span>
                            <button
                              className="h-10 w-10 inline-flex items-center justify-center"
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              disabled={isMutatingCart}
                              aria-label={`Increase quantity for ${item.title}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <Button
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={isMutatingCart}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                    {index < cart.items.length - 1 ? <Separator className="mt-6" /> : null}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/70 h-fit lg:sticky lg:top-28">
              <CardHeader>
                <CardTitle className="text-xl">Order summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Items ({cart.itemCount})</span>
                  <span>{formatCurrency(cart.subtotalAmount, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Product price before margin and VAT</span>
                  <span>{formatCurrency(productPriceBeforeMarginAndVat, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Items ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(cart.subtotalAmount, currency, displayCurrency), displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Product price before margin and VAT ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(productPriceBeforeMarginAndVat, currency, displayCurrency), displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Website margin</span>
                  <span>{formatCurrency(websiteMarginAmount, currency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Website margin ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(websiteMarginAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatCurrency(cart.shippingAmount, currency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Shipping ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(cart.shippingAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Handling</span>
                  <span>{formatCurrency(cart.handlingAmount, currency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Handling ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(cart.handlingAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Payment fee</span>
                  <span>{formatCurrency(cart.paymentFeeAmount, currency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Payment fee ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(cart.paymentFeeAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">VAT</span>
                  <span>{formatCurrency(cart.taxAmount, currency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>VAT ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(cart.taxAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold text-xl">{formatCurrency(cart.totalAmount, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(cart.totalAmount, currency, displayCurrency), displayCurrency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Exchange Rate</span>
                    <span>1 {currency} {"->"} {convertAmount(1, currency, displayCurrency)} {displayCurrency}</span>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Currency conversion and payment selection continue in checkout.
                </p>
                <Button asChild className="w-full rounded-full h-12">
                  <Link to="/checkout">
                    Proceed to checkout
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-full h-12">
                  <Link to="/shop">Continue shopping</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
