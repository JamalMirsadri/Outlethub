import React, { useState, useEffect } from "react";
import { listAccountOrders } from "@/api/commerce";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency, shouldShowTomanAmounts } from "@/lib/currency";
import moment from "moment";
import { useTranslation } from "react-i18next";

const STATUS_STYLES = {
  PENDING: "bg-blue-500/10 text-blue-500",
  PAYMENT_APPROVED: "bg-violet-500/10 text-violet-500",
  PAID: "bg-emerald-500/10 text-emerald-500",
  PROCESSING: "bg-yellow-500/10 text-yellow-500",
  PURCHASED_FROM_SUPPLIER: "bg-purple-500/10 text-purple-500",
  SHIPPED: "bg-cyan-500/10 text-cyan-500",
  DELIVERED: "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]",
  REFUNDED: "bg-red-500/10 text-red-500",
  CANCELLED: "bg-muted text-muted-foreground",
};

const STATUS_LABEL_MAP = {
  ORDER_CREATED: "orderCreated",
  PAYMENT_PENDING_REVIEW: "paymentPendingReview",
  PAYMENT_APPROVED: "paymentApproved",
  PAYMENT_COMPLETED: "paymentCompleted",
  PROCUREMENT_STARTED: "procurementStarted",
  PURCHASED_FROM_SUPPLIER: "purchasedFromSupplier",
  RECEIVED_AT_WAREHOUSE: "receivedAtWarehouse",
  READY_TO_SHIP: "readyToShip",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  PENDING: "pending",
};

export default function Orders() {
  const { t } = useTranslation(["dashboard", "common", "product"]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { preferredCurrency, convertAmount } = useCurrency();

  const getStatusLabel = (status) => {
    const key = STATUS_LABEL_MAP[status];
    if (key) return t(`dashboard.${key}`);
    return status?.replaceAll("_", " ");
  };

  useEffect(() => {
    listAccountOrders()
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-4">{Array.from({length:3}).map((_,i)=><div key={i} className="h-24 bg-secondary rounded-xl animate-pulse"/>)}</div>;

  return (
    <div>
      <h2 className="font-display text-xl font-bold mb-6">{t("dashboard.myOrders")}</h2>
      {orders.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-xl">
          <Package className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("common.noResults")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            (() => {
              const showTomanAmounts = shouldShowTomanAmounts({
                countryCode: order.customerAddress?.countryCode,
                displayCurrency: order.displayCurrency,
              });
              const displayAmount = showTomanAmounts
                ? formatCurrency(convertAmount(order.totalAmount, order.currency, "TOMAN"), "TOMAN")
                : formatCurrency(convertAmount(order.totalAmount, order.currency, preferredCurrency), preferredCurrency);

              return (
            <div key={order.id} className="p-4 lg:p-6 border border-border rounded-xl hover:border-muted-foreground/30 transition-colors">
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm font-semibold">{order.orderNumber}</span>
                    <Badge variant="secondary" className={STATUS_STYLES[order.status]}>{getStatusLabel(order.status)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{moment(order.createdAt).format("MMM D, YYYY")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{order.items?.length || 0} {t("dashboard.items")}</p>
                  {order.carrier ? <p className="text-xs text-muted-foreground mt-1">{t("common.status")}: {order.carrier}</p> : null}
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold">{formatCurrency(order.totalAmount, order.currency)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {displayAmount}
                  </p>
                  {order.trackingNumber && <p className="text-xs text-muted-foreground mt-1">{t("dashboard.trackOrder")}: {order.trackingNumber}</p>}
                  {order.estimatedDeliveryDate ? <p className="text-xs text-muted-foreground mt-1">{t("product.estimatedDelivery")}: {moment(order.estimatedDeliveryDate).format("MMM D, YYYY")}</p> : null}
                </div>
              </div>
              {order.timeline?.length ? (
                <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  {order.timeline.map((step) => (
                    <div key={step.key} className={`rounded-lg border px-3 py-2 ${step.status === "completed" ? "border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5" : "border-border bg-secondary/20"}`}>
                      <p className="text-xs font-medium">{step.label}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {step.happenedAt ? moment(step.happenedAt).format("MMM D, YYYY") : t("dashboard.pending")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              {order.trackingUrl || order.shipmentNotes ? (
                <div className="mt-4 rounded-lg bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
                  {order.trackingUrl ? (
                    <p>
                      {t("dashboard.trackOrder")}: <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="text-[hsl(var(--accent))] underline underline-offset-4">{order.trackingUrl}</a>
                    </p>
                  ) : null}
                  {order.shipmentNotes ? <p className="mt-1">{t("common.info")}: {order.shipmentNotes}</p> : null}
                </div>
              ) : null}
              {order.customerAddress ? (
                <div className="mt-4 rounded-lg bg-secondary/20 px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground">{t("common.address")}</p>
                  <p className="mt-2 text-sm">{order.customerAddress.fullName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {order.customerAddress.addressLine1}
                    {order.customerAddress.addressLine2 ? `, ${order.customerAddress.addressLine2}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {order.customerAddress.city}, {order.customerAddress.postalCode}, {order.customerAddress.countryCode}
                  </p>
                  {order.customerAddress.phone ? <p className="text-xs text-muted-foreground mt-1">{order.customerAddress.phone}</p> : null}
                </div>
              ) : null}
              {order.items?.length ? (
                <div className="mt-4 space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="rounded-lg bg-secondary/20 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-3 min-w-0">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.title} className="h-16 w-16 rounded-lg object-cover border border-border shrink-0" />
                          ) : null}
                          <div className="min-w-0">
                            <p className="font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{item.brandName || "Unknown brand"} · Qty {item.quantity}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full bg-background px-3 py-1 text-[11px] text-muted-foreground">{t("product.size")}: {item.size || t("product.notSelected")}</span>
                              <span className="rounded-full bg-background px-3 py-1 text-[11px] text-muted-foreground">{t("product.color")}: {item.color || t("product.notSelected")}</span>
                            </div>
                            {item.sourceUrl ? (
                              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs text-[hsl(var(--accent))] hover:underline break-all">
                                {t("product.sourceAddress")}
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-mono">{formatCurrency(item.totalPrice, order.currency)}</p>
                          {showTomanAmounts ? (
                            <p className="text-xs text-muted-foreground mt-1">{formatCurrency(convertAmount(item.totalPrice, order.currency, "TOMAN"), "TOMAN")}</p>
                          ) : null}
                          <p className="text-xs text-muted-foreground mt-1">{t("product.unitPrice")} {formatCurrency(item.unitPrice, order.currency)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
              );
            })()
          ))}
        </div>
      )}
    </div>
  );
}
