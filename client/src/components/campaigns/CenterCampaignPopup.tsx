import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getActiveCenterPopup, type CampaignRecord } from "@/api/campaigns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const DISMISSED_STORAGE_KEY = "outlethub:center-popup:dismissed";

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

export default function CenterCampaignPopup() {
  const location = useLocation();
  const { t } = useTranslation();
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
        setOpen(dismissedSignature !== buildDismissSignature(result));
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
      <DialogContent className="max-w-2xl overflow-hidden border-border/70 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--card)))] p-0 shadow-[0_32px_80px_rgba(0,0,0,0.45)]">
        <div className="relative">
          {campaign.image ? (
            <img src={campaign.image} alt={campaign.title} className="h-60 w-full object-cover sm:h-72" />
          ) : (
            <div className="h-60 w-full bg-[radial-gradient(circle_at_top,hsl(var(--accent)/0.3),transparent_60%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--background)))] sm:h-72" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(6,10,20,0.72))]" />
        </div>

        <div className="space-y-4 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[hsl(var(--accent))]">{t("campaigns.centerEyebrow")}</p>
            <DialogTitle className="font-display text-2xl font-semibold sm:text-3xl">{campaign.title}</DialogTitle>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              {campaign.description || t("campaigns.defaultDescription")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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

            <Button variant="outline" size="lg" onClick={() => handleOpenChange(false)}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
