import React, { useEffect, useMemo, useState } from "react";

import { deleteShippingMethod, getAgentCostSettings, getCommerceSettings, getShippingSettings, updateAgentCostSettings, updateShippingSettings, upsertShippingMethod } from "@/api/commerce";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

const EMPTY_FORM = {
  id: null,
  name: "",
  originCountryCode: "PT",
  countryCode: "IR",
  currency: "EUR",
  minWeightKg: "0",
  maxWeightKg: "1",
  minDeliveryDays: "5",
  maxDeliveryDays: "12",
  baseFee: "25",
  freeShippingThreshold: "",
  deliveryEstimate: "Standard international shipping",
  isActive: true,
};

export default function AdminShipping() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [shippingConfig, setShippingConfig] = useState(null);
  const [shippingForm, setShippingForm] = useState({
    first: "",
    second: "",
    third: "",
    fourth: "",
    fifth: "",
    additional: "",
    threshold: "",
  });
  const [agentCostConfig, setAgentCostConfig] = useState(null);
  const [agentCostForm, setAgentCostForm] = useState({
    first: "",
    second: "",
    third: "",
    fourth: "",
    fifth: "",
    sixth: "",
    additional: "",
    threshold: "",
  });

  const loadSettings = async () => {
    const nextSettings = await getCommerceSettings();
    setSettings(nextSettings);
  };

  const loadShippingConfig = async () => {
    const config = await getShippingSettings();
    setShippingConfig(config);
    setShippingForm({
      first: config.firstProductFee,
      second: config.secondProductFee,
      third: config.thirdProductFee,
      fourth: config.fourthProductFee,
      fifth: config.fifthProductFee,
      additional: config.additionalProductFee,
      threshold: String(config.threshold),
    });
  };

  const loadAgentCostConfig = async () => {
    const config = await getAgentCostSettings();
    setAgentCostConfig(config);
    setAgentCostForm({
      first: config.firstProductFee,
      second: config.secondProductFee,
      third: config.thirdProductFee,
      fourth: config.fourthProductFee,
      fifth: config.fifthProductFee,
      sixth: config.sixthProductFee,
      additional: config.additionalProductFee,
      threshold: String(config.threshold),
    });
  };

  useEffect(() => {
    loadSettings().catch(() => {}).finally(() => setLoading(false));
    loadShippingConfig().catch(() => {});
    loadAgentCostConfig().catch(() => {});
  }, []);

  const saveShippingConfig = async () => {
    if (!window.confirm("Save quantity shipping rules? This affects future orders only.")) return;
    try {
      await updateShippingSettings({
        firstProductFee: shippingForm.first,
        secondProductFee: shippingForm.second,
        thirdProductFee: shippingForm.third,
        fourthProductFee: shippingForm.fourth,
        fifthProductFee: shippingForm.fifth,
        additionalProductFee: shippingForm.additional,
        threshold: Number(shippingForm.threshold),
      });
      await loadShippingConfig();
      toast({ title: "Shipping rules saved" });
    } catch (error) {
      toast({
        title: "Shipping rules save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const saveAgentCostConfig = async () => {
    if (!window.confirm("Save agent cost rules? This affects future orders only.")) return;
    try {
      await updateAgentCostSettings({
        firstProductFee: agentCostForm.first,
        secondProductFee: agentCostForm.second,
        thirdProductFee: agentCostForm.third,
        fourthProductFee: agentCostForm.fourth,
        fifthProductFee: agentCostForm.fifth,
        sixthProductFee: agentCostForm.sixth,
        additionalProductFee: agentCostForm.additional,
        threshold: Number(agentCostForm.threshold),
      });
      await loadAgentCostConfig();
      toast({ title: "Agent cost rules saved" });
    } catch (error) {
      toast({
        title: "Agent cost rules save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const shippingRows = useMemo(() => settings?.shippingMethods ?? [], [settings]);

  const saveShipping = async () => {
    try {
      await upsertShippingMethod({
        id: form.id || undefined,
        name: form.name,
        originCountryCode: form.originCountryCode || null,
        countryCode: form.countryCode,
        currency: form.currency,
        minWeightKg: form.minWeightKg === "" ? null : Number(form.minWeightKg),
        maxWeightKg: form.maxWeightKg === "" ? null : Number(form.maxWeightKg),
        minDeliveryDays: Number(form.minDeliveryDays),
        maxDeliveryDays: Number(form.maxDeliveryDays),
        baseFee: Number(form.baseFee),
        freeShippingThreshold: form.freeShippingThreshold === "" ? null : Number(form.freeShippingThreshold),
        deliveryEstimate: form.deliveryEstimate || null,
        isActive: form.isActive,
      });
      await loadSettings();
      setOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Shipping rule saved" });
    } catch (error) {
      toast({
        title: "Shipping save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeShipping = async (id) => {
    try {
      await deleteShippingMethod(id);
      await loadSettings();
      toast({ title: "Shipping rule deleted" });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const openEdit = (row) => {
    setForm({
      id: row.id,
      name: row.name,
      originCountryCode: row.originCountryCode || "",
      countryCode: row.countryCode,
      currency: row.currency,
      minWeightKg: row.minWeightKg?.toString() ?? "",
      maxWeightKg: row.maxWeightKg?.toString() ?? "",
      minDeliveryDays: row.minDeliveryDays.toString(),
      maxDeliveryDays: row.maxDeliveryDays.toString(),
      baseFee: row.baseFee.toString(),
      freeShippingThreshold: row.freeShippingThreshold?.toString() ?? "",
      deliveryEstimate: row.deliveryEstimate || "",
      isActive: row.isActive,
    });
    setOpen(true);
  };

  if (loading || !settings) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 bg-secondary rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Shipping Engine</h1>
          <p className="text-sm text-muted-foreground">Configure shipping routes, supported weight ranges, and delivery estimates. Checkout shipping charges come from Global Business Settings.</p>
        </div>
        <Button className="rounded-full" onClick={() => { setForm(EMPTY_FORM); setOpen(true); }}>
          Add Shipping Method
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Quantity Shipping Rules</h2>
            {shippingConfig ? (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated {new Date(shippingConfig.updatedAt).toLocaleString()}
                {shippingConfig.updatedByEmail ? ` · by ${shippingConfig.updatedByEmail}` : ""}
              </p>
            ) : null}
          </div>
          <Button onClick={() => void saveShippingConfig()}>Save Rules</Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FeeField label="Product 1" value={shippingForm.first} onChange={(value) => setShippingForm((current) => ({ ...current, first: value }))} />
          <FeeField label="Product 2" value={shippingForm.second} onChange={(value) => setShippingForm((current) => ({ ...current, second: value }))} />
          <FeeField label="Product 3" value={shippingForm.third} onChange={(value) => setShippingForm((current) => ({ ...current, third: value }))} />
          <FeeField label="Product 4" value={shippingForm.fourth} onChange={(value) => setShippingForm((current) => ({ ...current, fourth: value }))} />
          <FeeField label="Product 5" value={shippingForm.fifth} onChange={(value) => setShippingForm((current) => ({ ...current, fifth: value }))} />
          <FeeField label="Additional Product Fee" value={shippingForm.additional} onChange={(value) => setShippingForm((current) => ({ ...current, additional: value }))} />
          <div>
            <Label className="text-xs">Threshold</Label>
            <Input type="number" min={1} max={5} value={shippingForm.threshold} onChange={(event) => setShippingForm((current) => ({ ...current, threshold: event.target.value }))} className="mt-1" />
          </div>
        </div>

        {shippingConfig?.preview?.length ? (
          <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {shippingConfig.preview.map((item) => (
                <div key={item.quantity} className="rounded-lg bg-card px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{item.quantity} product{item.quantity === 1 ? "" : "s"}</span>
                  <p className="font-medium">€{item.amount}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Agent Cost Rules</h2>
            {agentCostConfig ? (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated {new Date(agentCostConfig.updatedAt).toLocaleString()}
                {agentCostConfig.updatedByEmail ? ` · by ${agentCostConfig.updatedByEmail}` : ""}
              </p>
            ) : null}
          </div>
          <Button onClick={() => void saveAgentCostConfig()}>Save Rules</Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FeeField label="Product 1" value={agentCostForm.first} onChange={(value) => setAgentCostForm((current) => ({ ...current, first: value }))} />
          <FeeField label="Product 2" value={agentCostForm.second} onChange={(value) => setAgentCostForm((current) => ({ ...current, second: value }))} />
          <FeeField label="Product 3" value={agentCostForm.third} onChange={(value) => setAgentCostForm((current) => ({ ...current, third: value }))} />
          <FeeField label="Product 4" value={agentCostForm.fourth} onChange={(value) => setAgentCostForm((current) => ({ ...current, fourth: value }))} />
          <FeeField label="Product 5" value={agentCostForm.fifth} onChange={(value) => setAgentCostForm((current) => ({ ...current, fifth: value }))} />
          <FeeField label="Product 6" value={agentCostForm.sixth} onChange={(value) => setAgentCostForm((current) => ({ ...current, sixth: value }))} />
          <FeeField label="Additional Product Fee" value={agentCostForm.additional} onChange={(value) => setAgentCostForm((current) => ({ ...current, additional: value }))} />
          <div>
            <Label className="text-xs">Threshold</Label>
            <Input type="number" min={1} max={6} value={agentCostForm.threshold} onChange={(event) => setAgentCostForm((current) => ({ ...current, threshold: event.target.value }))} className="mt-1" />
          </div>
        </div>

        {agentCostConfig?.preview?.length ? (
          <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {agentCostConfig.preview.map((item) => (
                <div key={item.quantity} className="rounded-lg bg-card px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{item.quantity} product{item.quantity === 1 ? "" : "s"}</span>
                  <p className="font-medium">€{item.amount}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4">
        {shippingRows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold">{row.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {row.originCountryCode ? `${row.originCountryCode} -> ` : ""}
                  {row.countryCode} · {row.deliveryEstimate || `${row.minDeliveryDays}-${row.maxDeliveryDays} days`}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Weight {row.minWeightKg ?? 0}kg - {row.maxWeightKg ?? "up"}kg
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => openEdit(row)}>Edit</Button>
                <Button variant="destructive" onClick={() => removeShipping(row.id)}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{form.id ? "Edit" : "Add"} Shipping Method</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="text-xs">Rule Name</Label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Origin Country</Label>
              <Select value={form.originCountryCode || "none"} onValueChange={(value) => setForm((current) => ({ ...current, originCountryCode: value === "none" ? "" : value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No fixed origin</SelectItem>
                  {settings.countries.map((country) => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Destination Country</Label>
              <Select value={form.countryCode} onValueChange={(value) => setForm((current) => ({ ...current, countryCode: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {settings.countries.map((country) => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {[
              ["currency", "Currency"],
              ["minWeightKg", "Min Weight Kg"],
              ["maxWeightKg", "Max Weight Kg"],
              ["minDeliveryDays", "Min Delivery Days"],
              ["maxDeliveryDays", "Max Delivery Days"],
              ["deliveryEstimate", "Delivery Estimate"],
            ].map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1" />
              </div>
            ))}
            <div className="md:col-span-2 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
              Shipping charge and free shipping threshold are managed only from Global Business Settings in Admin Pricing.
            </div>
            <div className="md:col-span-2">
              <Button className="w-full rounded-full" onClick={saveShipping}>Save Shipping Method</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeeField({ label, value, onChange }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} step={0.01} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1" />
    </div>
  );
}
