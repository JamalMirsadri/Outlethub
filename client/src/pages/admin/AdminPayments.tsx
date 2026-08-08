import { useCallback, useEffect, useState } from "react";
import { CreditCard, Receipt, RefreshCcw, Wallet } from "lucide-react";

import {
  completePayment,
  getAdminPayments,
  listPaymentProviderConfigs,
  updatePaymentProviderConfig,
  type PaymentProviderConfigRecord,
  type PaymentRecord,
  type PaymentsAdminDashboardResponse,
} from "@/api/commerce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, shouldShowTomanAmounts } from "@/lib/currency";

const STATUS_STYLES: Record<string, string> = {
  PAYMENT_PENDING_REVIEW: "bg-amber-500/10 text-amber-500",
  PAYMENT_APPROVED: "bg-violet-500/10 text-violet-500",
  PAYMENT_PENDING: "bg-blue-500/10 text-blue-500",
  PAID: "bg-emerald-500/10 text-emerald-500",
  PAYMENT_REJECTED: "bg-red-500/10 text-red-500",
  FAILED: "bg-red-500/10 text-red-500",
  REFUNDED: "bg-muted text-muted-foreground",
  PARTIALLY_REFUNDED: "bg-orange-500/10 text-orange-500",
};

function getLatestTransition(payment: PaymentRecord) {
  return payment.auditLogs[0] ?? null;
}

function mergedProvider(
  provider: PaymentProviderConfigRecord,
  patch: Partial<PaymentProviderConfigRecord> | undefined
): PaymentProviderConfigRecord {
  return {
    ...provider,
    ...patch,
    settings: {
      ...((provider.settings ?? {}) as Record<string, unknown>),
      ...((patch?.settings ?? {}) as Record<string, unknown>),
    },
  };
}

