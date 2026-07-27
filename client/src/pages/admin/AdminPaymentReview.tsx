import { useEffect, useState } from "react";

import { getPaymentReviewQueue, reviewPayment, type PaymentRecord } from "@/api/commerce";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, shouldShowTomanAmounts } from "@/lib/currency";

export default function AdminPaymentReview() {
  const [items, setItems] = useState<PaymentRecord[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadQueue = async () => {
    setItems(await getPaymentReviewQueue());
  };

  useEffect(() => {
    loadQueue().catch(() => {});
  }, []);

  const handleDecision = async (paymentId: string, decision: "approve" | "reject") => {
    setSavingId(paymentId);
    try {
      await reviewPayment(paymentId, {
        decision,
        internalNotes: notes[paymentId] || null,
      });
      await loadQueue();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Payment Review</h1>
        <p className="mt-2 text-sm text-muted-foreground">Approve or reject uploaded bank transfer receipts, persist the review outcome, and release payment completion only after admin confirmation.</p>
      </div>

      {!items.length ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          No receipts are waiting for review.
        </div>
      ) : (
        items.map((payment) => (
          (() => {
            const showTomanAmounts = shouldShowTomanAmounts({
              displayCurrency: payment.order?.displayCurrency ?? payment.displayCurrency,
            });

            return (
          <div key={payment.id} className="rounded-xl border border-border bg-card p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Order</p>
                  <p className="font-semibold">{payment.order?.orderNumber ?? "No order"}</p>
                  <p className="text-sm text-muted-foreground">{payment.order?.customerEmail}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-secondary/40 p-4">
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="mt-2 font-semibold">{formatCurrency(payment.amount, payment.currency)}</p>
                    {showTomanAmounts ? (
                      <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(payment.amount * payment.exchangeRate, "TOMAN")}</p>
                    ) : null}
                  </div>
                  <div className="rounded-xl bg-secondary/40 p-4">
                    <p className="text-xs text-muted-foreground">Reference</p>
                    <p className="mt-2 font-semibold">{payment.paymentReference ?? "Pending"}</p>
                  </div>
                  <div className="rounded-xl bg-secondary/40 p-4">
                    <p className="text-xs text-muted-foreground">Uploaded</p>
                    <p className="mt-2 font-semibold">{payment.receiptUploadedAt ? new Date(payment.receiptUploadedAt).toLocaleString() : "Pending"}</p>
                  </div>
                </div>
                {payment.receiptUrl ? (
                  <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm text-[hsl(var(--accent))] hover:underline">
                    Open Receipt
                  </a>
                ) : null}
                {payment.order?.customerAddress ? (
                  <div className="rounded-xl bg-secondary/40 p-4 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Delivery Address</p>
                    <p className="mt-2">{payment.order.customerAddress.fullName}</p>
                    <p className="mt-1">
                      {payment.order.customerAddress.addressLine1}
                      {payment.order.customerAddress.addressLine2 ? `, ${payment.order.customerAddress.addressLine2}` : ""}
                    </p>
                    <p className="mt-1">
                      {payment.order.customerAddress.city}, {payment.order.customerAddress.postalCode}, {payment.order.customerAddress.countryCode}
                    </p>
                  </div>
                ) : null}
                {payment.order?.items?.length ? (
                  <div className="space-y-2">
                    {payment.order.items.map((item) => (
                      <div key={item.id} className="rounded-xl bg-secondary/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.brandName || "Unknown brand"} · Qty {item.quantity}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Size: {item.size || "Not captured"} · Color: {item.color || "Not captured"}</p>
                          </div>
                          <div className="text-right text-xs">
                            <p>{formatCurrency(item.totalPrice, payment.currency)}</p>
                            {showTomanAmounts ? <p className="mt-1 text-muted-foreground">{formatCurrency(item.totalPrice * payment.exchangeRate, "TOMAN")}</p> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div>
                  <Label className="text-xs">Internal Notes</Label>
                  <Textarea
                    className="mt-1"
                    value={notes[payment.id] ?? ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [payment.id]: event.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col justify-end gap-3">
                <Button onClick={() => void handleDecision(payment.id, "approve")} disabled={savingId === payment.id}>
                  Approve Payment
                </Button>
                <Button variant="outline" onClick={() => void handleDecision(payment.id, "reject")} disabled={savingId === payment.id}>
                  Reject Payment
                </Button>
              </div>
            </div>
          </div>
            );
          })()
        ))
      )}
    </div>
  );
}
