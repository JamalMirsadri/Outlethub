import React, { useEffect, useMemo, useState } from "react";

import { appClient } from "@/api/appClient";
import {
  createCoupon,
  deleteCoupon,
  duplicateCoupon,
  getAdminCouponOverview,
  type CouponAdminOverviewResponse,
  type CouponPayload,
  updateCoupon,
} from "@/api/coupons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Copy, Loader2, PercentCircle, Plus, Save, TicketPercent, Trash2, Truck } from "lucide-react";
import moment from "moment";

const EMPTY_OVERVIEW: CouponAdminOverviewResponse = {
  summary: {
    totalCoupons: 0,
    activeCoupons: 0,
    totalUsages: 0,
  },
  coupons: [],
  usageHistory: [],
  membershipLevels: [],
};

const DEFAULT_FORM = {
  id: "",
  code: "",
  description: "",
  discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT",
  percentage: "10",
  fixedAmount: "",
  freeShipping: false,
  minimumOrderAmount: "",
  maximumDiscountAmount: "",
  usageLimit: "",
  usagePerUser: "",
  startsAt: "",
  endsAt: "",
  allowedProductIds: [] as string[],
  allowedCategoryIds: [] as string[],
  allowedBrandIds: [] as string[],
  excludedProductIds: [] as string[],
  excludedCategoryIds: [] as string[],
  excludedBrandIds: [] as string[],
  allowedMembershipLevelIds: [] as string[],
  status: "ACTIVE" as "ACTIVE" | "DISABLED",
};

function toNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function SelectionPanel({
  title,
  items,
  selectedIds,
  onToggle,
}: {
  title: string;
  items: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const active = selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                active ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10" : "border-border hover:bg-secondary/40"
              }`}
            >
              {item.name}
            </button>
          );
        })}
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No items available.</p> : null}
      </div>
    </div>
  );
}

export default function AdminCoupons() {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const membershipLevels = useMemo(
    () => overview.membershipLevels.map((level) => ({ id: level.id, name: `${level.title} (${level.minPoints}+ pts)` })),
    [overview.membershipLevels],
  );

  const load = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const [couponOverview, productRows, brandRows, categoryRows] = await Promise.all([
        getAdminCouponOverview(),
        appClient.entities.Product.list("-created_date", 100),
        appClient.entities.Brand.list("-created_date", 100),
        appClient.entities.Category.list("-created_date", 100),
      ]);

      setOverview(couponOverview);
      setProducts((Array.isArray(productRows) ? productRows : []).map((product) => ({ id: String(product.id), name: String(product.title || product.name) })));
      setBrands((Array.isArray(brandRows) ? brandRows : []).map((brand) => ({ id: String(brand.id), name: String(brand.name) })));
      setCategories((Array.isArray(categoryRows) ? categoryRows : []).map((category) => ({ id: String(category.id), name: String(category.name) })));
    } catch (error) {
      toast({
        title: "Unable to load coupons",
        description: error instanceof Error ? error.message : "Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => setForm(DEFAULT_FORM);

  const toggleSelection = (key: keyof typeof DEFAULT_FORM, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: Array.isArray(current[key])
        ? current[key].includes(value)
          ? current[key].filter((item) => item !== value)
          : [...current[key], value]
        : current[key],
    }));
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (coupon: CouponAdminOverviewResponse["coupons"][number]) => {
    setForm({
      id: coupon.id,
      code: coupon.code,
      description: coupon.description || "",
      discountType: coupon.discountType,
      percentage: coupon.percentage !== null ? String(coupon.percentage) : "",
      fixedAmount: coupon.fixedAmount !== null ? String(coupon.fixedAmount) : "",
      freeShipping: coupon.freeShipping,
      minimumOrderAmount: coupon.minimumOrderAmount !== null ? String(coupon.minimumOrderAmount) : "",
      maximumDiscountAmount: coupon.maximumDiscountAmount !== null ? String(coupon.maximumDiscountAmount) : "",
      usageLimit: coupon.usageLimit !== null ? String(coupon.usageLimit) : "",
      usagePerUser: coupon.usagePerUser !== null ? String(coupon.usagePerUser) : "",
      startsAt: coupon.startsAt ? moment(coupon.startsAt).format("YYYY-MM-DDTHH:mm") : "",
      endsAt: coupon.endsAt ? moment(coupon.endsAt).format("YYYY-MM-DDTHH:mm") : "",
      allowedProductIds: coupon.allowedProductIds,
      allowedCategoryIds: coupon.allowedCategoryIds,
      allowedBrandIds: coupon.allowedBrandIds,
      excludedProductIds: coupon.excludedProductIds,
      excludedCategoryIds: coupon.excludedCategoryIds,
      excludedBrandIds: coupon.excludedBrandIds,
      allowedMembershipLevelIds: coupon.allowedMembershipLevelIds,
      status: coupon.status,
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    setSaving(true);

    const payload: CouponPayload = {
      code: form.code,
      description: form.description || null,
      discountType: form.discountType,
      percentage: form.discountType === "PERCENTAGE" ? toNullableNumber(form.percentage) : null,
      fixedAmount: form.discountType === "FIXED_AMOUNT" ? toNullableNumber(form.fixedAmount) : null,
      freeShipping: form.freeShipping,
      minimumOrderAmount: toNullableNumber(form.minimumOrderAmount),
      maximumDiscountAmount: toNullableNumber(form.maximumDiscountAmount),
      usageLimit: toNullableNumber(form.usageLimit),
      usagePerUser: toNullableNumber(form.usagePerUser),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      allowedProductIds: form.allowedProductIds,
      allowedCategoryIds: form.allowedCategoryIds,
      allowedBrandIds: form.allowedBrandIds,
      excludedProductIds: form.excludedProductIds,
      excludedCategoryIds: form.excludedCategoryIds,
      excludedBrandIds: form.excludedBrandIds,
      allowedMembershipLevelIds: form.allowedMembershipLevelIds,
      status: form.status,
    };

    try {
      if (form.id) {
        await updateCoupon(form.id, payload);
      } else {
        await createCoupon(payload);
      }

      await load({ silent: true });
      setDialogOpen(false);
      resetForm();
      toast({
        title: form.id ? "Coupon updated" : "Coupon created",
        description: "The promotion settings were saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to save coupon",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    setBusyId(id);

    try {
      await duplicateCoupon(id);
      await load({ silent: true });
      toast({
        title: "Coupon duplicated",
        description: "A disabled copy was created successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to duplicate coupon",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId("");
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);

    try {
      await deleteCoupon(id);
      await load({ silent: true });
      toast({
        title: "Coupon deleted",
        description: "The promotion was removed successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to delete coupon",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId("");
    }
  };

  const handleStatusToggle = async (id: string, checked: boolean) => {
    setBusyId(id);

    try {
      await updateCoupon(id, { status: checked ? "ACTIVE" : "DISABLED" });
      await load({ silent: true });
    } catch (error) {
      toast({
        title: "Unable to update coupon",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-secondary animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Coupons</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure promotion codes, targeting rules, membership restrictions, and checkout-ready discounts.
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-full">
          <Plus className="mr-2 h-4 w-4" />
          Create Coupon
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Coupons" value={overview.summary.totalCoupons} hint="All configured promotions" />
        <StatCard label="Active Coupons" value={overview.summary.activeCoupons} hint="Currently eligible at checkout" />
        <StatCard label="Recorded Uses" value={overview.summary.totalUsages} hint="Tracked coupon usages on orders" />
      </div>

      <div className="space-y-4">
        {overview.coupons.map((coupon) => (
          <div key={coupon.id} className={`rounded-2xl border border-border bg-card p-5 ${coupon.status === "DISABLED" ? "opacity-60" : ""}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold">{coupon.code}</h2>
                  <Badge variant="secondary">{coupon.discountType === "PERCENTAGE" ? "Percentage" : "Fixed"}</Badge>
                  {coupon.freeShipping ? <Badge variant="outline">Free Shipping</Badge> : null}
                  <Badge variant={coupon.status === "ACTIVE" ? "default" : "outline"}>
                    {coupon.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{coupon.description || "No description provided."}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Uses {coupon.usageCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}</span>
                  <span>Per user {coupon.usagePerUser ?? "Unlimited"}</span>
                  <span>
                    Discount {coupon.discountType === "PERCENTAGE" ? `${coupon.percentage ?? 0}%` : `${coupon.fixedAmount ?? 0} EUR`}
                  </span>
                  <span>Min order {coupon.minimumOrderAmount ?? 0} EUR</span>
                  <span>Max discount {coupon.maximumDiscountAmount ?? "Unlimited"}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Allowed Products {coupon.allowedProductIds.length}</span>
                  <span>Allowed Categories {coupon.allowedCategoryIds.length}</span>
                  <span>Allowed Brands {coupon.allowedBrandIds.length}</span>
                  <span>Excluded Products {coupon.excludedProductIds.length}</span>
                  <span>Excluded Categories {coupon.excludedCategoryIds.length}</span>
                  <span>Excluded Brands {coupon.excludedBrandIds.length}</span>
                  <span>Levels {coupon.allowedMembershipLevelIds.length || "All"}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 rounded-full border border-border px-4 py-2">
                  <span className="text-sm text-muted-foreground">Enabled</span>
                  <Switch
                    checked={coupon.status === "ACTIVE"}
                    disabled={busyId === coupon.id}
                    onCheckedChange={(checked) => void handleStatusToggle(coupon.id, checked)}
                  />
                </div>
                <Button variant="outline" onClick={() => openEdit(coupon)}>Edit</Button>
                <Button variant="outline" onClick={() => void handleDuplicate(coupon.id)} disabled={busyId === coupon.id}>
                  {busyId === coupon.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                  Duplicate
                </Button>
                <Button variant="ghost" size="icon" onClick={() => void handleDelete(coupon.id)} disabled={busyId === coupon.id}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <TicketPercent className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Coupon Usage History</h2>
        </div>
        <div className="space-y-3">
          {overview.usageHistory.map((usage) => (
            <div key={usage.id} className="rounded-2xl border border-border bg-secondary/20 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-medium">
                    {usage.code} · {usage.order.orderNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {usage.user?.name || usage.user?.email || usage.order.customerEmail} · {usage.order.status}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Discount {usage.discountAmount.toFixed(2)} EUR</p>
                  <p>Shipping {usage.shippingDiscountAmount.toFixed(2)} EUR</p>
                  <p>Saved {usage.totalSavingsAmount.toFixed(2)} EUR</p>
                  <p>{moment(usage.createdAt).format("YYYY-MM-DD HH:mm")}</p>
                </div>
              </div>
            </div>
          ))}
          {overview.usageHistory.length === 0 ? <p className="text-sm text-muted-foreground">No coupon usage has been recorded yet.</p> : null}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{form.id ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Code</Label>
                  <Input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value === "DISABLED" ? "DISABLED" : "ACTIVE" }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="DISABLED">DISABLED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Discount Type</Label>
                  <Select value={form.discountType} onValueChange={(value) => setForm((current) => ({ ...current, discountType: value === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "PERCENTAGE" }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                      <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-2xl border border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Free Shipping</p>
                      <p className="text-xs text-muted-foreground">Waive the calculated shipping amount.</p>
                    </div>
                    <Switch checked={form.freeShipping} onCheckedChange={(checked) => setForm((current) => ({ ...current, freeShipping: checked }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Percentage</Label>
                  <Input type="number" value={form.percentage} onChange={(event) => setForm((current) => ({ ...current, percentage: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Fixed Amount</Label>
                  <Input type="number" value={form.fixedAmount} onChange={(event) => setForm((current) => ({ ...current, fixedAmount: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Minimum Order</Label>
                  <Input type="number" value={form.minimumOrderAmount} onChange={(event) => setForm((current) => ({ ...current, minimumOrderAmount: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Maximum Discount</Label>
                  <Input type="number" value={form.maximumDiscountAmount} onChange={(event) => setForm((current) => ({ ...current, maximumDiscountAmount: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Usage Limit</Label>
                  <Input type="number" value={form.usageLimit} onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Usage Per User</Label>
                  <Input type="number" value={form.usagePerUser} onChange={(event) => setForm((current) => ({ ...current, usagePerUser: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} className="mt-1" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <PercentCircle className="h-4 w-4" />
                    <p className="text-sm font-medium">Allowed Membership Levels</p>
                  </div>
                  <div className="space-y-2">
                    {membershipLevels.map((level) => (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => toggleSelection("allowedMembershipLevelIds", level.id)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                          form.allowedMembershipLevelIds.includes(level.id) ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10" : "border-border hover:bg-secondary/40"
                        }`}
                      >
                        {level.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <TicketPercent className="h-4 w-4" />
                    <p className="text-sm font-medium">Quick Notes</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Allowed scopes work as a qualifying pool. Excluded scopes always override allowed scopes. If no allowed scopes are selected, the coupon can target the whole cart.
                  </p>
                </div>

                <div className="rounded-2xl border border-border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    <p className="text-sm font-medium">Checkout Behavior</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Applied promotions are revalidated on every checkout refresh and once again when the order is created, so invalid or expired codes never slip through.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SelectionPanel title="Allowed Products" items={products} selectedIds={form.allowedProductIds} onToggle={(id) => toggleSelection("allowedProductIds", id)} />
              <SelectionPanel title="Allowed Categories" items={categories} selectedIds={form.allowedCategoryIds} onToggle={(id) => toggleSelection("allowedCategoryIds", id)} />
              <SelectionPanel title="Allowed Brands" items={brands} selectedIds={form.allowedBrandIds} onToggle={(id) => toggleSelection("allowedBrandIds", id)} />
              <SelectionPanel title="Excluded Products" items={products} selectedIds={form.excludedProductIds} onToggle={(id) => toggleSelection("excludedProductIds", id)} />
              <SelectionPanel title="Excluded Categories" items={categories} selectedIds={form.excludedCategoryIds} onToggle={(id) => toggleSelection("excludedCategoryIds", id)} />
              <SelectionPanel title="Excluded Brands" items={brands} selectedIds={form.excludedBrandIds} onToggle={(id) => toggleSelection("excludedBrandIds", id)} />
            </div>
          </div>

          <div className="mt-2">
            <Button onClick={() => void submit()} disabled={saving} className="w-full rounded-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {form.id ? "Update Coupon" : "Create Coupon"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
