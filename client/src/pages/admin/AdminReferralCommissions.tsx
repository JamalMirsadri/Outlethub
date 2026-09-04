import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import {
  getCommissionConfig,
  getCommissionsOverview,
  getPointSettings,
  getReferralOverview,
  listCommissions,
  listPointRewards,
  updateCommissionConfig,
  updateCommissionSettings,
  updatePointSettings,
  type ReferralAdminOverview,
  type ReferralCommissionConfigItem,
  type ReferralCommissionOverview,
  type ReferralCommissionRecord,
  type ReferralCommissionStatus,
  type ReferralPointRecord,
  type ReferralPointSettings,
  type ReferralRank,
} from "@/api/referral-commissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const RANKS: ReferralRank[] = ["SILVER", "GOLD", "PLATINUM", "DIAMOND"];
const LEVELS = [1, 2];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

interface PointFilters {
  level?: number;
  status?: "AWARDED" | "REVERSED";
  beneficiary?: string;
  purchaser?: string;
}

export default function AdminReferralCommissions() {
  const [configs, setConfigs] = useState<ReferralCommissionConfigItem[]>([]);
  const [maxLevel, setMaxLevel] = useState(2);
  const [pointSettings, setPointSettings] = useState<ReferralPointSettings | null>(null);
  const [pointForm, setPointForm] = useState({ purchaser: "5", level1: "5", level2: "4", level3: "3", maxLevel: "3" });
  const [overview, setOverview] = useState<ReferralCommissionOverview | null>(null);
  const [referralOverview, setReferralOverview] = useState<ReferralAdminOverview | null>(null);
  const [commissions, setCommissions] = useState<ReferralCommissionRecord[]>([]);
  const [pointRewards, setPointRewards] = useState<ReferralPointRecord[]>([]);
  const [commissionFilters, setCommissionFilters] = useState<{
    level?: number;
    rank?: ReferralRank;
    beneficiary?: string;
    purchaser?: string;
    status?: ReferralCommissionStatus;
  }>({});
  const [pointFilters, setPointFilters] = useState<PointFilters>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        configData,
        commissionOverviewData,
        pointSettingsData,
        referralOverviewData,
        commissionsData,
        pointRewardsData,
      ] = await Promise.all([
        getCommissionConfig(),
        getCommissionsOverview(),
        getPointSettings(),
        getReferralOverview(),
        listCommissions({
          pageSize: 100,
          level: commissionFilters.level,
          rank: commissionFilters.rank,
          referrerUserId: commissionFilters.beneficiary || undefined,
          purchaserUserId: commissionFilters.purchaser || undefined,
          status: commissionFilters.status,
        }),
        listPointRewards({
          pageSize: 100,
          level: pointFilters.level,
          status: pointFilters.status,
          beneficiaryUserId: pointFilters.beneficiary || undefined,
          purchaserUserId: pointFilters.purchaser || undefined,
        }),
      ]);
      setConfigs(configData.items);
      setMaxLevel(configData.maxCommissionLevel);
      setPointSettings(pointSettingsData);
      setPointForm({
        purchaser: String(pointSettingsData.purchaserPointsPer10EUR),
        level1: String(pointSettingsData.level1PointsPer10EUR),
        level2: String(pointSettingsData.level2PointsPer10EUR),
        level3: String(pointSettingsData.level3PointsPer10EUR),
        maxLevel: String(pointSettingsData.maxReferralLevel),
      });
      setOverview(commissionOverviewData);
      setReferralOverview(referralOverviewData);
      setCommissions(commissionsData.items);
      setPointRewards(pointRewardsData.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load referral rewards.");
    } finally {
      setLoading(false);
    }
  }, [commissionFilters, pointFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateConfig = (levelNumber: number, rank: ReferralRank, next: { percentage: string; isActive: boolean }) => {
    setConfigs((current) =>
      current.map((config) =>
        config.levelNumber === levelNumber && config.rank === rank ? { ...config, ...next } : config,
      ),
    );
  };

  const onSaveCommission = async (levelNumber: number, rank: ReferralRank) => {
    const config = configs.find((item) => item.levelNumber === levelNumber && item.rank === rank);
    if (!config) return;

    if (!window.confirm(`Save Level ${levelNumber} ${rank} commission at ${config.percentage}%?`)) return;

    setBusy(true);
    setError("");
    try {
      await updateCommissionConfig({
        levelNumber,
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

  const onSaveMaxLevel = async () => {
    if (!window.confirm(`Save maximum commission level as ${maxLevel}?`)) return;

    setBusy(true);
    setError("");
    try {
      await updateCommissionSettings({ maxCommissionLevel: maxLevel });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save maximum commission level.");
    } finally {
      setBusy(false);
    }
  };

  const onSavePointSettings = async () => {
    if (!window.confirm("Save referral point settings? This affects future rewards only.")) return;

    setBusy(true);
    setError("");
    try {
      await updatePointSettings({
        purchaserPointsPer10EUR: Number(pointForm.purchaser),
        level1PointsPer10EUR: Number(pointForm.level1),
        level2PointsPer10EUR: Number(pointForm.level2),
        level3PointsPer10EUR: Number(pointForm.level3),
        maxReferralLevel: Number(pointForm.maxLevel),
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save referral point settings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Referral Rewards</h1>
          <p className="text-sm text-muted-foreground">Points and EUR commission configuration and reporting.</p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users w/ Codes" value={referralOverview?.referrals.totalUsersWithReferralCodes ?? 0} />
        <Stat label="Direct Referrals" value={referralOverview?.referrals.totalDirectReferrals ?? 0} />
        <Stat label="Referral Points" value={referralOverview?.points.totalReferralPoints ?? 0} />
        <Stat label="Total Commission" value={`€${referralOverview?.commission.totalCommission ?? "0.00"}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="L1 / L2 / L3 Referrals" value={`${referralOverview?.referrals.level1 ?? 0} / ${referralOverview?.referrals.level2 ?? 0} / ${referralOverview?.referrals.level3 ?? 0}`} />
        <Stat label="L1 Commission" value={`€${referralOverview?.commission.level1Commission ?? "0.00"}`} />
        <Stat label="L2 Commission" value={`€${referralOverview?.commission.level2Commission ?? "0.00"}`} />
        <Stat label="Reversed Commissions" value={overview?.reversedCommissions ?? 0} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Referral Point Settings</h2>
            {pointSettings ? (
              <p className="text-xs text-muted-foreground">Last updated {formatDateTime(pointSettings.updatedAt)}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <PointField label="Purchaser / €10" value={pointForm.purchaser} onChange={(value) => setPointForm((current) => ({ ...current, purchaser: value }))} />
          <PointField label="Level 1 / €10" value={pointForm.level1} onChange={(value) => setPointForm((current) => ({ ...current, level1: value }))} />
          <PointField label="Level 2 / €10" value={pointForm.level2} onChange={(value) => setPointForm((current) => ({ ...current, level2: value }))} />
          <PointField label="Level 3 / €10" value={pointForm.level3} onChange={(value) => setPointForm((current) => ({ ...current, level3: value }))} />
          <PointField label="Max Point Level" value={pointForm.maxLevel} onChange={(value) => setPointForm((current) => ({ ...current, maxLevel: value }))} />
        </div>

        <Button className="mt-4" onClick={() => void onSavePointSettings()} disabled={busy}>
          Save Point Settings
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3">
          <h2 className="font-display text-lg font-bold">Commission Settings</h2>
        </div>

        <div className="mb-4 flex items-end gap-3 rounded-lg border border-border p-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Maximum commission level</p>
            <Input
              type="number"
              min={0}
              max={2}
              value={maxLevel}
              onChange={(event) => setMaxLevel(Number(event.target.value))}
              className="w-32"
            />
          </div>
          <Button onClick={() => void onSaveMaxLevel()} disabled={busy}>
            Save Max Level
          </Button>
        </div>

        <div className="space-y-6">
          {LEVELS.map((level) => (
            <div key={level}>
              <h3 className="mb-2 font-medium">Level {level}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {RANKS.map((rank) => {
                  const config = configs.find((item) => item.levelNumber === level && item.rank === rank);
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
                          onChange={(event) => updateConfig(level, rank, { percentage: event.target.value, isActive: config.isActive })}
                        />
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={config.isActive}
                          onChange={(event) => updateConfig(level, rank, { percentage: config.percentage, isActive: event.target.checked })}
                        />
                        Active
                      </label>
                      <Button className="mt-3 w-full" size="sm" onClick={() => void onSaveCommission(level, rank)} disabled={busy}>
                        Save
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-display text-lg font-bold">Commission History</h2>
          <select
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
            value={commissionFilters.level ?? ""}
            onChange={(event) => setCommissionFilters((current) => ({ ...current, level: event.target.value ? Number(event.target.value) : undefined }))}
          >
            <option value="">All levels</option>
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
          </select>
          <select
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
            value={commissionFilters.rank ?? ""}
            onChange={(event) => setCommissionFilters((current) => ({ ...current, rank: (event.target.value || undefined) as ReferralRank | undefined }))}
          >
            <option value="">All ranks</option>
            {RANKS.map((rank) => (
              <option key={rank} value={rank}>{rank}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
            value={commissionFilters.status ?? ""}
            onChange={(event) => setCommissionFilters((current) => ({ ...current, status: (event.target.value || undefined) as ReferralCommissionStatus | undefined }))}
          >
            <option value="">All statuses</option>
            <option value="AWARDED">Awarded</option>
            <option value="REVERSED">Reversed</option>
          </select>
          <Input
            className="w-40"
            placeholder="Beneficiary email"
            value={commissionFilters.beneficiary ?? ""}
            onChange={(event) => setCommissionFilters((current) => ({ ...current, beneficiary: event.target.value }))}
          />
          <Input
            className="w-40"
            placeholder="Purchaser email"
            value={commissionFilters.purchaser ?? ""}
            onChange={(event) => setCommissionFilters((current) => ({ ...current, purchaser: event.target.value }))}
          />
        </div>

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
                  <th className="px-3 py-2">Purchaser</th>
                  <th className="px-3 py-2">Beneficiary</th>
                  <th className="px-3 py-2">Level</th>
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
                    <td className="px-3 py-2">{commission.purchaserEmail}</td>
                    <td className="px-3 py-2">{commission.referrerEmail}</td>
                    <td className="px-3 py-2">L{commission.referralLevel}</td>
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

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-display text-lg font-bold">Point History</h2>
          <select
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
            value={pointFilters.level ?? ""}
            onChange={(event) => setPointFilters((current) => ({ ...current, level: event.target.value ? Number(event.target.value) : undefined }))}
          >
            <option value="">All levels</option>
            <option value={0}>Purchaser</option>
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
            <option value={3}>Level 3</option>
          </select>
          <select
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
            value={pointFilters.status ?? ""}
            onChange={(event) => setPointFilters((current) => ({ ...current, status: (event.target.value || undefined) as "AWARDED" | "REVERSED" | undefined }))}
          >
            <option value="">All statuses</option>
            <option value="AWARDED">Awarded</option>
            <option value="REVERSED">Reversed</option>
          </select>
          <Input
            className="w-40"
            placeholder="Beneficiary email"
            value={pointFilters.beneficiary ?? ""}
            onChange={(event) => setPointFilters((current) => ({ ...current, beneficiary: event.target.value }))}
          />
          <Input
            className="w-40"
            placeholder="Purchaser email"
            value={pointFilters.purchaser ?? ""}
            onChange={(event) => setPointFilters((current) => ({ ...current, purchaser: event.target.value }))}
          />
        </div>

        {loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-secondary" />
        ) : pointRewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No point rewards yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Purchaser</th>
                  <th className="px-3 py-2">Beneficiary</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">Points / €10</th>
                  <th className="px-3 py-2">Product Amount</th>
                  <th className="px-3 py-2">Points</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pointRewards.map((reward) => (
                  <tr key={reward.id}>
                    <td className="px-3 py-2 font-medium">{reward.orderNumber}</td>
                    <td className="px-3 py-2">{reward.purchaserEmail}</td>
                    <td className="px-3 py-2">{reward.beneficiaryEmail}</td>
                    <td className="px-3 py-2">{reward.referralLevel === 0 ? "Purchaser" : `L${reward.referralLevel}`}</td>
                    <td className="px-3 py-2">{reward.pointsPer10EUR}</td>
                    <td className="px-3 py-2">€{reward.eligibleProductAmount}</td>
                    <td className="px-3 py-2 font-medium">{reward.pointsAwarded}</td>
                    <td className="px-3 py-2">{reward.status}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(reward.createdAt)}</td>
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

function PointField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <Input type="number" min={0} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
