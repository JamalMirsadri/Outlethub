import React, { useEffect, useState } from "react";
import { Activity, Database, RefreshCw, ShieldAlert, Timer } from "lucide-react";
import { Link } from "react-router-dom";

import { getImportObservabilityDashboard, type ImportObservabilityDashboardResponse } from "@/api/imports";
import { Button } from "@/components/ui/button";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

export default function AdminImportObservability() {
  const [dashboard, setDashboard] = useState<ImportObservabilityDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setDashboard(await getImportObservabilityDashboard());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load import observability.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const summaryCards = [
    {
      label: "Success Rate",
      value: `${dashboard?.summary.successRate ?? 0}%`,
      icon: Activity,
    },
    {
      label: "Imported",
      value: dashboard?.summary.importedCount ?? 0,
      icon: Database,
    },
    {
      label: "Unchanged",
      value: dashboard?.summary.unchangedCount ?? 0,
      icon: ShieldAlert,
    },
    {
      label: "Throughput / sec",
      value: dashboard?.summary.averageThroughput ?? 0,
      icon: Timer,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Import Observability</h1>
          <p className="text-sm text-muted-foreground">
            Discovery, fetch, normalize, validate, upsert, and catalog analytics for every connector run.
          </p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Icon className="h-4 w-4 text-[hsl(var(--accent))]" />
            </div>
            <p className="font-mono text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Connector Analytics</h2>
              <p className="text-sm text-muted-foreground">Latest universal pipeline metrics per connector run.</p>
            </div>
            <Link to="/admin/imports/jobs" className="text-sm text-[hsl(var(--accent))] hover:underline">
              Open Jobs
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-16 rounded-xl bg-secondary animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    {["Connector", "Strategy", "Discovery", "Normalize", "Validate", "Upsert", "Runtime"].map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.connectors ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.connectorName}</div>
                        <div className="text-xs text-muted-foreground">
                          HTTP {item.httpStatus ?? "—"} · {item.protectionType ?? "NONE"}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">{item.strategyUsed ?? "—"}</td>
                      <td className="px-4 py-3 font-mono">
                        {item.urlsDiscovered} / {item.urlsProcessed}
                      </td>
                      <td className="px-4 py-3 font-mono">{item.normalizedCount}</td>
                      <td className="px-4 py-3 font-mono">
                        {item.validatedCount} / {item.validationFailureCount}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {item.importedCount} / {item.updatedCount} / {item.unchangedCount} / {item.failedCount}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {item.durationMs ? `${Math.round(item.durationMs / 1000)}s` : "—"} · {formatDateTime(item.completedAt)}
                      </td>
                    </tr>
                  ))}
                  {(dashboard?.connectors ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                        No connector runs available yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold">Failure Reasons</h2>
            <div className="mt-4 space-y-3">
              {(dashboard?.failureReasons ?? []).map((item) => (
                <div key={`${item.reason}-${item.count}`} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2 text-sm">
                  <span>{item.reason ?? "UNKNOWN"}</span>
                  <span className="font-mono">{item.count}</span>
                </div>
              ))}
              {(dashboard?.failureReasons ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  No failure reasons recorded.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold">Pipeline Totals</h2>
            <div className="mt-4 space-y-3 text-sm">
              {[
                ["Discovered", dashboard?.summary.discoveredCount ?? 0],
                ["Fetched", dashboard?.summary.fetchedCount ?? 0],
                ["Normalized", dashboard?.summary.normalizedCount ?? 0],
                ["Validated", dashboard?.summary.validatedCount ?? 0],
                ["Imported", dashboard?.summary.importedCount ?? 0],
                ["Updated", dashboard?.summary.updatedCount ?? 0],
                ["Unchanged", dashboard?.summary.unchangedCount ?? 0],
                ["Failed", dashboard?.summary.failedCount ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                  <span>{label}</span>
                  <span className="font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
