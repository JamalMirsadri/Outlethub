import React, { useEffect, useMemo, useState } from "react";
import { createLoyaltyManualAdjustment } from "@/api/loyalty";
import {
  createReferralRelationship,
  createReferralRule,
  deleteReferralRelationship,
  deleteReferralRule,
  getAdminReferrals,
  type AdminReferralOverviewResponse,
  type ReferralRelationshipStatus,
  type ReferralRulePayload,
  type ReferralTreeNode,
  updateReferralRelationship,
  updateReferralRule,
  updateReferralUserCode,
} from "@/api/referrals";
import { listAdminUsers } from "@/api/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  CopyPlus,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import moment from "moment";

const EMPTY_OVERVIEW: AdminReferralOverviewResponse = {
  summary: {
    totalReferrals: 0,
    activeReferrals: 0,
    totalPointsGenerated: 0,
    pointsDistributed: 0,
    conversionRate: 0,
  },
  referralGrowth: [],
  topReferrers: [],
  rules: [],
  relationships: [],
  rewards: [],
};

const DEFAULT_RULE_FORM = {
  id: "",
  name: "",
  description: "",
  trigger: "SIGNUP",
  levelNumber: "1",
  rewardType: "FIXED_POINTS",
  rewardValue: "10",
  minOrderAmount: "",
  maxRewardPoints: "",
  maxReferralCount: "",
  expiresInDays: "",
  conditionsText: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
  sortOrder: "0",
};

const DEFAULT_RELATIONSHIP_FORM = {
  id: "",
  referrerUserId: "",
  referredUserId: "",
  notes: "",
  status: "ACTIVE" as ReferralRelationshipStatus,
};

const DEFAULT_CODE_FORM = {
  userId: "",
  referralCode: "",
};

