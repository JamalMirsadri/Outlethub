import { useEffect, useState } from "react";
import { CreditCard, Receipt, RefreshCcw, Wallet } from "lucide-react";

import { completePayment, getAdminPayments, type PaymentRecord, type PaymentsAdminDashboardResponse } from "@/api/commerce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default function AdminPayments() {
  const [dashboard, setDashboard] = useState<PaymentsAdminDashboardResponse | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const loadDashboard = async () => {
    setDashboard(await getAdminPayments());
  };

  useEffect(() => {
    loadDashboard().catch(() => {});
  }, []);

  const handleCompletePayment = async (paymentId: string) => {
    setCompletingId(paymentId);
    try {
      await completePayment(paymentId);
      await loadDashboard();
    } finally {
      setCompletingId(null);
    }
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
  );
}
