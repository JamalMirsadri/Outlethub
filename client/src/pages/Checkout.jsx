import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, MapPin, PackageCheck, Truck } from "lucide-react";

import {
  createOrder,
  getCheckoutSummary,
  upsertAddress,
  updateCartCountry,
} from "@/api/commerce";
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

const STEP_TITLES = [
  "Cart Review",
  "Shipping Address",
  "Shipping Method",
  "Payment Method",
  "Order Review",
  "Place Order",
];

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshCart } = useCart();
  const { preferredCurrency, supportedCurrencies, setPreferredCurrency, convertAmount } = useCurrency();
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

  const loadSummary = async () => {
    const response = await getCheckoutSummary();
    setSummary(response);

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
          title: "Checkout failed to load",
          description: error instanceof Error ? error.message : "Please try again.",
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
        title: "Address saved",
        description: "Checkout can now continue with the new address.",
      });
    } catch (error) {
      toast({
        title: "Address save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const nextStep = () => {
    if (step === 1 && !selectedShippingAddressId) {
      toast({ title: "Select a shipping address first", variant: "destructive" });
      return;
    }
    if (step === 2 && !selectedShippingMethodId) {
      toast({ title: "Select a shipping method first", variant: "destructive" });
      return;
    }
    setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
  };

  const placeOrder = async () => {
    if (!selectedShippingAddressId) {
      toast({ title: "Shipping address is required", variant: "destructive" });
      return;
    }

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
      await refreshCart();
      toast({
        title: "Order placed",
        description: `Order ${order.orderNumber} is now pending.`,
      });
      navigate("/dashboard/payments");
    } catch (error) {
      toast({
        title: "Order placement failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
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
            <h1 className="font-display text-3xl font-bold mb-3">Your cart is empty</h1>
            <p className="text-muted-foreground mb-8">Add products to the cart before starting checkout.</p>
            <Button asChild className="rounded-full">
              <Link to="/cart">Return to cart</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const currency = summary.cart.currency || summary.businessSettings.defaultCurrency || "EUR";
  const displayCurrency = isIranDelivery ? "TOMAN" : preferredCurrency || currency;
  const productPriceBeforeMarginAndVat = summary.cart.items.reduce(
    (sum, item) => sum + item.supplierCost * item.quantity,
    0,
  );
  const websiteMarginAmount = summary.cart.items.reduce(
    (sum, item) => sum + item.profitAmount * item.quantity,
    0,
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 max-w-[1400px] mx-auto px-6 lg:px-10 pb-16">
        <div className="mb-8">
          <Link to="/cart" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to cart
          </Link>
          <h1 className="font-display text-3xl lg:text-5xl font-bold">Checkout</h1>
          <p className="text-sm text-muted-foreground mt-3">Complete the 6-step order flow and create a pending order snapshot.</p>
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
                    <p className="text-xs text-muted-foreground mb-2">Step {index + 1}</p>
                    <p className="text-sm font-medium">{title}</p>
                  </button>
                ))}
              </div>
            </div>

            {step === 0 ? (
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-semibold text-lg mb-4">Cart Review</h2>
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
                            Size: {item.size || "Not selected"}
                          </span>
                          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
                            Color: {item.color || "Not selected"}
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
                    <h2 className="font-semibold text-lg">Shipping Address</h2>
                    <p className="text-sm text-muted-foreground mt-1">Choose an existing address or add a new one.</p>
                  </div>
                  <Button variant="outline" className="rounded-full" onClick={() => setShowAddressForm((current) => !current)}>
                    {showAddressForm ? "Close form" : "Add address"}
                  </Button>
                </div>

                {showAddressForm ? (
                  <div className="grid gap-4 md:grid-cols-2 mb-6">
                    {[
                      ["fullName", "Full Name"],
                      ["phone", "Phone"],
                      ["city", "City"],
                      ["postalCode", "Postal Code"],
                      ["addressLine1", "Address Line 1"],
                      ["addressLine2", "Address Line 2"],
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
                      <Label className="text-xs">Country</Label>
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
                      <Button onClick={handleSaveAddress} className="w-full rounded-full">Save address</Button>
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
                <h2 className="font-semibold text-lg mb-4">Shipping Method</h2>
                <div className="space-y-3">
                  {availableShippingMethods.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active shipping methods for this destination yet.</p>
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
                              {method.countryCode} | {method.deliveryEstimate || `${method.minDeliveryDays}-${method.maxDeliveryDays} days`}
                            </p>
                            {method.minWeightKg !== null || method.maxWeightKg !== null ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Weight range {method.minWeightKg ?? 0}kg - {method.maxWeightKg ?? "up"}kg
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
                <h2 className="font-semibold text-lg mb-4">Payment Method</h2>
                <div className="mb-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Display Currency</Label>
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
                        Iran delivery uses the saved EUR to TOMAN FX rate.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-3">
                  {summary.paymentProviders.map((provider) => (
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
                            {provider.supportsReceipts ? "Receipt upload enabled" : "Provider adapter ready for activation."}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {paymentProvider === "BANK_TRANSFER" ? (
                  <div className="mt-5 rounded-2xl bg-secondary/40 p-4">
                    <p className="text-xs text-muted-foreground mb-3">Active Bank Accounts</p>
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
                  <Label className="text-xs">Payment Label</Label>
                  <Input value={paymentMethodLabel} onChange={(event) => setPaymentMethodLabel(event.target.value)} className="mt-1" />
                </div>
              </section>
            ) : null}

            {step === 4 || step === 5 ? (
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-semibold text-lg mb-4">Order Review</h2>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="rounded-2xl bg-secondary/40 p-4">
                    <p className="text-xs text-muted-foreground mb-2">Shipping Address</p>
                    {selectedShippingAddress ? (
                      <>
                        <p className="font-medium">{selectedShippingAddress.fullName}</p>
                        <p className="text-sm text-muted-foreground mt-1">{selectedShippingAddress.addressLine1}</p>
                        <p className="text-sm text-muted-foreground">{selectedShippingAddress.city}, {selectedShippingAddress.postalCode}</p>
                        <p className="text-sm text-muted-foreground">{selectedShippingAddress.countryCode}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No address selected.</p>
                    )}
                  </div>
                  <div className="rounded-2xl bg-secondary/40 p-4">
                    <p className="text-xs text-muted-foreground mb-2">Fulfillment</p>
                    <p className="font-medium">{selectedShippingMethod?.name || "No shipping method selected"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{paymentMethodLabel}</p>
                    <p className="text-sm text-muted-foreground mt-1">Estimated cart weight {summary.cart.items.reduce((sum, item) => sum + item.quantity, 0)}kg</p>
                  </div>
                </div>
                <div className="mt-5">
                  <Label className="text-xs">Customer Notes</Label>
                  <Textarea value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} className="mt-1" />
                </div>
              </section>
            ) : null}

            <div className="flex items-center justify-between">
              <Button variant="outline" className="rounded-full" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              {step < STEP_TITLES.length - 1 ? (
                <Button className="rounded-full" onClick={nextStep}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button className="rounded-full" onClick={placeOrder} disabled={placingOrder}>
                  {placingOrder ? "Placing order..." : "Place Order"}
                  <Truck className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 xl:sticky xl:top-28">
              <h2 className="font-semibold text-lg mb-4">Order Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(summary.cart.subtotalAmount, currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Product price before website fee and VAT</span>
                  <span>{formatCurrency(productPriceBeforeMarginAndVat, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Subtotal ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(summary.cart.subtotalAmount, currency, displayCurrency), displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Product price before website fee and VAT ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(productPriceBeforeMarginAndVat, currency, displayCurrency), displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatCurrency(summary.cart.shippingAmount, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Shipping ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(summary.cart.shippingAmount, currency, displayCurrency), displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Website Fee</span>
                  <span>{formatCurrency(websiteMarginAmount, currency)}</span>
                </div>
                {isIranDelivery ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Website Fee ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(websiteMarginAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Handling</span>
                  <span>{formatCurrency(summary.cart.handlingAmount, currency)}</span>
                </div>
                {isIranDelivery ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Handling ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(summary.cart.handlingAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Payment fee</span>
                  <span>{formatCurrency(summary.cart.paymentFeeAmount, currency)}</span>
                </div>
                {isIranDelivery ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Payment fee ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(summary.cart.paymentFeeAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">VAT</span>
                  <span>{formatCurrency(summary.cart.taxAmount, currency)}</span>
                </div>
                {isIranDelivery ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>VAT ({displayCurrency})</span>
                    <span>{formatCurrency(convertAmount(summary.cart.taxAmount, currency, displayCurrency), displayCurrency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between font-semibold text-base pt-3 border-t border-border">
                  <span>Total</span>
                  <span>{formatCurrency(summary.cart.totalAmount, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Exchange Rate</span>
                  <span>1 {currency} {"->"} {convertAmount(1, currency, displayCurrency)} {displayCurrency}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-base">
                  <span>Total ({displayCurrency})</span>
                  <span>{formatCurrency(convertAmount(summary.cart.totalAmount, currency, displayCurrency), displayCurrency)}</span>
                </div>
                <div className="rounded-2xl bg-secondary/40 p-4 mt-4">
                  <p className="text-xs text-muted-foreground mb-2">Website Fee</p>
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
