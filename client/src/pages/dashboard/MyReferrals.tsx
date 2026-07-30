import React, { useEffect, useMemo, useState } from "react";
import { getMyReferrals, type CustomerReferralOverviewResponse, type ReferralTreeNode } from "@/api/referrals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/components/ui/use-toast";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  GitBranch,
  Link2,
  Loader2,
  Network,
  Sparkles,
  Users,
} from "lucide-react";
import moment from "moment";

const EMPTY_OVERVIEW: CustomerReferralOverviewResponse = {
  profile: {
    id: "",
    name: "",
    email: "",
    referralCode: "",
    referralLinkPath: "",
  },
  summary: {
    directReferralCount: 0,
    networkReferralCount: 0,
    successfulPurchaseCount: 0,
    pointsReceived: 0,
    pointsPending: 0,
  },
  directReferrals: [],
  earningsHistory: [],
  tree: [],
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

function formatTrigger(trigger: string) {
  return trigger
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function ReferralTreeItem({ node }: { node: ReferralTreeNode }) {
  const hasChildren = node.children.length > 0;

  if (!hasChildren) {
    return (
      <div className="ml-4 border-l border-border pl-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{node.name}</p>
                <Badge variant="outline">Level {node.level}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Joined {moment(node.joinedAt).format("MMM D, YYYY")} • {node.purchaseCount} delivered order
                {node.purchaseCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>{node.generatedPoints} pts generated</Badge>
              {node.pendingPoints > 0 ? <Badge variant="secondary">{node.pendingPoints} pts pending</Badge> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-4 border-l border-border pl-4">
      <Collapsible defaultOpen>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CollapsibleTrigger className="inline-flex items-center gap-2 text-left">
                  <ChevronRight className="h-4 w-4 data-[state=open]:hidden" />
                  <ChevronDown className="hidden h-4 w-4 data-[state=open]:block" />
                  <span className="font-medium">{node.name}</span>
                </CollapsibleTrigger>
                <Badge variant="outline">Level {node.level}</Badge>
                <Badge variant="secondary">{node.children.length} direct</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Joined {moment(node.joinedAt).format("MMM D, YYYY")} • {node.purchaseCount} delivered order
                {node.purchaseCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>{node.generatedPoints} pts generated</Badge>
              {node.pendingPoints > 0 ? <Badge variant="secondary">{node.pendingPoints} pts pending</Badge> : null}
            </div>
          </div>
        </div>
        <CollapsibleContent className="space-y-3 pt-3">
          {node.children.map((child) => (
            <ReferralTreeItem key={child.id} node={child} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function MyReferrals() {
  const [data, setData] = useState(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [copyingKey, setCopyingKey] = useState("");

  const load = async () => {
    setLoading(true);

    try {
      setData(await getMyReferrals());
    } catch (error) {
      toast({
        title: "Unable to load referrals",
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

  const referralLink = useMemo(() => {
    if (!data.profile.referralLinkPath) {
      return "";
    }

    if (typeof window === "undefined") {
      return data.profile.referralLinkPath;
    }

    return `${window.location.origin}${data.profile.referralLinkPath}`;
  }, [data.profile.referralLinkPath]);

  const pendingHistory = useMemo(
    () => data.earningsHistory.filter((item) => item.status === "PENDING"),
    [data.earningsHistory],
  );

  const awardedHistory = useMemo(
    () => data.earningsHistory.filter((item) => item.status === "AWARDED"),
    [data.earningsHistory],
  );

  const handleCopy = async (key: "code" | "link", value: string) => {
    if (!value) {
      return;
    }

    setCopyingKey(key);

    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: key === "code" ? "Referral code copied" : "Referral link copied",
        description: value,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: error instanceof Error ? error.message : "Please copy manually.",
        variant: "destructive",
      });
    } finally {
      setCopyingKey("");
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
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Referral Program</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">My Referrals</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Share your code, follow your network growth, and monitor how your referral tree generates loyalty points.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
          <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
          <span className="text-sm font-medium">{data.summary.networkReferralCount} people in your network</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">Referral Identity</h3>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Referral Code</p>
              <p className="mt-3 text-2xl font-semibold">{data.profile.referralCode}</p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => void handleCopy("code", data.profile.referralCode)}
                disabled={!data.profile.referralCode || copyingKey === "code"}
              >
                {copyingKey === "code" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                Copy Code
              </Button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Referral Link</p>
              <p className="mt-3 break-all text-sm text-muted-foreground">{referralLink || "Unavailable"}</p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => void handleCopy("link", referralLink)}
                disabled={!referralLink || copyingKey === "link"}
              >
                {copyingKey === "link" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Copy Link
              </Button>
            </div>
          </div>
        </div>

        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">Program Snapshot</h3>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Direct referrals</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.directReferralCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Successful purchases</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.successfulPurchaseCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Points received</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.pointsReceived}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Points pending</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.pointsPending}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Direct Referrals" value={data.summary.directReferralCount} hint="Customers you referred directly" />
        <StatCard label="Network Size" value={data.summary.networkReferralCount} hint="Total downline across all levels" />
        <StatCard label="Earned Points" value={data.summary.pointsReceived} hint="Already posted to loyalty history" />
        <StatCard label="Pending Points" value={data.summary.pointsPending} hint="Waiting for order completion" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">Direct Referrals</h3>
          </div>
          <div className="mt-5 space-y-4">
            {data.directReferrals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Your direct referrals will appear here after someone signs up using your code.
              </div>
            ) : (
              data.directReferrals.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{item.referredUserName}</p>
                      <p className="text-sm text-muted-foreground">{item.referredUserEmail}</p>
                    </div>
                    <Badge variant="outline">{moment(item.joinedAt).format("MMM D, YYYY")}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">Pending Earnings</h3>
          </div>
          <div className="mt-5 space-y-4">
            {pendingHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No referral earnings are waiting right now.
              </div>
            ) : (
              pendingHistory.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{entry.sourceUser.name}</p>
                        <Badge variant="outline">{formatTrigger(entry.trigger)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {entry.order ? `${entry.order.orderNumber} • ` : ""}
                        {moment(entry.createdAt).format("MMM D, YYYY • HH:mm")}
                      </p>
                    </div>
                    <Badge>{entry.pointsAwarded} pts</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">Referral Tree</h3>
          </div>
          <div className="mt-5 space-y-3">
            {data.tree.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Your referral tree will expand here as your network grows.
              </div>
            ) : (
              data.tree.map((node) => <ReferralTreeItem key={node.id} node={node} />)
            )}
          </div>
        </div>

        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">Referral Earnings History</h3>
          </div>
          <div className="mt-5 space-y-4">
            {awardedHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Completed referral rewards will appear here after your network generates qualifying events.
              </div>
            ) : (
              awardedHistory.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{entry.sourceUser.name}</p>
                        <Badge variant="outline">Level {entry.levelNumber}</Badge>
                        <Badge variant="secondary">{formatTrigger(entry.trigger)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {entry.order ? `${entry.order.orderNumber} • ` : ""}
                        {moment(entry.awardedAt || entry.createdAt).format("MMM D, YYYY • HH:mm")}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{entry.title}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="font-semibold text-emerald-500">+{entry.pointsAwarded}</p>
                      {entry.basePoints !== null ? (
                        <p className="text-xs text-muted-foreground">Base points {entry.basePoints}</p>
                      ) : null}
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
