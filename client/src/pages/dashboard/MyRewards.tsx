import React, { useEffect, useMemo, useState } from "react";
import { getMyRewards, redeemLoyaltyReward, type LoyaltyCustomerRewardsResponse } from "@/api/loyalty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { Award, Gift, Gem, Loader2, Lock, Sparkles, Trophy } from "lucide-react";
import moment from "moment";

const EMPTY_REWARDS: LoyaltyCustomerRewardsResponse = {
  account: {
    id: "",
    currentPoints: 0,
    totalEarnedPoints: 0,
    totalSpentPoints: 0,
    membershipLevel: null,
  },
  progress: {
    nextLevel: null,
    percent: 0,
    pointsToNextLevel: 0,
  },
  membershipLevels: [],
  rewards: [],
  history: [],
  redemptions: [],
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function formatTransactionType(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function MyRewards() {
  const [data, setData] = useState(EMPTY_REWARDS);
  const [loading, setLoading] = useState(true);
  const [redeemingRewardId, setRedeemingRewardId] = useState("");

  const load = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      setData(await getMyRewards());
    } catch (error) {
      toast({
        title: "Unable to load rewards",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const unlockedRewards = useMemo(
    () => data.rewards.filter((reward) => reward.isUnlocked),
    [data.rewards],
  );

  const lockedRewards = useMemo(
    () => data.rewards.filter((reward) => !reward.isUnlocked),
    [data.rewards],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-3xl bg-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Loyalty Program</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">My Rewards</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Track your points, unlock higher membership levels, and redeem exclusive OutletHub rewards.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
          <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
          <span className="text-sm font-medium">{data.account.membershipLevel?.title || "Bronze"} Member</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current Points" value={data.account.currentPoints} hint="Available to redeem right now" />
        <StatCard label="Total Earned" value={data.account.totalEarnedPoints} hint="Points from completed orders" />
        <StatCard label="Total Spent" value={data.account.totalSpentPoints} hint="Redeemed and deducted points" />
        <StatCard
          label="Next Level"
          value={data.progress.nextLevel?.title || "Top Level"}
          hint={
            data.progress.nextLevel
              ? `${data.progress.pointsToNextLevel} points to go`
              : "You already reached the highest level"
          }
        />
      </div>

      <div className="luxe-panel p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Membership Progress</h3>
            <p className="text-sm text-muted-foreground">
              {data.account.membershipLevel?.title || "Bronze"} level
              {data.progress.nextLevel ? ` • Next: ${data.progress.nextLevel.title}` : " • Highest tier unlocked"}
            </p>
          </div>
          {data.account.membershipLevel ? (
            <Badge variant="outline" className="w-fit">
              {data.account.membershipLevel.minPoints}+ points
            </Badge>
          ) : null}
        </div>
        <div className="mt-5">
          <Progress value={data.progress.percent} className="h-3" />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{data.account.currentPoints} pts</span>
            <span>{Math.round(data.progress.percent)}%</span>
            <span>{data.progress.nextLevel ? data.progress.nextLevel.minPoints : data.account.currentPoints} pts</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {data.membershipLevels.map((level) => {
          const active = data.account.membershipLevel?.id === level.id;
          return (
            <div key={level.id} className={`rounded-3xl border p-5 ${active ? "border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/8" : "border-border bg-card"}`}>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border" style={{ backgroundColor: `${level.color}1f`, color: level.color }}>
                  <Trophy className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold">{level.title}</p>
                  <p className="text-xs text-muted-foreground">{level.minPoints}+ points</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                {level.benefits.map((benefit) => (
                  <p key={benefit}>• {benefit}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">Rewards Available</h3>
          </div>
          <div className="mt-5 space-y-4">
            {unlockedRewards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No rewards are unlocked yet.
              </div>
            ) : (
              unlockedRewards.map((reward) => (
                <div key={reward.id} className="rounded-3xl border border-border bg-card p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold">{reward.title}</h4>
                        <Badge>{reward.pointsCost} pts</Badge>
                        {reward.minMembershipLevel ? <Badge variant="outline">{reward.minMembershipLevel.title}+</Badge> : null}
                      </div>
                      {reward.description ? <p className="mt-2 text-sm text-muted-foreground">{reward.description}</p> : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {reward.benefits.map((benefit) => (
                          <Badge key={benefit} variant="outline">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      disabled={!reward.isRedeemable || redeemingRewardId === reward.id}
                      onClick={async () => {
                        setRedeemingRewardId(reward.id);
                        try {
                          await redeemLoyaltyReward(reward.id);
                          await load({ silent: true });
                          toast({
                            title: "Reward redeemed",
                            description: `${reward.title} was redeemed successfully.`,
                          });
                        } catch (error) {
                          toast({
                            title: "Unable to redeem reward",
                            description: error instanceof Error ? error.message : "Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setRedeemingRewardId("");
                        }
                      }}
                    >
                      {redeemingRewardId === reward.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Gem className="mr-2 h-4 w-4" />
                      )}
                      {reward.isRedeemable ? "Redeem" : "Not Enough Points"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-xl font-semibold">Locked Rewards</h3>
          </div>
          <div className="mt-5 space-y-4">
            {lockedRewards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                All current rewards are already unlocked for your level.
              </div>
            ) : (
              lockedRewards.map((reward) => (
                <div key={reward.id} className="rounded-3xl border border-border bg-card/80 p-5 opacity-80">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold">{reward.title}</h4>
                    <Badge variant="outline">{reward.pointsCost} pts</Badge>
                    {reward.minMembershipLevel ? <Badge variant="outline">{reward.minMembershipLevel.title}+</Badge> : null}
                  </div>
                  {reward.description ? <p className="mt-2 text-sm text-muted-foreground">{reward.description}</p> : null}
                  <p className="mt-4 text-sm text-muted-foreground">
                    Unlock this reward by reaching the required membership level.
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">Reward History</h3>
          </div>
          <div className="mt-5 space-y-4">
            {data.redemptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                You have not redeemed any rewards yet.
              </div>
            ) : (
              data.redemptions.map((redemption) => (
                <div key={redemption.id} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{redemption.reward.title}</p>
                      <p className="text-sm text-muted-foreground">{moment(redemption.redeemedAt).format("MMM D, YYYY • HH:mm")}</p>
                    </div>
                    <Badge>{redemption.pointsSpent} pts</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">Point History</h3>
          </div>
          <div className="mt-5 space-y-4">
            {data.history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Your loyalty history will appear here after your first completed order or reward redemption.
              </div>
            ) : (
              data.history.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{entry.description}</p>
                        <Badge variant="outline">{formatTransactionType(entry.type)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {moment(entry.createdAt).format("MMM D, YYYY • HH:mm")}
                        {entry.order ? ` • ${entry.order.orderNumber}` : ""}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className={`font-semibold ${entry.pointsDelta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {entry.pointsDelta >= 0 ? "+" : ""}
                        {entry.pointsDelta}
                      </p>
                      <p className="text-xs text-muted-foreground">Balance {entry.balanceAfter}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
