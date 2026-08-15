import React, { useMemo, useState } from "react";

import { upsertSource, getCommerceSettings } from "@/api/commerce";
import { analyzeConnectorWebsite, runConnectorImport, testConnector, updateConnectorDetail } from "@/api/connectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

const STEPS = [
  "Enter Website",
  "Analyze Website",
  "Preview Products",
  "Confirm Selectors",
  "Create Connector",
  "Test Import",
];

const EMPTY_WIZARD = {
  websiteUrl: "",
  brandName: "",
  countryCode: "PT",
  currencyCode: "EUR",
  region: "EUROPE",
  shippingMethodId: "none",
  notes: "",
};

export default function AdminConnectorWizard() {
  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState(EMPTY_WIZARD);
  const [settings, setSettings] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectors, setSelectors] = useState({
    listingUrl: "",
    productCardSelector: "",
    productNameSelector: "",
    productPriceSelector: "",
    productOldPriceSelector: "",
    productImageSelector: "",
    productUrlSelector: "",
    paginationSelector: "",
    nextPageSelector: "",
  });
  const [createdConnector, setCreatedConnector] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const stepLabel = useMemo(() => STEPS[step - 1], [step]);

  const ensureSettings = async () => {
    if (settings) {
      return settings;
    }

    const value = await getCommerceSettings();
    setSettings(value);
    return value;
  };

  const analyze = async () => {
    setBusy(true);
    try {
      await ensureSettings();
      const result = await analyzeConnectorWebsite({
        websiteUrl: wizard.websiteUrl,
        brandName: wizard.brandName || null,
        currencyCode: wizard.currencyCode || null,
      });
      setAnalysis(result);
      setSelectors({
        listingUrl: result.analyzedUrl,
        productCardSelector: result.selectors.productCardSelector || "",
        productNameSelector: result.selectors.productNameSelector || "",
        productPriceSelector: result.selectors.productPriceSelector || "",
        productOldPriceSelector: result.selectors.productOldPriceSelector || "",
        productImageSelector: result.selectors.productImageSelector || "",
        productUrlSelector: result.selectors.productUrlSelector || "",
        paginationSelector: result.selectors.paginationSelector || "",
        nextPageSelector: result.selectors.nextPageSelector || "",
      });
      setStep(2);
      toast({ title: "Website analyzed", description: `${result.productsFound} products detected.` });
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const createConnector = async () => {
    setBusy(true);
    try {
      const source = await upsertSource({
        brandName: wizard.brandName || new URL(wizard.websiteUrl).hostname.replace(/^www\./, "").split(".")[0],
        website: wizard.websiteUrl,
        countryCode: wizard.countryCode || null,
        currencyCode: wizard.currencyCode || null,
        region: wizard.region || null,
        sourceType: "PLAYWRIGHT",
        status: "ACTIVE",
        shippingMethodId: wizard.shippingMethodId === "none" ? null : wizard.shippingMethodId,
        notes: wizard.notes || null,
      });

      const connector = await updateConnectorDetail(source.id, {
        isEnabled: true,
        executionProfile: {
          listingUrl: selectors.listingUrl || wizard.websiteUrl,
          productCardSelector: selectors.productCardSelector || null,
          productNameSelector: selectors.productNameSelector || null,
          productPriceSelector: selectors.productPriceSelector || null,
          productOldPriceSelector: selectors.productOldPriceSelector || null,
          productImageSelector: selectors.productImageSelector || null,
          productUrlSelector: selectors.productUrlSelector || null,
          paginationSelector: selectors.paginationSelector || null,
          nextPageSelector: selectors.nextPageSelector || null,
          sampleSize: 10,
          pageLimit: 1,
          maxRequestsPerMinute: 60,
          maxConcurrentPages: 2,
        },
      });

      setCreatedConnector(connector);
      setStep(5);
      toast({ title: "Connector created", description: `${connector.brandSource.brandName} is now configured.` });
    } catch (error) {
      toast({
        title: "Connector creation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const testImport = async () => {
    if (!createdConnector) {
      return;
    }

    setBusy(true);
    try {
      const result = await testConnector(createdConnector.brandSourceId);
      setTestResult(result);
      setStep(6);
      toast({
        title: "Connector tested",
        description: `${result.productsFound} products found.`,
      });
    } catch (error) {
      toast({
        title: "Connector test failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!createdConnector) {
      return;
    }

    setBusy(true);
    try {
      const result = await runConnectorImport(createdConnector.brandSourceId);
      toast({
        title: "Import queued",
        description: `Run ${result.runId} queued for ${createdConnector.brandSource.brandName}.`,
      });
    } catch (error) {
      toast({
        title: "Run import failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Connector Wizard</h1>
        <p className="text-sm text-muted-foreground">Start from a storefront URL, let the analyzer suggest selectors, preview products, confirm the configuration, and create a template-based connector.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        {STEPS.map((item, index) => (
          <div key={item} className={`rounded-xl border p-4 text-sm ${index + 1 <= step ? "border-foreground bg-secondary/40" : "border-border bg-card"}`}>
            <p className="font-medium">{index + 1}. {item}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current Step</p>
          <h2 className="mt-2 font-display text-xl font-semibold">{stepLabel}</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="text-xs">Website URL</Label>
            <Input value={wizard.websiteUrl} onChange={(event) => setWizard((current) => ({ ...current, websiteUrl: event.target.value }))} className="mt-1" placeholder="https://www.zara.com/pt" />
          </div>
          <div>
            <Label className="text-xs">Brand Name</Label>
            <Input value={wizard.brandName} onChange={(event) => setWizard((current) => ({ ...current, brandName: event.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Region</Label>
            <Input value={wizard.region} onChange={(event) => setWizard((current) => ({ ...current, region: event.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Country</Label>
            <Input value={wizard.countryCode} onChange={(event) => setWizard((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Currency</Label>
            <Input value={wizard.currencyCode} onChange={(event) => setWizard((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Shipping Method</Label>
            <Select value={wizard.shippingMethodId} onValueChange={(value) => setWizard((current) => ({ ...current, shippingMethodId: value }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(settings?.shippingMethods ?? []).map((method) => <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea value={wizard.notes} onChange={(event) => setWizard((current) => ({ ...current, notes: event.target.value }))} className="mt-1" rows={3} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button disabled={busy || !wizard.websiteUrl} onClick={analyze}>Analyze Website</Button>
          {analysis ? <Button variant="outline" onClick={() => setStep(3)}>Preview Products</Button> : null}
          {analysis ? <Button variant="outline" onClick={() => setStep(4)}>Confirm Selectors</Button> : null}
          {analysis ? <Button variant="outline" disabled={busy} onClick={createConnector}>Create Connector</Button> : null}
          {createdConnector ? <Button variant="outline" disabled={busy} onClick={testImport}>Test Import</Button> : null}
          {createdConnector ? <Button variant="outline" disabled={busy} onClick={runImport}>Run Import</Button> : null}
        </div>

        {analysis && step >= 2 ? (
          <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm">
            Analyzed URL: {analysis.analyzedUrl} · Candidate Pages: {analysis.analyzedUrls.length} · Products Found: {analysis.productsFound}
          </div>
        ) : null}

        {analysis && step >= 3 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">AI Preview</h3>
              <p className="text-xs text-muted-foreground">First {analysis.sampleProducts.length} products</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {analysis.sampleProducts.slice(0, 10).map((product) => (
                <div key={product.contentHash} className="rounded-xl border border-border p-4">
                  {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-40 w-full rounded-lg object-cover bg-secondary" /> : <div className="h-40 rounded-lg bg-secondary" />}
                  <p className="mt-3 font-medium">{product.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{product.currency} {product.price}</p>
                  <p className="mt-1 text-xs text-muted-foreground break-all">{product.sourceUrl || "No source URL"}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {analysis && step >= 4 ? (
          <div className="space-y-4">
            <h3 className="font-semibold">Confirm Selectors</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["listingUrl", "Listing URL"],
                ["productCardSelector", "Product Card Selector"],
                ["productNameSelector", "Product Name Selector"],
                ["productPriceSelector", "Product Price Selector"],
                ["productOldPriceSelector", "Product Old Price Selector"],
                ["productImageSelector", "Product Image Selector"],
                ["productUrlSelector", "Product URL Selector"],
                ["paginationSelector", "Pagination Selector"],
                ["nextPageSelector", "Next Page Selector"],
              ].map(([key, label]) => (
                <div key={key} className={key === "listingUrl" ? "md:col-span-2" : ""}>
                  <Label className="text-xs">{label}</Label>
                  <Textarea rows={2} value={selectors[key]} onChange={(event) => setSelectors((current) => ({ ...current, [key]: event.target.value }))} className="mt-1" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {createdConnector && step >= 5 ? (
          <div className="rounded-xl border border-border p-4 text-sm">
            Connector created for {createdConnector.brandSource.brandName}. Runtime source key: {createdConnector.scraperSource?.connectorKey || "dynamic-template"}.
          </div>
        ) : null}

        {testResult && step >= 6 ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-border p-4 text-sm">
              Website Reachable: {String(testResult.websiteReachable)} · Selectors Valid: {String(testResult.selectorsWorking)} · Products Found: {testResult.productsFound}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {testResult.sampleProducts.slice(0, 10).map((product) => (
                <div key={product.contentHash} className="rounded-xl border border-border p-4">
                  {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-40 w-full rounded-lg object-cover bg-secondary" /> : <div className="h-40 rounded-lg bg-secondary" />}
                  <p className="mt-3 font-medium">{product.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{product.currency} {product.price}</p>
                  <p className="mt-1 text-xs text-muted-foreground break-all">{product.sourceUrl || "No source URL"}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
