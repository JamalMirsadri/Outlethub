import React, { useEffect, useMemo, useState } from "react";
import { Bot, Plus, RefreshCw, Play, AlertTriangle, PackageSearch, PackageCheck } from "lucide-react";

import {
  createScraperSource,
  deleteScraperSource,
  getScrapersDashboard,
  runScraper,
  type ScraperDashboardSummary,
  type ScraperSourceRecord,
  type ScraperStatus,
  type ScraperType,
  updateScraperSource,
} from "@/api/scrapers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SCRAPER_TYPES: Array<{ value: ScraperType; label: string }> = [
  { value: "PLAYWRIGHT", label: "Playwright" },
  { value: "PUPPETEER", label: "Puppeteer" },
];

const SCRAPER_STATUSES: Array<{ value: ScraperStatus; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "DISABLED", label: "Disabled" },
  { value: "ERROR", label: "Error" },
];

interface ScraperSourceFormState {
  name: string;
  website: string;
  status: ScraperStatus;
  scraperType: ScraperType;
  connectorKey: string;
  headless: string;
  timeoutMs: string;
  retryAttempts: string;
  userAgent: string;
  maxRequestsPerMinute: string;
  maxConcurrentPages: string;
}

const EMPTY_FORM: ScraperSourceFormState = {
  name: "",
  website: "",
  status: "ACTIVE",
  scraperType: "PLAYWRIGHT",
  connectorKey: "demo",
  headless: "true",
  timeoutMs: "30000",
  retryAttempts: "2",
  userAgent: "",
  maxRequestsPerMinute: "60",
  maxConcurrentPages: "2",
};

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

function parseForm(source: ScraperSourceRecord | null): ScraperSourceFormState {
  if (!source) {
    return EMPTY_FORM;
  }

  const configuration = source.configuration ?? {};
  const requestLimiter =
    configuration.requestLimiter && typeof configuration.requestLimiter === "object"
      ? (configuration.requestLimiter as Record<string, unknown>)
      : {};

  return {
    name: source.name,
    website: source.website ?? "",
    status: source.status,
    scraperType: source.scraperType,
    connectorKey: source.connectorKey,
    headless: String(configuration.headless ?? true),
    timeoutMs: String(configuration.timeoutMs ?? 30000),
    retryAttempts: String(configuration.retryAttempts ?? 2),
    userAgent: typeof configuration.userAgent === "string" ? configuration.userAgent : "",
    maxRequestsPerMinute: String(requestLimiter.maxRequestsPerMinute ?? 60),
    maxConcurrentPages: String(requestLimiter.maxConcurrentPages ?? 2),
  };
}

function buildPayload(form: ScraperSourceFormState) {
  return {
    name: form.name,
    website: form.website || null,
    status: form.status,
    scraperType: form.scraperType,
    connectorKey: form.connectorKey,
    configuration: {
      headless: form.headless === "true",
      timeoutMs: Number(form.timeoutMs),
      retryAttempts: Number(form.retryAttempts),
      ...(form.userAgent ? { userAgent: form.userAgent } : {}),
      requestLimiter: {
        maxRequestsPerMinute: Number(form.maxRequestsPerMinute),
        maxConcurrentPages: Number(form.maxConcurrentPages),
      },
    },
  };
}

