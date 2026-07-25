import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { Plus, Play, Pause, Pencil, Trash2, Globe, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import moment from "moment";

const SOURCE_TYPES = [
  { value: "playwright", label: "Playwright Scraper" },
  { value: "json_feed", label: "JSON Feed" },
  { value: "xml_feed", label: "XML Feed" },
  { value: "n8n_webhook", label: "n8n Webhook" },
];

const FREQ_LABELS = { manual: "Manual", hourly: "Hourly", daily: "Daily", weekly: "Weekly" };

const STATUS_ICONS = { active: CheckCircle, disabled: Pause, error: AlertCircle };
const STATUS_COLORS = { active: "text-[hsl(var(--accent))]", disabled: "text-muted-foreground", error: "text-red-400" };

const EMPTY_FORM = { name: "", website: "", source_type: "json_feed", sync_frequency: "daily", feed_url: "", notes: "" };

export default function ImportsSources() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => appClient.entities.ImportSource.list("-created_date").then(setSources).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, website: s.website || "", source_type: s.source_type, sync_frequency: s.sync_frequency || "daily", feed_url: s.feed_url || "", notes: s.notes || "" }); setDialogOpen(true); };

  const save = async () => {
    setSaving(true);
    if (editing) await appClient.entities.ImportSource.update(editing.id, form);
    else await appClient.entities.ImportSource.create(form);
    await load();
    setDialogOpen(false);
    setSaving(false);
  };

  const toggleStatus = async (s) => {
    const status = s.status === "active" ? "disabled" : "active";
    await appClient.entities.ImportSource.update(s.id, { status });
    setSources(sources.map(x => x.id === s.id ? { ...x, status } : x));
  };

  const runNow = async (s) => {
    await appClient.entities.ImportSource.update(s.id, { last_sync: new Date().toISOString() });
    await appClient.entities.ImportLog.create({ source: s.source_type, status: "running", started_at: new Date().toISOString() });
    setSources(sources.map(x => x.id === s.id ? { ...x, last_sync: new Date().toISOString() } : x));
  };

  const remove = async (s) => {
    await appClient.entities.ImportSource.delete(s.id);
    setSources(sources.filter(x => x.id !== s.id));
  };

  if (loading) return <div className="space-y-3">{Array.from({length: 4}).map((_, i) => <div key={i} className="h-20 bg-secondary rounded-xl animate-pulse" />)}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-muted-foreground">{sources.length} source{sources.length !== 1 ? "s" : ""} configured</p>
        <Button onClick={openNew} className="rounded-full"><Plus className="w-4 h-4 mr-1.5" /> Add Source</Button>
      </div>

      <div className="space-y-3">
        {sources.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl text-muted-foreground">
            <Globe className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No sources added yet. Add your first import source.</p>
          </div>
        ) : sources.map(s => {
          const StatusIcon = STATUS_ICONS[s.status] || Globe;
          const statusColor = STATUS_COLORS[s.status] || "text-muted-foreground";
          const typeLabel = SOURCE_TYPES.find(t => t.value === s.source_type)?.label || s.source_type;
          return (
            <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-4">
                <div className={`w-9 h-9 rounded-lg bg-secondary flex items-center justify-center`}>
                  <StatusIcon className={`w-4 h-4 ${statusColor}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{s.name}</p>
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{typeLabel}</span>
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{FREQ_LABELS[s.sync_frequency] || s.sync_frequency}</span>
                  </div>
                  <div className="flex gap-3 mt-0.5">
                    {s.website && <p className="text-xs text-muted-foreground">{s.website}</p>}
                    <p className="text-xs text-muted-foreground">Last sync: {s.last_sync ? moment(s.last_sync).fromNow() : "Never"}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => runNow(s)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-[hsl(var(--accent))] transition-colors" title="Run Now">
                  <Play className="w-4 h-4" />
                </button>
                <button onClick={() => toggleStatus(s)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title={s.status === "active" ? "Disable" : "Enable"}>
                  {s.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(s)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(s)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-red-400 transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Source" : "Add Import Source"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Source Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Nike Official Feed" /></div>
            <div><Label>Website</Label><Input className="mt-1" value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="https://example.com" /></div>
            <div>
              <Label>Source Type</Label>
              <Select value={form.source_type} onValueChange={v => setForm({...form, source_type: v})}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sync Frequency</Label>
              <Select value={form.sync_frequency} onValueChange={v => setForm({...form, sync_frequency: v})}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Feed URL (optional)</Label><Input className="mt-1" value={form.feed_url} onChange={e => setForm({...form, feed_url: e.target.value})} placeholder="https://feed.example.com/products.json" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving || !form.name}>{saving ? "Saving..." : "Save Source"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

