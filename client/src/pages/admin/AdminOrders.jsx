import React, { useEffect, useMemo, useState } from "react";
import { listAdminOrders, refundAdminOrder, updateAdminOrder } from "@/api/commerce";
import { Eye, Search, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, shouldShowTomanAmounts } from "@/lib/currency";
import moment from "moment";

const STATUSES = ["all", "PENDING", "PAYMENT_APPROVED", "PAID", "PROCESSING", "PURCHASED_FROM_SUPPLIER", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const STATUS_COLORS = {
  PENDING: "bg-blue-500/10 text-blue-500",
  PAYMENT_APPROVED: "bg-violet-500/10 text-violet-500",
  PAID: "bg-emerald-500/10 text-emerald-500",
  PROCESSING: "bg-yellow-500/10 text-yellow-500",
  PURCHASED_FROM_SUPPLIER: "bg-purple-500/10 text-purple-500",
  SHIPPED: "bg-cyan-500/10 text-cyan-500",
  DELIVERED: "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]",
  CANCELLED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-red-500/10 text-red-500",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [updatingOrder, setUpdatingOrder] = useState(false);
  const [detailForm, setDetailForm] = useState({
    status: "PENDING",
    trackingNumber: "",
    carrier: "",
    trackingUrl: "",
    estimatedDeliveryDate: "",
    shipmentNotes: "",
    internalNotes: "",
    refundAmount: "",
  });

  useEffect(() => {
    listAdminOrders().then(setOrders).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const filtered = useMemo(() => orders.filter((order) => {
    if (
      search &&
      !order.orderNumber?.toLowerCase().includes(search.toLowerCase()) &&
      !order.customerEmail?.toLowerCase().includes(search.toLowerCase())
    ) return false;
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    return true;
  }), [orders, search, statusFilter]);

  const openOrder = (order) => {
    setSelectedOrder(order);
    setDetailForm({
      status: order.status,
      trackingNumber: order.trackingNumber || "",
      carrier: order.carrier || "",
      trackingUrl: order.trackingUrl || "",
      estimatedDeliveryDate: order.estimatedDeliveryDate ? moment(order.estimatedDeliveryDate).format("YYYY-MM-DD") : "",
      shipmentNotes: order.shipmentNotes || "",
      internalNotes: order.internalNotes || "",
      refundAmount: order.totalAmount?.toString() || "",
    });
    setOrderDialogOpen(true);
  };

  const applyOrderUpdate = (updatedOrder) => {
    setOrders((current) => current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)));
    setSelectedOrder(updatedOrder);
  };

  const saveOrderDetails = async (orderId, payload, successTitle) => {
    setUpdatingOrder(true);
    try {
      const updated = await updateAdminOrder(orderId, payload);
      applyOrderUpdate(updated);
      toast({ title: successTitle });
    } catch (error) {
      toast({
        title: "Order update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingOrder(false);
    }
  };

  const refundOrder = async () => {
    if (!selectedOrder) return;
    setUpdatingOrder(true);
    try {
      const updated = await refundAdminOrder(selectedOrder.id, {
        amount: detailForm.refundAmount ? Number(detailForm.refundAmount) : null,
        internalNotes: detailForm.internalNotes || null,
      });
      applyOrderUpdate(updated);
      toast({ title: "Order refunded" });
    } catch (error) {
      toast({
        title: "Refund failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingOrder(false);
    }
  };

  if (loading) return <div className="space-y-4">{Array.from({length:5}).map((_,i)=><div key={i} className="h-16 bg-secondary rounded-xl animate-pulse"/>)}</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">{orders.length} total orders</p>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search orders..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-10 bg-secondary border-0" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map(s=><SelectItem key={s} value={s}>{s === "all" ? "All Status" : s.replaceAll("_"," ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground">ORDER</th>
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground hidden md:table-cell">CUSTOMER</th>
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground hidden lg:table-cell">DATE</th>
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground">TOTAL</th>
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground hidden xl:table-cell">PROFIT</th>
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground">STATUS</th>
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const showTomanAmounts = shouldShowTomanAmounts({
                  countryCode: o.customerAddress?.countryCode,
                  displayCurrency: o.displayCurrency,
                });

                return (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium">{o.orderNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{o.customerEmail}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{moment(o.createdAt).format("MMM D, YYYY")}</td>
                  <td className="px-4 py-3 font-mono">
                    <div>{formatCurrency(o.totalAmount, o.currency)}</div>
                    {showTomanAmounts ? (
                      <div className="text-xs text-muted-foreground">{formatCurrency(o.totalAmount * (o.exchangeRateSnapshot?.rate ?? 1), "TOMAN")}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono hidden xl:table-cell">{formatCurrency(o.profitAmount, o.currency)}</td>
                  <td className="px-4 py-3">
                    <Select value={o.status} onValueChange={v => saveOrderDetails(o.id, { status: v }, "Order status updated")}>
                      <SelectTrigger className="h-8 w-36 border-0 bg-transparent p-0">
                        <Badge variant="secondary" className={STATUS_COLORS[o.status]}>{o.status?.replace("_"," ")}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.filter(s=>s!=="all").map(s=><SelectItem key={s} value={s}>{s.replaceAll("_"," ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" onClick={() => openOrder(o)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Order Detail</DialogTitle>
          </DialogHeader>
          {selectedOrder ? (
            (() => {
              const showTomanAmounts = shouldShowTomanAmounts({
                countryCode: selectedOrder.customerAddress?.countryCode,
                displayCurrency: selectedOrder.displayCurrency,
              });

              return (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-2">Order</p>
                  <p className="font-semibold">{selectedOrder.orderNumber}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedOrder.customerEmail}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-2">Revenue</p>
                  <p className="font-semibold">{formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)}</p>
                  <p className="text-sm text-muted-foreground mt-1">Profit {formatCurrency(selectedOrder.profitAmount, selectedOrder.currency)}</p>
                  {showTomanAmounts ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Toman {formatCurrency(selectedOrder.totalAmount * (selectedOrder.exchangeRateSnapshot?.rate ?? 1), "TOMAN")}
                    </p>
                  ) : selectedOrder.displayCurrency && selectedOrder.displayCurrency !== selectedOrder.currency ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Display {formatCurrency(
                        selectedOrder.exchangeRateSnapshot?.convertedAmount
                          ? selectedOrder.totalAmount * selectedOrder.exchangeRateSnapshot.rate
                          : selectedOrder.totalAmount,
                        selectedOrder.displayCurrency,
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-2">Shipping</p>
                  <p className="font-semibold">{selectedOrder.shippingMethod?.name || "No method selected"}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedOrder.shippingMethod?.deliveryEstimate || `${selectedOrder.shippingMethod?.minDeliveryDays ?? 0}-${selectedOrder.shippingMethod?.maxDeliveryDays ?? 0} days`}
                  </p>
                  {showTomanAmounts ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      FX 1 {selectedOrder.currency} {"->"} {selectedOrder.exchangeRateSnapshot?.rate ?? 1} TOMAN
                    </p>
                  ) : selectedOrder.displayCurrency ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      FX 1 {selectedOrder.currency} {"->"} {selectedOrder.exchangeRateSnapshot?.rate ?? 1} {selectedOrder.displayCurrency}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={detailForm.status} onValueChange={(value) => setDetailForm((current) => ({ ...current, status: value }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.filter((status) => status !== "all").map((status) => (
                        <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tracking Number</Label>
                  <Input value={detailForm.trackingNumber} onChange={(event) => setDetailForm((current) => ({ ...current, trackingNumber: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Carrier</Label>
                  <Input value={detailForm.carrier} onChange={(event) => setDetailForm((current) => ({ ...current, carrier: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Tracking URL</Label>
                  <Input value={detailForm.trackingUrl} onChange={(event) => setDetailForm((current) => ({ ...current, trackingUrl: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Estimated Delivery</Label>
                  <Input type="date" value={detailForm.estimatedDeliveryDate} onChange={(event) => setDetailForm((current) => ({ ...current, estimatedDeliveryDate: event.target.value }))} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Shipment Notes</Label>
                  <Textarea value={detailForm.shipmentNotes} onChange={(event) => setDetailForm((current) => ({ ...current, shipmentNotes: event.target.value }))} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Internal Notes</Label>
                  <Textarea value={detailForm.internalNotes} onChange={(event) => setDetailForm((current) => ({ ...current, internalNotes: event.target.value }))} className="mt-1" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => saveOrderDetails(selectedOrder.id, {
                  status: detailForm.status,
                  trackingNumber: detailForm.trackingNumber || null,
                  carrier: detailForm.carrier || null,
                  trackingUrl: detailForm.trackingUrl || null,
                  estimatedDeliveryDate: detailForm.estimatedDeliveryDate ? new Date(`${detailForm.estimatedDeliveryDate}T00:00:00`).toISOString() : null,
                  shipmentNotes: detailForm.shipmentNotes || null,
                  internalNotes: detailForm.internalNotes || null,
                }, "Order updated")} disabled={updatingOrder}>
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => saveOrderDetails(selectedOrder.id, { status: "PURCHASED_FROM_SUPPLIER" }, "Marked purchased from supplier")} disabled={updatingOrder}>
                  Mark Purchased
                </Button>
                <Button variant="outline" onClick={() => saveOrderDetails(selectedOrder.id, { status: "SHIPPED" }, "Marked shipped")} disabled={updatingOrder}>
                  <Truck className="w-4 h-4 mr-2" />
                  Mark Shipped
                </Button>
                <Button variant="outline" onClick={() => saveOrderDetails(selectedOrder.id, { status: "DELIVERED" }, "Marked delivered")} disabled={updatingOrder}>
                  Mark Delivered
                </Button>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-4">
                <h3 className="font-semibold">Refund</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Refund Amount</Label>
                    <Input type="number" value={detailForm.refundAmount} onChange={(event) => setDetailForm((current) => ({ ...current, refundAmount: event.target.value }))} className="mt-1" />
                  </div>
                  <div className="flex items-end">
                    <Button variant="destructive" onClick={refundOrder} disabled={updatingOrder}>
                      Refund Order
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <h3 className="font-semibold mb-4">Items</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex flex-col gap-4 rounded-xl bg-secondary/30 p-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{item.brandName || "Unknown brand"} · Qty {item.quantity}</p>
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                          <p>Size: {item.size || "N/A"}</p>
                          <p>Color: {item.color || "N/A"}</p>
                          <p>Source Store: {item.sourceStore || "N/A"}</p>
                          <p>Currency: {item.currency || selectedOrder.currency}</p>
                        </div>
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex text-xs text-[hsl(var(--accent))] hover:underline break-all"
                          >
                            {item.sourceUrl}
                          </a>
                        ) : (
                          <p className="mt-3 text-xs text-muted-foreground">Source address: N/A</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-mono">{formatCurrency(item.totalPrice, selectedOrder.currency)}</p>
                        {showTomanAmounts ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatCurrency(item.totalPrice * (selectedOrder.exchangeRateSnapshot?.rate ?? 1), "TOMAN")}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground mt-1">
                          Unit {formatCurrency(item.unitPrice, selectedOrder.currency)}
                        </p>
                        {showTomanAmounts ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Unit {formatCurrency(item.unitPrice * (selectedOrder.exchangeRateSnapshot?.rate ?? 1), "TOMAN")}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground mt-1">Profit {formatCurrency(item.profitAmount, selectedOrder.currency)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
              );
            })()
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
