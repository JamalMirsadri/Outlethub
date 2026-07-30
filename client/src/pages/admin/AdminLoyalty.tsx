import React, { useEffect, useMemo, useState } from "react";
import { getAdminCouponOverview } from "@/api/coupons";
import {
  createLoyaltyManualAdjustment,
  createLoyaltyMembershipLevel,
  createLoyaltyPointRule,
  createLoyaltyReward,
  deleteLoyaltyMembershipLevel,
  deleteLoyaltyPointRule,
  deleteLoyaltyReward,
  getAdminLoyaltyOverview,
  type LoyaltyAdminOverviewResponse,
  type LoyaltyRewardPayload,
  updateLoyaltyMembershipLevel,
  updateLoyaltyPointRule,
  updateLoyaltyReward,
} from "@/api/loyalty";
import { listAdminUsers } from "@/api/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Award, Gift, Loader2, Pencil, Plus, Save, Sparkles, Trash2, Trophy } from "lucide-react";
import moment from "moment";

const EMPTY_OVERVIEW: LoyaltyAdminOverviewResponse = {
  summary: {
    totalAccounts: 0,
    totalCurrentPoints: 0,
    totalEarnedPoints: 0,
    totalSpentPoints: 0,
  },
  pointRules: [],
  membershipLevels: [],
  rewards: [],
  pointHistory: [],
};

const DEFAULT_RULE_FORM = {
  id: "",
  name: "",
  spendAmount: "1",
  pointsAwarded: "1",
  currency: "EUR",
  isActive: true,
  isDefault: false,
  notes: "",
};

const DEFAULT_LEVEL_FORM = {
  id: "",
  title: "",
  minPoints: "0",
  color: "#B08D57",
  icon: "medal",
  benefitsText: "",
  sortOrder: "0",
  isActive: true,
};

const DEFAULT_REWARD_FORM = {
  id: "",
  title: "",
  description: "",
  pointsCost: "100",
  rewardType: "PERCENTAGE_DISCOUNT",
  startsAt: "",
  endsAt: "",
  minMembershipLevelId: "none",
  couponTemplateId: "none",
  couponPercentage: "5",
  couponFixedAmount: "",
  couponMinimumOrderAmount: "",
  couponMaximumDiscountAmount: "",
  couponDurationDays: "30",
  couponCodePrefix: "",
  color: "#D4AF37",
  icon: "gift",
  benefitsText: "",
  stockLimit: "",
  sortOrder: "0",
  isActive: true,
};

function toLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTransactionType(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function AdminLoyalty() {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [users, setUsers] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSection, setSavingSection] = useState("");
  const [ruleForm, setRuleForm] = useState(DEFAULT_RULE_FORM);
  const [levelForm, setLevelForm] = useState(DEFAULT_LEVEL_FORM);
  const [rewardForm, setRewardForm] = useState(DEFAULT_REWARD_FORM);
  const [couponTemplates, setCouponTemplates] = useState<Array<{ id: string; code: string; description: string | null }>>([]);
  const [adjustmentForm, setAdjustmentForm] = useState({
    userId: "",
    pointsDelta: "0",
    reason: "",
  });

  const membershipLevelOptions = useMemo(
    () => overview.membershipLevels.filter((level) => level.isActive),
    [overview.membershipLevels],
  );

  const load = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [overviewResponse, usersResponse, couponOverview] = await Promise.all([
        getAdminLoyaltyOverview(),
        listAdminUsers({ pageSize: 100, status: "ALL" }),
        getAdminCouponOverview(),
      ]);

      setOverview(overviewResponse);
      setUsers(
        usersResponse.items.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
        })),
      );
      setCouponTemplates(couponOverview.coupons.map((coupon) => ({ id: coupon.id, code: coupon.code, description: coupon.description })));
    } catch (error) {
      toast({
        title: "Unable to load loyalty settings",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetRuleForm = () => setRuleForm(DEFAULT_RULE_FORM);
  const resetLevelForm = () => setLevelForm(DEFAULT_LEVEL_FORM);
  const resetRewardForm = () => setRewardForm(DEFAULT_REWARD_FORM);

  const submitRule = async () => {
    setSavingSection("rule");

    try {
      const payload = {
        name: ruleForm.name,
        spendAmount: Number(ruleForm.spendAmount),
        pointsAwarded: Number(ruleForm.pointsAwarded),
        currency: ruleForm.currency || "EUR",
        isActive: ruleForm.isActive,
        isDefault: ruleForm.isDefault,
        notes: ruleForm.notes || null,
      };

      if (ruleForm.id) {
        await updateLoyaltyPointRule(ruleForm.id, payload);
      } else {
        await createLoyaltyPointRule(payload);
      }

      resetRuleForm();
      await load({ silent: true });
      toast({
        title: "Point rule saved",
        description: "The earning rule was updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to save point rule",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSection("");
    }
  };

  const submitLevel = async () => {
    setSavingSection("level");

    try {
      const payload = {
        title: levelForm.title,
        minPoints: Number(levelForm.minPoints),
        color: levelForm.color || null,
        icon: levelForm.icon || null,
        benefits: toLines(levelForm.benefitsText),
        sortOrder: Number(levelForm.sortOrder),
        isActive: levelForm.isActive,
      };

      if (levelForm.id) {
        await updateLoyaltyMembershipLevel(levelForm.id, payload);
      } else {
        await createLoyaltyMembershipLevel(payload);
      }

      resetLevelForm();
      await load({ silent: true });
      toast({
        title: "Membership level saved",
        description: "The loyalty tier was updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to save membership level",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSection("");
    }
  };

  const submitReward = async () => {
    setSavingSection("reward");

    try {
      const payload: LoyaltyRewardPayload = {
        title: rewardForm.title,
        description: rewardForm.description || null,
        pointsCost: Number(rewardForm.pointsCost),
        rewardType: rewardForm.rewardType as LoyaltyRewardPayload["rewardType"],
        startsAt: rewardForm.startsAt ? new Date(rewardForm.startsAt).toISOString() : null,
        endsAt: rewardForm.endsAt ? new Date(rewardForm.endsAt).toISOString() : null,
        minMembershipLevelId: rewardForm.minMembershipLevelId === "none" ? null : rewardForm.minMembershipLevelId,
        couponTemplateId: rewardForm.couponTemplateId === "none" ? null : rewardForm.couponTemplateId,
        couponPercentage: rewardForm.couponPercentage ? Number(rewardForm.couponPercentage) : null,
        couponFixedAmount: rewardForm.couponFixedAmount ? Number(rewardForm.couponFixedAmount) : null,
        couponMinimumOrderAmount: rewardForm.couponMinimumOrderAmount ? Number(rewardForm.couponMinimumOrderAmount) : null,
        couponMaximumDiscountAmount: rewardForm.couponMaximumDiscountAmount ? Number(rewardForm.couponMaximumDiscountAmount) : null,
        couponDurationDays: rewardForm.couponDurationDays ? Number(rewardForm.couponDurationDays) : null,
        couponCodePrefix: rewardForm.couponCodePrefix || null,
        color: rewardForm.color || null,
        icon: rewardForm.icon || null,
        benefits: toLines(rewardForm.benefitsText),
        stockLimit: rewardForm.stockLimit ? Number(rewardForm.stockLimit) : null,
        sortOrder: Number(rewardForm.sortOrder),
        isActive: rewardForm.isActive,
      };

      if (rewardForm.id) {
        await updateLoyaltyReward(rewardForm.id, payload);
      } else {
        await createLoyaltyReward(payload);
      }

      resetRewardForm();
      await load({ silent: true });
      toast({
        title: "Reward saved",
        description: "The reward catalog was updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to save reward",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSection("");
    }
  };

  const submitManualAdjustment = async () => {
    setSavingSection("adjustment");

    try {
      await createLoyaltyManualAdjustment({
        userId: adjustmentForm.userId,
        pointsDelta: Number(adjustmentForm.pointsDelta),
        reason: adjustmentForm.reason,
      });

      setAdjustmentForm({
        userId: "",
        pointsDelta: "0",
        reason: "",
      });
      await load({ silent: true });
      toast({
        title: "Adjustment applied",
        description: "Customer points were updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to adjust points",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSection("");
    }
  };

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
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Customer Loyalty</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Loyalty</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage point rules, membership levels, rewards, manual adjustments, and full point history.
          </p>
        </div>
        <Button variant="outline" className="w-full md:w-auto" onClick={() => void load({ silent: true })} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accounts" value={overview.summary.totalAccounts} hint="Customers with loyalty profiles" />
        <StatCard label="Current Points" value={overview.summary.totalCurrentPoints} hint="Live balance across customers" />
        <StatCard label="Earned" value={overview.summary.totalEarnedPoints} hint="All points earned over time" />
        <StatCard label="Spent" value={overview.summary.totalSpentPoints} hint="All redeemed or deducted points" />
      </div>

      <Tabs defaultValue="point-rules" className="space-y-6">
        <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-2xl bg-secondary/50 p-2">
          <TabsTrigger value="point-rules">Point Rules</TabsTrigger>
          <TabsTrigger value="membership-levels">Membership Levels</TabsTrigger>
          <TabsTrigger value="reward-settings">Reward Settings</TabsTrigger>
          <TabsTrigger value="manual-adjustment">Manual Point Adjustment</TabsTrigger>
          <TabsTrigger value="point-history">Point History</TabsTrigger>
        </TabsList>

        <TabsContent value="point-rules" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="luxe-panel space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Point Rule</h2>
                  <p className="text-sm text-muted-foreground">Define how many points customers earn per order amount.</p>
                </div>
                {ruleForm.id ? (
                  <Button variant="ghost" onClick={resetRuleForm}>
                    New Rule
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={ruleForm.name} onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Spend Amount</Label>
                  <Input type="number" min="0" step="0.01" value={ruleForm.spendAmount} onChange={(event) => setRuleForm((current) => ({ ...current, spendAmount: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Points Awarded</Label>
                  <Input type="number" min="1" step="1" value={ruleForm.pointsAwarded} onChange={(event) => setRuleForm((current) => ({ ...current, pointsAwarded: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={ruleForm.currency} onChange={(event) => setRuleForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={ruleForm.notes} onChange={(event) => setRuleForm((current) => ({ ...current, notes: event.target.value }))} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border p-4">
                <div>
                  <p className="font-medium">Active</p>
                  <p className="text-sm text-muted-foreground">Inactive rules are ignored.</p>
                </div>
                <Switch checked={ruleForm.isActive} onCheckedChange={(checked) => setRuleForm((current) => ({ ...current, isActive: checked }))} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border p-4">
                <div>
                  <p className="font-medium">Default Rule</p>
                  <p className="text-sm text-muted-foreground">The default rule is used for completed orders.</p>
                </div>
                <Switch checked={ruleForm.isDefault} onCheckedChange={(checked) => setRuleForm((current) => ({ ...current, isDefault: checked }))} />
              </div>

              <Button className="w-full" onClick={submitRule} disabled={savingSection === "rule"}>
                {savingSection === "rule" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Point Rule
              </Button>
            </div>

            <div className="grid gap-4">
              {overview.pointRules.map((rule) => (
                <div key={rule.id} className="luxe-panel p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{rule.name}</h3>
                        {rule.isDefault ? <Badge>Default</Badge> : null}
                        {!rule.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Every {rule.spendAmount} {rule.currency} spent earns {rule.pointsAwarded} points.
                      </p>
                      {rule.notes ? <p className="mt-2 text-sm text-muted-foreground">{rule.notes}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setRuleForm({
                            id: rule.id,
                            name: rule.name,
                            spendAmount: String(rule.spendAmount),
                            pointsAwarded: String(rule.pointsAwarded),
                            currency: rule.currency,
                            isActive: rule.isActive,
                            isDefault: rule.isDefault,
                            notes: rule.notes || "",
                          })
                        }
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await deleteLoyaltyPointRule(rule.id);
                            await load({ silent: true });
                            toast({ title: "Point rule deleted" });
                          } catch (error) {
                            toast({
                              title: "Unable to delete point rule",
                              description: error instanceof Error ? error.message : "Please try again.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="membership-levels" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="luxe-panel space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Membership Level</h2>
                  <p className="text-sm text-muted-foreground">Define thresholds, colors, icons, and benefits for each tier.</p>
                </div>
                {levelForm.id ? (
                  <Button variant="ghost" onClick={resetLevelForm}>
                    New Level
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={levelForm.title} onChange={(event) => setLevelForm((current) => ({ ...current, title: event.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Minimum Points</Label>
                  <Input type="number" min="0" step="1" value={levelForm.minPoints} onChange={(event) => setLevelForm((current) => ({ ...current, minPoints: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Sort Order</Label>
                  <Input type="number" min="0" step="1" value={levelForm.sortOrder} onChange={(event) => setLevelForm((current) => ({ ...current, sortOrder: event.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input value={levelForm.color} onChange={(event) => setLevelForm((current) => ({ ...current, color: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Input value={levelForm.icon} onChange={(event) => setLevelForm((current) => ({ ...current, icon: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Benefits</Label>
                <Textarea
                  placeholder="One benefit per line"
                  value={levelForm.benefitsText}
                  onChange={(event) => setLevelForm((current) => ({ ...current, benefitsText: event.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border p-4">
                <div>
                  <p className="font-medium">Active</p>
                  <p className="text-sm text-muted-foreground">Inactive levels are hidden from the program.</p>
                </div>
                <Switch checked={levelForm.isActive} onCheckedChange={(checked) => setLevelForm((current) => ({ ...current, isActive: checked }))} />
              </div>

              <Button className="w-full" onClick={submitLevel} disabled={savingSection === "level"}>
                {savingSection === "level" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Award className="mr-2 h-4 w-4" />}
                Save Membership Level
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {overview.membershipLevels.map((level) => (
                <div key={level.id} className="luxe-panel p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border" style={{ backgroundColor: `${level.color}1f`, color: level.color }}>
                          <Trophy className="h-4 w-4" />
                        </span>
                        <div>
                          <h3 className="text-lg font-semibold">{level.title}</h3>
                          <p className="text-sm text-muted-foreground">{level.minPoints}+ points</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {level.benefits.map((benefit) => (
                          <Badge key={benefit} variant="outline">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {!level.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setLevelForm({
                          id: level.id,
                          title: level.title,
                          minPoints: String(level.minPoints),
                          color: level.color,
                          icon: level.icon || "",
                          benefitsText: level.benefits.join("\n"),
                          sortOrder: String(level.sortOrder),
                          isActive: level.isActive,
                        })
                      }
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await deleteLoyaltyMembershipLevel(level.id);
                          await load({ silent: true });
                          toast({ title: "Membership level deleted" });
                        } catch (error) {
                          toast({
                            title: "Unable to delete membership level",
                            description: error instanceof Error ? error.message : "Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reward-settings" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="luxe-panel space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Reward</h2>
                  <p className="text-sm text-muted-foreground">Create redeemable rewards and lock them by level if needed.</p>
                </div>
                {rewardForm.id ? (
                  <Button variant="ghost" onClick={resetRewardForm}>
                    New Reward
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={rewardForm.title} onChange={(event) => setRewardForm((current) => ({ ...current, title: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={rewardForm.description} onChange={(event) => setRewardForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Points Cost</Label>
                  <Input type="number" min="1" step="1" value={rewardForm.pointsCost} onChange={(event) => setRewardForm((current) => ({ ...current, pointsCost: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Usage Limit</Label>
                  <Input type="number" min="1" step="1" value={rewardForm.stockLimit} onChange={(event) => setRewardForm((current) => ({ ...current, stockLimit: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reward Type</Label>
                <Select value={rewardForm.rewardType} onValueChange={(value) => setRewardForm((current) => ({ ...current, rewardType: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE_DISCOUNT">Percentage Discount Coupon</SelectItem>
                    <SelectItem value="FIXED_AMOUNT_DISCOUNT">Fixed Amount Coupon</SelectItem>
                    <SelectItem value="FREE_SHIPPING">Free Shipping Coupon</SelectItem>
                    <SelectItem value="COUPON_TEMPLATE">Coupon Template</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="datetime-local" value={rewardForm.startsAt} onChange={(event) => setRewardForm((current) => ({ ...current, startsAt: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="datetime-local" value={rewardForm.endsAt} onChange={(event) => setRewardForm((current) => ({ ...current, endsAt: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Minimum Membership Level</Label>
                <Select value={rewardForm.minMembershipLevelId} onValueChange={(value) => setRewardForm((current) => ({ ...current, minMembershipLevelId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="No restriction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No restriction</SelectItem>
                    {membershipLevelOptions.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {rewardForm.rewardType === "COUPON_TEMPLATE" ? (
                <div className="space-y-2">
                  <Label>Coupon Template</Label>
                  <Select value={rewardForm.couponTemplateId} onValueChange={(value) => setRewardForm((current) => ({ ...current, couponTemplateId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a coupon template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select template</SelectItem>
                      {couponTemplates.map((coupon) => (
                        <SelectItem key={coupon.id} value={coupon.id}>
                          {coupon.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {rewardForm.rewardType === "PERCENTAGE_DISCOUNT" ? (
                <div className="space-y-2">
                  <Label>Coupon Percentage</Label>
                  <Input type="number" min="1" max="100" step="0.01" value={rewardForm.couponPercentage} onChange={(event) => setRewardForm((current) => ({ ...current, couponPercentage: event.target.value }))} />
                </div>
              ) : null}
              {rewardForm.rewardType === "FIXED_AMOUNT_DISCOUNT" ? (
                <div className="space-y-2">
                  <Label>Coupon Fixed Amount</Label>
                  <Input type="number" min="0.01" step="0.01" value={rewardForm.couponFixedAmount} onChange={(event) => setRewardForm((current) => ({ ...current, couponFixedAmount: event.target.value }))} />
                </div>
              ) : null}
              {rewardForm.rewardType !== "COUPON_TEMPLATE" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Coupon Minimum Order</Label>
                    <Input type="number" min="0" step="0.01" value={rewardForm.couponMinimumOrderAmount} onChange={(event) => setRewardForm((current) => ({ ...current, couponMinimumOrderAmount: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Coupon Maximum Discount</Label>
                    <Input type="number" min="0" step="0.01" value={rewardForm.couponMaximumDiscountAmount} onChange={(event) => setRewardForm((current) => ({ ...current, couponMaximumDiscountAmount: event.target.value }))} />
                  </div>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Coupon Expiry Days</Label>
                  <Input type="number" min="1" step="1" value={rewardForm.couponDurationDays} onChange={(event) => setRewardForm((current) => ({ ...current, couponDurationDays: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Coupon Code Prefix</Label>
                  <Input value={rewardForm.couponCodePrefix} onChange={(event) => setRewardForm((current) => ({ ...current, couponCodePrefix: event.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input value={rewardForm.color} onChange={(event) => setRewardForm((current) => ({ ...current, color: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Input value={rewardForm.icon} onChange={(event) => setRewardForm((current) => ({ ...current, icon: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Benefits</Label>
                <Textarea
                  placeholder="One benefit per line"
                  value={rewardForm.benefitsText}
                  onChange={(event) => setRewardForm((current) => ({ ...current, benefitsText: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" min="0" step="1" value={rewardForm.sortOrder} onChange={(event) => setRewardForm((current) => ({ ...current, sortOrder: event.target.value }))} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border p-4">
                <div>
                  <p className="font-medium">Active</p>
                  <p className="text-sm text-muted-foreground">Only active rewards are shown to customers.</p>
                </div>
                <Switch checked={rewardForm.isActive} onCheckedChange={(checked) => setRewardForm((current) => ({ ...current, isActive: checked }))} />
              </div>

              <Button className="w-full" onClick={submitReward} disabled={savingSection === "reward"}>
                {savingSection === "reward" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                Save Reward
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {overview.rewards.map((reward) => (
                <div key={reward.id} className="luxe-panel p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{reward.title}</h3>
                        <Badge>{reward.pointsCost} pts</Badge>
                        {!reward.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                      </div>
                      {reward.description ? <p className="mt-2 text-sm text-muted-foreground">{reward.description}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary">{reward.rewardType.replaceAll("_", " ")}</Badge>
                        {reward.minMembershipLevel ? <Badge variant="outline">{reward.minMembershipLevel.title}+</Badge> : null}
                        {reward.usageLimit !== null ? <Badge variant="outline">Usage {reward.usageLimit}</Badge> : null}
                        <Badge variant="outline">Redeemed {reward.redemptionCount ?? 0}</Badge>
                        {reward.couponTemplate ? <Badge variant="outline">Template {reward.couponTemplate.code}</Badge> : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {reward.benefits.map((benefit) => (
                          <Badge key={benefit} variant="outline">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setRewardForm({
                          id: reward.id,
                          title: reward.title,
                          description: reward.description || "",
                          pointsCost: String(reward.pointsCost),
                          rewardType: reward.rewardType,
                          startsAt: reward.startsAt ? moment(reward.startsAt).format("YYYY-MM-DDTHH:mm") : "",
                          endsAt: reward.endsAt ? moment(reward.endsAt).format("YYYY-MM-DDTHH:mm") : "",
                          minMembershipLevelId: reward.minMembershipLevelId || "none",
                          couponTemplateId: reward.couponTemplateId || "none",
                          couponPercentage: reward.couponPercentage !== null && reward.couponPercentage !== undefined ? String(reward.couponPercentage) : "",
                          couponFixedAmount: reward.couponFixedAmount !== null && reward.couponFixedAmount !== undefined ? String(reward.couponFixedAmount) : "",
                          couponMinimumOrderAmount: reward.couponMinimumOrderAmount !== null && reward.couponMinimumOrderAmount !== undefined ? String(reward.couponMinimumOrderAmount) : "",
                          couponMaximumDiscountAmount: reward.couponMaximumDiscountAmount !== null && reward.couponMaximumDiscountAmount !== undefined ? String(reward.couponMaximumDiscountAmount) : "",
                          couponDurationDays: reward.couponDurationDays !== null && reward.couponDurationDays !== undefined ? String(reward.couponDurationDays) : "30",
                          couponCodePrefix: reward.couponCodePrefix || "",
                          color: reward.color || "",
                          icon: reward.icon || "",
                          benefitsText: reward.benefits.join("\n"),
                          stockLimit: reward.stockLimit ? String(reward.stockLimit) : "",
                          sortOrder: String(reward.sortOrder),
                          isActive: reward.isActive,
                        })
                      }
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await deleteLoyaltyReward(reward.id);
                          await load({ silent: true });
                          toast({ title: "Reward deleted" });
                        } catch (error) {
                          toast({
                            title: "Unable to delete reward",
                            description: error instanceof Error ? error.message : "Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manual-adjustment">
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="luxe-panel space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold">Manual Adjustment</h2>
                <p className="text-sm text-muted-foreground">Add or deduct points manually for a customer account.</p>
              </div>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={adjustmentForm.userId} onValueChange={(value) => setAdjustmentForm((current) => ({ ...current, userId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Points Delta</Label>
                <Input type="number" step="1" value={adjustmentForm.pointsDelta} onChange={(event) => setAdjustmentForm((current) => ({ ...current, pointsDelta: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={adjustmentForm.reason} onChange={(event) => setAdjustmentForm((current) => ({ ...current, reason: event.target.value }))} />
              </div>
              <Button className="w-full" onClick={submitManualAdjustment} disabled={savingSection === "adjustment"}>
                {savingSection === "adjustment" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Apply Adjustment
              </Button>
            </div>

            <div className="luxe-panel p-6">
              <h3 className="text-lg font-semibold">Recent Manual Activity</h3>
              <div className="mt-4 space-y-3">
                {overview.pointHistory
                  .filter((item) => item.type === "MANUAL_ADJUSTMENT")
                  .slice(0, 20)
                  .map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border p-4">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-medium">{item.user?.name || item.user?.email || "Unknown customer"}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <div className="text-left lg:text-right">
                          <p className={`font-semibold ${item.pointsDelta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {item.pointsDelta >= 0 ? "+" : ""}
                            {item.pointsDelta}
                          </p>
                          <p className="text-xs text-muted-foreground">{moment(item.createdAt).format("MMM D, YYYY • HH:mm")}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="point-history">
          <div className="luxe-panel overflow-hidden">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Point History</h2>
              <p className="text-sm text-muted-foreground">Latest loyalty events across all customers.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-secondary/40 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Delta</th>
                    <th className="px-6 py-4">Balance</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.pointHistory.map((item) => (
                    <tr key={item.id} className="border-t border-border/70">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{item.user?.name || item.user?.email || "Unknown"}</p>
                          {item.order ? <p className="text-xs text-muted-foreground">{item.order.orderNumber}</p> : null}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline">{formatTransactionType(item.type)}</Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{item.description}</td>
                      <td className={`px-6 py-4 font-semibold ${item.pointsDelta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {item.pointsDelta >= 0 ? "+" : ""}
                        {item.pointsDelta}
                      </td>
                      <td className="px-6 py-4">{item.balanceAfter}</td>
                      <td className="px-6 py-4 text-muted-foreground">{moment(item.createdAt).format("MMM D, YYYY • HH:mm")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
