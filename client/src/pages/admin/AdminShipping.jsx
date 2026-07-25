import React, { useEffect, useMemo, useState } from "react";

import { deleteShippingMethod, getCommerceSettings, upsertShippingMethod } from "@/api/commerce";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/currency";

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

  const loadSettings = async () => {
    const nextSettings = await getCommerceSettings();
    setSettings(nextSettings);
  };

  useEffect(() => {
    loadSettings().catch(() => {}).finally(() => setLoading(false));
  }, []);

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
          <p className="text-sm text-muted-foreground">Configure Portugal, Spain, and Iran shipping routes with weight ranges and delivery estimates.</p>
        </div>
        <Button className="rounded-full" onClick={() => { setForm(EMPTY_FORM); setOpen(true); }}>
          Add Shipping Rule
        </Button>
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
                  Weight {row.minWeightKg ?? 0}kg - {row.maxWeightKg ?? "up"}kg · {formatCurrency(row.baseFee, row.currency)}
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
            <DialogTitle className="font-display">{form.id ? "Edit" : "Add"} Shipping Rule</DialogTitle>
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
              ["baseFee", "Shipping Cost"],
              ["freeShippingThreshold", "Free Shipping Threshold"],
              ["deliveryEstimate", "Delivery Estimate"],
            ].map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1" />
              </div>
            ))}
            <div className="md:col-span-2">
              <Button className="w-full rounded-full" onClick={saveShipping}>Save Shipping Rule</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
