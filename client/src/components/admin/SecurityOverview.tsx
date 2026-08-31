import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Bug, RefreshCw, Save, ShieldAlert } from "lucide-react";

import {
  evaluateSecurityAlerts,
  getSecurityAlerts,
  getSecurityAlertsConfig,
  getSecurityOverview,
  updateSecurityAlertsConfig,
  type SecurityAlertsConfig,
  type SecurityAlertView,
  type SecurityOverview,
  type ErrorLogSeverity,
} from "@/api/system-logs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function SecurityOverview() {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlertView[]>([]);
  const [config, setConfig] = useState<SecurityAlertsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [overviewData, alertsData, configData] = await Promise.all([
        getSecurityOverview(),
        getSecurityAlerts(),
        getSecurityAlertsConfig(),
      ]);
      setOverview(overviewData);
      setAlerts(alertsData.items);
      setConfig(configData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load security overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onEvaluate = async () => {
    setError("");
    try {
      const result = await evaluateSecurityAlerts();
      setAlerts(result.items);
    } catch (evaluateError) {
      setError(evaluateError instanceof Error ? evaluateError.message : "Failed to evaluate security alerts.");
    }
  };

  const onSaveConfig = async () => {
    if (!config) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updated = await updateSecurityAlertsConfig(config);
      setConfig(updated);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save security alert settings.");
    } finally {
      setSaving(false);
    }
  };

  const summary = overview?.summary;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <h2 className="font-display text-lg font-bold">Security Overview</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => void onEvaluate()}>
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            Evaluate Alerts
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => void load()}>
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
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Scans Today" value={summary?.scansToday ?? 0} tone="text-foreground" />
            <StatCard label="Unique IPs" value={summary?.uniqueIps ?? 0} tone="text-foreground" />
            <StatCard label="Total Requests" value={summary?.totalRequests ?? 0} tone="text-foreground" />
            <StatCard label="High-Risk Events" value={summary?.highRiskEvents ?? 0} tone="text-red-500" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="WordPress Probes" value={summary?.wordpressProbes ?? 0} tone="text-foreground" />
            <StatCard label="PHP Probes" value={summary?.phpProbes ?? 0} tone="text-foreground" />
            <StatCard label="RCE Probes" value={summary?.rceProbes ?? 0} tone="text-red-500" />
            <StatCard label="Other Probes" value={summary?.otherProbes ?? 0} tone="text-foreground" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Top Attackers">
              {overview && overview.topAttackers.length > 0 ? (
                <div className="space-y-2">
                  {overview.topAttackers.map((attacker) => (
                    <div key={attacker.ip} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                      <span className="font-mono">{attacker.ip}</span>
                      <span className="text-muted-foreground">{attacker.count} requests</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyText />
              )}
            </Section>

            <Section title="Recent Security Events">
              {overview && overview.recentEvents.length > 0 ? (
                <div className="space-y-2">
                  {overview.recentEvents.slice(0, 8).map((event) => (
                    <div key={event.id} className="rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{event.source ?? "Security event"}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(event.lastSeenAt)}</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{event.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyText />
              )}
            </Section>
          </div>

          <Section title="Security Alerts">
            {alerts.length > 0 ? (
              <div className="space-y-2">
                {alerts.slice(0, 10).map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{alert.title}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{alert.severity}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(alert.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyText text="No security alerts." />
            )}

            {config ? (
              <div className="mt-4 grid gap-3 rounded-lg border border-border p-4 md:grid-cols-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(event) => setConfig({ ...config, enabled: event.target.checked })}
                  />
                  Enable alerts
                </label>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Threshold</p>
                  <Input
                    type="number"
                    min={1}
                    value={config.threshold}
                    onChange={(event) => setConfig({ ...config, threshold: Number(event.target.value) || 1 })}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Window (min)</p>
                  <Input
                    type="number"
                    min={1}
                    value={config.windowMinutes}
                    onChange={(event) => setConfig({ ...config, windowMinutes: Number(event.target.value) || 1 })}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Min severity</p>
                  <Select
                    value={config.minSeverity}
                    onValueChange={(value) => setConfig({ ...config, minSeverity: value as ErrorLogSeverity })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INFO">Info</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-4">
                  <Button onClick={() => void onSaveConfig()} disabled={saving}>
                    <Save className="mr-1.5 h-4 w-4" />
                    {saving ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </div>
            ) : null}
          </Section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Bug className="h-4 w-4 text-muted-foreground" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyText({ text = "No data available." }: { text?: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
