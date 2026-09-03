import { useCallback, useEffect, useState } from "react";
import { Ban, Plus, RefreshCw, ShieldOff, TimerReset } from "lucide-react";

import {
  createManualBlock,
  extendSecurityBlock,
  getSecurityBlockOverview,
  listSecurityBlocks,
  releaseSecurityBlock,
  type SecurityBlock,
  type SecurityBlockOverview,
} from "@/api/system-logs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default function SecurityBlocks() {
  const [overview, setOverview] = useState<SecurityBlockOverview | null>(null);
  const [blocks, setBlocks] = useState<SecurityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [ip, setIp] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [overviewData, blocksData] = await Promise.all([
        getSecurityBlockOverview(),
        listSecurityBlocks({ pageSize: 50 }),
      ]);
      setOverview(overviewData);
      setBlocks(blocksData.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load security blocks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onBlock = async () => {
    if (!ip.trim() || !reason.trim()) {
      setError("IP and reason are required.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await createManualBlock({ ip: ip.trim(), durationMinutes, reason: reason.trim() });
      setIp("");
      setReason("");
      await load();
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : "Failed to block IP.");
    } finally {
      setBusy(false);
    }
  };

  const onRelease = async (block: SecurityBlock) => {
    setBusy(true);
    setError("");
    try {
      await releaseSecurityBlock(block.id);
      await load();
    } catch (releaseError) {
      setError(releaseError instanceof Error ? releaseError.message : "Failed to release block.");
    } finally {
      setBusy(false);
    }
  };

  const onExtend = async (block: SecurityBlock) => {
    setBusy(true);
    setError("");
    try {
      await extendSecurityBlock(block.id, 60);
      await load();
    } catch (extendError) {
      setError(extendError instanceof Error ? extendError.message : "Failed to extend block.");
    } finally {
      setBusy(false);
    }
  };

  const activeBlocks = blocks.filter((block) => block.status === "ACTIVE");

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Ban className="h-5 w-5 text-red-400" />
          <h2 className="font-display text-lg font-bold">Active Blocks</h2>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active Blocks" value={overview?.activeBlocks ?? 0} tone="text-red-500" />
        <Stat label="Blocks (24h)" value={overview?.blocks24h ?? 0} tone="text-foreground" />
        <Stat label="Blocked Requests (24h)" value={overview?.blockedRequests24h ?? 0} tone="text-red-500" />
        <Stat label="Rate Limited (24h)" value={overview?.rateLimited24h ?? 0} tone="text-amber-500" />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      <div className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-4">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">IP address</p>
          <Input value={ip} onChange={(event) => setIp(event.target.value)} placeholder="1.2.3.4" />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Duration (minutes)</p>
          <Input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value) || 30)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Reason</p>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Manual block reason" />
        </div>
        <div className="flex items-end">
          <Button onClick={() => void onBlock()} disabled={busy} className="w-full">
            <Plus className="mr-1.5 h-4 w-4" />
            Block IP
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-12 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      ) : activeBlocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active blocks.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Attack</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Blocked At</th>
                <th className="px-4 py-3">Expires At</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeBlocks.map((block) => (
                <tr key={block.id} className="hover:bg-secondary/20">
                  <td className="px-4 py-3 font-mono">{block.ip}</td>
                  <td className="max-w-[220px] truncate px-4 py-3" title={block.reason}>
                    {block.reason}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{block.attackType ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{block.riskScore}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(block.blockedAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(block.expiresAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => void onExtend(block)} disabled={busy}>
                        <TimerReset className="h-4 w-4" />
                        Extend 1h
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void onRelease(block)} disabled={busy}>
                        <ShieldOff className="h-4 w-4" />
                        Unblock
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
