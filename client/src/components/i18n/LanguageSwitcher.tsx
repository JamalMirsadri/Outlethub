import { useEffect, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  LANGUAGE_META,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function LanguageSwitcher({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label={t("common.language")}
        className="hidden items-center gap-2 rounded-full border border-border bg-card/80 p-2.5 text-foreground hover:border-[hsl(var(--accent))/0.55] sm:inline-flex"
      >
        <Globe className="h-5 w-5" />
      </button>
    );
  }

  const currentLang =
    (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.resolvedLanguage ?? i18n.language)
      ? ((i18n.resolvedLanguage ?? i18n.language) as SupportedLanguage)
      : "en";

  const meta = LANGUAGE_META[currentLang];

  const handleChange = (nextLang: SupportedLanguage) => {
    if (nextLang === currentLang) {
      return;
    }
    void i18n.changeLanguage(nextLang);
  };

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full border-border bg-card/80 text-foreground hover:border-[hsl(var(--accent))/0.55]"
            aria-label={t("common.language")}
            title={t("common.language")}
          >
            <Globe className="h-4.5 w-4.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const item = LANGUAGE_META[lang];
            const selected = currentLang === lang;
            return (
              <DropdownMenuItem
                key={lang}
                onSelect={() => handleChange(lang)}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--accent))]">
                    {item.shortLabel}
                  </span>
                  <span className="text-sm">{item.label}</span>
                </span>
                {selected ? <Check className="h-4 w-4 text-[hsl(var(--accent))]" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 p-2.5 text-foreground transition hover:border-[hsl(var(--accent))/0.55]"
          aria-label={t("common.language")}
          title={t("common.language")}
        >
          <Globe className="h-5 w-5" />
          <span className="hidden pr-1 text-xs font-semibold uppercase tracking-wider sm:inline">
            {meta.shortLabel}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const item = LANGUAGE_META[lang];
          const selected = currentLang === lang;
          return (
            <DropdownMenuItem
              key={lang}
              onSelect={() => handleChange(lang)}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--accent))]">
                  {item.shortLabel}
                </span>
                <span className="text-sm">{item.label}</span>
              </span>
              {selected ? <Check className="h-4 w-4 text-[hsl(var(--accent))]" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
