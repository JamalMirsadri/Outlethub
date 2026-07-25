import React, { useEffect, useState } from "react";
import { Activity, BellRing, Clock3, LineChart, Play, RefreshCw, ShieldCheck, TrendingDown, Warehouse } from "lucide-react";

import {
  getMonitoringDashboard,
  runMonitoringSync,
  updateMonitoringSourceSettings,
  type MonitoringDashboardResponse,
  type SyncFrequency,
} from "@/api/monitoring";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FREQUENCY_OPTIONS: Array<{ value: SyncFrequency; label: string }> = [
  { value: "MANUAL", label: "Manual" },
  { value: "HOURLY", label: "Hourly" },
  { value: "EVERY_6_HOURS", label: "Every 6 Hours" },
  { value: "DAILY", label: "Daily" },
];

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default function AdminMonitoring() {
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [dashboard, setDashboard] = useState<MonitoringDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getMonitoringDashboard(selectedSourceId ? { sourceId: selectedSourceId } : undefined);
      setDashboard(response);
      if (!selectedSourceId && response.selectedSource?.id) {
        setSelectedSourceId(response.selectedSource.id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load monitoring dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [selectedSourceId]);

  const triggerSync = async () => {
    if (!dashboard?.selectedSource) {
      return;
    }

    setRunning(true);
    setError("");
    try {
      await runMonitoringSync(dashboard.selectedSource.id, "manual");
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to queue connector sync.");
    } finally {
      setRunning(false);
    }
  };

  const updateFrequency = async (value: SyncFrequency) => {
    if (!dashboard?.selectedSource) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateMonitoringSourceSettings({ sourceId: dashboard.selectedSource.id, syncFrequency: value });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update sync settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  const stats = [
    { label: "Active Sources", value: dashboard?.summary.activeSources ?? 0, icon: Activity },
    { label: "Success Rate", value: `${dashboard?.summary.successRate ?? 0}%`, icon: ShieldCheck },
    { label: "Imported", value: dashboard?.summary.importedCount ?? 0, icon: RefreshCw },
    { label: "Unchanged", value: dashboard?.summary.unchangedCount ?? 0, icon: Warehouse },
    { label: "Avg Health", value: dashboard?.summary.averageHealthScore ?? 0, icon: BellRing },
    { label: "Failed Syncs", value: dashboard?.summary.failedSyncs ?? 0, icon: Clock3 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Connector Monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Universal sync monitoring, queue visibility, health scoring, alerts, and source analytics for every connector.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={dashboard?.selectedSource?.id ?? ""} onValueChange={setSelectedSourceId}>
            <SelectTrigger className="w-[220px] rounded-full">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {(dashboard?.sources ?? []).map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={dashboard?.selectedSource?.syncFrequency ?? "MANUAL"}
            onValueChange={(value) => void updateFrequency(value as SyncFrequency)}
            disabled={!dashboard?.selectedSource}
          >
            <SelectTrigger className="w-[180px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-full" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Button className="rounded-full" disabled={running || saving || !dashboard?.selectedSource} onClick={() => void triggerSync()}>
            {running ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
            Run Sync
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Icon className="h-4 w-4 text-[hsl(var(--accent))]" />
            </div>
            <p className="text-lg font-semibold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <LineChart className="h-4 w-4 text-[hsl(var(--accent))]" />
            <h2 className="font-semibold">Selected Source</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="mt-2 text-lg font-bold">{dashboard?.selectedSource?.name ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dashboard?.selectedSource?.connectorKey ?? "—"} · {dashboard?.selectedSource?.status ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="text-xs text-muted-foreground">Last Sync</p>
              <p className="mt-2 text-2xl font-bold">{formatDateTime(dashboard?.monitoring.lastSync?.completedAt ?? null)}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="text-xs text-muted-foreground">Health Score</p>
              <p className="mt-2 text-2xl font-bold">{dashboard?.selectedSource?.healthScore ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="text-xs text-muted-foreground">Product Yield</p>
              <p className="mt-2 text-2xl font-bold">{dashboard?.selectedSource?.productYield ?? 0}%</p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Source Analytics</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <p className="text-xs text-muted-foreground">Products Checked</p>
                <p className="mt-2 text-2xl font-bold">{dashboard?.monitoring.productsChecked ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <p className="text-xs text-muted-foreground">Products Changed</p>
                <p className="mt-2 text-2xl font-bold">{dashboard?.monitoring.productsChanged ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <p className="text-xs text-muted-foreground">Price Drops</p>
                <p className="mt-2 text-2xl font-bold">{dashboard?.monitoring.priceDrops ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <p className="text-xs text-muted-foreground">Stock Changes</p>
                <p className="mt-2 text-2xl font-bold">{dashboard?.monitoring.stockChanges ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <p className="text-xs text-muted-foreground">Imported Products</p>
                <p className="mt-2 text-2xl font-bold">{dashboard?.analytics?.importedProducts ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <p className="text-xs text-muted-foreground">Average Discount</p>
                <p className="mt-2 text-2xl font-bold">{Math.round(dashboard?.analytics?.averageDiscount ?? 0)}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Alert Statistics</h2>
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <p className="text-xs text-muted-foreground">Total Alerts</p>
                <p className="mt-2 text-2xl font-bold">{dashboard?.alerts.total ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <p className="text-xs text-muted-foreground">Unread Alerts</p>
                <p className="mt-2 text-2xl font-bold">{dashboard?.alerts.unread ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <p className="text-xs text-muted-foreground">Critical Alerts</p>
                <p className="mt-2 text-2xl font-bold">{dashboard?.alerts.critical ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Failure Reasons</h2>
            <div className="space-y-3 text-sm">
              {(dashboard?.failureReasons ?? []).slice(0, 6).map((item) => (
                <div key={`${item.reason}-${item.count}`} className="rounded-xl border border-border bg-secondary/20 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span>{item.reason ?? "UNKNOWN"}</span>
                    <span className="font-mono">{item.count}</span>
                  </div>
                </div>
              ))}
              {(dashboard?.failureReasons ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  No failure reasons recorded yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold">Recent Sync Runs</h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["Source", "Status", "Checked", "Changed", "Completed"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(dashboard?.recentRuns ?? []).map((run) => (
                  <tr key={run.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{run.source?.name ?? "Unknown Source"}</div>
                      <div className="text-xs text-muted-foreground">{run.source?.connectorKey ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">{run.status}</td>
                    <td className="px-4 py-3 font-mono">{run.productsChecked}</td>
                    <td className="px-4 py-3 font-mono">{run.productsChanged}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(run.completedAt)}</td>
                  </tr>
                ))}
                {(dashboard?.recentRuns ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                      No sync runs available yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold">Queue Status</h2>
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="font-medium">sync-scheduler</p>
              <p className="mt-2 text-xs text-muted-foreground break-all">{JSON.stringify(dashboard?.queueStatus.syncScheduler ?? {})}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="font-medium">price-monitor</p>
              <p className="mt-2 text-xs text-muted-foreground break-all">{JSON.stringify(dashboard?.queueStatus.priceMonitor ?? {})}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="font-medium">Selected Source Health</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Success {dashboard?.selectedSource?.successRate ?? 0}% · Failure {dashboard?.selectedSource?.failureRate ?? 0}% ·
                Stability {dashboard?.selectedSource?.runtimeStability ?? 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
