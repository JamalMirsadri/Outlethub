import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { listImportJobs, type ImportJobRecord, type ImportJobStatus } from "@/api/imports";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const JOB_STATUSES: Array<{ value: "ALL" | ImportJobStatus; label: string }> = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "RUNNING", label: "Running" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
];

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

export default function ImportsJobs() {
  const [jobs, setJobs] = useState<ImportJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"ALL" | ImportJobStatus>("ALL");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const items = await listImportJobs({
        status: status === "ALL" ? undefined : status,
        limit: 100,
      });
      setJobs(items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load import jobs.");
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
          <h2 className="font-semibold">Import Jobs</h2>
          <p className="text-sm text-muted-foreground">Queue lifecycle, stage totals, unchanged outcomes, and trace links.</p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={(value) => setStatus(value as "ALL" | ImportJobStatus)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_STATUSES.map((option) => (
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
                {["Source", "Status", "Discovery", "Validate", "Imported", "Updated", "Unchanged", "Failed", "Trace"].map(
                  (header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                    No import jobs found.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{job.source?.name ?? "Admin Upload"}</div>
                      <div className="text-xs text-muted-foreground">{job.source?.sourceType ?? job.triggerMode}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">{job.status}</td>
                    <td className="px-4 py-3 font-mono">
                      {job.discoveredCount} / {job.fetchedCount}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {job.normalizedCount} / {job.validatedCount}
                    </td>
                    <td className="px-4 py-3 font-mono text-[hsl(var(--accent))]">{job.importedCount}</td>
                    <td className="px-4 py-3 font-mono">{job.updatedCount}</td>
                    <td className="px-4 py-3 font-mono">{job.unchangedCount}</td>
                    <td className="px-4 py-3 font-mono text-red-400">{job.failedCount}</td>
                    <td className="px-4 py-3 text-xs">
                      <Link to={`/admin/imports/jobs/${job.id}`} className="text-[hsl(var(--accent))] hover:underline">
                        Open Trace
                      </Link>
                    </td>
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