export default function AdminPayments() {
  const [dashboard, setDashboard] = useState<PaymentsAdminDashboardResponse | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [providers, setProviders] = useState<PaymentProviderConfigRecord[] | null>(null);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [patches, setPatches] = useState<Record<string, Partial<PaymentProviderConfigRecord>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadDashboard = async () => {
    setDashboard(await getAdminPayments());
  };

  const loadProviders = useCallback(async () => {
    setProvidersLoading(true);
    try {
      setProviders(await listPaymentProviderConfigs());
      setPatches({});
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard().catch(() => {});
    loadProviders().catch(() => {});
  }, [loadProviders]);

  const handleCompletePayment = async (paymentId: string) => {
    setCompletingId(paymentId);
    try {
      await completePayment(paymentId);
      await loadDashboard();
    } finally {
      setCompletingId(null);
    }
  };

  const patchField = (
    providerId: string,
    field: keyof PaymentProviderConfigRecord,
    value: unknown
  ) => {
    setPatches((prev) => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] ?? {}),
        [field]: value,
      },
    }));
  };

  const patchSetting = (providerId: string, key: string, value: unknown) => {
    setPatches((prev) => {
      const existing = prev[providerId] ?? {};
      const existingSettings = (existing.settings ?? {}) as Record<string, unknown>;
      return {
        ...prev,
        [providerId]: {
          ...existing,
          settings: {
            ...existingSettings,
            [key]: value,
          },
        },
      };
    });
  };

  const handleToggleActive = async (provider: PaymentProviderConfigRecord) => {
    setTogglingId(provider.id);
    try {
      await updatePaymentProviderConfig(provider.id, {
        isActive: !provider.isActive,
      });
      await loadProviders();
    } finally {
      setTogglingId(null);
    }
  };

  const handleSave = async (provider: PaymentProviderConfigRecord) => {
    const patch = patches[provider.id] ?? {};
    const merged = mergedProvider(provider, patch);

    const supportedCurrencies =
      typeof merged.supportedCurrencies === "string"
        ? (merged.supportedCurrencies as string)
            .split("\n")
            .map((c) => c.trim())
            .filter(Boolean)
        : Array.isArray(merged.supportedCurrencies)
        ? merged.supportedCurrencies
        : [];

    const payload = {
      displayName: merged.displayName,
      priority: Number(merged.priority),
      supportedCurrencies,
      settings: (merged.settings ?? {}) as Record<string, unknown>,
    };

    setSavingId(provider.id);
    try {
      await updatePaymentProviderConfig(provider.id, payload);
      await loadProviders();
    } finally {
      setSavingId(null);
    }
  };

  const handleReloadProvider = async () => {
    await loadProviders();
  };

  if (!dashboard) {
    return <div className="space-y-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 rounded-xl bg-secondary animate-pulse" />)}</div>;
  }

  const cards = [
    { label: "Revenue EUR", value: formatCurrency(dashboard.summary.revenueEur, "EUR"), icon: Wallet },
    { label: "Revenue TOMAN", value: formatCurrency(dashboard.summary.revenueToman, "TOMAN"), icon: Wallet },
    { label: "Successful Payments", value: dashboard.summary.successfulPayments, icon: CreditCard },
    { label: "Approved Awaiting Settlement", value: dashboard.summary.approvedAwaitingSettlement, icon: CreditCard },
    { label: "Pending Reviews", value: dashboard.summary.pendingReviews, icon: Receipt },
    { label: "Failed Payments", value: dashboard.summary.failedPayments, icon: RefreshCcw },
    { label: "Refunds", value: dashboard.summary.refunds, icon: RefreshCcw },
  ];

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Payment Methods</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Configure and enable/disable payment methods for checkout. These settings apply dynamically without code changes.
          </p>
        </div>

        {providersLoading && !providers ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {providers?.map((provider) => {
              const merged = mergedProvider(provider, patches[provider.id]);
              const currenciesDisplay = Array.isArray(provider.supportedCurrencies)
                ? provider.supportedCurrencies.join("\n")
                : "";
              const patchCurrenciesVal = patches[provider.id]?.supportedCurrencies;
              const effectiveCurrencies =
                patchCurrenciesVal !== undefined
                  ? Array.isArray(patchCurrenciesVal)
                    ? patchCurrenciesVal.join("\n")
                    : String(patchCurrenciesVal)
                  : currenciesDisplay;

              return (
                <div key={provider.id} className="rounded-xl border border-border bg-card p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <h2 className="font-semibold text-lg">{merged.displayName}</h2>
                      <Badge variant="secondary">{provider.code}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label htmlFor={`active-${provider.id}`} className="text-sm">
                        {merged.isActive ? "Enabled" : "Disabled"}
                      </Label>
                      <Switch
                        id={`active-${provider.id}`}
                        checked={merged.isActive}
                        disabled={togglingId === provider.id}
                        onCheckedChange={() => void handleToggleActive(provider)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
                    <div className="space-y-2">
                      <Label htmlFor={`name-${provider.id}`}>Display Name</Label>
                      <Input
                        id={`name-${provider.id}`}
                        value={merged.displayName}
                        onChange={(e) => patchField(provider.id, "displayName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`priority-${provider.id}`}>Priority</Label>
                      <Input
                        id={`priority-${provider.id}`}
                        type="number"
                        value={Number(merged.priority) ?? 0}
                        onChange={(e) => patchField(provider.id, "priority", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`currencies-${provider.id}`}>Supported Currencies</Label>
                      <Textarea
                        id={`currencies-${provider.id}`}
                        rows={4}
                        placeholder={"EUR\nUSD\nTOMAN"}
                        value={effectiveCurrencies}
                        onChange={(e) => patchField(provider.id, "supportedCurrencies", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">One currency code per line.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`desc-${provider.id}`}>Display Description</Label>
                      <Textarea
                        id={`desc-${provider.id}`}
                        rows={4}
                        value={(merged.settings as Record<string, unknown>)?.description as string ?? ""}
                        onChange={(e) => patchSetting(provider.id, "description", e.target.value)}
                      />
                    </div>
                  </div>

                  {provider.code === "BANK_TRANSFER" && (
                    <div className="grid gap-4 md:grid-cols-2 mb-6 p-4 rounded-lg border border-border bg-secondary/20">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`bt-instructions-${provider.id}`}>Transfer Instructions</Label>
                        <Textarea
                          id={`bt-instructions-${provider.id}`}
                          rows={4}
                          value={(merged.settings as Record<string, unknown>)?.transferInstructions as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "transferInstructions", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`bt-receipt-${provider.id}`}
                          checked={Boolean((merged.settings as Record<string, unknown>)?.requireReceipt)}
                          onCheckedChange={(v) => patchSetting(provider.id, "requireReceipt", v)}
                        />
                        <Label htmlFor={`bt-receipt-${provider.id}`}>Require Receipt Upload</Label>
                      </div>
                    </div>
                  )}

                  {provider.code === "STRIPE" && (
                    <div className="grid gap-4 md:grid-cols-2 mb-6 p-4 rounded-lg border border-border bg-secondary/20">
                      <div className="space-y-2">
                        <Label htmlFor={`stripe-pk-${provider.id}`}>Publishable Key</Label>
                        <Input
                          id={`stripe-pk-${provider.id}`}
                          value={(merged.settings as Record<string, unknown>)?.publishableKey as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "publishableKey", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`stripe-sk-${provider.id}`}>Secret Key</Label>
                        <Input
                          id={`stripe-sk-${provider.id}`}
                          type="password"
                          value={(merged.settings as Record<string, unknown>)?.secretKey as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "secretKey", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`stripe-wh-${provider.id}`}>Webhook Secret</Label>
                        <Input
                          id={`stripe-wh-${provider.id}`}
                          type="password"
                          value={(merged.settings as Record<string, unknown>)?.webhookSecret as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "webhookSecret", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-3 self-end">
                        <Switch
                          id={`stripe-test-${provider.id}`}
                          checked={Boolean((merged.settings as Record<string, unknown>)?.testMode)}
                          onCheckedChange={(v) => patchSetting(provider.id, "testMode", v)}
                        />
                        <Label htmlFor={`stripe-test-${provider.id}`}>Test Mode</Label>
                      </div>
                    </div>
                  )}

                  {provider.code === "PAYPAL" && (
                    <div className="grid gap-4 md:grid-cols-2 mb-6 p-4 rounded-lg border border-border bg-secondary/20">
                      <div className="space-y-2">
                        <Label htmlFor={`paypal-cid-${provider.id}`}>Client ID</Label>
                        <Input
                          id={`paypal-cid-${provider.id}`}
                          value={(merged.settings as Record<string, unknown>)?.clientId as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "clientId", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`paypal-sk-${provider.id}`}>Secret Key</Label>
                        <Input
                          id={`paypal-sk-${provider.id}`}
                          type="password"
                          value={(merged.settings as Record<string, unknown>)?.secretKey as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "secretKey", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`paypal-wh-${provider.id}`}>Webhook ID</Label>
                        <Input
                          id={`paypal-wh-${provider.id}`}
                          value={(merged.settings as Record<string, unknown>)?.webhookId as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "webhookId", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`paypal-mode-${provider.id}`}>Mode</Label>
                        <Select
                          value={(merged.settings as Record<string, unknown>)?.mode as string ?? "sandbox"}
                          onValueChange={(v) => patchSetting(provider.id, "mode", v)}
                        >
                          <SelectTrigger id={`paypal-mode-${provider.id}`}>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandbox">sandbox</SelectItem>
                            <SelectItem value="live">live</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {provider.code === "MB_WAY" && (
                    <div className="grid gap-4 md:grid-cols-2 mb-6 p-4 rounded-lg border border-border bg-secondary/20">
                      <div className="space-y-2">
                        <Label htmlFor={`mb-merchant-${provider.id}`}>Merchant ID</Label>
                        <Input
                          id={`mb-merchant-${provider.id}`}
                          value={(merged.settings as Record<string, unknown>)?.merchantId as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "merchantId", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`mb-entity-${provider.id}`}>Entity ID</Label>
                        <Input
                          id={`mb-entity-${provider.id}`}
                          value={(merged.settings as Record<string, unknown>)?.entityId as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "entityId", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`mb-url-${provider.id}`}>Notification URL</Label>
                        <Input
                          id={`mb-url-${provider.id}`}
                          type="url"
                          value={(merged.settings as Record<string, unknown>)?.notificationUrl as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "notificationUrl", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-3 self-end">
                        <Switch
                          id={`mb-test-${provider.id}`}
                          checked={Boolean((merged.settings as Record<string, unknown>)?.testMode)}
                          onCheckedChange={(v) => patchSetting(provider.id, "testMode", v)}
                        />
                        <Label htmlFor={`mb-test-${provider.id}`}>Test Mode</Label>
                      </div>
                    </div>
                  )}

                  {provider.code === "MULTIBANCO" && (
                    <div className="grid gap-4 md:grid-cols-2 mb-6 p-4 rounded-lg border border-border bg-secondary/20">
                      <div className="space-y-2">
                        <Label htmlFor={`multibanco-entity-${provider.id}`}>Entity</Label>
                        <Input
                          id={`multibanco-entity-${provider.id}`}
                          value={(merged.settings as Record<string, unknown>)?.entity as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "entity", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`multibanco-subentity-${provider.id}`}>Sub Entity</Label>
                        <Input
                          id={`multibanco-subentity-${provider.id}`}
                          value={(merged.settings as Record<string, unknown>)?.subEntity as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "subEntity", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`multibanco-apikey-${provider.id}`}>API Key</Label>
                        <Input
                          id={`multibanco-apikey-${provider.id}`}
                          type="password"
                          value={(merged.settings as Record<string, unknown>)?.apiKey as string ?? ""}
                          onChange={(e) => patchSetting(provider.id, "apiKey", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-3 self-end">
                        <Switch
                          id={`multibanco-test-${provider.id}`}
                          checked={Boolean((merged.settings as Record<string, unknown>)?.testMode)}
                          onCheckedChange={(v) => patchSetting(provider.id, "testMode", v)}
                        />
                        <Label htmlFor={`multibanco-test-${provider.id}`}>Test Mode</Label>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={() => void handleSave(provider)}
                      disabled={savingId === provider.id}
                    >
                      {savingId === provider.id ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void handleReloadProvider()}
                      disabled={providersLoading}
                    >
                      {providersLoading ? "Reloading..." : "Reload"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground mt-2">International and Iran-focused payment operations with provider analytics and receipt review visibility.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="mt-2 text-2xl font-bold">{card.value}</p>
                  </div>
                  <div className="rounded-full bg-secondary p-3">
                    <Icon className="h-4 w-4 text-[hsl(var(--accent))]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold">Revenue By Provider</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.providers.map((provider) => (
              <div key={provider.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{provider.displayName}</p>
                  <Badge variant="secondary">{provider.paymentCount}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">EUR {formatCurrency(provider.revenueEur, "EUR")}</p>
                <p className="text-sm text-muted-foreground">TOMAN {formatCurrency(provider.revenueToman, "TOMAN")}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["Order", "Provider", "Status", "Previous", "Transition", "Reviewer", "Amount", "Receipt", "Actions"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs tracking-widest text-muted-foreground">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboard.items.map((payment) => {
                  const latestTransition = getLatestTransition(payment);
                  const showTomanAmounts = shouldShowTomanAmounts({
                    displayCurrency: payment.order?.displayCurrency ?? payment.displayCurrency,
                  });

                  return (
                    <tr key={payment.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{payment.order?.orderNumber ?? "No order"}</div>
                        <div className="text-xs text-muted-foreground">{payment.order?.customerEmail ?? "No customer"}</div>
                        {payment.order?.customerAddress ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {payment.order.customerAddress.fullName} · {payment.order.customerAddress.countryCode}
                          </div>
                        ) : null}
                        {payment.order?.items?.[0] ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {payment.order.items[0].title} · Size {payment.order.items[0].size || "N/A"} · Color {payment.order.items[0].color || "N/A"}
                          </div>
                        ) : null}
                        <div className="text-xs text-muted-foreground">{payment.paymentReference ?? "No reference"}</div>
                      </td>
                      <td className="px-4 py-3">{payment.providerLabel}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={STATUS_STYLES[payment.status] ?? "bg-secondary text-foreground"}>
                          {payment.statusLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {latestTransition?.fromStatus ? latestTransition.fromStatus.replaceAll("_", " ") : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {latestTransition ? new Date(latestTransition.createdAt).toLocaleString() : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {latestTransition?.actorUser?.email ?? "System"}
                      </td>
                      <td className="px-4 py-3">
                        <div>{formatCurrency(payment.amount, payment.currency)}</div>
                        {showTomanAmounts ? (
                          <div className="text-xs text-muted-foreground">{formatCurrency(payment.amount * payment.exchangeRate, "TOMAN")}</div>
                        ) : (
                          <div className="text-xs text-muted-foreground">{payment.displayCurrency}</div>
                        )}
                        {latestTransition?.notes ? (
                          <div className="mt-1 text-xs text-muted-foreground">{latestTransition.notes}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {payment.receiptUrl ? (
                          <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="text-[hsl(var(--accent))] hover:underline">
                            View receipt
                          </a>
                        ) : (
                          <span className="text-muted-foreground">No receipt</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {payment.status === "PAYMENT_APPROVED" ? (
                          <Button
                            size="sm"
                            onClick={() => void handleCompletePayment(payment.id)}
                            disabled={completingId === payment.id}
                          >
                            Complete Payment
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {payment.status === "PAID" ? "Completed" : "No action"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
