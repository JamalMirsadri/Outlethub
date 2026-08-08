import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, MapPin, PackageCheck, Truck } from "lucide-react";

import {
  createOrder,
  getCheckoutSummary,
  upsertAddress,
  updateCartCountry,
} from "@/api/commerce";
import { applyCheckoutPromotionCode, clearCheckoutPromotionCode } from "@/api/coupons";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency, shouldShowTomanAmounts } from "@/lib/currency";

const EMPTY_ADDRESS_FORM = {
  fullName: "",
  phone: "",
  countryCode: "PT",
  city: "",
  postalCode: "",
  addressLine1: "",
  addressLine2: "",
  isDefaultShipping: true,
  isDefaultBilling: true,
};

export default function Checkout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshCart } = useCart();
  const { preferredCurrency, supportedCurrencies, setPreferredCurrency, convertAmount } = useCurrency();

  const STEP_TITLES = [
    t("cart.cartItems"),
    t("checkout.shippingAddress"),
    t("checkout.shippingMethod"),
    t("checkout.paymentMethod"),
    t("checkout.shippingAddress"),
    t("checkout.placeOrder"),
  ];
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedShippingAddressId, setSelectedShippingAddressId] = useState(null);
  const [selectedBillingAddressId, setSelectedBillingAddressId] = useState(null);
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState("BANK_TRANSFER");
  const [paymentMethodLabel, setPaymentMethodLabel] = useState("Bank Transfer");
  const [customerNotes, setCustomerNotes] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS_FORM);
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionBusy, setPromotionBusy] = useState(false);
  const placingOrderRef = useRef(false);

  const loadSummary = async () => {
    const response = await getCheckoutSummary();
    setSummary(response);
    setPromotionCode(response.cart.promotion?.code ?? "");

    if (!selectedShippingAddressId && response.addresses[0]) {
      setSelectedShippingAddressId(response.addresses[0].id);
      setSelectedBillingAddressId(response.addresses[0].id);
    }

    const resolvedAddress =
      response.addresses.find((address) => address.id === selectedShippingAddressId) ?? response.addresses[0] ?? null;
    const matchingMethods = response.shippingMethods.filter(
      (method) => method.countryCode === (resolvedAddress?.countryCode ?? response.cart.countryCode),
    );

    if (!selectedShippingMethodId || !matchingMethods.some((method) => method.id === selectedShippingMethodId)) {
      setSelectedShippingMethodId(matchingMethods[0]?.id ?? null);
    }
  };

  useEffect(() => {
    loadSummary()
      .catch((error) => {
        toast({
          title: t("common.errorOccurred"),
          description: error instanceof Error ? error.message : t("cart.pleaseTryAgain"),
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedShippingAddress = useMemo(
    () => summary?.addresses.find((address) => address.id === selectedShippingAddressId) ?? null,
    [summary, selectedShippingAddressId],
  );

  const selectedBillingAddress = useMemo(
    () => summary?.addresses.find((address) => address.id === selectedBillingAddressId) ?? null,
    [summary, selectedBillingAddressId],
  );

  const availableShippingMethods = useMemo(() => {
    if (!summary) {
      return [];
    }

    const destinationCountryCode = selectedShippingAddress?.countryCode ?? summary.cart.countryCode;
    return summary.shippingMethods.filter((method) => method.countryCode === destinationCountryCode && method.isActive);
  }, [summary, selectedShippingAddress]);

  const selectedShippingMethod = useMemo(
    () => availableShippingMethods.find((method) => method.id === selectedShippingMethodId) ?? null,
    [availableShippingMethods, selectedShippingMethodId],
  );
  const isIranDelivery = shouldShowTomanAmounts({
    countryCode: selectedShippingAddress?.countryCode ?? summary?.cart?.countryCode,
  });

  const persistShippingSelection = async (countryCode, shippingMethodId) => {
    await updateCartCountry({
      countryCode,
      shippingMethodId: shippingMethodId ?? null,
    });
    await refreshCart();
    await loadSummary();
  };

  const handleSelectAddress = async (addressId) => {
    setSelectedShippingAddressId(addressId);
    setSelectedBillingAddressId((current) => current ?? addressId);

    const address = summary.addresses.find((item) => item.id === addressId);
    if (!address) {
      return;
    }

    const nextMethod = summary.shippingMethods.find((method) => method.countryCode === address.countryCode && method.isActive) ?? null;
    setSelectedShippingMethodId(nextMethod?.id ?? null);
    await persistShippingSelection(address.countryCode, nextMethod?.id ?? null);
  };

  const handleSaveAddress = async () => {
    try {
      const created = await upsertAddress(addressForm);
      setShowAddressForm(false);
      setAddressForm(EMPTY_ADDRESS_FORM);
      setSelectedShippingAddressId(created.id);
      setSelectedBillingAddressId(created.id);
      await persistShippingSelection(created.countryCode, null);
      toast({
        title: t("common.success"),
        description: t("common.save"),
      });
    } catch (error) {
      toast({
        title: t("common.errorOccurred"),
        description: error instanceof Error ? error.message : t("cart.pleaseTryAgain"),
        variant: "destructive",
      });
    }
  };

  const nextStep = () => {
    if (step === 1 && !selectedShippingAddressId) {
      toast({ title: t("checkout.shippingAddress"), variant: "destructive" });
      return;
    }
    if (step === 2 && !selectedShippingMethodId) {
      toast({ title: t("checkout.shippingMethod"), variant: "destructive" });
      return;
    }
    setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
  };

  const placeOrder = async () => {
    if (!selectedShippingAddressId) {
      toast({ title: t("checkout.shippingAddress"), variant: "destructive" });
      return;
    }

    if (placingOrderRef.current) {
      return;
    }

    placingOrderRef.current = true;
    setPlacingOrder(true);
    try {
      const order = await createOrder({
        customerEmail: user?.email ?? "customer@outlethub.local",
        shippingAddressId: selectedShippingAddressId,
        billingAddressId: selectedBillingAddressId ?? selectedShippingAddressId,
        shippingMethodId: selectedShippingMethodId,
        paymentProvider,
        displayCurrency: isIranDelivery ? "TOMAN" : preferredCurrency,
        paymentMethodLabel,
        notes: customerNotes || null,
      });

      await refreshCart().catch(() => undefined);

      toast({
        title: t("checkout.orderSuccess"),
        description: `${t("checkout.orderSuccessDesc")} ${order.orderNumber}`,
      });
      navigate("/dashboard/payments");
    } catch (error) {
      toast({
        title: t("common.errorOccurred"),
        description: error instanceof Error ? error.message : t("cart.pleaseTryAgain"),
        variant: "destructive",
      });
    } finally {
      placingOrderRef.current = false;
      setPlacingOrder(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 max-w-[1400px] mx-auto px-6 lg:px-10 pb-16 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 bg-secondary rounded-2xl animate-pulse" />
          ))}
        </main>
        <Footer />
      </div>
    );
  }

  if (!summary.cart.items.length) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 max-w-[960px] mx-auto px-6 lg:px-10 pb-16">
          <div className="rounded-3xl border border-border bg-card p-10 text-center">
            <PackageCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="font-display text-3xl font-bold mb-3">{t("cart.emptyTitle")}</h1>
            <p className="text-muted-foreground mb-8">{t("cart.emptySubtitle")}</p>
            <Button asChild className="rounded-full">
              <Link to="/cart">{t("checkout.backToCart")}</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const currency = summary.cart.currency || summary.businessSettings.defaultCurrency || "EUR";
  const displayCurrency = isIranDelivery ? "TOMAN" : preferredCurrency || currency;
  const promotion = summary.cart.promotion;
  const productPriceBeforeMarginAndVat = summary.cart.items.reduce(
    (sum, item) => sum + item.supplierCost * item.quantity,
    0,
  );
  const websiteMarginAmount = summary.cart.items.reduce(
    (sum, item) => sum + item.profitAmount * item.quantity,
    0,
  );

  const applyPromotion = async () => {
    if (!promotionCode.trim()) {
      toast({
        title: t("checkout.promoCodeRequired"),
        description: t("checkout.promoCodeInvalid"),
        variant: "destructive",
      });
      return;
    }

    setPromotionBusy(true);

    try {
      await applyCheckoutPromotionCode(promotionCode);
      await loadSummary();
      toast({
        title: t("checkout.promoApplied"),
        description: t("checkout.promoApplied"),
      });
    } catch (error) {
      toast({
        title: t("checkout.promoCodeInvalid"),
        description: error instanceof Error ? error.message : t("cart.pleaseTryAgain"),
        variant: "destructive",
      });
    } finally {
      setPromotionBusy(false);
    }
  };

  const removePromotion = async () => {
    setPromotionBusy(true);

    try {
      await clearCheckoutPromotionCode();
      await loadSummary();
      setPromotionCode("");
      toast({
        title: t("common.remove"),
        description: t("common.remove"),
      });
    } catch (error) {
      toast({
        title: t("common.errorOccurred"),
        description: error instanceof Error ? error.message : t("cart.pleaseTryAgain"),
        variant: "destructive",
      });
    } finally {
      setPromotionBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 max-w-[1400px] mx-auto px-6 lg:px-10 pb-16">
        <div className="mb-8">
          <Link to="/cart" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("checkout.backToCart")}
          </Link>
          <h1 className="font-display text-3xl lg:text-5xl font-bold">{t("checkout.title")}</h1>
          <p className="text-sm text-muted-foreground mt-3">{t("checkout.eyebrow")}</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {STEP_TITLES.map((title, index) => (
                  <button
                    key={title}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      index === step
                        ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                        : index < step
                          ? "border-border bg-secondary/40"
                          : "border-border"
                    }`}
                    onClick={() => setStep(index)}
                  >
                    <p className="text-xs text-muted-foreground mb-2">{t("shop.page")} {index + 1}</p>
                    <p className="text-sm font-medium">{title}</p>
                  </button>
                ))}
              </div>
            </div>

            {step === 0 ? (
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-semibold text-lg mb-4">{t("cart.cartItems")}</h2>
                <div className="space-y-4">
                  {summary.cart.items.map((item) => (
                    <div key={item.id} className="flex gap-4 items-start border-b border-border pb-4 last:border-0 last:pb-0">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-secondary shrink-0">
                        {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{item.brand}</p>
                        <p className="text-sm text-muted-foreground mt-1">Qty {item.quantity}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
                            {t("cart.size")}: {item.size || t("product.notSelected")}
                          </span>
                          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
                            {t("cart.color")}: {item.color || t("product.notSelected")}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-semibold">{formatCurrency(item.customerPaid * item.quantity, currency)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 1 ? (
              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-lg">{t("checkout.shippingAddress")}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{t("checkout.contact")}</p>
                  </div>
                  <Button variant="outline" className="rounded-full" onClick={() => setShowAddressForm((current) => !current)}>
                    {showAddressForm ? t("common.close") : t("common.add")}
                  </Button>
                </div>

                {showAddressForm ? (
                  <div className="grid gap-4 md:grid-cols-2 mb-6">
                    {[
                      ["fullName", t("checkout.firstName") + " & " + t("checkout.lastName")],
                      ["phone", t("checkout.phone")],
                      ["city", t("checkout.city")],
                      ["postalCode", t("checkout.postalCode")],
                      ["addressLine1", t("checkout.addressLine1")],
                      ["addressLine2", t("checkout.addressLine2")],
                    ].map(([key, label]) => (
                      <div key={key} className={key === "addressLine1" || key === "addressLine2" ? "md:col-span-2" : ""}>
                        <Label className="text-xs">{label}</Label>
                        <Input
                          value={addressForm[key]}
                          onChange={(event) => setAddressForm((current) => ({ ...current, [key]: event.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    ))}
                    <div>
                      <Label className="text-xs">{t("checkout.country")}</Label>
                      <Select
                        value={addressForm.countryCode}
                        onValueChange={(value) => setAddressForm((current) => ({ ...current, countryCode: value }))}
                      >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {summary.countries.map((country) => (
                            <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleSaveAddress} className="w-full rounded-full">{t("common.save")}</Button>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {summary.addresses.map((address) => (
                    <button
                      key={address.id}
                      onClick={() => handleSelectAddress(address.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                        selectedShippingAddressId === address.id ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">{address.fullName}</p>
                          <p className="text-sm text-muted-foreground mt-1">{address.addressLine1}</p>
                          {address.addressLine2 ? <p className="text-sm text-muted-foreground">{address.addressLine2}</p> : null}
                          <p className="text-sm text-muted-foreground">{address.city}, {address.postalCode}, {address.countryCode}</p>
                        </div>
                        {selectedShippingAddressId === address.id ? <CheckCircle2 className="w-5 h-5 text-[hsl(var(--accent))]" /> : null}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-semibold text-lg mb-4">{t("checkout.shippingMethod")}</h2>
                <div className="space-y-3">
                  {availableShippingMethods.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("common.noResults")}</p>
                  ) : (
                    availableShippingMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={async () => {
                          setSelectedShippingMethodId(method.id);
                          await persistShippingSelection(selectedShippingAddress?.countryCode ?? summary.cart.countryCode, method.id);
                        }}
                        className={`w-full rounded-2xl border p-4 text-left ${
                          selectedShippingMethodId === method.id ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10" : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium">{method.name}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {method.originCountryCode ? `${method.originCountryCode} -> ` : ""}
                              {method.countryCode} | {method.deliveryEstimate || `${method.minDeliveryDays}-${method.maxDeliveryDays} ${t("checkout.shippingStandard")}`}
                            </p>
                            {method.minWeightKg !== null || method.maxWeightKg !== null ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("checkout.shippingMethod")} {method.minWeightKg ?? 0}kg - {method.maxWeightKg ?? "up"}kg
                              </p>
                            ) : null}
                          </div>
                          <p className="font-mono font-semibold">{formatCurrency(method.baseFee, currency)}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-semibold text-lg mb-4">{t("checkout.paymentMethod")}</h2>
                <div className="mb-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">{t("cart.displayCurrency")}</Label>
                    <Select value={displayCurrency} onValueChange={(value) => void setPreferredCurrency(value)} disabled={isIranDelivery}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {supportedCurrencies.map((entry) => (
                          <SelectItem key={entry.code} value={entry.code}>{entry.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isIranDelivery ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("checkout.shippingExpress")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-3">
                  {(summary.paymentProviders.filter((provider) => {
                    if (!provider.supportedCurrencies || provider.supportedCurrencies.length === 0) {
                      return true;
                    }
                    return provider.supportedCurrencies.includes(displayCurrency);
                  })).map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => {
                        setPaymentProvider(provider.code);
                        setPaymentMethodLabel(provider.displayName);
                      }}
                      className={`w-full rounded-2xl border p-4 text-left ${
                        paymentProvider === provider.code ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10" : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-4 h-4" />
                        <div>
                          <p className="font-medium">{provider.displayName}</p>
                          <p className="text-sm text-muted-foreground">
                            {provider.settings && typeof provider.settings.description === "string" && provider.settings.description.length > 0
                              ? provider.settings.description
                              : provider.supportsReceipts ? t("checkout.creditCard") : t("checkout.stripe")}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {paymentProvider === "BANK_TRANSFER" ? (
                  <div className="mt-5 rounded-2xl bg-secondary/40 p-4">
                    <p className="text-xs text-muted-foreground mb-3">{t("checkout.paymentMethod")}</p>
                    <div className="space-y-3">
                      {summary.bankAccounts.map((account) => (
                        <div key={account.id} className="rounded-xl border border-border bg-card p-4">
                          <p className="font-medium">{account.bankName}</p>
                          <p className="text-sm text-muted-foreground mt-1">{account.accountHolder} · {account.currency}</p>
                          <p className="text-xs text-muted-foreground mt-2">IBAN {account.iban || "N/A"} · SWIFT {account.swift || "N/A"} · Card {account.cardNumber || "N/A"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-5">
                  <Label className="text-xs">{t("checkout.paymentMethod")}</Label>
                  <Input value={paymentMethodLabel} onChange={(event) => setPaymentMethodLabel(event.target.value)} className="mt-1" />
                </div>
              </section>
            ) : null}

            {step === 4 || step === 5 ? (
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-semibold text-lg mb-4">{t("checkout.shippingAddress")}</h2>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="rounded-2xl bg-secondary/40 p-4">
                    <p className="text-xs text-muted-foreground mb-2">{t("checkout.shippingAddress")}</p>
                    {selectedShippingAddress ? (
                      <>
                        <p className="font-medium">{selectedShippingAddress.fullName}</p>
                        <p className="text-sm text-muted-foreground mt-1">{selectedShippingAddress.addressLine1}</p>
                        <p className="text-sm text-muted-foreground">{selectedShippingAddress.city}, {selectedShippingAddress.postalCode}</p>
                        <p className="text-sm text-muted-foreground">{selectedShippingAddress.countryCode}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("product.notSelected")}</p>
                    )}
                  </div>
                  <div className="rounded-2xl bg-secondary/40 p-4">
                    <p className="text-xs text-muted-foreground mb-2">{t("checkout.shippingMethod")}</p>
                    <p className="font-medium">{selectedShippingMethod?.name || t("product.notSelected")}</p>
                    <p className="text-sm text-muted-foreground mt-1">{paymentMethodLabel}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t("checkout.shippingMethod")} {summary.cart.items.reduce((sum, item) => sum + item.quantity, 0)}kg</p>
                  </div>
                </div>
                <div className="mt-5">
                  <Label className="text-xs">{t("checkout.contact")}</Label>
                  <Textarea value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} className="mt-1" />
                </div>
              </section>
            ) : null}

            <div className="flex items-center justify-between">
              <Button variant="outline" className="rounded-full" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("common.previous")}
              </Button>
              {step < STEP_TITLES.length - 1 ? (
                <Button className="rounded-full" onClick={nextStep}>
                  {t("common.next")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button className="rounded-full" onClick={placeOrder} disabled={placingOrder}>
                  {placingOrder ? t("checkout.processingOrder") : t("checkout.placeOrder")}
                  <Truck className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 xl:sticky xl:top-28">
              <h2 className="font-semibold text-lg mb-4">{t("cart.orderSummary")}</h2>
              <div className="mb-5 rounded-2xl border border-border bg-secondary/20 p-4">
                <Label className="text-xs">{t("checkout.promotionCode")}</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={promotionCode}
                    onChange={(event) => setPromotionCode(event.target.value)}
                    placeholder={t("checkout.promotionCode")}
                    disabled={promotionBusy}
                  />
                  <Button type="button" onClick={applyPromotion} disabled={promotionBusy} className="rounded-full">
                    {promotionBusy ? t("common.loading") : t("checkout.applyPromo")}
                  </Button>
                </div>
                {promotion?.status === "applied" ? (
                  <div className="mt-3 rounded-xl border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{promotion.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("checkout.savings")} {formatCurrency(promotion.savingsAmount, currency)}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={removePromotion} disabled={promotionBusy}>
                        {t("common.remove")}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {promotion?.status === "invalid" ? (
                  <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                    <p className="text-sm font-medium">{t("checkout.promoCodeInvalid")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{promotion.message || t("common.tryAgain")}</p>
                  </div>
                ) : null}
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("checkout.subtotal")}</span>
                  <span>{formatCurrency(summary.cart.subtotalAmount, currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("product.supplierCost")}</span>
                  <span>{formatCurrency(productPriceBeforeMarginAndVat, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("checkout.subtotal")} ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(summary.cart.subtotalAmount, currency, displayCurrency), displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("product.supplierCost")} ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(productPriceBeforeMarginAndVat, currency, displayCurrency), displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("checkout.shipping")}</span>
                  <span>{formatCurrency(summary.cart.shippingAmount, currency)}</span>
                </div>
                {promotion?.status === "applied" && promotion.shippingDiscountAmount > 0 ? (
                  <div className="flex items-center justify-between text-xs text-emerald-400">
                    <span>{t("checkout.shipping")} {t("checkout.savings")}</span>
                    <span>-{formatCurrency(promotion.shippingDiscountAmount, currency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("checkout.shipping")} ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(summary.cart.shippingAmount, currency, displayCurrency), displayCurrency)}</span>
                </div>
                {promotion?.status === "applied" && promotion.discountAmount > 0 ? (
                  <div className="flex items-center justify-between text-sm text-emerald-400">
                    <span>{t("checkout.promotionCode")} {t("checkout.savings")}</span>
                    <span>-{formatCurrency(promotion.discountAmount, currency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("checkout.tax")}</span>
                  <span>{formatCurrency(websiteMarginAmount, currency)}</span>
                </div>
                {isIranDelivery ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("checkout.tax")} ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(websiteMarginAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("cart.shipping")}</span>
                  <span>{formatCurrency(summary.cart.handlingAmount, currency)}</span>
                </div>
                {isIranDelivery ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("cart.shipping")} ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(summary.cart.handlingAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("cart.shipping")}</span>
                  <span>{formatCurrency(summary.cart.paymentFeeAmount, currency)}</span>
                </div>
                {isIranDelivery ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("cart.shipping")} ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(summary.cart.paymentFeeAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("cart.vat")}</span>
                  <span>{formatCurrency(summary.cart.taxAmount, currency)}</span>
                </div>
                {isIranDelivery ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("cart.vat")} ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(summary.cart.taxAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between font-semibold text-base pt-3 border-t border-border">
                  <span>{t("checkout.total")}</span>
                  <span>{formatCurrency(summary.cart.totalAmount, currency)}</span>
                </div>
                {promotion?.status === "applied" ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("checkout.total")} {t("checkout.promotionCode")}</span>
                    <span>{formatCurrency(promotion.totalBeforeDiscount, currency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("cart.total")}</span>
                  <span>1 {currency} {"->"} {convertAmount(1, currency, displayCurrency)} {displayCurrency}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-base">
                  <span>{t("checkout.total")} ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(summary.cart.totalAmount, currency, displayCurrency), displayCurrency)}</span>
                </div>
                {promotion?.status === "applied" ? (
                  <div className="rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/10 p-4 mt-4">
                    <p className="text-xs text-muted-foreground mb-2">{t("checkout.savings")}</p>
                    <p className="font-mono text-lg font-semibold">{formatCurrency(promotion.savingsAmount, currency)}</p>
                  </div>
                ) : null}
                <div className="rounded-2xl bg-secondary/40 p-4 mt-4">
                  <p className="text-xs text-muted-foreground mb-2">{t("checkout.tax")}</p>
                  <p className="font-mono text-lg font-semibold">{formatCurrency(websiteMarginAmount, currency)}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
