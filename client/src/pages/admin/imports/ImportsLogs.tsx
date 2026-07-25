import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { listImportLogs, type ImportLogLevel, type ImportLogRecord } from "@/api/imports";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LOG_LEVELS: Array<{ value: "ALL" | ImportLogLevel; label: string }> = [
  { value: "ALL", label: "All Levels" },
  { value: "INFO", label: "Info" },
  { value: "WARN", label: "Warn" },
  { value: "ERROR", label: "Error" },
];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default function ImportsLogs() {
  const [logs, setLogs] = useState<ImportLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<"ALL" | ImportLogLevel>("ALL");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setLogs(
        await listImportLogs({
          level: level === "ALL" ? undefined : level,
          limit: 200,
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load import logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [level]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold">Import Logs</h2>
          <p className="text-sm text-muted-foreground">Structured log trail for parser, normalizer, and queue activity.</p>
        </div>
        <div className="flex gap-2">
          <Select value={level} onValueChange={(value) => setLevel(value as "ALL" | ImportLogLevel)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOG_LEVELS.map((option) => (
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
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-14 rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Time", "Level", "Source", "Job", "Message"].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    No import logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{log.level}</td>
                    <td className="px-4 py-3">{log.job?.source?.name ?? "Admin Upload"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.jobId}</td>
                    <td className="px-4 py-3">{log.message}</td>
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
