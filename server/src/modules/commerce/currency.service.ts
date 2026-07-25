import { Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

const REQUIRED_DISPLAY_CURRENCIES = [
  { code: "EUR", name: "Euro", symbol: "EUR", isDefault: true },
  { code: "IRR", name: "Iranian Rial", symbol: "IRR", isDefault: false },
  { code: "TOMAN", name: "Iranian Toman", symbol: "TOMAN", isDefault: false },
];

function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) {
    return 0;
  }

  return Number(value);
}

export interface CurrencyConversionResult {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  originalAmount: number;
  convertedAmount: number;
}

export class CurrencyService {
  private async ensureSupportedCurrencies() {
    await Promise.all(
      REQUIRED_DISPLAY_CURRENCIES.map((currency) =>
        prisma.currency.upsert({
          where: { code: currency.code },
          update: {
            name: currency.name,
            symbol: currency.symbol,
            isDefault: currency.isDefault,
          },
          create: currency,
        }),
      ),
    );
  }

  public async getPreferredCurrency(userId?: string | null) {
    if (!userId) {
      return "EUR";
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferredCurrency: true,
      },
    });

    return user?.preferredCurrency ?? "EUR";
  }

  public async updatePreferredCurrency(userId: string, currency: string) {
    const normalizedCurrency = currency.trim().toUpperCase();
    await this.ensureSupportedCurrencies();

    const supportedCurrency = await prisma.currency.findUnique({
      where: { code: normalizedCurrency },
      select: { code: true },
    });

    if (!supportedCurrency) {
      throw new ApiError(400, `Currency ${normalizedCurrency} is not supported.`);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        preferredCurrency: normalizedCurrency,
      },
      select: {
        preferredCurrency: true,
      },
    });

    return updated.preferredCurrency;
  }

  public async getActiveExchangeRates() {
    const rates = await prisma.exchangeRate.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ baseCurrency: "asc" }, { quoteCurrency: "asc" }],
    });

    return rates.map((rate) => ({
      id: rate.id,
      baseCurrency: rate.baseCurrency,
      quoteCurrency: rate.quoteCurrency,
      rate: toNumber(rate.rate),
      updatedByUserId: rate.updatedByUserId,
      notes: rate.notes,
      updatedAt: rate.updatedAt,
      createdAt: rate.createdAt,
    }));
  }

  public async getCurrencyContext(userId?: string | null) {
    await this.ensureSupportedCurrencies();

    const [preferredCurrency, rates, currencies] = await Promise.all([
      this.getPreferredCurrency(userId),
      this.getActiveExchangeRates(),
      prisma.currency.findMany({
        orderBy: { code: "asc" },
      }),
    ]);

    return {
      preferredCurrency,
      supportedDisplayCurrencies: currencies.map((currency) => ({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        isDefault: currency.isDefault,
      })),
      exchangeRates: rates,
    };
  }

  public async getExchangeRate(baseCurrency: string, quoteCurrency: string) {
    if (baseCurrency === quoteCurrency) {
      return 1;
    }

    const rate = await prisma.exchangeRate.findUnique({
      where: {
        baseCurrency_quoteCurrency: {
          baseCurrency,
          quoteCurrency,
        },
      },
      select: {
        rate: true,
        isActive: true,
      },
    });

    if (!rate || !rate.isActive) {
      throw new ApiError(400, `Exchange rate ${baseCurrency} -> ${quoteCurrency} is not configured.`);
    }

    return toNumber(rate.rate);
  }

  public async convertAmount(input: {
    amount: number;
    fromCurrency: string;
    toCurrency: string;
  }): Promise<CurrencyConversionResult> {
    const rate = await this.getExchangeRate(input.fromCurrency, input.toCurrency);

    return {
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      rate,
      originalAmount: input.amount,
      convertedAmount: Number((input.amount * rate).toFixed(2)),
    };
  }
}

export const currencyService = new CurrencyService();
