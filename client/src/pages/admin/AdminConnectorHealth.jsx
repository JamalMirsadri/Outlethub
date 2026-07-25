import React, { useEffect, useState } from "react";

import { autoRepairConnector, getConnectorsHealth, updateConnectorDetail } from "@/api/connectors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

export default function AdminConnectorHealth() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [repair, setRepair] = useState(null);
  const [repairOpen, setRepairOpen] = useState(false);

  const load = async () => {
    const response = await getConnectorsHealth();
    setDashboard(response);
  };

  useEffect(() => {
    load().catch(() => {}).finally(() => setLoading(false));
  }, []);

  const runAutoRepair = async (item) => {
    setBusyKey(item.brandSourceId);
    try {
      const response = await autoRepairConnector(item.brandSourceId);
      setRepair({
        item,
        response,
      });
      setRepairOpen(true);
    } catch (error) {
      toast({
        title: "Auto-repair failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const applyRepair = async () => {
    if (!repair) {
      return;
    }

    setBusyKey(`apply:${repair.item.brandSourceId}`);
    try {
      await updateConnectorDetail(repair.item.brandSourceId, {
        executionProfile: repair.response.suggestedExecutionProfile,
      });
      setRepairOpen(false);
      await load();
      toast({ title: "Repair applied", description: `Updated selectors for ${repair.item.brandSource.brandName}.` });
    } catch (error) {
      toast({
        title: "Apply repair failed",
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
        <h1 className="font-display text-2xl font-bold">Connector Health</h1>
        <p className="text-sm text-muted-foreground">Track health score, validate selectors, review last success and failure, and approve auto-repair suggestions when storefront markup changes.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-mono text-2xl font-bold">{dashboard.summary.averageHealthScore}</p>
          <p className="mt-1 text-xs text-muted-foreground">Average Health Score</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-mono text-2xl font-bold">{dashboard.summary.healthyConnectors}</p>
          <p className="mt-1 text-xs text-muted-foreground">Healthy Connectors</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-mono text-2xl font-bold">{dashboard.summary.needsAttention}</p>
          <p className="mt-1 text-xs text-muted-foreground">Needs Attention</p>
        </div>
      </div>

      <div className="space-y-4">
        {dashboard.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-semibold">{item.brandSource.brandName}</p>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs">Health {item.health.healthScore}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Website Reachable {String(item.health.websiteReachable)} · Selectors Valid {String(item.health.selectorsValid)} · Products Found {item.health.productsFound}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last Success {item.health.lastSuccessAt ? new Date(item.health.lastSuccessAt).toLocaleString() : "Never"} · Last Failure {item.health.lastFailureAt ? new Date(item.health.lastFailureAt).toLocaleString() : "Never"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Recommended Action: {item.recommendedAction}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={busyKey === item.brandSourceId} onClick={() => runAutoRepair(item)}>
                  Auto Repair
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={repairOpen} onOpenChange={setRepairOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Auto Repair {repair ? `· ${repair.item.brandSource.brandName}` : ""}</DialogTitle>
          </DialogHeader>
          {repair ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-4 text-sm">
                Suggested Listing URL: {repair.response.suggestedExecutionProfile.listingUrl} · Products Found: {repair.response.productsFound}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(repair.response.suggestedExecutionProfile).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{key}</p>
                    <p className="mt-1 text-sm break-all">{String(value)}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {repair.response.sampleProducts.slice(0, 10).map((product) => (
                  <div key={product.contentHash} className="rounded-xl border border-border p-4">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-40 w-full rounded-lg object-cover bg-secondary" /> : <div className="h-40 rounded-lg bg-secondary" />}
                    <p className="mt-3 font-medium">{product.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{product.currency} {product.price}</p>
                    <p className="mt-1 text-xs text-muted-foreground break-all">{product.sourceUrl || "No source URL"}</p>
                  </div>
                ))}
              </div>
              <Button className="w-full rounded-full" disabled={busyKey === `apply:${repair.item.brandSourceId}`} onClick={applyRepair}>
                Apply Suggested Selectors
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
