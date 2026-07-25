import React, { useEffect, useMemo, useState } from "react";
import { Globe, Play, Plus, RefreshCw, Upload, AlertCircle, Database, Flame } from "lucide-react";

import {
  createImportSource,
  deleteImportSource,
  getImportsDashboard,
  runImport,
  type ImportDashboardSummary,
  type ImportSourceRecord,
  type ImportSourceStatus,
  type ImportSourceType,
  type SyncFrequency,
  updateImportSource,
  uploadImport,
} from "@/api/imports";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SOURCE_TYPES: Array<{ value: ImportSourceType; label: string }> = [
  { value: "JSON_FEED", label: "JSON Feed" },
  { value: "XML_FEED", label: "XML Feed" },
  { value: "MANUAL", label: "Manual Upload" },
  { value: "SCRAPER", label: "Scraper Adapter" },
  { value: "AWIN", label: "AWIN Connector" },
  { value: "CJ", label: "CJ Connector" },
];

const SYNC_FREQUENCIES: Array<{ value: SyncFrequency; label: string }> = [
  { value: "MANUAL", label: "Manual" },
  { value: "HOURLY", label: "Every Hour" },
  { value: "EVERY_6_HOURS", label: "Every 6 Hours" },
  { value: "DAILY", label: "Daily" },
];

const STATUS_OPTIONS: Array<{ value: ImportSourceStatus; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "DISABLED", label: "Disabled" },
  { value: "ERROR", label: "Error" },
];

interface SourceFormState {
  name: string;
  sourceType: ImportSourceType;
  website: string;
  status: ImportSourceStatus;
  syncFrequency: SyncFrequency;
  feedUrl: string;
  recordPath: string;
  defaultBrand: string;
  defaultCategory: string;
  sourceStore: string;
}

