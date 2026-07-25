import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { listScraperRuns, type ScraperRunRecord, type ScraperRunStatus } from "@/api/scrapers";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RUN_STATUSES: Array<{ value: "ALL" | ScraperRunStatus; label: string }> = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "RUNNING", label: "Running" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
];

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function ScrapersRuns() {
  const [runs, setRuns] = useState<ScraperRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"ALL" | ScraperRunStatus>("ALL");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRuns(
        await listScraperRuns({
          status: status === "ALL" ? undefined : status,
          limit: 100,
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load scraper runs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold">Scraper Runs</h2>
          <p className="text-sm text-muted-foreground">Execution history, artifacts, and downstream import results.</p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={(value) => setStatus(value as "ALL" | ScraperRunStatus)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RUN_STATUSES.map((option) => (
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
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

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
                {["Source", "Status", "Found", "Imported", "Updated", "Failed", "Import Job", "Artifacts", "Completed"].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                    No scraper runs found.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{run.source?.name ?? run.sourceId}</div>
                      <div className="text-xs text-muted-foreground">{run.source?.connectorKey ?? "unknown"}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">{run.status}</td>
                    <td className="px-4 py-3 font-mono">{run.productsFound}</td>
                    <td className="px-4 py-3 font-mono text-[hsl(var(--accent))]">{run.productsImported}</td>
                    <td className="px-4 py-3 font-mono">{run.productsUpdated}</td>
                    <td className="px-4 py-3 font-mono text-red-400">{run.failedCount}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{run.importJob?.id ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">{run.artifacts.length}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(run.completedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
