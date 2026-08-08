import React, { useEffect, useState } from "react";
import { CreditCard, Upload } from "lucide-react";

import { listCustomerPayments, uploadPaymentReceipt } from "@/api/commerce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency, shouldShowTomanAmounts } from "@/lib/currency";
import { useTranslation } from "react-i18next";

const STATUS_STYLES = {
  PAYMENT_PENDING_REVIEW: "bg-amber-500/10 text-amber-500",
  PAYMENT_APPROVED: "bg-violet-500/10 text-violet-500",
  PAYMENT_PENDING: "bg-blue-500/10 text-blue-500",
  PAID: "bg-emerald-500/10 text-emerald-500",
  PAYMENT_REJECTED: "bg-red-500/10 text-red-500",
  FAILED: "bg-red-500/10 text-red-500",
};

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PaymentsPage() {
  const { t } = useTranslation(["dashboard", "common", "product"]);
  const [payments, setPayments] = useState([]);
  const [referenceById, setReferenceById] = useState({});
  const [notesById, setNotesById] = useState({});
  const [fileById, setFileById] = useState({});
  const [savingId, setSavingId] = useState(null);
  const { preferredCurrency, convertAmount } = useCurrency();

  const buildTimeline = (payment) => {
    return [
      {
        label: t("common.upload"),
        timestamp: payment.receiptUploadedAt,
      },
      {
        label: t("dashboard.paymentApproved"),
        timestamp: payment.approvedAt,
      },
      {
        label: t("dashboard.paymentCompleted"),
        timestamp: payment.status === "PAID" ? payment.processedAt : null,
      },
      {
        label: t("dashboard.procurementStarted"),
        timestamp: payment.status === "PAID" && payment.order?.status === "PAID" ? payment.processedAt : null,
      },
    ];
  };

  const loadPayments = async () => {
    setPayments(await listCustomerPayments());
  };

  useEffect(() => {
    loadPayments().catch(() => {});
  }, []);

  const handleUpload = async (payment) => {
    const file = fileById[payment.id];
    if (!file) {
      return;
    }

    setSavingId(payment.id);

    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadPaymentReceipt(payment.id, {
        dataUrl,
        fileName: file.name,
        mimeType: file.type,
        paymentReference: referenceById[payment.id] || null,
        notes: notesById[payment.id] || null,
      });
      await loadPayments();
      setFileById((current) => ({ ...current, [payment.id]: null }));
      toast({
        title: t("common.success"),
        description: t("dashboard.paymentPendingReview"),
      });
    } catch (error) {
      toast({
        title: t("common.errorOccurred"),
        description: error instanceof Error ? error.message : t("common.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <h2 className="font-display text-xl font-bold mb-6">{t("dashboard.payments")}</h2>
      {payments.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-xl">
          <CreditCard className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("common.noResults")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("common.info")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-xl border border-border p-5">
              {(() => {
                const timeline = buildTimeline(payment);

                return (
                  <>
              {(() => {
                const showTomanAmount = shouldShowTomanAmounts({
                  countryCode: payment.order?.shippingAddress?.countryCode,
                  displayCurrency: payment.displayCurrency,
                });
                const tomanAmount = convertAmount(payment.amount, payment.currency, "TOMAN");

                return (
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{payment.order?.orderNumber ?? payment.providerLabel}</p>
                    <Badge variant="secondary" className={STATUS_STYLES[payment.status] ?? "bg-secondary text-foreground"}>
                      {payment.statusLabel?.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{payment.providerLabel} · {payment.paymentReference ?? t("dashboard.pending")}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatCurrency(payment.amount, payment.currency)}
                    {showTomanAmount ? ` · ${formatCurrency(tomanAmount, "TOMAN")}` : ` · ${formatCurrency(convertAmount(payment.amount, payment.currency, preferredCurrency), preferredCurrency)}`}
                  </p>
                  {payment.receiptUrl ? (
                    <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex mt-2 text-sm text-[hsl(var(--accent))] hover:underline">
                      {t("common.view")}
                    </a>
                  ) : null}
                  {payment.order?.customerAddress ? (
                    <div className="mt-4 rounded-lg bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{t("common.address")}</p>
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
                    <div className="mt-4 space-y-3">
                      {payment.order.items.map((item) => (
                        <div key={item.id} className="rounded-lg bg-secondary/30 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{item.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{item.brandName || "Unknown brand"} · Qty {item.quantity}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="rounded-full bg-background px-3 py-1 text-[11px] text-muted-foreground">{t("product.size")}: {item.size || t("product.notSelected")}</span>
                                <span className="rounded-full bg-background px-3 py-1 text-[11px] text-muted-foreground">{t("product.color")}: {item.color || t("product.notSelected")}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{formatCurrency(item.totalPrice, payment.currency)}</p>
                              {showTomanAmount ? <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(item.totalPrice * payment.exchangeRate, "TOMAN")}</p> : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-2 md:grid-cols-4">
                    {timeline.map((step) => (
                      <div key={step.label} className="rounded-lg bg-secondary/40 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{step.label}</p>
                        <p className="mt-2 text-xs font-medium">
                          {step.timestamp ? new Date(step.timestamp).toLocaleString() : t("dashboard.pending")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {payment.provider === "BANK_TRANSFER" &&
                (payment.status === "PAYMENT_PENDING" || payment.status === "PAYMENT_REJECTED") ? (
                  <div className="w-full max-w-md space-y-3">
                    <div>
                      <Label className="text-xs">{t("dashboard.referralCode")}</Label>
                      <Input className="mt-1" value={referenceById[payment.id] ?? ""} onChange={(event) => setReferenceById((current) => ({ ...current, [payment.id]: event.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">{t("common.info")}</Label>
                      <Textarea className="mt-1" value={notesById[payment.id] ?? ""} onChange={(event) => setNotesById((current) => ({ ...current, [payment.id]: event.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">{t("common.upload")}</Label>
                      <Input className="mt-1" type="file" accept="image/*,.pdf,application/pdf" onChange={(event) => setFileById((current) => ({ ...current, [payment.id]: event.target.files?.[0] ?? null }))} />
                    </div>
                    <Button onClick={() => void handleUpload(payment)} disabled={savingId === payment.id || !fileById[payment.id]}>
                      <Upload className="w-4 h-4 mr-2" />
                      {t("common.upload")}
                    </Button>
                  </div>
                ) : null}
              </div>
                );
              })()}
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
