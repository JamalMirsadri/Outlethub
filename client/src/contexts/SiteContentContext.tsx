import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { getSiteContentSettings } from "@/api/commerce";
import {
  DEFAULT_SITE_CONTENT_SETTINGS,
  type SiteContentSettings,
} from "@/lib/site-content";

interface SiteContentContextValue {
  settings: SiteContentSettings;
  refresh: () => Promise<void>;
}

const SiteContentContext = createContext<SiteContentContextValue>({
  settings: DEFAULT_SITE_CONTENT_SETTINGS,
  refresh: async () => undefined,
});

function upsertMetaTag(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
}

function upsertCanonicalLink(href: string) {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

export function SiteContentProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [settings, setSettings] = useState<SiteContentSettings>(DEFAULT_SITE_CONTENT_SETTINGS);

  const refresh = async () => {
    try {
      setSettings(await getSiteContentSettings());
    } catch {
      setSettings(DEFAULT_SITE_CONTENT_SETTINGS);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const title = settings.seo.titleSuffix
      ? `${settings.seo.defaultTitle} | ${settings.seo.titleSuffix}`
      : settings.seo.defaultTitle;

    document.title = title;
    upsertMetaTag('meta[name="description"]', { name: "description", content: settings.seo.description });
    upsertMetaTag('meta[name="keywords"]', { name: "keywords", content: settings.seo.keywords });
    upsertMetaTag('meta[name="robots"]', { name: "robots", content: settings.seo.robots });
    upsertMetaTag('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMetaTag('meta[property="og:description"]', { property: "og:description", content: settings.seo.description });
    upsertMetaTag('meta[property="og:image"]', { property: "og:image", content: settings.seo.ogImageUrl });
    upsertMetaTag('meta[property="og:type"]', { property: "og:type", content: "website" });

    if (settings.seo.canonicalBaseUrl) {
      const canonicalHref = `${settings.seo.canonicalBaseUrl.replace(/\/$/, "")}${location.pathname}`;
      upsertCanonicalLink(canonicalHref);
    }
  }, [location.pathname, settings]);

  const value = useMemo(
    () => ({
      settings,
      refresh,
    }),
    [settings],
  );

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent() {
  return useContext(SiteContentContext);
}
