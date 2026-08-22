import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getActiveCenterPopup, type CampaignRecord } from "@/api/campaigns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

const DISMISSED_STORAGE_KEY = "outlethub:center-popup:dismissed";
const GUEST_VISITOR_KEY = "outlethub:center-popup:guest-key";
const IMPRESSION_KEY_PREFIX = "outlethub:center-popup:impressions:";

function isStorefrontPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/shop" ||
    pathname === "/cart" ||
    pathname.startsWith("/product/") ||
    pathname.startsWith("/products/")
  );
}

function buildDismissSignature(campaign: CampaignRecord) {
  return `${campaign.id}:${campaign.updatedAt}`;
}

function isExternalLink(value: string) {
  return /^https?:\/\//i.test(value);
}

function getDayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getVisitorKey(userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  if (typeof window === "undefined") {
    return "guest";
  }

  let guestKey = window.localStorage.getItem(GUEST_VISITOR_KEY);
  if (!guestKey) {
    guestKey = `guest:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(GUEST_VISITOR_KEY, guestKey);
  }

  return guestKey;
}

function getImpressionStorageKey(campaignId: string, visitorKey: string): string {
  return `${IMPRESSION_KEY_PREFIX}${campaignId}:${visitorKey}`;
}

function readDailyImpressionCount(campaignId: string, visitorKey: string): number {
  const raw = window.localStorage.getItem(getImpressionStorageKey(campaignId, visitorKey));
  if (!raw) {
    return 0;
  }

  const [storedDayKey, countValue] = raw.split(":");
  if (storedDayKey !== getDayKey()) {
    return 0;
  }

  return Number(countValue) || 0;
}

function recordDailyImpression(campaignId: string, visitorKey: string): number {
  const nextCount = readDailyImpressionCount(campaignId, visitorKey) + 1;
  window.localStorage.setItem(getImpressionStorageKey(campaignId, visitorKey), `${getDayKey()}:${nextCount}`);
  return nextCount;
}

export default function CenterCampaignPopup() {
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const shouldRenderOnPage = useMemo(() => isStorefrontPath(location.pathname), [location.pathname]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const result = await getActiveCenterPopup();

        if (!isMounted) {
          return;
        }

        setCampaign(result);

        if (!result) {
          setOpen(false);
          return;
        }

        const dismissedSignature = window.sessionStorage.getItem(DISMISSED_STORAGE_KEY);
        if (dismissedSignature === buildDismissSignature(result)) {
          setOpen(false);
          return;
        }

        const visitorKey = getVisitorKey(user?.id);
        const dailyCount = readDailyImpressionCount(result.id, visitorKey);
        const limit = result.maxDisplaysPerUser;

        if (limit != null && dailyCount >= limit) {
          setOpen(false);
          return;
        }

        recordDailyImpression(result.id, visitorKey);
        setOpen(true);
      } catch {
        if (isMounted) {
          setCampaign(null);
          setOpen(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!shouldRenderOnPage || loading || !campaign) {
    return null;
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, buildDismissSignature(campaign));
    }
  };

  const ctaLabel = campaign.link ? t("campaigns.cta") : t("campaigns.closePopup");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden border-0 p-0 shadow-[0_32px_80px_rgba(0,0,0,0.45)]">
        <div className="relative min-h-[420px] w-full sm:min-h-[480px]">
          {campaign.image ? (
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${campaign.image})` }} />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--accent)/0.3),transparent_60%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--background)))]" />
          )}

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.25),rgba(6,10,20,0.82))]" />

          <div className="relative flex min-h-[420px] w-full flex-col justify-end p-6 sm:min-h-[480px] sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[hsl(var(--accent))]">
              {t("campaigns.centerEyebrow")}
            </p>
            <DialogTitle className="mt-2 font-display text-2xl font-semibold text-foreground sm:text-3xl">
              {campaign.title}
            </DialogTitle>
            <p className="mt-2 text-sm leading-7 text-foreground/90 sm:text-base">
              {campaign.description || t("campaigns.defaultDescription")}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {campaign.link ? (
                isExternalLink(campaign.link) ? (
                  <Button asChild size="lg" onClick={() => handleOpenChange(false)}>
                    <a href={campaign.link} target="_blank" rel="noreferrer">
                      {ctaLabel}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button asChild size="lg" onClick={() => handleOpenChange(false)}>
                    <Link to={campaign.link}>
                      {ctaLabel}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                )
              ) : (
                <Button size="lg" onClick={() => handleOpenChange(false)}>
                  {ctaLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
