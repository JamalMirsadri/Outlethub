import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getLanguageDirection, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";

export function applyLanguageAttributes(language: string): void {
  const safeLang: SupportedLanguage =
    (SUPPORTED_LANGUAGES as readonly string[]).includes(language)
      ? (language as SupportedLanguage)
      : "en";
  const dir = getLanguageDirection(safeLang);
  const html = document.documentElement;
  if (html.getAttribute("lang") !== safeLang) {
    html.setAttribute("lang", safeLang);
  }
  if (html.getAttribute("dir") !== dir) {
    html.setAttribute("dir", dir);
  }
  html.dataset.language = safeLang;
  html.dataset.direction = dir;
}

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    applyLanguageAttributes(i18n.resolvedLanguage ?? i18n.language ?? "en");

    const handleLanguageChanged = (lng: string) => {
      applyLanguageAttributes(lng);
    };

    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, [i18n]);

  return <>{children}</>;
}