export default function ScrapersDashboard() {
  const [summary, setSummary] = useState<ScraperDashboardSummary | null>(null);
  const [sources, setSources] = useState<ScraperSourceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScraperSourceRecord | null>(null);
  const [form, setForm] = useState<ScraperSourceFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [runningSourceId, setRunningSourceId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    return [
      { label: "Active Scrapers", value: summary?.activeScrapers ?? 0, icon: Bot },
      { label: "Products Found", value: summary?.productsFound ?? 0, icon: PackageSearch },
      { label: "Products Imported", value: summary?.productsImported ?? 0, icon: PackageCheck },
      { label: "Failed Runs", value: summary?.failedRuns ?? 0, icon: AlertTriangle },
    ];
  }, [summary]);

  const nikeSource = useMemo(
    () => sources.find((source) => source.connectorKey === "nike-outlet") ?? null,
    [sources],
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getScrapersDashboard();
      setSummary(response.summary);
      setSources(response.sources);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load scraper dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreateDialog = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (source: ScraperSourceRecord) => {
    setEditing(source);
    setForm(parseForm(source));
    setDialogOpen(true);
  };

  const saveSource = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload(form);
      if (editing) {
        await updateScraperSource(editing.id, payload);
      } else {
        await createScraperSource(payload);
      }
      setDialogOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save scraper source.");
    } finally {
      setSaving(false);
    }
  };

  const removeSource = async (id: string) => {
    setError("");
    try {
      await deleteScraperSource(id);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete scraper source.");
    }
  };

  const triggerRun = async (id: string) => {
    setRunningSourceId(id);
    setError("");
    try {
      await runScraper(id);
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to queue scraper run.");
    } finally {
      setRunningSourceId(null);
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

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Icon className="h-4 w-4 text-[hsl(var(--accent))]" />
            </div>
            <p className="font-mono text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Scraper Sources</h2>
            <p className="text-sm text-muted-foreground">
              Define reusable scraper sources, connector keys, and browser/request-limiter hooks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={nikeSource ? "default" : "outline"}
              className="rounded-full"
              disabled={!nikeSource || runningSourceId === nikeSource.id}
              onClick={() => {
                if (nikeSource) {
                  void triggerRun(nikeSource.id);
                }
              }}
            >
              {nikeSource && runningSourceId === nikeSource.id ? (
                <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-4 w-4" />
              )}
              Run Nike Import
            </Button>
            <Button className="rounded-full" onClick={openCreateDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Scraper
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {sources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No scraper sources configured yet.
            </div>
          ) : (
            sources.map((source) => (
              <div key={source.id} className="rounded-xl border border-border bg-secondary/20 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{source.name}</p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {source.scraperType}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {source.connectorKey}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {source.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last run: {formatDateTime(source.lastRunAt)} | Run count: {source.runCount}
                    </p>
                    {source.website ? <p className="mt-1 text-xs text-muted-foreground">{source.website}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      disabled={runningSourceId === source.id}
                      onClick={() => void triggerRun(source.id)}
                    >
                      {runningSourceId === source.id ? (
                        <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-1.5 h-4 w-4" />
                      )}
                      Run
                    </Button>
                    <Button variant="outline" className="rounded-full" onClick={() => openEditDialog(source)}>
                      Edit
                    </Button>
                    <Button variant="outline" className="rounded-full" onClick={() => void removeSource(source.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Scraper Source" : "Add Scraper Source"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Name</Label>
              <Input className="mt-1" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div>
              <Label>Scraper Type</Label>
              <Select value={form.scraperType} onValueChange={(value) => setForm((current) => ({ ...current, scraperType: value as ScraperType }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCRAPER_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as ScraperStatus }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCRAPER_STATUSES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Connector Key</Label>
              <Input className="mt-1" value={form.connectorKey} onChange={(event) => setForm((current) => ({ ...current, connectorKey: event.target.value }))} />
            </div>
            <div>
              <Label>Website</Label>
              <Input className="mt-1" value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} />
            </div>
            <div>
              <Label>Headless</Label>
              <Select value={form.headless} onValueChange={(value) => setForm((current) => ({ ...current, headless: value }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timeout (ms)</Label>
              <Input className="mt-1" type="number" value={form.timeoutMs} onChange={(event) => setForm((current) => ({ ...current, timeoutMs: event.target.value }))} />
            </div>
            <div>
              <Label>Retry Attempts</Label>
              <Input className="mt-1" type="number" value={form.retryAttempts} onChange={(event) => setForm((current) => ({ ...current, retryAttempts: event.target.value }))} />
            </div>
            <div>
              <Label>Max Requests/Minute</Label>
              <Input className="mt-1" type="number" value={form.maxRequestsPerMinute} onChange={(event) => setForm((current) => ({ ...current, maxRequestsPerMinute: event.target.value }))} />
            </div>
            <div>
              <Label>Max Concurrent Pages</Label>
              <Input className="mt-1" type="number" value={form.maxConcurrentPages} onChange={(event) => setForm((current) => ({ ...current, maxConcurrentPages: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>User Agent Override</Label>
              <Textarea className="mt-1" rows={3} value={form.userAgent} onChange={(event) => setForm((current) => ({ ...current, userAgent: event.target.value }))} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button disabled={saving || !form.name.trim()} onClick={() => void saveSource()}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Create Source"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
