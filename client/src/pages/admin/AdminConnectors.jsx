import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  getConnectorDetail,
  getConnectorsDashboard,
  listConnectorTemplates,
  previewConnectorImport,
  runConnectorImport,
  testConnector,
  updateConnectorDetail,
} from "@/api/connectors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

const EMPTY_FORM = {
  templateKey: "",
  syncFrequency: "DAILY",
  isEnabled: true,
  headless: true,
  feedUrl: "",
  recordPath: "",
  listingUrl: "",
  productCardSelector: "",
  productNameSelector: "",
  productPriceSelector: "",
  productOldPriceSelector: "",
  productImageSelector: "",
  productUrlSelector: "",
  paginationSelector: "",
  nextPageSelector: "",
  pageLimit: "1",
  sampleSize: "6",
  maxRequestsPerMinute: "60",
  maxConcurrentPages: "2",
};

function buildForm(detail) {
  return {
    templateKey: detail.template.key,
    syncFrequency: detail.scraperSource?.syncFrequency || "DAILY",
    isEnabled: detail.isEnabled,
    headless: detail.executionProfile?.headless ?? true,
    feedUrl: detail.feedUrl || "",
    recordPath: detail.recordPath || "",
    listingUrl: detail.executionProfile?.listingUrl || "",
    productCardSelector: detail.executionProfile?.productCardSelector || "",
    productNameSelector: detail.executionProfile?.productNameSelector || "",
    productPriceSelector: detail.executionProfile?.productPriceSelector || "",
    productOldPriceSelector: detail.executionProfile?.productOldPriceSelector || "",
    productImageSelector: detail.executionProfile?.productImageSelector || "",
    productUrlSelector: detail.executionProfile?.productUrlSelector || "",
    paginationSelector: detail.executionProfile?.paginationSelector || "",
    nextPageSelector: detail.executionProfile?.nextPageSelector || "",
    pageLimit: String(detail.executionProfile?.pageLimit ?? 1),
    sampleSize: String(detail.executionProfile?.sampleSize ?? 6),
    maxRequestsPerMinute: String(detail.executionProfile?.maxRequestsPerMinute ?? 60),
    maxConcurrentPages: String(detail.executionProfile?.maxConcurrentPages ?? 2),
  };
}

