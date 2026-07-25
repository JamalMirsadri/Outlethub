import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { Upload, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import moment from "moment";

const STATUS_ICONS = { running: Clock, completed: CheckCircle, failed: XCircle };
const STATUS_COLORS = { running: "bg-yellow-500/10 text-yellow-500", completed: "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]", failed: "bg-red-500/10 text-red-500" };

export default function AdminImports() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appClient.entities.ImportLog.list("-created_date", 50).then(setLogs).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const startImport = async (source) => {
    const log = await appClient.entities.ImportLog.create({ source, status: "running", started_at: new Date().toISOString() });
    setLogs([log, ...logs]);
  };

  if (loading) return <div className="space-y-4">{Array.from({length:3}).map((_,i)=><div key={i} className="h-20 bg-secondary rounded-xl animate-pulse"/>)}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Product Imports</h1>
          <p className="text-sm text-muted-foreground">Import and sync products from affiliate networks</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => startImport("awin")} variant="outline" className="rounded-full"><Upload className="w-4 h-4 mr-1" /> Awin Import</Button>
          <Button onClick={() => startImport("cj")} variant="outline" className="rounded-full"><Upload className="w-4 h-4 mr-1" /> CJ Import</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Imported", value: logs.reduce((a, l) => a + (l.imported || 0), 0), color: "text-[hsl(var(--accent))]" },
          { label: "Failed", value: logs.reduce((a, l) => a + (l.failed || 0), 0), color: "text-destructive" },
          { label: "Last Sync", value: logs[0] ? moment(logs[0].created_date).fromNow() : "Never", color: "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-border bg-card text-center">
            <p className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Log History */}
      <h2 className="font-semibold text-sm mb-3">Import History</h2>
      {logs.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-xl">
          <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No imports yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => {
            const StatusIcon = STATUS_ICONS[log.status] || Clock;
            return (
              <div key={log.id} className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm capitalize">{log.source}</span>
                      <Badge variant="secondary" className={STATUS_COLORS[log.status]}>{log.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{moment(log.created_date).format("MMM D, YYYY h:mm A")}</p>
                  </div>
                </div>
                <div className="flex gap-6 text-sm">
                  <div className="text-center"><p className="font-mono font-semibold">{log.total_products || 0}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
                  <div className="text-center"><p className="font-mono font-semibold text-[hsl(var(--accent))]">{log.imported || 0}</p><p className="text-[10px] text-muted-foreground">Imported</p></div>
                  <div className="text-center"><p className="font-mono font-semibold text-destructive">{log.failed || 0}</p><p className="text-[10px] text-muted-foreground">Failed</p></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