const EMPTY_SOURCE_FORM: SourceFormState = {
  name: "",
  sourceType: "JSON_FEED",
  website: "",
  status: "ACTIVE",
  syncFrequency: "DAILY",
  feedUrl: "",
  recordPath: "",
  defaultBrand: "",
  defaultCategory: "",
  sourceStore: "",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

function parseSourceForm(source: ImportSourceRecord | null): SourceFormState {
  if (!source) {
    return EMPTY_SOURCE_FORM;
  }

  const configuration = source.configuration ?? {};
  return {
    name: source.name,
    sourceType: source.sourceType,
    website: source.website ?? "",
    status: source.status,
    syncFrequency: source.syncFrequency,
    feedUrl: typeof configuration.feedUrl === "string" ? configuration.feedUrl : "",
    recordPath: typeof configuration.recordPath === "string" ? configuration.recordPath : "",
    defaultBrand: typeof configuration.defaultBrand === "string" ? configuration.defaultBrand : "",
    defaultCategory: typeof configuration.defaultCategory === "string" ? configuration.defaultCategory : "",
    sourceStore: typeof configuration.sourceStore === "string" ? configuration.sourceStore : "",
  };
}

function buildSourcePayload(form: SourceFormState) {
  return {
    name: form.name,
    sourceType: form.sourceType,
    website: form.website || null,
    status: form.status,
    syncFrequency: form.syncFrequency,
    configuration: {
      ...(form.feedUrl ? { feedUrl: form.feedUrl } : {}),
      ...(form.recordPath ? { recordPath: form.recordPath } : {}),
      ...(form.defaultBrand ? { defaultBrand: form.defaultBrand } : {}),
      ...(form.defaultCategory ? { defaultCategory: form.defaultCategory } : {}),
      ...(form.sourceStore ? { sourceStore: form.sourceStore } : {}),
    },
  };
}

export default function ImportsDashboard() {
  const [summary, setSummary] = useState<ImportDashboardSummary | null>(null);
  const [sources, setSources] = useState<ImportSourceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ImportSourceRecord | null>(null);
  const [form, setForm] = useState<SourceFormState>(EMPTY_SOURCE_FORM);
  const [saving, setSaving] = useState(false);
  const [runningSourceId, setRunningSourceId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [uploadForm, setUploadForm] = useState({
    name: "Admin Upload",
    sourceType: "JSON_FEED" as ImportSourceType,
    format: "json" as "json" | "xml",
    website: "",
    content: "",
  });

  const stats = useMemo(() => {
    return [
      {
        label: "Active Sources",
        value: summary?.activeSources ?? 0,
        icon: Globe,
      },
      {
        label: "Imported Products",
        value: summary?.importedProducts ?? 0,
        icon: Database,
      },
      {
        label: "Failed Imports",
        value: summary?.failedImports ?? 0,
        icon: AlertCircle,
      },
      {
        label: "Deal Count",
        value: summary?.dealCount ?? 0,
        icon: Flame,
      },
    ];
  }, [summary]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getImportsDashboard();
      setSummary(response.summary);
      setSources(response.sources);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load import dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreateDialog = () => {
    setEditing(null);
    setForm(EMPTY_SOURCE_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (source: ImportSourceRecord) => {
    setEditing(source);
    setForm(parseSourceForm(source));
    setDialogOpen(true);
  };

  const saveSource = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = buildSourcePayload(form);
      if (editing) {
        await updateImportSource(editing.id, payload);
      } else {
        await createImportSource(payload);
      }
      setDialogOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save import source.");
    } finally {
      setSaving(false);
    }
  };

  const removeSource = async (sourceId: string) => {
    setError("");
    try {
      await deleteImportSource(sourceId);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete import source.");
    }
  };

  const triggerSourceRun = async (sourceId: string) => {
    setRunningSourceId(sourceId);
    setError("");
    try {
      await runImport(sourceId);
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to queue import job.");
    } finally {
      setRunningSourceId(null);
    }
  };

  const submitUpload = async () => {
    setUploading(true);
    setError("");
    try {
      await uploadImport({
        name: uploadForm.name,
        sourceType: uploadForm.sourceType,
        format: uploadForm.format,
        website: uploadForm.website || null,
        content: uploadForm.content,
      });
      setUploadForm({
        name: "Admin Upload",
        sourceType: "JSON_FEED",
        format: "json",
        website: "",
        content: "",
      });
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to queue admin upload.");
    } finally {
      setUploading(false);
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

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Import Sources</h2>
              <p className="text-sm text-muted-foreground">Manage feed endpoints and future connector definitions.</p>
            </div>
            <Button className="rounded-full" onClick={openCreateDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Source
            </Button>
          </div>

          <div className="space-y-3">
            {sources.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No import sources configured yet.
              </div>
            ) : (
              sources.map((source) => (
                <div key={source.id} className="rounded-xl border border-border bg-secondary/20 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{source.name}</p>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                          {source.sourceType}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                          {source.syncFrequency}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                          {source.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last sync: {formatDateTime(source.lastSyncAt)} | Source size: {source.productCount}
                      </p>
                      {source.website ? (
                        <p className="mt-1 text-xs text-muted-foreground">{source.website}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="rounded-full"
                        disabled={runningSourceId === source.id}
                        onClick={() => void triggerSourceRun(source.id)}
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

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Admin Upload Import</h2>
            <p className="text-sm text-muted-foreground">
              Queue JSON or XML payloads directly without creating a scraper.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <Label>Upload Name</Label>
              <Input
                className="mt-1"
                value={uploadForm.name}
                onChange={(event) => setUploadForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Format</Label>
                <Select
                  value={uploadForm.format}
                  onValueChange={(value) =>
                    setUploadForm((current) => ({ ...current, format: value as "json" | "xml" }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="xml">XML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source Type</Label>
                <Select
                  value={uploadForm.sourceType}
                  onValueChange={(value) =>
                    setUploadForm((current) => ({ ...current, sourceType: value as ImportSourceType }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Website</Label>
              <Input
                className="mt-1"
                placeholder="https://example.com"
                value={uploadForm.website}
                onChange={(event) => setUploadForm((current) => ({ ...current, website: event.target.value }))}
              />
            </div>
            <div>
              <Label>Import Content</Label>
              <Textarea
                className="mt-1 min-h-[220px] font-mono text-xs"
                placeholder='{"items":[{"name":"Outlet Tee","brand":"Nike","category":"Clothing","price":39,"oldPrice":80,"imageUrl":"https://...","sourceUrl":"https://..."}]}'
                value={uploadForm.content}
                onChange={(event) => setUploadForm((current) => ({ ...current, content: event.target.value }))}
              />
            </div>
            <Button
              className="w-full rounded-full"
              disabled={uploading || !uploadForm.content.trim()}
              onClick={() => void submitUpload()}
            >
              {uploading ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              Queue Upload Import
            </Button>
            <p className="text-xs text-muted-foreground">
              Latest sync: {formatDateTime(summary?.lastSyncAt ?? null)}
            </p>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Import Source" : "Add Import Source"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Name</Label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div>
              <Label>Source Type</Label>
              <Select
                value={form.sourceType}
                onValueChange={(value) => setForm((current) => ({ ...current, sourceType: value as ImportSourceType }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((current) => ({ ...current, status: value as ImportSourceStatus }))}
              >
                <SelectTrigger className="mt-1">
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
            </div>
            <div>
              <Label>Sync Frequency</Label>
              <Select
                value={form.syncFrequency}
                onValueChange={(value) => setForm((current) => ({ ...current, syncFrequency: value as SyncFrequency }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_FREQUENCIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Website</Label>
              <Input
                className="mt-1"
                value={form.website}
                onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Feed URL</Label>
              <Input
                className="mt-1"
                placeholder="https://feed.example.com/products.json"
                value={form.feedUrl}
                onChange={(event) => setForm((current) => ({ ...current, feedUrl: event.target.value }))}
              />
            </div>
            <div>
              <Label>Record Path</Label>
              <Input
                className="mt-1"
                placeholder="items"
                value={form.recordPath}
                onChange={(event) => setForm((current) => ({ ...current, recordPath: event.target.value }))}
              />
            </div>
            <div>
              <Label>Source Store</Label>
              <Input
                className="mt-1"
                placeholder="Nike Outlet Feed"
                value={form.sourceStore}
                onChange={(event) => setForm((current) => ({ ...current, sourceStore: event.target.value }))}
              />
            </div>
            <div>
              <Label>Default Brand</Label>
              <Input
                className="mt-1"
                value={form.defaultBrand}
                onChange={(event) => setForm((current) => ({ ...current, defaultBrand: event.target.value }))}
              />
            </div>
            <div>
              <Label>Default Category</Label>
              <Input
                className="mt-1"
                value={form.defaultCategory}
                onChange={(event) => setForm((current) => ({ ...current, defaultCategory: event.target.value }))}
              />
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
