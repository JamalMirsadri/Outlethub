import { useTranslation } from "react-i18next";
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

export default function Cart() {
  const { t } = useTranslation();
  const { cart, cartReady, isLoadingCart, isMutatingCart, updateItemQuantity, removeItem, clearItems, changeCountry } =
    useCart();
  const { preferredCurrency, supportedCurrencies, setPreferredCurrency, convertAmount } = useCurrency();

  const COUNTRY_OPTIONS = [
    { code: "PT", label: t("countries.portugal") },
    { code: "ES", label: t("countries.spain") },
    { code: "IR", label: t("countries.iran") },
  ];

  const handleQuantityChange = async (itemId: string, quantity: number) => {
    try {
      await updateItemQuantity(itemId, quantity);
    } catch (error: unknown) {
      toast({
        title: t("cart.cartUpdateFailed"),
        description: error instanceof Error ? error.message : t("cart.pleaseTryAgain"),
        variant: "destructive",
      });
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItem(itemId);
      toast({
        title: t("cart.itemRemoved"),
        description: t("cart.itemRemovedDesc"),
      });
    } catch (error: unknown) {
      toast({
        title: t("cart.removeFailed"),
        description: error instanceof Error ? error.message : t("cart.pleaseTryAgain"),
        variant: "destructive",
      });
    }
  };

  const handleClearCart = async () => {
    try {
      await clearItems();
      toast({
        title: t("cart.cartCleared"),
        description: t("cart.cartClearedDesc"),
      });
    } catch (error: unknown) {
      toast({
        title: t("cart.clearCartFailed"),
        description: error instanceof Error ? error.message : t("cart.pleaseTryAgain"),
        variant: "destructive",
      });
    }
  };

  const handleCountryChange = async (countryCode: string) => {
    try {
      await changeCountry({ countryCode });
    } catch (error: unknown) {
      toast({
        title: t("cart.shippingUpdateFailed"),
        description: error instanceof Error ? error.message : t("cart.pleaseTryAgain"),
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
  const agentCostAmount = cart.items.reduce(
    (sum, item) => sum + item.profitAmount * item.quantity,
    0,
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="luxe-shell pt-28 pb-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-10">
          <div>
            <p className="luxe-eyebrow mb-3">{t("cart.eyebrow")}</p>
            <h1 className="luxe-heading text-3xl lg:text-5xl">{t("cart.title")}</h1>
            <p className="text-sm text-muted-foreground mt-3">
              {t("cart.subtitle")}
            </p>
          </div>
          <div className="w-full md:w-56">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">{t("cart.shippingZone")}</p>
            <Select value={cart.countryCode} onValueChange={handleCountryChange} disabled={isLoadingCart || isMutatingCart}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t("cart.selectCountry")} />
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
            <p className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">{t("cart.displayCurrency")}</p>
            <Select value={displayCurrency} onValueChange={(value) => void setPreferredCurrency(value)} disabled={showTomanAmounts}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t("cart.selectCurrency")} />
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
            <Card className="border-border/60 bg-card/85 shadow-[0_18px_45px_hsl(var(--foreground)/0.05)]">
              <CardContent className="p-6 space-y-4">
                <div className="h-24 rounded-xl bg-secondary animate-pulse" />
                <div className="h-24 rounded-xl bg-secondary animate-pulse" />
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/85 shadow-[0_18px_45px_hsl(var(--foreground)/0.05)]">
              <CardContent className="p-6 space-y-4">
                <div className="h-6 rounded bg-secondary animate-pulse" />
                <div className="h-6 rounded bg-secondary animate-pulse" />
                <div className="h-10 rounded bg-secondary animate-pulse" />
              </CardContent>
            </Card>
          </div>
        ) : cart.items.length === 0 ? (
          <Card className="border-border/60 bg-card/85 shadow-[0_18px_45px_hsl(var(--foreground)/0.05)]">
            <CardContent className="p-12 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h2 className="font-display text-2xl font-bold mb-3">{t("cart.emptyTitle")}</h2>
              <p className="text-sm text-muted-foreground mb-8">
                {t("cart.emptySubtitle")}
              </p>
              <Button asChild size="lg" className="rounded-full px-8">
                <Link to="/shop">{t("cart.continueShopping")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.5fr,0.9fr]">
            <Card className="border-border/60 bg-card/85 shadow-[0_18px_45px_hsl(var(--foreground)/0.05)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xl">{t("cart.cartItems")}</CardTitle>
                <Button variant="ghost" onClick={handleClearCart} disabled={isMutatingCart}>
                  {t("cart.clearCart")}
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
                            {t("cart.noImage")}
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
                              {t("product.supplierCost")} {formatCurrency(item.supplierCost, currency)}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
                                {t("cart.size")}: {item.size || t("product.notSelected")}
                              </span>
                              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
                                {t("cart.color")}: {item.color || t("product.notSelected")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("product.finalPrice")} {formatCurrency(convertAmount(item.customerPaid, currency, displayCurrency), displayCurrency)}
                            </p>
                            {showTomanAmounts ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("currency.eur")} {formatCurrency(item.customerPaid, currency)}
                              </p>
                            ) : null}
                            {item.sourceUrl ? (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {t("product.viewSource")}
                              </a>
                            ) : null}
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-semibold text-lg">{formatCurrency(item.customerPaid, currency)}</p>
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
                            {t("common.remove")}
                          </Button>
                        </div>
                      </div>
                    </div>
                    {index < cart.items.length - 1 ? <Separator className="mt-6" /> : null}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="h-fit border-border/60 bg-card/85 shadow-[0_18px_45px_hsl(var(--foreground)/0.05)] lg:sticky lg:top-28">
              <CardHeader>
                <CardTitle className="text-xl">{t("cart.orderSummary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("cart.items")} ({cart.itemCount})</span>
                  <span>{formatCurrency(cart.subtotalAmount, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("product.supplierCost")}</span>
                  <span>{formatCurrency(productPriceBeforeMarginAndVat, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("cart.subtotal")} ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(cart.subtotalAmount, currency, displayCurrency), displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("product.supplierCost")} ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(productPriceBeforeMarginAndVat, currency, displayCurrency), displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("checkout.agentCost")}</span>
                  <span>{formatCurrency(agentCostAmount, currency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("checkout.agentCost")} ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(agentCostAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("cart.shipping")}</span>
                  <span>{formatCurrency(cart.shippingAmount, currency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("cart.shipping")} ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(cart.shippingAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("checkout.handlingFee")}</span>
                  <span>{formatCurrency(cart.handlingAmount, currency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("checkout.handlingFee")} ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(cart.handlingAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("checkout.paymentFee")}</span>
                  <span>{formatCurrency(cart.paymentFeeAmount, currency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("checkout.paymentFee")} ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(cart.paymentFeeAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("cart.vat")}</span>
                  <span>{formatCurrency(cart.taxAmount, currency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("cart.vat")} ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(cart.taxAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t("cart.total")}</span>
                  <span className="font-semibold text-xl">{formatCurrency(cart.totalAmount, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("cart.total")} ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(cart.totalAmount, currency, displayCurrency), displayCurrency)}</span>
                </div>
                {showTomanAmounts ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("cart.total")}</span>
                    <span>1 {currency} {"->"} {convertAmount(1, currency, displayCurrency)} {displayCurrency}</span>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {t("checkout.title")}
                </p>
                <Button asChild className="w-full rounded-full h-12">
                  <Link to="/checkout">
                    {t("cart.proceedToCheckout")}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-full h-12">
                  <Link to="/shop">{t("cart.continueShopping")}</Link>
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
