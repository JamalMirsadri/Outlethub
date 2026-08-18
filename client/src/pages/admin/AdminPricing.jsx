import React, { useEffect, useMemo, useState } from "react";

import { getCommerceSettings, updateBusinessSettings } from "@/api/commerce";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/currency";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getCountryShippingFee(form, countryCode) {
  switch ((countryCode || form.defaultCountryCode || "PT").toUpperCase()) {
    case "ES":
      return toNumber(form.spainShippingFee);
    case "IR":
      return toNumber(form.iranShippingFee);
    case "PT":
    default:
      return toNumber(form.portugalShippingFee);
  }
}

export default function AdminPricing() {
  const [countries, setCountries] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessForm, setBusinessForm] = useState({
    businessName: "",
    supportEmail: "",
    defaultCurrency: "EUR",
    defaultCountryCode: "PT",
    defaultMarginPercent: "15",
    fixedProfitAmount: "0",
    minimumProfitAmount: "0",
    portugalShippingFee: "0",
    spainShippingFee: "0",
    iranShippingFee: "0",
    handlingFee: "0",
    paymentFee: "0",
    vatPercent: "23",
    freeShippingThreshold: "0",
    minimumOrderValue: "0",
    bankTransferPaymentDeadlineHours: "3",
    returnPeriodDays: "30",
  });
  const [calculator, setCalculator] = useState({
    supplierPrice: "100",
    countryCode: "PT",
  });

  const loadSettings = async () => {
    const settings = await getCommerceSettings();

    setCountries(settings.countries);
    setCurrencies(settings.currencies);
    setBusinessForm({
      businessName: settings.businessSettings.businessName || "",
      supportEmail: settings.businessSettings.supportEmail || "",
      defaultCurrency: settings.businessSettings.defaultCurrency || "EUR",
      defaultCountryCode: settings.businessSettings.defaultCountryCode || "PT",
      defaultMarginPercent: String(settings.businessSettings.defaultMarginPercent ?? 0),
      fixedProfitAmount: String(settings.businessSettings.fixedProfitAmount ?? 0),
      minimumProfitAmount: String(settings.businessSettings.minimumProfitAmount ?? 0),
      portugalShippingFee: String(settings.businessSettings.portugalShippingFee ?? 0),
      spainShippingFee: String(settings.businessSettings.spainShippingFee ?? 0),
      iranShippingFee: String(settings.businessSettings.iranShippingFee ?? 0),
      handlingFee: String(settings.businessSettings.handlingFee ?? 0),
      paymentFee: String(settings.businessSettings.paymentFee ?? 0),
      vatPercent: String(settings.businessSettings.vatPercent ?? 0),
      freeShippingThreshold: String(settings.businessSettings.freeShippingThreshold ?? 0),
      minimumOrderValue: String(settings.businessSettings.minimumOrderValue ?? 0),
      bankTransferPaymentDeadlineHours: String(settings.businessSettings.bankTransferPaymentDeadlineHours ?? 3),
      returnPeriodDays: String(settings.businessSettings.returnPeriodDays ?? 30),
    });
    setCalculator({
      supplierPrice: "100",
      countryCode: settings.businessSettings.defaultCountryCode || "PT",
    });
  };

  useEffect(() => {
    loadSettings()
      .catch((error) => {
        toast({
          title: "Pricing settings failed to load",
          description: error instanceof Error ? error.message : "Please refresh the page.",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const calculatorResult = useMemo(() => {
    const supplierPrice = toNumber(calculator.supplierPrice);
    const marginPercent = toNumber(businessForm.defaultMarginPercent);
    const fixedProfitAmount = toNumber(businessForm.fixedProfitAmount);
    const minimumProfitAmount = toNumber(businessForm.minimumProfitAmount);
    const shippingFee = getCountryShippingFee(businessForm, calculator.countryCode);
    const handlingFee = toNumber(businessForm.handlingFee);
    const paymentFee = toNumber(businessForm.paymentFee);
    const vatPercent = toNumber(businessForm.vatPercent);
    const freeShippingThreshold = toNumber(businessForm.freeShippingThreshold);

    const marginAmount = supplierPrice * (marginPercent / 100);
    const baseAgentCost = marginAmount + fixedProfitAmount;
    const minimumProfitAdjustment = Math.max(0, minimumProfitAmount - baseAgentCost);
    const agentCostAmount = baseAgentCost + minimumProfitAdjustment;
    const productPrice = supplierPrice + agentCostAmount;
    const shippingAmount =
      freeShippingThreshold > 0 && productPrice >= freeShippingThreshold
        ? 0
        : shippingFee;
    const taxableAmount = productPrice + shippingAmount + handlingFee + paymentFee;
    const vatAmount = taxableAmount * (vatPercent / 100);
    const totalAmount = taxableAmount + vatAmount;
    const agentCostPercentage = productPrice > 0 ? (agentCostAmount / productPrice) * 100 : 0;

    return {
      productPrice,
      agentCostAmount,
      agentCostPercentage,
      shippingAmount,
      handlingFee,
      paymentFee,
      vatAmount,
      totalAmount,
    };
  }, [businessForm, calculator]);

  const saveBusinessSettings = async () => {
    setSavingBusiness(true);

    try {
      await updateBusinessSettings({
        businessName: businessForm.businessName,
        supportEmail: businessForm.supportEmail,
        defaultCurrency: businessForm.defaultCurrency,
        defaultCountryCode: businessForm.defaultCountryCode,
        defaultMarginPercent: toNumber(businessForm.defaultMarginPercent),
        fixedProfitAmount: toNumber(businessForm.fixedProfitAmount),
        minimumProfitAmount: toNumber(businessForm.minimumProfitAmount),
        portugalShippingFee: toNumber(businessForm.portugalShippingFee),
        spainShippingFee: toNumber(businessForm.spainShippingFee),
        iranShippingFee: toNumber(businessForm.iranShippingFee),
        handlingFee: toNumber(businessForm.handlingFee),
        paymentFee: toNumber(businessForm.paymentFee),
        vatPercent: toNumber(businessForm.vatPercent),
        freeShippingThreshold: toNumber(businessForm.freeShippingThreshold),
        minimumOrderValue: toNumber(businessForm.minimumOrderValue),
        bankTransferPaymentDeadlineHours: toNumber(businessForm.bankTransferPaymentDeadlineHours, 3),
        returnPeriodDays: toNumber(businessForm.returnPeriodDays, 30),
      });
      await loadSettings();
      toast({
        title: "Business settings saved",
        description: "Global Business Settings is now the single pricing source across catalog, checkout, and orders.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingBusiness(false);
    }
  };

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 rounded-xl bg-secondary animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Pricing Engine</h1>
        <p className="text-sm text-muted-foreground">
          Global Business Settings is the only pricing source for product pricing, checkout totals, order summaries, VAT, shipping, handling, payment fees, and minimum profit.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold">Pricing Flow</h3>
        <div className="rounded-xl bg-secondary/50 p-4 font-mono text-sm lg:text-base">
          Product Price = Supplier Price + Agent Cost
          <br />
          Checkout Total = Product Price + Shipping + Handling Fee + Payment Fee + VAT
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-6 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Global Business Settings</h3>
              <p className="mt-1 text-sm text-muted-foreground">These values are saved to the database and used directly by runtime pricing calculations. Bank transfer deadline changes apply only to new pending payments.</p>
            </div>
            <Button onClick={saveBusinessSettings} disabled={savingBusiness} className="rounded-full">
              {savingBusiness ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Business Name</Label>
              <Input value={businessForm.businessName} onChange={(event) => setBusinessForm((current) => ({ ...current, businessName: event.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Support Email</Label>
              <Input value={businessForm.supportEmail} onChange={(event) => setBusinessForm((current) => ({ ...current, supportEmail: event.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Default Currency</Label>
              <Select value={businessForm.defaultCurrency} onValueChange={(value) => setBusinessForm((current) => ({ ...current, defaultCurrency: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => <SelectItem key={currency.code} value={currency.code}>{currency.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Default Country</Label>
              <Select value={businessForm.defaultCountryCode} onValueChange={(value) => setBusinessForm((current) => ({ ...current, defaultCountryCode: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {countries.map((country) => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {[
              ["defaultMarginPercent", "Agent Cost %"],
              ["fixedProfitAmount", "Fixed Agent Cost"],
              ["minimumProfitAmount", "Minimum Profit"],
              ["portugalShippingFee", "Portugal Shipping"],
              ["spainShippingFee", "Spain Shipping"],
              ["iranShippingFee", "Iran Shipping"],
              ["handlingFee", "Handling Fee"],
              ["paymentFee", "Payment Fee"],
              ["vatPercent", "VAT %"],
              ["freeShippingThreshold", "Free Shipping Threshold"],
              ["minimumOrderValue", "Minimum Order Value"],
              ["bankTransferPaymentDeadlineHours", "Bank Transfer Deadline (Hours)"],
              ["returnPeriodDays", "Return Period Days"],
            ].map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input type="number" value={businessForm[key]} onChange={(event) => setBusinessForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <h3 className="font-semibold">Live Pricing Preview</h3>
            <p className="mt-1 text-sm text-muted-foreground">Preview the exact Global Business Settings flow for one product and destination country.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Supplier Price</Label>
              <Input
                type="number"
                value={calculator.supplierPrice}
                onChange={(event) => setCalculator((current) => ({ ...current, supplierPrice: event.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Destination Country</Label>
              <Select value={calculator.countryCode} onValueChange={(value) => setCalculator((current) => ({ ...current, countryCode: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {countries.map((country) => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-secondary/50 p-4">
              <p className="mb-2 text-xs text-muted-foreground">Product Price</p>
              <p className="font-mono text-xl font-bold">{formatCurrency(calculatorResult.productPrice, businessForm.defaultCurrency || "EUR")}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <p className="mb-2 text-xs text-muted-foreground">Agent Cost Amount</p>
              <p className="font-mono text-xl font-bold">{formatCurrency(calculatorResult.agentCostAmount, businessForm.defaultCurrency || "EUR")}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <p className="mb-2 text-xs text-muted-foreground">Shipping</p>
              <p className="font-mono text-xl font-bold">{formatCurrency(calculatorResult.shippingAmount, businessForm.defaultCurrency || "EUR")}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <p className="mb-2 text-xs text-muted-foreground">VAT</p>
              <p className="font-mono text-xl font-bold">{formatCurrency(calculatorResult.vatAmount, businessForm.defaultCurrency || "EUR")}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <p className="mb-2 text-xs text-muted-foreground">Handling Fee</p>
              <p className="font-mono text-xl font-bold">{formatCurrency(calculatorResult.handlingFee, businessForm.defaultCurrency || "EUR")}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <p className="mb-2 text-xs text-muted-foreground">Payment Fee</p>
              <p className="font-mono text-xl font-bold">{formatCurrency(calculatorResult.paymentFee, businessForm.defaultCurrency || "EUR")}</p>
            </div>
          </div>

          <div className="rounded-xl bg-secondary/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Agent Cost % of Product Price</p>
              <p className="font-mono font-semibold">{calculatorResult.agentCostPercentage.toFixed(2)}%</p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm font-medium">Checkout Total</p>
              <p className="font-mono text-xl font-bold">{formatCurrency(calculatorResult.totalAmount, businessForm.defaultCurrency || "EUR")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
