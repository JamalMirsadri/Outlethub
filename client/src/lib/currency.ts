export function normalizeCurrencyCode(currency?: string | null): string {
  return (currency ?? "").trim().toUpperCase();
}

export function shouldShowTomanAmounts(input?: {
  countryCode?: string | null;
  displayCurrency?: string | null;
}): boolean {
  return (
    normalizeCurrencyCode(input?.countryCode) === "IR" ||
    normalizeCurrencyCode(input?.displayCurrency) === "TOMAN"
  );
}

export function formatCurrency(amount: number, currency = "EUR", locale = "en-IE"): string {
  const normalizedCurrency = normalizeCurrencyCode(currency) || "EUR";

  if (normalizedCurrency === "TOMAN") {
    return `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)} TOMAN`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: normalizedCurrency === "IRR" ? 0 : 2,
    maximumFractionDigits: normalizedCurrency === "IRR" ? 0 : 2,
  }).format(amount);
}
