export function formatCurrency(amount: number, currency = "EUR", locale = "en-IE"): string {
  if (currency === "TOMAN") {
    return `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)} TOMAN`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "IRR" ? 0 : 2,
    maximumFractionDigits: currency === "IRR" ? 0 : 2,
  }).format(amount);
}
