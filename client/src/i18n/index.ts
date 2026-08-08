import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { en } from "./locales/en";
import { fa } from "./locales/fa";

export const SUPPORTED_LANGUAGES = ["en", "fa"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_META: Record<
  SupportedLanguage,
  { label: string; shortLabel: string; dir: "ltr" | "rtl"; flagCode?: string }
> = {
  en: { label: "English", shortLabel: "EN", dir: "ltr" },
  fa: { label: "فارسی", shortLabel: "فا", dir: "rtl" },
};

const STORAGE_KEY = "outhub:lang";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    resources: {
      en: { translation: en },
      fa: { translation: fa },
    },
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

export function getLanguageDirection(lang: string): "ltr" | "rtl" {
  return lang === "fa" ? "rtl" : "ltr";
}

export function getLanguageNativeLabel(lang: string): string {
  const key = (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
    ? (lang as SupportedLanguage)
    : "en";
  return LANGUAGE_META[key].label;
}

export const I18N_STORAGE_KEY = STORAGE_KEY;

export default i18n;
