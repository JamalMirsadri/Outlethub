import React, { useEffect, useState } from "react";

import { getCommerceSettings, listSources, upsertSource } from "@/api/commerce";
import { listConnectorImportHistory, previewConnectorImport, runConnectorImport, testConnector } from "@/api/connectors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

const EMPTY_SOURCE = {
  id: null,
  brandName: "",
  website: "",
  countryCode: "PT",
  currencyCode: "EUR",
  region: "EUROPE",
  sourceType: "PLAYWRIGHT",
  status: "ACTIVE",
  shippingMethodId: "none",
  notes: "",
};

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default function AdminSources() {
  const [sources, setSources] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_SOURCE);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadData = async () => {
    const [sourceRows, nextSettings] = await Promise.all([listSources(), getCommerceSettings()]);
    setSources(sourceRows);
    setSettings(nextSettings);
  };

  useEffect(() => {
    loadData().catch(() => {}).finally(() => setLoading(false));
  }, []);

  const saveSource = async () => {
    try {
      await upsertSource({
        id: form.id || undefined,
        brandName: form.brandName,
        website: form.website,
        countryCode: form.countryCode || null,
        currencyCode: form.currencyCode || null,
        region: form.region || null,
        sourceType: form.sourceType,
        status: form.status,
        shippingMethodId: form.shippingMethodId === "none" ? null : form.shippingMethodId,
        notes: form.notes || null,
      });
      await loadData();
      setOpen(false);
      setForm(EMPTY_SOURCE);
      toast({ title: "Source saved" });
    } catch (error) {
      toast({
        title: "Source save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const openEdit = (source) => {
    setForm({
      id: source.id,
      brandName: source.brandName,
      website: source.website,
      countryCode: source.countryCode || "PT",
      currencyCode: source.currencyCode || "EUR",
      region: source.region || "EUROPE",
      sourceType: source.sourceType,
      status: source.status,
      shippingMethodId: source.shippingMethodId || "none",
      notes: source.notes || "",
    });
    setOpen(true);
  };

  const updateSourceStatus = async (source, status) => {
    try {
      await upsertSource({
        id: source.id,
        brandName: source.brandName,
        website: source.website,
        countryCode: source.countryCode,
        currencyCode: source.currencyCode,
        region: source.region,
        sourceType: source.sourceType,
        status,
        shippingMethodId: source.shippingMethodId,
        notes: source.notes,
      });
      await loadData();
      toast({ title: `Source ${status === "DISABLED" ? "disabled" : "enabled"}` });
    } catch (error) {
      toast({
        title: "Status update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const runAction = async (source, action) => {
    setBusyId(`${source.id}:${action}`);
    try {
      if (action === "test") {
        const result = await testConnector(source.id);
        toast({
          title: "Connector tested",
          description: `${result.productsFound} products found. Selectors ${result.selectorsWorking ? "passed" : "need review"}.`,
        });
      }

      if (action === "preview") {
        const result = await previewConnectorImport(source.id);
        setSelectedSource(source);
        setPreviewResult(result);
        setPreviewOpen(true);
      }

      if (action === "run") {
        const result = await runConnectorImport(source.id);
        toast({
          title: "Import queued",
          description: `Run ${result.runId} was queued for ${source.brandName}.`,
        });
      }

      if (action === "history") {
        const result = await listConnectorImportHistory(source.id);
        setSelectedSource(source);
        setHistoryItems(result);
        setHistoryOpen(true);
      }

      await loadData();
    } catch (error) {
      toast({
        title: "Connector action failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (loading || !settings) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 bg-secondary rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Universal Source Management</h1>
          <p className="text-sm text-muted-foreground">Add brands, enable or disable them, test connectors, run imports, and review import history without code changes.</p>
        </div>
        <Button className="rounded-full" onClick={() => { setForm(EMPTY_SOURCE); setOpen(true); }}>
          Add Brand
        </Button>
      </div>

      <div className="grid gap-4">
        {sources.map((source) => (
          <div key={source.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">{source.brandName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {source.countryCode || "No country"} · {source.currencyCode || "No currency"} · {source.region || "No region"} · {source.sourceType}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{source.website}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Status {source.status} · Shipping {source.shippingMethod?.name || "Unassigned"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => openEdit(source)}>Edit</Button>
                  <Button variant="outline" disabled={busyId === `${source.id}:test`} onClick={() => runAction(source, "test")}>Test Connection</Button>
                  <Button variant="outline" disabled={busyId === `${source.id}:preview`} onClick={() => runAction(source, "preview")}>Import Preview</Button>
                  <Button variant="outline" disabled={busyId === `${source.id}:run`} onClick={() => runAction(source, "run")}>Run Import</Button>
                  <Button variant="outline" disabled={busyId === `${source.id}:history`} onClick={() => runAction(source, "history")}>View History</Button>
                  <Button
                    variant={source.status === "DISABLED" ? "default" : "secondary"}
                    onClick={() => updateSourceStatus(source, source.status === "DISABLED" ? "ACTIVE" : "DISABLED")}
                  >
                    {source.status === "DISABLED" ? "Enable" : "Disable"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{form.id ? "Edit" : "Add"} Brand Source</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Brand Name</Label>
              <Input value={form.brandName} onChange={(event) => setForm((current) => ({ ...current, brandName: event.target.value }))} className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Website</Label>
              <Input value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Country</Label>
              <Select value={form.countryCode} onValueChange={(value) => setForm((current) => ({ ...current, countryCode: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {settings.countries.map((country) => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Select value={form.currencyCode} onValueChange={(value) => setForm((current) => ({ ...current, currencyCode: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {settings.currencies.map((currency) => <SelectItem key={currency.code} value={currency.code}>{currency.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Region</Label>
              <Input value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Source Type</Label>
              <Select value={form.sourceType} onValueChange={(value) => setForm((current) => ({ ...current, sourceType: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["PLAYWRIGHT", "JSON_FEED", "XML_FEED", "MANUAL_IMPORT"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Shipping Method</Label>
              <Select value={form.shippingMethodId} onValueChange={(value) => setForm((current) => ({ ...current, shippingMethodId: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {settings.shippingMethods.map((method) => <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ACTIVE", "DISABLED", "ERROR"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Button className="w-full rounded-full" onClick={saveSource}>Save Source</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Import Preview {selectedSource ? `· ${selectedSource.brandName}` : ""}</DialogTitle>
          </DialogHeader>
          {previewResult ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm">
                Product Count: {previewResult.productCount} · Parsed Fields: {previewResult.parsedFields.join(", ") || "None"}
              </div>
              <div className="space-y-3">
                {previewResult.sampleProducts.map((product) => (
                  <div key={product.contentHash} className="rounded-xl border border-border p-4">
                    <p className="font-medium">{product.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {product.brand} · {product.category} · {product.currency} {product.price}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{product.sourceUrl || "No source URL"}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Import History {selectedSource ? `· ${selectedSource.brandName}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {historyItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No import history yet.
              </div>
            ) : historyItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">{item.status}</span>
                  <span>Found {item.productsFound}</span>
                  <span>Imported {item.productsImported}</span>
                  <span>Updated {item.productsUpdated}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Started {formatDateTime(item.startedAt)} · Completed {formatDateTime(item.completedAt)}
                </p>
                {item.errorMessage ? <p className="mt-2 text-xs text-red-400">{item.errorMessage}</p> : null}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
