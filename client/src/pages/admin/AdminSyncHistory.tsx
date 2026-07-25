import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { listSyncHistory, type SyncHistoryRecord, type SyncRunStatus } from "@/api/monitoring";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_OPTIONS: Array<{ value: "ALL" | SyncRunStatus; label: string }> = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "RUNNING", label: "Running" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
];

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function AdminSyncHistory() {
  const [items, setItems] = useState<SyncHistoryRecord[]>([]);
  const [status, setStatus] = useState<"ALL" | SyncRunStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(
        await listSyncHistory({
          status: status === "ALL" ? undefined : status,
          limit: 100,
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load sync history.");
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
          <h1 className="font-display text-2xl font-bold">Sync History</h1>
          <p className="text-sm text-muted-foreground">Auto-sync execution history for the Nike connector.</p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={(value) => setStatus(value as "ALL" | SyncRunStatus)}>
            <SelectTrigger className="w-[180px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
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

      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div> : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Source", "Frequency", "Status", "Checked", "Changed", "Started", "Completed"].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    No sync history found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.source?.name ?? item.sourceId}</div>
                      <div className="text-xs text-muted-foreground">{item.source?.connectorKey ?? "nike-outlet"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.source?.syncFrequency ?? "MANUAL"}</td>
                    <td className="px-4 py-3 font-medium">{item.status}</td>
                    <td className="px-4 py-3 font-mono">{item.productsChecked}</td>
                    <td className="px-4 py-3 font-mono text-[hsl(var(--accent))]">{item.productsChanged}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(item.startedAt)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(item.completedAt)}</td>
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
