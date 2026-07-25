import React, { useEffect, useState } from "react";
import { BellRing, RefreshCw } from "lucide-react";

import { listAlerts, markAlertRead, type AlertRecord } from "@/api/monitoring";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default function AdminAlerts() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setAlerts(
        await listAlerts({
          unreadOnly: filter === "UNREAD",
          limit: 100,
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const onMarkRead = async (id: string) => {
    setError("");
    try {
      await markAlertRead(id);
      await load();
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Failed to mark alert as read.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Alerts</h1>
          <p className="text-sm text-muted-foreground">Operational alerts for Nike sync failures, price drops, and stock changes.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={(value) => setFilter(value as "ALL" | "UNREAD")}>
            <SelectTrigger className="w-[160px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Alerts</SelectItem>
              <SelectItem value="UNREAD">Unread Only</SelectItem>
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
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
          No alerts available.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <BellRing className="h-4 w-4 text-[hsl(var(--accent))]" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{alert.title}</p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{alert.type}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{alert.severity}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {alert.isRead ? "Read" : "Unread"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{alert.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(alert.createdAt)}</p>
                  </div>
                </div>
                {!alert.isRead ? (
                  <Button variant="outline" className="rounded-full" onClick={() => void onMarkRead(alert.id)}>
                    Mark Read
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
