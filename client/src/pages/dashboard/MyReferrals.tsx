import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

function ReferralTreeItem({ node, t }: { node: ReferralTreeNode; t: ReturnType<typeof useTranslation>["t"] }) {
  const hasChildren = node.children.length > 0;

  if (!hasChildren) {
    return (
      <div className="ml-4 border-l border-border pl-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{node.name}</p>
                <Badge variant="outline">{t("dashboard.level")} {node.level}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("dashboard.memberSince")} {moment(node.joinedAt).format("MMM D, YYYY")} • {node.purchaseCount} delivered order
                {node.purchaseCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>{node.generatedPoints} pts {t("dashboard.generatedPoints").toLowerCase()}</Badge>
              {node.pendingPoints > 0 ? <Badge variant="secondary">{node.pendingPoints} pts {t("dashboard.pendingPoints").toLowerCase()}</Badge> : null}
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
                <Badge variant="outline">{t("dashboard.level")} {node.level}</Badge>
                <Badge variant="secondary">{node.children.length} direct</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("dashboard.memberSince")} {moment(node.joinedAt).format("MMM D, YYYY")} • {node.purchaseCount} delivered order
                {node.purchaseCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>{node.generatedPoints} pts {t("dashboard.generatedPoints").toLowerCase()}</Badge>
              {node.pendingPoints > 0 ? <Badge variant="secondary">{node.pendingPoints} pts {t("dashboard.pendingPoints").toLowerCase()}</Badge> : null}
            </div>
          </div>
        </div>
        <CollapsibleContent className="space-y-3 pt-3">
          {node.children.map((child) => (
            <ReferralTreeItem key={child.id} node={child} t={t} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function MyReferrals() {
  const { t } = useTranslation();
  const [data, setData] = useState(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [copyingKey, setCopyingKey] = useState("");

  const load = async () => {
    setLoading(true);

    try {
      setData(await getMyReferrals());
    } catch (error) {
      toast({
        title: t("common.somethingWentWrong"),
        description: error instanceof Error ? error.message : t("common.tryAgain"),
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
        title: t("common.copied"),
        description: value,
      });
    } catch (error) {
      toast({
        title: t("common.errorOccurred"),
        description: error instanceof Error ? error.message : t("common.tryAgain"),
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
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("dashboard.referralEarnings")}</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">{t("dashboard.myReferralsTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("dashboard.myReferralsSubtitle")}
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
            <h3 className="text-xl font-semibold">{t("dashboard.profile")}</h3>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("dashboard.referralCode")}</p>
              <p className="mt-3 text-2xl font-semibold">{data.profile.referralCode}</p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => void handleCopy("code", data.profile.referralCode)}
                disabled={!data.profile.referralCode || copyingKey === "code"}
              >
                {copyingKey === "code" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                {t("dashboard.copyCode")}
              </Button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("dashboard.referralLink")}</p>
              <p className="mt-3 break-all text-sm text-muted-foreground">{referralLink || t("common.none")}</p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => void handleCopy("link", referralLink)}
                disabled={!referralLink || copyingKey === "link"}
              >
                {copyingKey === "link" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                {t("dashboard.copyLink")}
              </Button>
            </div>
          </div>
        </div>

        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">{t("dashboard.overview")}</h3>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">{t("dashboard.totalReferrals")}</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.directReferralCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">{t("dashboard.successfulPurchases")}</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.successfulPurchaseCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">{t("dashboard.pointsEarned")}</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.pointsReceived}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">{t("dashboard.pendingPoints")}</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.pointsPending}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dashboard.totalReferrals")} value={data.summary.directReferralCount} hint="Customers you referred directly" />
        <StatCard label={t("dashboard.referralTree").replace("Your ", "")} value={data.summary.networkReferralCount} hint="Total downline across all levels" />
        <StatCard label={t("dashboard.pointsEarned")} value={data.summary.pointsReceived} hint="Already posted to loyalty history" />
        <StatCard label={t("dashboard.pendingPoints")} value={data.summary.pointsPending} hint="Waiting for order completion" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">{t("dashboard.totalReferrals")}</h3>
          </div>
          <div className="mt-5 space-y-4">
            {data.directReferrals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                {t("dashboard.noReferralsYet")}
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
            <h3 className="text-xl font-semibold">{t("dashboard.pendingPoints")}</h3>
          </div>
          <div className="mt-5 space-y-4">
            {pendingHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                {t("common.none")} referral earnings are waiting right now.
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
            <h3 className="text-xl font-semibold">{t("dashboard.referralTree")}</h3>
          </div>
          <div className="mt-5 space-y-3">
            {data.tree.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                {t("dashboard.noReferralsYet")}
              </div>
            ) : (
              data.tree.map((node) => <ReferralTreeItem key={node.id} node={node} t={t} />)
            )}
          </div>
        </div>

        <div className="luxe-panel p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[hsl(var(--accent))]" />
            <h3 className="text-xl font-semibold">{t("dashboard.referralEarnings")}</h3>
          </div>
          <div className="mt-5 space-y-4">
            {awardedHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                {t("dashboard.earningsEmpty")}
              </div>
            ) : (
              awardedHistory.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{entry.sourceUser.name}</p>
                        <Badge variant="outline">{t("dashboard.level")} {entry.levelNumber}</Badge>
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
                        <p className="text-xs text-muted-foreground">{t("dashboard.totalPoints").replace("points", "").trim()} {t("dashboard.availableNow").toLowerCase().split(" ")[0]} {entry.basePoints}</p>
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
