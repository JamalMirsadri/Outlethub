import React, { useEffect, useState } from "react";

import { appClient } from "@/api/appClient";
import {
  createPricingRule,
  deletePricingRule,
  getCommerceSettings,
  previewProfit,
  updateBusinessSettings,
  updatePricingRule,
} from "@/api/commerce";
import { Calculator, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/currency";

const DEFAULT_RULE_FORM = {
  id: null,
  name: "",
  targetType: "GLOBAL",
  brandId: "all",
  categoryId: "all",
  countryCode: "all",
  currency: "EUR",
  marginPercent: "15",
  localShippingFee: "0",
  shippingFee: "0",
  handlingFee: "0",
  minimumProfitAmount: "0",
  taxPercent: "23",
  freeShippingThreshold: "120",
  minimumOrderValue: "0",
  isDefault: false,
  isActive: true,
  priority: "0",
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AdminPricing() {
  const [rules, setRules] = useState([]);
  const [countries, setCountries] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [businessForm, setBusinessForm] = useState({
    businessName: "",
    supportEmail: "",
    defaultCurrency: "EUR",
    defaultCountryCode: "PT",
    defaultMarginPercent: "15",
    minimumProfitAmount: "0",
    portugalShippingFee: "0",
    spainShippingFee: "0",
    iranShippingFee: "0",
    handlingFee: "0",
    vatPercent: "23",
    minimumOrderValue: "0",
    returnPeriodDays: "30",
  });
  const [ruleForm, setRuleForm] = useState(DEFAULT_RULE_FORM);
  const [calculator, setCalculator] = useState({
    supplierPrice: "100",
    marginPercent: "15",
    localShippingFee: "0",
    internationalShippingFee: "0",
    handlingFee: "0",
    minimumProfitAmount: "0",
    vatPercent: "23",
  });
  const [calculatorResult, setCalculatorResult] = useState({
    customerPrice: 0,
    profitAmount: 0,
    profitPercentage: 0,
  });

  const loadSettings = async () => {
    const [settings, brandRows, categoryRows] = await Promise.all([
      getCommerceSettings(),
      appClient.entities.Brand.list("-created_date", 100),
      appClient.entities.Category.list("-created_date", 100),
    ]);

    setRules(settings.pricingRules);
    setCountries(settings.countries);
    setCurrencies(settings.currencies);
    setBrands(Array.isArray(brandRows) ? brandRows : []);
    setCategories(Array.isArray(categoryRows) ? categoryRows : []);

    setBusinessForm({
      businessName: settings.businessSettings.businessName || "",
      supportEmail: settings.businessSettings.supportEmail || "",
      defaultCurrency: settings.businessSettings.defaultCurrency || "EUR",
      defaultCountryCode: settings.businessSettings.defaultCountryCode || "PT",
      defaultMarginPercent: String(settings.businessSettings.defaultMarginPercent ?? 0),
      minimumProfitAmount: String(settings.businessSettings.minimumProfitAmount ?? 0),
      portugalShippingFee: String(settings.businessSettings.portugalShippingFee ?? 0),
      spainShippingFee: String(settings.businessSettings.spainShippingFee ?? 0),
      iranShippingFee: String(settings.businessSettings.iranShippingFee ?? 0),
      handlingFee: String(settings.businessSettings.handlingFee ?? 0),
      vatPercent: String(settings.businessSettings.vatPercent ?? 0),
      minimumOrderValue: String(settings.businessSettings.minimumOrderValue ?? 0),
      returnPeriodDays: String(settings.businessSettings.returnPeriodDays ?? 30),
    });

    setCalculator({
      supplierPrice: "100",
      marginPercent: String(settings.businessSettings.defaultMarginPercent ?? 15),
      localShippingFee: String(settings.businessSettings.portugalShippingFee ?? 0),
      internationalShippingFee: String(settings.businessSettings.iranShippingFee ?? 0),
      handlingFee: String(settings.businessSettings.handlingFee ?? 0),
      minimumProfitAmount: String(settings.businessSettings.minimumProfitAmount ?? 0),
      vatPercent: String(settings.businessSettings.vatPercent ?? 23),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await previewProfit({
          supplierPrice: toNumber(calculator.supplierPrice),
          marginPercent: toNumber(calculator.marginPercent),
          localShippingFee: toNumber(calculator.localShippingFee),
          internationalShippingFee: toNumber(calculator.internationalShippingFee),
          handlingFee: toNumber(calculator.handlingFee),
          minimumProfitAmount: toNumber(calculator.minimumProfitAmount),
          vatPercent: toNumber(calculator.vatPercent),
        });
        setCalculatorResult(result);
      } catch {
        setCalculatorResult({
          customerPrice: 0,
          profitAmount: 0,
          profitPercentage: 0,
        });
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [calculator]);

  const saveBusinessSettings = async () => {
    setSavingBusiness(true);

    try {
      await updateBusinessSettings({
        businessName: businessForm.businessName,
        supportEmail: businessForm.supportEmail,
        defaultCurrency: businessForm.defaultCurrency,
        defaultCountryCode: businessForm.defaultCountryCode,
        defaultMarginPercent: toNumber(businessForm.defaultMarginPercent),
        minimumProfitAmount: toNumber(businessForm.minimumProfitAmount),
        portugalShippingFee: toNumber(businessForm.portugalShippingFee),
        spainShippingFee: toNumber(businessForm.spainShippingFee),
        iranShippingFee: toNumber(businessForm.iranShippingFee),
        handlingFee: toNumber(businessForm.handlingFee),
        vatPercent: toNumber(businessForm.vatPercent),
        minimumOrderValue: toNumber(businessForm.minimumOrderValue),
        returnPeriodDays: toNumber(businessForm.returnPeriodDays, 30),
      });
      await loadSettings();
      toast({
        title: "Business settings saved",
        description: "Margin, shipping, handling, VAT, and minimum profit defaults were updated.",
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

  const openCreateRule = () => {
    setRuleForm(DEFAULT_RULE_FORM);
    setDialogOpen(true);
  };

  const openEditRule = (rule) => {
    setRuleForm({
      id: rule.id,
      name: rule.name || "",
      targetType: rule.targetType || "GLOBAL",
      brandId: rule.brandId || "all",
      categoryId: rule.categoryId || "all",
      countryCode: rule.countryCode || "all",
      currency: rule.currency || "EUR",
      marginPercent: String(rule.marginPercent ?? 0),
      localShippingFee: String(rule.localShippingFee ?? 0),
      shippingFee: String(rule.shippingFee ?? 0),
      handlingFee: String(rule.handlingFee ?? 0),
      minimumProfitAmount: String(rule.minimumProfitAmount ?? 0),
      taxPercent: String(rule.taxPercent ?? 0),
      freeShippingThreshold: String(rule.freeShippingThreshold ?? 0),
      minimumOrderValue: String(rule.minimumOrderValue ?? 0),
      isDefault: Boolean(rule.isDefault),
      isActive: Boolean(rule.isActive),
      priority: String(rule.priority ?? 0),
    });
    setDialogOpen(true);
  };

  const saveRule = async () => {
    setSavingRule(true);

    const payload = {
      name: ruleForm.name,
      targetType: ruleForm.targetType,
      brandId: ruleForm.brandId === "all" ? undefined : ruleForm.brandId,
      categoryId: ruleForm.categoryId === "all" ? undefined : ruleForm.categoryId,
      countryCode: ruleForm.countryCode === "all" ? undefined : ruleForm.countryCode,
      currency: ruleForm.currency || "EUR",
      marginPercent: toNullableNumber(ruleForm.marginPercent),
      localShippingFee: toNullableNumber(ruleForm.localShippingFee),
      shippingFee: toNullableNumber(ruleForm.shippingFee),
      handlingFee: toNullableNumber(ruleForm.handlingFee),
      minimumProfitAmount: toNullableNumber(ruleForm.minimumProfitAmount),
      taxPercent: toNullableNumber(ruleForm.taxPercent),
      freeShippingThreshold: toNullableNumber(ruleForm.freeShippingThreshold),
      minimumOrderValue: toNullableNumber(ruleForm.minimumOrderValue),
      isDefault: ruleForm.isDefault,
      isActive: ruleForm.isActive,
      priority: toNumber(ruleForm.priority),
    };

    try {
      if (ruleForm.id) {
        await updatePricingRule(ruleForm.id, payload);
      } else {
        await createPricingRule(payload);
      }

      await loadSettings();
      setDialogOpen(false);
      setRuleForm(DEFAULT_RULE_FORM);
      toast({ title: ruleForm.id ? "Pricing rule updated" : "Pricing rule created" });
    } catch (error) {
      toast({
        title: "Rule save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingRule(false);
    }
  };

  const removeRule = async (id) => {
    try {
      await deletePricingRule(id);
      await loadSettings();
      toast({ title: "Pricing rule deleted" });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleRule = async (rule) => {
    try {
      await updatePricingRule(rule.id, { isActive: !rule.isActive });
      await loadSettings();
    } catch (error) {
      toast({
        title: "Rule update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 rounded-xl bg-secondary animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Pricing Engine</h1>
          <p className="text-sm text-muted-foreground">Configure margin, PT/ES/IR shipping defaults, minimum profit, VAT, and reusable pricing rules.</p>
        </div>
        <Button onClick={openCreateRule} className="rounded-full">
          <Plus className="mr-1 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold">Pricing Formula</h3>
        <div className="rounded-xl bg-secondary/50 p-4 font-mono text-sm lg:text-base">
          Final Customer Price = Supplier Price + Margin + Local Shipping + International Shipping + Handling Fee + VAT
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Global Business Settings</h3>
              <p className="mt-1 text-sm text-muted-foreground">All pricing variables stay admin-configurable with no hardcoded shipping or margin values.</p>
            </div>
            <Button onClick={saveBusinessSettings} disabled={savingBusiness} className="rounded-full">
              {savingBusiness ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Business Name</Label>
              <Input value={businessForm.businessName} onChange={(event) => setBusinessForm({ ...businessForm, businessName: event.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Support Email</Label>
              <Input value={businessForm.supportEmail} onChange={(event) => setBusinessForm({ ...businessForm, supportEmail: event.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Default Currency</Label>
              <Select value={businessForm.defaultCurrency} onValueChange={(value) => setBusinessForm({ ...businessForm, defaultCurrency: value })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => <SelectItem key={currency.code} value={currency.code}>{currency.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Default Country</Label>
              <Select value={businessForm.defaultCountryCode} onValueChange={(value) => setBusinessForm({ ...businessForm, defaultCountryCode: value })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {countries.map((country) => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {[
              ["defaultMarginPercent", "My Margin %"],
              ["minimumProfitAmount", "Minimum Profit"],
              ["portugalShippingFee", "Portugal Shipping"],
              ["spainShippingFee", "Spain Shipping"],
              ["iranShippingFee", "Iran Shipping"],
              ["handlingFee", "Handling Fee"],
              ["vatPercent", "VAT %"],
              ["minimumOrderValue", "Minimum Order Value"],
              ["returnPeriodDays", "Return Period Days"],
            ].map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input type="number" value={businessForm[key]} onChange={(event) => setBusinessForm({ ...businessForm, [key]: event.target.value })} className="mt-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <h3 className="font-semibold">Live Price Calculator</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["supplierPrice", "Supplier Price"],
              ["marginPercent", "Margin %"],
              ["localShippingFee", "Local Shipping"],
              ["internationalShippingFee", "International Shipping"],
              ["handlingFee", "Handling Fee"],
              ["minimumProfitAmount", "Minimum Profit"],
              ["vatPercent", "VAT %"],
            ].map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input type="number" value={calculator[key]} onChange={(event) => setCalculator({ ...calculator, [key]: event.target.value })} className="mt-1" />
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-secondary/50 p-4">
              <p className="mb-2 text-xs text-muted-foreground">Final Customer Price</p>
              <p className="font-mono text-xl font-bold">{formatCurrency(calculatorResult.customerPrice, businessForm.defaultCurrency || "EUR")}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <p className="mb-2 text-xs text-muted-foreground">Profit Amount</p>
              <p className="font-mono text-xl font-bold">{formatCurrency(calculatorResult.profitAmount, businessForm.defaultCurrency || "EUR")}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <p className="mb-2 text-xs text-muted-foreground">Profit %</p>
              <p className="font-mono text-xl font-bold">{calculatorResult.profitPercentage.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className={`rounded-xl border border-border bg-card p-5 transition-opacity ${!rule.isActive ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold">{rule.name}</h3>
                <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Target: {rule.targetType}</span>
                  <span>Currency: {rule.currency}</span>
                  <span>Country: {rule.country?.name || rule.countryCode || "All"}</span>
                  {rule.brand ? <span>Brand: {rule.brand.name}</span> : null}
                  {rule.category ? <span>Category: {rule.category.name}</span> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Margin {Number(rule.marginPercent ?? 0).toFixed(2)}%</span>
                  <span>Local {formatCurrency(Number(rule.localShippingFee ?? 0), rule.currency)}</span>
                  <span>International {formatCurrency(Number(rule.shippingFee ?? 0), rule.currency)}</span>
                  <span>Handling {formatCurrency(Number(rule.handlingFee ?? 0), rule.currency)}</span>
                  <span>Min Profit {formatCurrency(Number(rule.minimumProfitAmount ?? 0), rule.currency)}</span>
                  <span>VAT {Number(rule.taxPercent ?? 0).toFixed(2)}%</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Switch checked={rule.isActive} onCheckedChange={() => toggleRule(rule)} />
                <Button variant="outline" onClick={() => openEditRule(rule)}>Edit</Button>
                <Button variant="ghost" size="icon" onClick={() => removeRule(rule.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{ruleForm.id ? "Edit" : "Add"} Pricing Rule</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="text-xs">Rule Name</Label>
              <Input value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Target Type</Label>
              <Select value={ruleForm.targetType} onValueChange={(value) => setRuleForm({ ...ruleForm, targetType: value })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GLOBAL">Global</SelectItem>
                  <SelectItem value="BRAND">Brand</SelectItem>
                  <SelectItem value="CATEGORY">Category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Country</Label>
              <Select value={ruleForm.countryCode} onValueChange={(value) => setRuleForm({ ...ruleForm, countryCode: value })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries.map((country) => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Brand</Label>
              <Select value={ruleForm.brandId} onValueChange={(value) => setRuleForm({ ...ruleForm, brandId: value })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands.map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={ruleForm.categoryId} onValueChange={(value) => setRuleForm({ ...ruleForm, categoryId: value })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {[
              ["currency", "Currency"],
              ["marginPercent", "Margin %"],
              ["localShippingFee", "Local Shipping"],
              ["shippingFee", "International Shipping"],
              ["handlingFee", "Handling Fee"],
              ["minimumProfitAmount", "Minimum Profit"],
              ["taxPercent", "VAT %"],
              ["freeShippingThreshold", "Free Shipping Threshold"],
              ["minimumOrderValue", "Minimum Order Value"],
              ["priority", "Priority"],
            ].map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input value={ruleForm[key]} onChange={(event) => setRuleForm({ ...ruleForm, [key]: event.target.value })} className="mt-1" />
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Default Rule</p>
                <p className="text-xs text-muted-foreground">Use when no more specific rule applies.</p>
              </div>
              <Switch checked={ruleForm.isDefault} onCheckedChange={(checked) => setRuleForm({ ...ruleForm, isDefault: checked })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Keep the rule stored while disabling repricing when needed.</p>
              </div>
              <Switch checked={ruleForm.isActive} onCheckedChange={(checked) => setRuleForm({ ...ruleForm, isActive: checked })} />
            </div>
            <div className="md:col-span-2">
              <Button onClick={saveRule} disabled={savingRule} className="w-full rounded-full">
                {savingRule ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {ruleForm.id ? "Update Rule" : "Create Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

