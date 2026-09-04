import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import {
  getCommissionConfig,
  getCommissionsOverview,
  listCommissions,
  updateCommissionConfig,
  type ReferralCommissionConfigItem,
  type ReferralCommissionOverview,
  type ReferralCommissionRecord,
  type ReferralRank,
} from "@/api/referral-commissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const RANKS: ReferralRank[] = ["SILVER", "GOLD", "PLATINUM", "DIAMOND"];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default function AdminReferralCommissions() {
  const [configs, setConfigs] = useState<ReferralCommissionConfigItem[]>([]);
  const [overview, setOverview] = useState<ReferralCommissionOverview | null>(null);
  const [commissions, setCommissions] = useState<ReferralCommissionRecord[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [configData, overviewData, commissionsData] = await Promise.all([
        getCommissionConfig(),
        getCommissionsOverview(),
        listCommissions({ pageSize: 50 }),
      ]);
      setConfigs(configData.items);
      setOverview(overviewData);
      setCommissions(commissionsData.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load referral commissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateConfig = (rank: ReferralRank, next: { percentage: string; isActive: boolean }) => {
    setConfigs((current) =>
      current.map((config) => (config.rank === rank ? { ...config, ...next } : config)),
    );
  };

  const onSave = async (rank: ReferralRank) => {
    const config = configs.find((item) => item.rank === rank);
    if (!config) return;

    setBusy(true);
    setError("");
    try {
      await updateCommissionConfig({
        rank,
        percentage: Number(config.percentage),
        isActive: config.isActive,
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save commission config.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Referral Commissions</h1>
          <p className="text-sm text-muted-foreground">Rank-based commission configuration and monitoring.</p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Commissions" value={overview?.totalCommissions ?? 0} />
        <Stat label="Total Amount" value={`€${overview?.totalAmount ?? "0.00"}`} />
        <Stat label="Reversed" value={overview?.reversedCommissions ?? 0} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Rank Commission Config</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RANKS.map((rank) => {
            const config = configs.find((item) => item.rank === rank);
            if (!config) return null;
            return (
              <div key={rank} className="rounded-lg border border-border p-4">
                <p className="font-medium">{rank}</p>
                <div className="mt-2">
                  <p className="mb-1 text-xs text-muted-foreground">Percentage (%)</p>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={config.percentage}
                    onChange={(event) => updateConfig(rank, { percentage: event.target.value, isActive: config.isActive })}
                  />
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.isActive}
                    onChange={(event) => updateConfig(rank, { percentage: config.percentage, isActive: event.target.checked })}
                  />
                  Active
                </label>
                <Button className="mt-3 w-full" size="sm" onClick={() => void onSave(rank)} disabled={busy}>
                  Save
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Commission History</h2>
        {loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-secondary" />
        ) : commissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No commissions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Referrer</th>
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Product Amount</th>
                  <th className="px-3 py-2">Commission</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissions.map((commission) => (
                  <tr key={commission.id}>
                    <td className="px-3 py-2 font-medium">{commission.orderNumber}</td>
                    <td className="px-3 py-2">{commission.referrerEmail}</td>
                    <td className="px-3 py-2">{commission.rank}</td>
                    <td className="px-3 py-2">{commission.percentage}%</td>
                    <td className="px-3 py-2">€{commission.eligibleProductAmount}</td>
                    <td className="px-3 py-2 font-medium">€{commission.commissionAmount}</td>
                    <td className="px-3 py-2">{commission.status}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(commission.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
