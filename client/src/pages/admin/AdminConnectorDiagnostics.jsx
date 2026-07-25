import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getConnectorDiagnostics, getConnectorsDashboard } from "@/api/connectors";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export default function AdminConnectorDiagnostics() {
  const [searchParams] = useSearchParams();
  const [dashboard, setDashboard] = useState(null);
  const [diagnosticsById, setDiagnosticsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);

  const highlightedBrandSourceId = searchParams.get("brandSourceId");

  const load = async () => {
    const response = await getConnectorsDashboard();
    setDashboard(response);
  };

  useEffect(() => {
    load().catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!dashboard || !highlightedBrandSourceId) {
      return;
    }

    if (diagnosticsById[highlightedBrandSourceId]) {
      return;
    }

    const target = dashboard.items.find((item) => item.brandSourceId === highlightedBrandSourceId);
    if (!target) {
      return;
    }

    setBusyKey(highlightedBrandSourceId);
    getConnectorDiagnostics(highlightedBrandSourceId)
      .then((result) => {
        setDiagnosticsById((current) => ({ ...current, [highlightedBrandSourceId]: result }));
      })
      .catch((error) => {
        toast({
          title: "Diagnostics failed",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      })
      .finally(() => setBusyKey(null));
  }, [dashboard, diagnosticsById, highlightedBrandSourceId]);

  const summary = useMemo(() => {
    const rows = Object.values(diagnosticsById);
    return {
      akamai: rows.filter((item) => item.protectionType === "AKAMAI").length,
      cloudflare: rows.filter((item) => item.protectionType === "CLOUDFLARE").length,
      datadome: rows.filter((item) => item.protectionType === "DATADOME").length,
      sitemap: rows.filter((item) => item.strategyUsed === "SITEMAP").length,
      htmlFetch: rows.filter((item) => item.strategyUsed === "HTML_FETCH").length,
      playwright: rows.filter((item) => item.strategyUsed === "PLAYWRIGHT").length,
    };
  }, [diagnosticsById]);

  const runDiagnostics = async (item) => {
    setBusyKey(item.brandSourceId);
    try {
      const result = await getConnectorDiagnostics(item.brandSourceId);
      setDiagnosticsById((current) => ({ ...current, [item.brandSourceId]: result }));
      toast({
        title: "Diagnostics complete",
        description: `${item.brandSource.brandName}: ${result.strategyUsed} · ${result.productsFound} products.`,
      });
    } catch (error) {
      toast({
        title: "Diagnostics failed",
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Connector Diagnostics</h1>
        <p className="text-sm text-muted-foreground">Inspect HTTP status, redirects, protection type, adaptive strategy selection, sitemap fallback, and detected products before running imports.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Akamai", value: summary.akamai },
          { label: "Cloudflare", value: summary.cloudflare },
          { label: "DataDome", value: summary.datadome },
          { label: "Sitemap", value: summary.sitemap },
          { label: "HTML Fetch", value: summary.htmlFetch },
          { label: "Playwright", value: summary.playwright },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-5">
            <p className="font-mono text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {dashboard.items.map((item) => {
          const diagnostics = diagnosticsById[item.brandSourceId] || null;
          const highlighted = highlightedBrandSourceId === item.brandSourceId;

          return (
            <div key={item.id} className={`rounded-xl border bg-card p-5 ${highlighted ? "border-foreground" : "border-border"}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="font-semibold">{item.brandSource.brandName}</p>
                  <p className="text-sm text-muted-foreground">{item.brandSource.website}</p>
                  <p className="text-xs text-muted-foreground">
                    Source Type {item.brandSource.sourceType} · Browser {item.executionProfile?.headless ? "Headless" : "Headful"} · Last Test {item.lastTestStatus || "Never"}
                  </p>
                  {diagnostics ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        HTTP {diagnostics.httpStatus} · Protection {diagnostics.protectionType} · Strategy {diagnostics.strategyUsed} · Products Found {diagnostics.productsFound}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Final URL {diagnostics.finalUrl}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Redirects {diagnostics.redirects.length ? diagnostics.redirects.join(" -> ") : "None"} · Sitemap {diagnostics.sitemapUrl || "None"}
                      </p>
                      {diagnostics.message ? <p className="text-xs text-muted-foreground">{diagnostics.message}</p> : null}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No live diagnostics captured yet.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={busyKey === item.brandSourceId} onClick={() => runDiagnostics(item)}>
                    Run Diagnostics
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
