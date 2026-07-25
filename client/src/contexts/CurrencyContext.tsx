import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getCurrencyContext,
  updatePreferredCurrency,
  type CurrencyContextResponse,
} from "@/api/commerce";
import { useAuth } from "@/contexts/AuthContext";

const GUEST_CURRENCY_STORAGE_KEY = "outlethub_display_currency";

interface CurrencyContextValue {
  preferredCurrency: string;
  supportedCurrencies: CurrencyContextResponse["supportedDisplayCurrencies"];
  exchangeRates: CurrencyContextResponse["exchangeRates"];
  setPreferredCurrency: (currency: string) => Promise<void>;
  convertAmount: (amount: number, baseCurrency?: string | null, quoteCurrency?: string | null) => number;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

interface CurrencyProviderProps {
  children: ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const { isAuthenticated, authChecked } = useAuth();
  const [preferredCurrency, setPreferredCurrencyState] = useState("EUR");
  const [supportedCurrencies, setSupportedCurrencies] = useState<CurrencyContextResponse["supportedDisplayCurrencies"]>([]);
  const [exchangeRates, setExchangeRates] = useState<CurrencyContextResponse["exchangeRates"]>([]);

  const loadContext = useCallback(async () => {
    const context = await getCurrencyContext();
    const guestCurrency =
      typeof window !== "undefined" ? window.localStorage.getItem(GUEST_CURRENCY_STORAGE_KEY) : null;

    setSupportedCurrencies(context.supportedDisplayCurrencies);
    setExchangeRates(context.exchangeRates);
    setPreferredCurrencyState(isAuthenticated ? context.preferredCurrency : guestCurrency || context.preferredCurrency);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    void loadContext();
  }, [authChecked, loadContext]);

  const setPreferredCurrency = useCallback(
    async (currency: string) => {
      setPreferredCurrencyState(currency);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(GUEST_CURRENCY_STORAGE_KEY, currency);
      }

      if (isAuthenticated) {
        await updatePreferredCurrency(currency);
      }
    },
    [isAuthenticated],
  );

  const convertAmount = useCallback(
    (amount: number, baseCurrency?: string | null, quoteCurrency?: string | null) => {
      const resolvedBaseCurrency = baseCurrency ?? "EUR";
      const resolvedQuoteCurrency = quoteCurrency ?? preferredCurrency;

      if (!amount) {
        return 0;
      }

      if (resolvedBaseCurrency === resolvedQuoteCurrency) {
        return amount;
      }

      const rate = exchangeRates.find(
        (entry) =>
          entry.baseCurrency === resolvedBaseCurrency &&
          entry.quoteCurrency === resolvedQuoteCurrency &&
          entry.isActive,
      );

      return rate ? Number((amount * rate.rate).toFixed(2)) : amount;
    },
    [exchangeRates, preferredCurrency],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      preferredCurrency,
      supportedCurrencies,
      exchangeRates,
      setPreferredCurrency,
      convertAmount,
    }),
    [convertAmount, exchangeRates, preferredCurrency, setPreferredCurrency, supportedCurrencies],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);

  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }

  return context;
}
