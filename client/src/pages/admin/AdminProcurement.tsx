import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, PackageCheck, Search, Store, Truck } from "lucide-react";

import {
  getProcurementDashboard,
  updateProcurementTask,
  type ProcurementDashboardResponse,
  type ProcurementStatus,
  type ProcurementTaskRecord,
} from "@/api/commerce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/currency";

const PROCUREMENT_STATUSES: Array<"all" | ProcurementStatus> = [
  "all",
  "PURCHASE_REQUIRED",
  "PURCHASED_FROM_SUPPLIER",
  "RECEIVED_AT_WAREHOUSE",
  "READY_TO_SHIP",
];

const STATUS_COLORS: Record<ProcurementStatus, string> = {
  PURCHASE_REQUIRED: "bg-amber-500/10 text-amber-500",
  PURCHASED_FROM_SUPPLIER: "bg-violet-500/10 text-violet-500",
  RECEIVED_AT_WAREHOUSE: "bg-cyan-500/10 text-cyan-500",
  READY_TO_SHIP: "bg-emerald-500/10 text-emerald-500",
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminProcurement() {
  const [dashboard, setDashboard] = useState<ProcurementDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProcurementStatus>("all");
  const [selectedTask, setSelectedTask] = useState<ProcurementTaskRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    status: "PURCHASE_REQUIRED" as ProcurementStatus,
    supplierPrice: "0",
    shippingToPortugal: "0",
    customsCost: "0",
    notes: "",
  });

  const loadDashboard = async () => {
    const nextDashboard = await getProcurementDashboard();
    setDashboard(nextDashboard);
  };

  useEffect(() => {
    loadDashboard()
      .catch((error) => {
        toast({
          title: "Failed to load procurement",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    const items = dashboard?.items ?? [];
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      const query = search.toLowerCase();
      return [
        item.supplier,
        item.sourceWebsite,
        item.productUrl,
        item.customerOrder.orderNumber,
        item.customerOrder.customerEmail,
        item.orderItem.title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [dashboard?.items, search, statusFilter]);

  const openTask = (task: ProcurementTaskRecord) => {
    setSelectedTask(task);
    setForm({
      status: task.status,
      supplierPrice: String(task.supplierPrice),
      shippingToPortugal: String(task.shippingToPortugal),
      customsCost: String(task.customsCost),
      notes: task.notes ?? "",
    });
    setDialogOpen(true);
  };

  const applyTaskUpdate = (task: ProcurementTaskRecord) => {
    setDashboard((current) => {
      if (!current) {
        return current;
      }

      return {
        summary: current.summary,
        items: current.items.map((item) => (item.id === task.id ? task : item)),
      };
    });
    setSelectedTask(task);
  };

  const saveTask = async () => {
    if (!selectedTask) {
      return;
    }

    setSaving(true);
    try {
      const updatedTask = await updateProcurementTask(selectedTask.id, {
        status: form.status,
        supplierPrice: Number(form.supplierPrice),
        shippingToPortugal: Number(form.shippingToPortugal),
        customsCost: Number(form.customsCost),
        notes: form.notes || null,
      });
      applyTaskUpdate(updatedTask);
      await loadDashboard();
      toast({ title: "Procurement task updated" });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !dashboard) {
    return <div className="space-y-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 rounded-xl bg-secondary animate-pulse" />)}</div>;
  }

  const summaryCards = [
    { label: "Orders Waiting To Purchase", value: dashboard.summary.waitingToPurchase, icon: Store },
    { label: "Orders Purchased", value: dashboard.summary.purchased, icon: PackageCheck },
    { label: "Orders Received", value: dashboard.summary.received, icon: Truck },
    { label: "Orders Ready To Ship", value: dashboard.summary.readyToShip, icon: PackageCheck },
    { label: "Expected Profit", value: formatCurrency(dashboard.summary.expectedProfit, "EUR"), icon: Store },
    { label: "Real Profit", value: formatCurrency(dashboard.summary.realProfit, "EUR"), icon: Truck },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Procurement</h1>
          <p className="text-sm text-muted-foreground">
            Track customer orders from supplier purchase through warehouse receipt and readiness to ship.
          </p>
        </div>
        <div className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground">
          Total procurement cost {formatCurrency(dashboard.summary.totalProcurementCost, "EUR")} · Actual margin {dashboard.summary.actualMargin}%
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-4">
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

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search supplier, product URL, order number, or customer email"
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | ProcurementStatus)}>
          <SelectTrigger className="w-full lg:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROCUREMENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status === "all" ? "All Purchase Statuses" : status.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Supplier", "Source Website", "Product URL", "Customer Order", "Quantity", "Purchase Status", "Action"].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium tracking-widest text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.supplier ?? item.orderItem.brandName ?? "Unknown supplier"}</div>
                    <div className="text-xs text-muted-foreground">{item.orderItem.title}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.sourceWebsite ?? "No website"}</td>
                  <td className="px-4 py-3">
                    {item.productUrl ? (
                      <a href={item.productUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[hsl(var(--accent))] hover:underline">
                        Open URL
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No URL</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-medium">{item.customerOrder.orderNumber}</div>
                    <div className="text-xs text-muted-foreground">{item.customerOrder.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3 font-mono">{item.quantity}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={STATUS_COLORS[item.status]}>
                      {item.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" onClick={() => openTask(item)}>
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
              {!filteredItems.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    No procurement tasks match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Procurement Task</DialogTitle>
          </DialogHeader>
          {selectedTask ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Customer Order</p>
                  <p className="mt-2 font-semibold">{selectedTask.customerOrder.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">{selectedTask.customerOrder.customerEmail}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Expected Profit</p>
                  <p className="mt-2 font-semibold">{formatCurrency(selectedTask.expectedProfit, selectedTask.currency)}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Real Profit</p>
                  <p className="mt-2 font-semibold">{formatCurrency(selectedTask.realProfit, selectedTask.currency)}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Actual Margin</p>
                  <p className="mt-2 font-semibold">{selectedTask.actualMargin}%</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Purchase Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as ProcurementStatus }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCUREMENT_STATUSES.filter((status) => status !== "all").map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Supplier Price</Label>
                  <Input
                    type="number"
                    value={form.supplierPrice}
                    onChange={(event) => setForm((current) => ({ ...current, supplierPrice: event.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Shipping To Portugal</Label>
                  <Input
                    type="number"
                    value={form.shippingToPortugal}
                    onChange={(event) => setForm((current) => ({ ...current, shippingToPortugal: event.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customs Cost</Label>
                  <Input
                    type="number"
                    value={form.customsCost}
                    onChange={(event) => setForm((current) => ({ ...current, customsCost: event.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Internal Notes</Label>
                  <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <h3 className="font-semibold">Supplier Detail</h3>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>Supplier: {selectedTask.supplier ?? "Unknown supplier"}</p>
                    <p>Website: {selectedTask.sourceWebsite ?? "No website"}</p>
                    <p>Product URL: {selectedTask.productUrl ?? "No source URL"}</p>
                    <p>Quantity: {selectedTask.quantity}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <h3 className="font-semibold">Order Trace</h3>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>Customer Purchase: {formatDateTime(selectedTask.trace.customerPurchasedAt)}</p>
                    <p>Supplier Purchase: {formatDateTime(selectedTask.trace.supplierPurchasedAt)}</p>
                    <p>Warehouse Receipt: {formatDateTime(selectedTask.trace.warehouseReceivedAt)}</p>
                    <p>Ready To Ship: {formatDateTime(selectedTask.trace.readyToShipAt)}</p>
                    <p>Customer Shipment: {formatDateTime(selectedTask.trace.customerShippedAt)}</p>
                    <p>Delivery: {formatDateTime(selectedTask.trace.deliveredAt)}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void saveTask()} disabled={saving}>
                  Save Procurement Update
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