export default function AdminConnectors() {
  const [dashboard, setDashboard] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busyKey, setBusyKey] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = async () => {
    const [dashboardResponse, templateRows] = await Promise.all([
      getConnectorsDashboard(),
      listConnectorTemplates(),
    ]);
    setDashboard(dashboardResponse);
    setTemplates(templateRows);
  };

  useEffect(() => {
    load().catch(() => {}).finally(() => setLoading(false));
  }, []);

  const openConfigure = async (item) => {
    setBusyKey(`detail:${item.brandSourceId}`);
    try {
      const detail = await getConnectorDetail(item.brandSourceId);
      setEditing(detail);
      setForm(buildForm(detail));
      setDialogOpen(true);
    } catch (error) {
      toast({
        title: "Connector detail failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const saveConfiguration = async () => {
    if (!editing) {
      return;
    }

    setBusyKey(`save:${editing.brandSourceId}`);
    try {
      await updateConnectorDetail(editing.brandSourceId, {
        templateKey: form.templateKey,
        syncFrequency: form.syncFrequency,
        isEnabled: form.isEnabled,
        feedUrl: form.feedUrl || null,
        recordPath: form.recordPath || null,
        executionProfile: {
          listingUrl: form.listingUrl || null,
          headless: form.headless,
          productCardSelector: form.productCardSelector || null,
          productNameSelector: form.productNameSelector || null,
          productPriceSelector: form.productPriceSelector || null,
          productOldPriceSelector: form.productOldPriceSelector || null,
          productImageSelector: form.productImageSelector || null,
          productUrlSelector: form.productUrlSelector || null,
          paginationSelector: form.paginationSelector || null,
          nextPageSelector: form.nextPageSelector || null,
          pageLimit: Number(form.pageLimit),
          sampleSize: Number(form.sampleSize),
          maxRequestsPerMinute: Number(form.maxRequestsPerMinute),
          maxConcurrentPages: Number(form.maxConcurrentPages),
        },
      });
      setDialogOpen(false);
      await load();
      toast({ title: "Connector configuration saved" });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleAction = async (item, action) => {
    setBusyKey(`${action}:${item.brandSourceId}`);
    try {
      if (action === "test") {
        const result = await testConnector(item.brandSourceId);
        toast({
          title: "Connector tested",
          description: `${result.productsFound} products found for ${item.brandSource.brandName}.`,
        });
      }

      if (action === "preview") {
        const result = await previewConnectorImport(item.brandSourceId);
        setPreview({ item, result });
        setPreviewOpen(true);
      }

      if (action === "run") {
        const result = await runConnectorImport(item.brandSourceId);
        toast({
          title: "Connector run queued",
          description: `Run ${result.runId} queued for ${item.brandSource.brandName}.`,
        });
      }

      await load();
    } catch (error) {
      toast({
        title: "Connector action failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyKey(null);
    }
  };

  if (loading || !dashboard) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 rounded-xl bg-secondary animate-pulse" />)}</div>;
  }

  const statCards = [
    { label: "Dynamic Connectors", value: dashboard.summary.dynamicConnectorsCreated },
    { label: "Active Connectors", value: dashboard.summary.activeConnectors },
    { label: "Failed Connectors", value: dashboard.summary.failedConnectors },
    { label: "Products Imported", value: dashboard.summary.importedProducts },
    { label: "Products Updated", value: dashboard.summary.productsUpdated },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Connector Builder</h1>
        <p className="text-sm text-muted-foreground">Configure template-based dynamic connectors, validate selectors, preview imports, and push brands into the existing scraper and monitoring pipeline.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/admin/connectors/wizard">Open Wizard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/connectors/health">Open Health</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/connectors/diagnostics">Open Diagnostics</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-5">
            <p className="font-mono text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {dashboard.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold">{item.brandSource.brandName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.brandSource.sourceType} · {item.template.name} · {item.scraperSource?.syncFrequency || "MANUAL"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last Sync {item.latestSync?.completedAt ? new Date(item.latestSync.completedAt).toLocaleString() : "Never"} · Last Run {item.latestRun?.completedAt ? new Date(item.latestRun.completedAt).toLocaleString() : "Never"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Imported {item.latestRun?.productsImported ?? 0} · Updated {item.latestRun?.productsUpdated ?? 0} · Status {item.scraperSource?.status || "UNCONFIGURED"}
                </p>
                {item.health ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Health Score {item.health.healthScore} · Website {String(item.health.websiteReachable)} · Selectors {String(item.health.selectorsValid)}
                  </p>
                ) : null}
                {item.executionProfile ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Browser Mode {item.executionProfile.headless ? "Headless" : "Headful"} · Listing {item.executionProfile.listingUrl || item.brandSource.website}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={busyKey === `test:${item.brandSourceId}`} onClick={() => handleAction(item, "test")}>Test</Button>
                <Button variant="outline" disabled={busyKey === `preview:${item.brandSourceId}`} onClick={() => handleAction(item, "preview")}>Preview</Button>
                <Button variant="outline" disabled={busyKey === `run:${item.brandSourceId}`} onClick={() => handleAction(item, "run")}>Run Import</Button>
                <Button variant="outline" disabled={busyKey === `detail:${item.brandSourceId}`} onClick={() => openConfigure(item)}>Configure</Button>
                <Button asChild variant="outline">
                  <Link to={`/admin/connectors/diagnostics?brandSourceId=${item.brandSourceId}`}>Diagnostics</Link>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Configure Connector {editing ? `· ${editing.brandSource.brandName}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Template</Label>
              <Select value={form.templateKey} onValueChange={(value) => setForm((current) => ({ ...current, templateKey: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.map((template) => <SelectItem key={template.key} value={template.key}>{template.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sync Frequency</Label>
              <Select value={form.syncFrequency} onValueChange={(value) => setForm((current) => ({ ...current, syncFrequency: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["MANUAL", "HOURLY", "EVERY_6_HOURS", "DAILY", "WEEKLY"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Browser Mode</Label>
              <Select value={form.headless ? "HEADLESS" : "HEADFUL"} onValueChange={(value) => setForm((current) => ({ ...current, headless: value === "HEADLESS" }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HEADLESS">Headless</SelectItem>
                  <SelectItem value="HEADFUL">Headful</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Feed URL</Label>
              <Input value={form.feedUrl} onChange={(event) => setForm((current) => ({ ...current, feedUrl: event.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Record Path</Label>
              <Input value={form.recordPath} onChange={(event) => setForm((current) => ({ ...current, recordPath: event.target.value }))} className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Listing URL</Label>
              <Input value={form.listingUrl} onChange={(event) => setForm((current) => ({ ...current, listingUrl: event.target.value }))} className="mt-1" />
            </div>
            {[
              ["productCardSelector", "Product Card Selector"],
              ["productNameSelector", "Product Name Selector"],
              ["productPriceSelector", "Product Price Selector"],
              ["productOldPriceSelector", "Product Old Price Selector"],
              ["productImageSelector", "Product Image Selector"],
              ["productUrlSelector", "Product URL Selector"],
              ["paginationSelector", "Pagination Selector"],
              ["nextPageSelector", "Next Page Selector"],
            ].map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Textarea rows={2} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1" />
              </div>
            ))}
            {[
              ["pageLimit", "Page Limit"],
              ["sampleSize", "Sample Size"],
              ["maxRequestsPerMinute", "Max Requests / Minute"],
              ["maxConcurrentPages", "Max Concurrent Pages"],
            ].map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input type="number" value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1" />
              </div>
            ))}
            <div className="md:col-span-2">
              <Button className="w-full rounded-full" disabled={busyKey === `save:${editing?.brandSourceId}`} onClick={saveConfiguration}>
                Save Connector Configuration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Connector Preview {preview ? `· ${preview.item.brandSource.brandName}` : ""}</DialogTitle>
          </DialogHeader>
          {preview ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm">
                Product Count: {preview.result.productCount} · Strategy: {preview.result.strategyUsed} · Parsed Fields: {preview.result.parsedFields.join(", ") || "None"}
                <div className="mt-2 text-xs text-muted-foreground">
                  HTTP {preview.result.diagnostics.httpStatus} · Protection {preview.result.diagnostics.protectionType} · Sitemap {preview.result.diagnostics.sitemapUrl || "None"}
                </div>
              </div>
              <div className="space-y-3">
                {preview.result.sampleProducts.map((product) => (
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
    </div>
  );
}
