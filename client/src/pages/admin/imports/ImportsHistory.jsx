import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import moment from "moment";

const STATUS_STYLE = {
  completed: "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  running: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

export default function ImportsHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    appClient.entities.ImportLog.list("-created_date", 100).then(setLogs).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-3">{Array.from({length: 8}).map((_, i) => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}</div>;

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              {["Source", "Status", "Products Imported", "Success", "Failed", "Started At", "Finished At", ""].map(h => (
                <th key={h} className="text-left text-xs text-muted-foreground font-medium px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-muted-foreground py-16">No import history found</td></tr>
            ) : logs.map(log => {
              const StatusIcon = log.status === "completed" ? CheckCircle : log.status === "failed" ? XCircle : Clock;
              const isExpanded = expanded === log.id;
              return (
                <React.Fragment key={log.id}>
                  <tr className="border-b border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium capitalize">{log.source}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${STATUS_STYLE[log.status] || STATUS_STYLE.running}`}>
                        <StatusIcon className="w-3 h-3" />{log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{log.total_products || 0}</td>
                    <td className="px-4 py-3 font-mono text-[hsl(var(--accent))]">{log.imported || 0}</td>
                    <td className="px-4 py-3 font-mono text-red-400">{log.failed || 0}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{log.started_at ? moment(log.started_at).format("MMM D, h:mm A") : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{log.completed_at ? moment(log.completed_at).format("MMM D, h:mm A") : "—"}</td>
                    <td className="px-4 py-3">
                      {log.error_message && (
                        <button onClick={() => setExpanded(isExpanded ? null : log.id)} className="text-muted-foreground hover:text-foreground">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-secondary/20 border-b border-border">
                      <td colSpan={8} className="px-4 py-3">
                        <p className="text-xs text-muted-foreground font-semibold mb-1">Errors:</p>
                        <pre className="text-xs text-red-400 bg-red-500/5 p-3 rounded-lg overflow-x-auto">{log.error_message}</pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