const DEFAULT_ADJUSTMENT_FORM = {
  userId: "",
  pointsDelta: "0",
  reason: "",
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

function formatEnumValue(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function parseConditions(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return JSON.parse(trimmed) as Record<string, unknown>;
}

function buildAdminTree(
  relationships: AdminReferralOverviewResponse["relationships"],
  rewards: AdminReferralOverviewResponse["rewards"],
): ReferralTreeNode[] {
  const nodeById = new Map<
    string,
    Omit<ReferralTreeNode, "children"> & { children: ReferralTreeNode[] }
  >();
  const referredUserIds = new Set<string>();

  for (const relationship of relationships) {
    if (!nodeById.has(relationship.referrerUserId)) {
      nodeById.set(relationship.referrerUserId, {
        id: relationship.referrerUserId,
        name: relationship.referrerName,
        email: relationship.referrerEmail,
        joinedAt: relationship.createdAt,
        level: 0,
        generatedPoints: 0,
        pendingPoints: 0,
        purchaseCount: 0,
        children: [],
      });
    }

    if (!nodeById.has(relationship.referredUserId)) {
      nodeById.set(relationship.referredUserId, {
        id: relationship.referredUserId,
        name: relationship.referredUserName,
        email: relationship.referredUserEmail,
        joinedAt: relationship.createdAt,
        level: 1,
        generatedPoints: 0,
        pendingPoints: 0,
        purchaseCount: 0,
        children: [],
      });
    }

    referredUserIds.add(relationship.referredUserId);
  }

  const rewardsBySource = new Map<
    string,
    { awarded: number; pending: number; count: number }
  >();

  for (const reward of rewards) {
    const current = rewardsBySource.get(reward.sourceUser.id) ?? {
      awarded: 0,
      pending: 0,
      count: 0,
    };

    if (reward.status === "AWARDED") {
      current.awarded += reward.pointsAwarded;
      current.count += reward.order ? 1 : 0;
    } else if (reward.status === "PENDING") {
      current.pending += reward.pointsAwarded;
    }

    rewardsBySource.set(reward.sourceUser.id, current);
  }

  const childrenByParent = new Map<string, string[]>();
  for (const relationship of relationships) {
    const childIds = childrenByParent.get(relationship.referrerUserId) ?? [];
    childIds.push(relationship.referredUserId);
    childrenByParent.set(relationship.referrerUserId, childIds);
  }

  const assignLevel = (userId: string, level: number) => {
    const node = nodeById.get(userId);
    if (!node) {
      return;
    }

    node.level = level;
    for (const childId of childrenByParent.get(userId) ?? []) {
      assignLevel(childId, level + 1);
    }
  };

  const roots = Array.from(nodeById.keys()).filter((userId) => !referredUserIds.has(userId));
  roots.forEach((userId) => assignLevel(userId, 0));

  const buildNode = (userId: string): ReferralTreeNode | null => {
    const node = nodeById.get(userId);
    if (!node) {
      return null;
    }

    return {
      ...node,
      generatedPoints: rewardsBySource.get(userId)?.awarded ?? 0,
      pendingPoints: rewardsBySource.get(userId)?.pending ?? 0,
      purchaseCount: rewardsBySource.get(userId)?.count ?? 0,
      children: (childrenByParent.get(userId) ?? [])
        .map(buildNode)
        .filter((child): child is ReferralTreeNode => Boolean(child)),
    };
  };

  return roots
    .map(buildNode)
    .filter((node): node is ReferralTreeNode => Boolean(node));
}

function TreeItem({ node }: { node: ReferralTreeNode }) {
  const hasChildren = node.children.length > 0;

  return (
    <div className="ml-4 border-l border-border pl-4">
      <Collapsible defaultOpen={node.level < 1}>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {hasChildren ? (
                  <CollapsibleTrigger className="inline-flex items-center gap-2 text-left font-medium">
                    <ChevronRight className="h-4 w-4" />
                    {node.name}
                  </CollapsibleTrigger>
                ) : (
                  <p className="font-medium">{node.name}</p>
                )}
                <Badge variant="outline">Level {node.level}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{node.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{node.generatedPoints} pts</Badge>
              {node.pendingPoints > 0 ? <Badge variant="secondary">{node.pendingPoints} pending</Badge> : null}
            </div>
          </div>
        </div>
        {hasChildren ? (
          <CollapsibleContent className="space-y-3 pt-3">
            {node.children.map((child) => (
              <TreeItem key={child.id} node={child} />
            ))}
          </CollapsibleContent>
        ) : null}
      </Collapsible>
    </div>
  );
}

export default function AdminReferrals() {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [users, setUsers] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSection, setSavingSection] = useState("");
  const [search, setSearch] = useState("");
  const [relationshipStatusFilter, setRelationshipStatusFilter] = useState<"ALL" | ReferralRelationshipStatus>("ALL");
  const [ruleForm, setRuleForm] = useState(DEFAULT_RULE_FORM);
  const [relationshipForm, setRelationshipForm] = useState(DEFAULT_RELATIONSHIP_FORM);
  const [codeForm, setCodeForm] = useState(DEFAULT_CODE_FORM);
  const [adjustmentForm, setAdjustmentForm] = useState(DEFAULT_ADJUSTMENT_FORM);

  const load = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [overviewResponse, usersResponse] = await Promise.all([
        getAdminReferrals(),
        listAdminUsers({ pageSize: 100, status: "ALL" }),
      ]);

      setOverview(overviewResponse);
      setUsers(
        usersResponse.items.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
        })),
      );
    } catch (error) {
      toast({
        title: "Unable to load referrals",
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

  const userOptions = useMemo(
    () => users.slice().sort((left, right) => left.name.localeCompare(right.name)),
    [users],
  );

  const filteredRelationships = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return overview.relationships.filter((item) => {
      const matchesStatus =
        relationshipStatusFilter === "ALL" ? true : item.status === relationshipStatusFilter;
      const matchesSearch = !normalizedSearch
        ? true
        : [
            item.referrerName,
            item.referrerEmail,
            item.referrerCode,
            item.referredUserName,
            item.referredUserEmail,
            item.referredUserCode,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [overview.relationships, relationshipStatusFilter, search]);

  const filteredRewards = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return overview.rewards;
    }

    return overview.rewards.filter((item) =>
      [
        item.title,
        item.description || "",
        item.sourceUser.name,
        item.sourceUser.email,
        item.beneficiaryUser?.name || "",
        item.beneficiaryUser?.email || "",
        item.order?.orderNumber || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [overview.rewards, search]);

  const tree = useMemo(
    () => buildAdminTree(overview.relationships, overview.rewards),
    [overview.relationships, overview.rewards],
  );

  const submitRule = async () => {
    setSavingSection("rule");

    try {
      const payload: ReferralRulePayload = {
        name: ruleForm.name,
        description: ruleForm.description || null,
        trigger: ruleForm.trigger as ReferralRulePayload["trigger"],
        levelNumber: Number(ruleForm.levelNumber),
        rewardType: ruleForm.rewardType as ReferralRulePayload["rewardType"],
        rewardValue: Number(ruleForm.rewardValue),
        minOrderAmount: ruleForm.minOrderAmount ? Number(ruleForm.minOrderAmount) : null,
        maxRewardPoints: ruleForm.maxRewardPoints ? Number(ruleForm.maxRewardPoints) : null,
        maxReferralCount: ruleForm.maxReferralCount ? Number(ruleForm.maxReferralCount) : null,
        expiresInDays: ruleForm.expiresInDays ? Number(ruleForm.expiresInDays) : null,
        conditions: parseConditions(ruleForm.conditionsText),
        startsAt: ruleForm.startsAt ? new Date(ruleForm.startsAt).toISOString() : null,
        endsAt: ruleForm.endsAt ? new Date(ruleForm.endsAt).toISOString() : null,
        isActive: ruleForm.isActive,
        sortOrder: Number(ruleForm.sortOrder),
      };

      if (ruleForm.id) {
        await updateReferralRule(ruleForm.id, payload);
      } else {
        await createReferralRule(payload);
      }

      setRuleForm(DEFAULT_RULE_FORM);
      await load({ silent: true });
      toast({
        title: "Referral rule saved",
        description: "The referral payout rule was updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to save referral rule",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSection("");
    }
  };

  const submitRelationship = async () => {
    setSavingSection("relationship");

    try {
      if (relationshipForm.id) {
        await updateReferralRelationship(relationshipForm.id, {
          referrerUserId: relationshipForm.referrerUserId,
          notes: relationshipForm.notes || null,
          status: relationshipForm.status,
        });
      } else {
        await createReferralRelationship({
          referrerUserId: relationshipForm.referrerUserId,
          referredUserId: relationshipForm.referredUserId,
          notes: relationshipForm.notes || null,
        });
      }

      setRelationshipForm(DEFAULT_RELATIONSHIP_FORM);
      await load({ silent: true });
      toast({
        title: "Relationship saved",
        description: "The referral relationship was updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to save relationship",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSection("");
    }
  };

  const submitCodeUpdate = async () => {
    setSavingSection("code");

    try {
      await updateReferralUserCode(codeForm.userId, {
        referralCode: codeForm.referralCode,
      });

      setCodeForm(DEFAULT_CODE_FORM);
      await load({ silent: true });
      toast({
        title: "Referral code updated",
        description: "The customer referral code was changed successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to update referral code",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSection("");
    }
  };

  const submitAdjustment = async () => {
    setSavingSection("adjustment");

    try {
      await createLoyaltyManualAdjustment({
        userId: adjustmentForm.userId,
        pointsDelta: Number(adjustmentForm.pointsDelta),
        reason: adjustmentForm.reason,
      });

      setAdjustmentForm(DEFAULT_ADJUSTMENT_FORM);
      toast({
        title: "Manual adjustment applied",
        description: "The loyalty balance was updated successfully.",
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
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Referral Control Center</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Referrals</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage rules, relationships, customer referral codes, reward history, and full tree visibility without changing existing flows.
          </p>
        </div>
        <Button variant="outline" className="w-full md:w-auto" onClick={() => void load({ silent: true })} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Referrals" value={overview.summary.totalReferrals} hint="Active direct referral relationships" />
        <StatCard label="Active Referrals" value={overview.summary.activeReferrals} hint="Sources with awarded order rewards" />
        <StatCard label="Points Generated" value={overview.summary.totalPointsGenerated} hint="Awarded referral points across the network" />
        <StatCard label="Conversion Rate" value={`${overview.summary.conversionRate}%`} hint="Active referrals divided by total referrals" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h2 className="text-xl font-semibold">Growth</h2>
          </div>
          <div className="mt-5 space-y-3">
            {overview.referralGrowth.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Growth data will appear after the first referral relationships are created.
              </div>
            ) : (
              overview.referralGrowth.map((item) => (
                <div key={item.month} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                  <p className="font-medium">{moment(`${item.month}-01`).format("MMMM YYYY")}</p>
                  <Badge>{item.count}</Badge>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h2 className="text-xl font-semibold">Top Referrers</h2>
          </div>
          <div className="mt-5 space-y-3">
            {overview.topReferrers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Top referrers will appear here after points are awarded.
              </div>
            ) : (
              overview.topReferrers.map((item, index) => (
                <div key={item.userId} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                  <div>
                    <p className="font-medium">
                      #{index + 1} {item.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.email}
                      {item.referralCode ? ` • ${item.referralCode}` : ""}
                    </p>
                  </div>
                  <Badge>{item.pointsGenerated} pts</Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-2xl bg-secondary/50 p-2">
          <TabsTrigger value="rules">Referral Rules</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="codes">Referral Codes</TabsTrigger>
          <TabsTrigger value="tree">Referral Tree</TabsTrigger>
          <TabsTrigger value="history">Reward History</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
            <div className="luxe-panel space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Rule Editor</h2>
                  <p className="text-sm text-muted-foreground">Configure multi-level referral rewards and conditions.</p>
                </div>
                {ruleForm.id ? (
                  <Button variant="ghost" onClick={() => setRuleForm(DEFAULT_RULE_FORM)}>
                    New Rule
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={ruleForm.name} onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={ruleForm.description} onChange={(event) => setRuleForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Trigger</Label>
                  <Select value={ruleForm.trigger} onValueChange={(value) => setRuleForm((current) => ({ ...current, trigger: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIGNUP">Signup</SelectItem>
                      <SelectItem value="FIRST_ORDER">First Order</SelectItem>
                      <SelectItem value="REPEAT_ORDER">Repeat Order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Input type="number" min="1" step="1" value={ruleForm.levelNumber} onChange={(event) => setRuleForm((current) => ({ ...current, levelNumber: event.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Reward Type</Label>
                  <Select value={ruleForm.rewardType} onValueChange={(value) => setRuleForm((current) => ({ ...current, rewardType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED_POINTS">Fixed Points</SelectItem>
                      <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reward Value</Label>
                  <Input type="number" min="0" step="0.01" value={ruleForm.rewardValue} onChange={(event) => setRuleForm((current) => ({ ...current, rewardValue: event.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Minimum Order</Label>
                  <Input type="number" min="0" step="0.01" value={ruleForm.minOrderAmount} onChange={(event) => setRuleForm((current) => ({ ...current, minOrderAmount: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Days</Label>
                  <Input type="number" min="1" step="1" value={ruleForm.expiresInDays} onChange={(event) => setRuleForm((current) => ({ ...current, expiresInDays: event.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Point Cap</Label>
                  <Input type="number" min="1" step="1" value={ruleForm.maxRewardPoints} onChange={(event) => setRuleForm((current) => ({ ...current, maxRewardPoints: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Referral Cap</Label>
                  <Input type="number" min="1" step="1" value={ruleForm.maxReferralCount} onChange={(event) => setRuleForm((current) => ({ ...current, maxReferralCount: event.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Starts At</Label>
                  <Input type="datetime-local" value={ruleForm.startsAt} onChange={(event) => setRuleForm((current) => ({ ...current, startsAt: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Ends At</Label>
                  <Input type="datetime-local" value={ruleForm.endsAt} onChange={(event) => setRuleForm((current) => ({ ...current, endsAt: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conditions JSON</Label>
                <Textarea placeholder='{"firstPurchaseOnly": true}' value={ruleForm.conditionsText} onChange={(event) => setRuleForm((current) => ({ ...current, conditionsText: event.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sort Order</Label>
                  <Input type="number" min="0" step="1" value={ruleForm.sortOrder} onChange={(event) => setRuleForm((current) => ({ ...current, sortOrder: event.target.value }))} />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border p-4">
                  <div>
                    <p className="font-medium">Active</p>
                    <p className="text-sm text-muted-foreground">Inactive rules are ignored.</p>
                  </div>
                  <Switch checked={ruleForm.isActive} onCheckedChange={(checked) => setRuleForm((current) => ({ ...current, isActive: checked }))} />
                </div>
              </div>

              <Button className="w-full" onClick={submitRule} disabled={savingSection === "rule"}>
                {savingSection === "rule" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Rule
              </Button>
            </div>

            <div className="grid gap-4">
              {overview.rules.map((rule) => (
                <div key={rule.id} className="luxe-panel p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{rule.name}</h3>
                        <Badge>{formatEnumValue(rule.trigger)}</Badge>
                        <Badge variant="outline">L{rule.levelNumber}</Badge>
                        {!rule.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {rule.rewardType === "FIXED_POINTS" ? `${rule.rewardValue} fixed points` : `${rule.rewardValue}% of base loyalty points`}
                        {rule.minOrderAmount !== null ? ` • Min order ${rule.minOrderAmount}` : ""}
                        {rule.expiresInDays !== null ? ` • Expires in ${rule.expiresInDays} days` : ""}
                      </p>
                      {rule.description ? <p className="mt-2 text-sm text-muted-foreground">{rule.description}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setRuleForm({
                            id: rule.id,
                            name: rule.name,
                            description: rule.description || "",
                            trigger: rule.trigger,
                            levelNumber: String(rule.levelNumber),
                            rewardType: rule.rewardType,
                            rewardValue: String(rule.rewardValue),
                            minOrderAmount: rule.minOrderAmount !== null ? String(rule.minOrderAmount) : "",
                            maxRewardPoints: rule.maxRewardPoints !== null ? String(rule.maxRewardPoints) : "",
                            maxReferralCount: rule.maxReferralCount !== null ? String(rule.maxReferralCount) : "",
                            expiresInDays: rule.expiresInDays !== null ? String(rule.expiresInDays) : "",
                            conditionsText: rule.conditions ? JSON.stringify(rule.conditions, null, 2) : "",
                            startsAt: rule.startsAt ? moment(rule.startsAt).format("YYYY-MM-DDTHH:mm") : "",
                            endsAt: rule.endsAt ? moment(rule.endsAt).format("YYYY-MM-DDTHH:mm") : "",
                            isActive: rule.isActive,
                            sortOrder: String(rule.sortOrder),
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
                            await deleteReferralRule(rule.id);
                            await load({ silent: true });
                            toast({ title: "Rule deleted" });
                          } catch (error) {
                            toast({
                              title: "Unable to delete rule",
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

        <TabsContent value="relationships" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="luxe-panel space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Relationship Editor</h2>
                  <p className="text-sm text-muted-foreground">Create, move, disable, or remove direct referral links.</p>
                </div>
                {relationshipForm.id ? (
                  <Button variant="ghost" onClick={() => setRelationshipForm(DEFAULT_RELATIONSHIP_FORM)}>
                    New Link
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Referrer</Label>
                <Select value={relationshipForm.referrerUserId} onValueChange={(value) => setRelationshipForm((current) => ({ ...current, referrerUserId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select referrer" />
                  </SelectTrigger>
                  <SelectContent>
                    {userOptions.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Referred Customer</Label>
                <Select value={relationshipForm.referredUserId} onValueChange={(value) => setRelationshipForm((current) => ({ ...current, referredUserId: value }))} disabled={Boolean(relationshipForm.id)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select referred customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {userOptions.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={relationshipForm.status} onValueChange={(value) => setRelationshipForm((current) => ({ ...current, status: value as ReferralRelationshipStatus }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="REMOVED">Removed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={relationshipForm.notes} onChange={(event) => setRelationshipForm((current) => ({ ...current, notes: event.target.value }))} />
              </div>

              <Button className="w-full" onClick={submitRelationship} disabled={savingSection === "relationship"}>
                {savingSection === "relationship" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CopyPlus className="mr-2 h-4 w-4" />}
                Save Relationship
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search by name, email, or code" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <Select value={relationshipStatusFilter} onValueChange={(value) => setRelationshipStatusFilter(value as "ALL" | ReferralRelationshipStatus)}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="REMOVED">Removed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filteredRelationships.map((relationship) => (
                <div key={relationship.id} className="luxe-panel p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{relationship.referrerName}</h3>
                        <Badge variant="outline">{relationship.referrerCode}</Badge>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">{relationship.referredUserName}</p>
                        <Badge>{formatEnumValue(relationship.status)}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {relationship.referrerEmail}
                        {" -> "}
                        {relationship.referredUserEmail}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {relationship.sourceChannel || "Unknown channel"} • {moment(relationship.createdAt).format("MMM D, YYYY • HH:mm")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setRelationshipForm({
                            id: relationship.id,
                            referrerUserId: relationship.referrerUserId,
                            referredUserId: relationship.referredUserId,
                            notes: "",
                            status: relationship.status,
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
                            await deleteReferralRelationship(relationship.id);
                            await load({ silent: true });
                            toast({ title: "Relationship deleted" });
                          } catch (error) {
                            toast({
                              title: "Unable to delete relationship",
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

        <TabsContent value="codes" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="luxe-panel space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold">Referral Code Override</h2>
                <p className="text-sm text-muted-foreground">Only admins can change customer referral codes.</p>
              </div>

              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={codeForm.userId} onValueChange={(value) => setCodeForm((current) => ({ ...current, userId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {userOptions.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>New Referral Code</Label>
                <Input value={codeForm.referralCode} onChange={(event) => setCodeForm((current) => ({ ...current, referralCode: event.target.value.toUpperCase() }))} />
              </div>
              <Button className="w-full" onClick={submitCodeUpdate} disabled={savingSection === "code"}>
                {savingSection === "code" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Update Code
              </Button>

              <div className="border-t border-border pt-4">
                <h3 className="text-base font-semibold">Manual Point Adjustment</h3>
                <p className="mt-1 text-sm text-muted-foreground">Use loyalty adjustments for referral point corrections.</p>
              </div>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={adjustmentForm.userId} onValueChange={(value) => setAdjustmentForm((current) => ({ ...current, userId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {userOptions.map((user) => (
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
              <Button className="w-full" variant="outline" onClick={submitAdjustment} disabled={savingSection === "adjustment"}>
                {savingSection === "adjustment" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Apply Adjustment
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {overview.relationships.slice(0, 20).map((relationship) => (
                <div key={relationship.id} className="luxe-panel p-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{relationship.referrerName}</p>
                      <Badge variant="outline">{relationship.referrerCode}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{relationship.referrerEmail}</p>
                    <div className="pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{relationship.referredUserName}</p>
                        <Badge variant="secondary">{relationship.referredUserCode}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{relationship.referredUserEmail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tree">
          <div className="luxe-panel p-6">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-[hsl(var(--accent))]" />
              <h2 className="text-xl font-semibold">Network Tree</h2>
            </div>
            <div className="mt-5 space-y-3">
              {tree.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  The admin tree will appear after the first relationships are added.
                </div>
              ) : (
                tree.map((node) => <TreeItem key={node.id} node={node} />)
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search reward history" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="luxe-panel overflow-hidden">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Referral Reward History</h2>
              <p className="text-sm text-muted-foreground">Latest payout records, pending items, and reversals across the referral program.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-secondary/40 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Source</th>
                    <th className="px-6 py-4">Beneficiary</th>
                    <th className="px-6 py-4">Trigger</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Order</th>
                    <th className="px-6 py-4">Points</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRewards.map((reward) => (
                    <tr key={reward.id} className="border-t border-border/70">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{reward.sourceUser.name}</p>
                          <p className="text-xs text-muted-foreground">{reward.sourceUser.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {reward.beneficiaryUser ? (
                          <div>
                            <p className="font-medium">{reward.beneficiaryUser.name}</p>
                            <p className="text-xs text-muted-foreground">{reward.beneficiaryUser.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{formatEnumValue(reward.trigger)}</Badge>
                          <Badge variant="secondary">L{reward.levelNumber}</Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge>{formatEnumValue(reward.status)}</Badge>
                      </td>
                      <td className="px-6 py-4">{reward.order?.orderNumber || "-"}</td>
                      <td className="px-6 py-4 font-semibold">{reward.pointsAwarded}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {moment(reward.awardedAt || reward.pendingAt || reward.createdAt).format("MMM D, YYYY • HH:mm")}
                      </td>
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
