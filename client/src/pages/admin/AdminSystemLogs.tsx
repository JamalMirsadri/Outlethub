import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Bug, CheckCircle2, Eye, RefreshCw, Search, StickyNote, Trash2 } from "lucide-react";

import {
  addSystemLogNote,
  deleteSystemLog,
  getSystemLogsSummary,
  listSystemLogs,
  resolveSystemLog,
  type ErrorLogRecord,
  type ErrorLogSeverity,
  type ErrorLogSort,
  type ErrorLogType,
  type SystemLogsSummary,
} from "@/api/system-logs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SEVERITY_STYLES: Record<ErrorLogSeverity, string> = {
  CRITICAL: "bg-red-500/15 text-red-500",
  HIGH: "bg-orange-500/15 text-orange-500",
  MEDIUM: "bg-amber-500/15 text-amber-500",
  LOW: "bg-sky-500/15 text-sky-500",
  INFO: "bg-secondary text-muted-foreground",
};

const TYPE_STYLES: Record<ErrorLogType, string> = {
  FRONTEND: "bg-secondary text-muted-foreground",
  API: "bg-blue-500/10 text-blue-400",
  BACKEND: "bg-purple-500/10 text-purple-400",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default function AdminSystemLogs() {
  const [items, setItems] = useState<ErrorLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<SystemLogsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [severity, setSeverity] = useState<ErrorLogSeverity | "ALL">("ALL");
  const [type, setType] = useState<ErrorLogType | "ALL">("ALL");
  const [resolved, setResolved] = useState<"ALL" | "UNRESOLVED" | "RESOLVED">("UNRESOLVED");
  const [sort, setSort] = useState<ErrorLogSort>("newest");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [selected, setSelected] = useState<ErrorLogRecord | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ErrorLogRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listSystemLogs({
        page,
        pageSize,
        search: appliedSearch || undefined,
        severity: severity === "ALL" ? undefined : severity,
        type: type === "ALL" ? undefined : type,
        resolved: resolved === "ALL" ? undefined : resolved === "RESOLVED",
        sort,
      });
      setItems(response.items);
      setTotal(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load system logs.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedSearch, severity, type, resolved, sort]);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await getSystemLogsSummary());
    } catch {
      // Summary polling failures are intentionally silent.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary();
    const interval = window.setInterval(() => {
      void loadSummary();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [loadSummary]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const onResolve = async (record: ErrorLogRecord) => {
    setBusy(true);
    try {
      const updated = await resolveSystemLog(record.id);
      setSelected(updated);
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await loadSummary();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Failed to resolve log.");
    } finally {
      setBusy(false);
    }
  };

  const onSaveNote = async () => {
    if (!selected) {
      return;
    }

    setBusy(true);
    try {
      const updated = await addSystemLogNote(selected.id, noteDraft);
      setSelected(updated);
      setNoteDraft("");
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Failed to save note.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setBusy(true);
    try {
      await deleteSystemLog(pendingDelete.id);
      setPendingDelete(null);
      setSelected(null);
      await load();
      await loadSummary();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete log.");
    } finally {
      setBusy(false);
    }
  };

  const statCards = useMemo(
    () => [
      { label: "Total", value: summary?.total ?? 0, className: "text-foreground" },
      { label: "Unresolved", value: summary?.unresolved ?? 0, className: "text-foreground" },
      { label: "Critical", value: summary?.critical ?? 0, className: "text-red-500" },
      { label: "High", value: summary?.high ?? 0, className: "text-orange-500" },
    ],
    [summary],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">System Logs</h1>
          <p className="text-sm text-muted-foreground">
            Centralized frontend, API, and backend error monitoring.
          </p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className={`mt-1 font-display text-2xl font-bold ${stat.className}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applySearch();
              }
            }}
            placeholder="Search message, source, endpoint, email..."
            className="pl-10"
          />
        </div>
        <Button variant="secondary" className="rounded-full" onClick={applySearch}>
          Search
        </Button>
        <div className="flex flex-wrap gap-2">
          <Select value={severity} onValueChange={(value) => { setSeverity(value as ErrorLogSeverity | "ALL"); setPage(1); }}>
            <SelectTrigger className="w-[130px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Severity</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={(value) => { setType(value as ErrorLogType | "ALL"); setPage(1); }}>
            <SelectTrigger className="w-[130px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="FRONTEND">Frontend</SelectItem>
              <SelectItem value="API">API</SelectItem>
              <SelectItem value="BACKEND">Backend</SelectItem>
            </SelectContent>
          </Select>

          <Select value={resolved} onValueChange={(value) => { setResolved(value as "ALL" | "UNRESOLVED" | "RESOLVED"); setPage(1); }}>
            <SelectTrigger className="w-[140px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNRESOLVED">Unresolved</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="ALL">All Status</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(value) => { setSort(value as ErrorLogSort); setPage(1); }}>
            <SelectTrigger className="w-[140px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="occurrences">Most Frequent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
          No error logs found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Page / Endpoint</th>
                <th className="px-4 py-3">Count</th>
                <th className="px-4 py-3">Last Seen</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-secondary/20">
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[item.severity]}`}>
                      {item.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${TYPE_STYLES[item.type]}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 font-medium" title={item.message}>
                    {item.message}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.source ?? "—"}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                    {item.page ?? item.endpoint ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{item.occurrences}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(item.lastSeenAt)}</td>
                  <td className="px-4 py-3">
                    {item.resolved ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Activity className="h-3.5 w-3.5" /> Open
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setSelected(item); setNoteDraft(item.note ?? ""); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages} · {total} total
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
            Next
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelected(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-muted-foreground" />
              Error Details
            </DialogTitle>
            <DialogDescription>
              Full context and stack trace for this error.
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[selected.severity]}`}>
                  {selected.severity}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${TYPE_STYLES[selected.type]}`}>
                  {selected.type}
                </span>
                {selected.statusCode != null ? <Badge variant="outline">HTTP {selected.statusCode}</Badge> : null}
                <Badge variant="secondary">{selected.occurrences} occurrences</Badge>
                {selected.resolved ? (
                  <span className="text-xs text-emerald-500">Resolved</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Open</span>
                )}
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</p>
                <p className="mt-1 rounded-lg bg-secondary/40 p-3 text-sm">{selected.message}</p>
              </div>

              {selected.stack ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stack Trace</p>
                  <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-muted-foreground">
                    {selected.stack}
                  </pre>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Source" value={selected.source} />
                <InfoRow label="Method" value={selected.method} />
                <InfoRow label="Page" value={selected.page} />
                <InfoRow label="Endpoint" value={selected.endpoint} />
                <InfoRow label="User" value={selected.userEmail ?? selected.userId} />
                <InfoRow label="Role" value={selected.userRole} />
                <InfoRow label="Browser" value={selected.browser} />
                <InfoRow label="OS" value={selected.os} />
                <InfoRow label="Device" value={selected.device} />
                <InfoRow label="IP" value={selected.ip} />
                <InfoRow label="Duration" value={selected.durationMs != null ? `${selected.durationMs}ms` : null} />
                <InfoRow label="Correlation ID" value={selected.requestId} />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Internal Note</p>
                <Textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Add an internal note..."
                  className="mt-1"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => setPendingDelete(selected)}
              disabled={busy}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void onSaveNote()} disabled={busy || !noteDraft.trim()}>
                <StickyNote className="mr-1.5 h-4 w-4" />
                Save Note
              </Button>
              {selected && !selected.resolved ? (
                <Button onClick={() => void onResolve(selected)} disabled={busy}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Mark Resolved
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) { setPendingDelete(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete error log?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this error log. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDelete()} disabled={busy}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium" title={value ?? undefined}>{value ?? "—"}</p>
    </div>
  );
}
