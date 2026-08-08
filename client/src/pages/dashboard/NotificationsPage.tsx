import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationCategory,
  type NotificationPreferenceRecord,
  type NotificationRecord,
  updateNotificationPreferences,
} from "@/api/notifications";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { BellRing } from "lucide-react";

const CATEGORY_OPTIONS: Array<"ALL" | NotificationCategory> = [
  "ALL",
  "ORDERS",
  "PAYMENTS",
  "SHIPPING",
  "PROCUREMENT",
  "SYSTEM",
  "MARKETING",
];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferenceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<"ALL" | NotificationCategory>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const formatCategoryLabel = (option: string) => {
    switch (option) {
      case "ALL":
        return `${t("common.all")} Categories`;
      case "ORDERS":
        return t("dashboard.orders");
      case "PAYMENTS":
        return t("dashboard.payments");
      case "SHIPPING":
        return t("product.shippingInfo").split(" ")[0];
      case "SYSTEM":
        return t("dashboard.notifications").includes("Notifications") ? "System" : "System";
      case "MARKETING":
        return t("home.bestsellersTitle").includes("Bestsellers") ? "Marketing" : "Marketing";
      case "PROCUREMENT":
        return t("dashboard.orderCreated").includes("Created") ? "Procurement" : "Procurement";
      default:
        return option.replaceAll("_", " ");
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [notifications, nextPreferences] = await Promise.all([
        listNotifications({
          category: category === "ALL" ? undefined : category,
          unreadOnly,
        }),
        getNotificationPreferences(),
      ]);
      setItems(notifications.items);
      setUnreadCount(notifications.unreadCount);
      setPreferences(nextPreferences);
    } catch (error) {
      toast({
        title: t("common.somethingWentWrong"),
        description: error instanceof Error ? error.message : t("common.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [category, unreadOnly]);

  const groupedPreferences = useMemo(
    () =>
      preferences
        ? [
            { key: "orderNotifications", label: `${t("dashboard.orders")} Notifications`, value: preferences.orderNotifications },
            { key: "paymentNotifications", label: `${t("dashboard.payments")} Notifications`, value: preferences.paymentNotifications },
            { key: "shippingNotifications", label: `${t("product.shippingInfo").split(" ")[0]} Notifications`, value: preferences.shippingNotifications },
            { key: "marketingEmails", label: `Marketing ${t("home.bestsellersTitle").includes("Bestsellers") ? "Emails" : "Emails"}`, value: preferences.marketingEmails },
            { key: "systemNotifications", label: `${t("dashboard.notifications").includes("Notifications") ? "System" : "System"} Notifications`, value: preferences.systemNotifications },
          ]
        : [],
    [preferences, t],
  );

  const onMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      await load();
    } catch (error) {
      toast({
        title: t("common.errorOccurred"),
        description: error instanceof Error ? error.message : t("common.tryAgain"),
        variant: "destructive",
      });
    }
  };

  const onMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      await load();
      toast({ title: t("common.success") });
    } catch (error) {
      toast({
        title: t("common.errorOccurred"),
        description: error instanceof Error ? error.message : t("common.tryAgain"),
        variant: "destructive",
      });
    }
  };

  const onPreferenceToggle = async (key: keyof NotificationPreferenceRecord, value: boolean) => {
    if (!preferences) {
      return;
    }

    try {
      const next = await updateNotificationPreferences({
        [key]: value,
      });
      setPreferences(next);
      toast({ title: t("common.success") });
    } catch (error) {
      toast({
        title: t("common.errorOccurred"),
        description: error instanceof Error ? error.message : t("common.tryAgain"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">{t("dashboard.notifications")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Unread: {unreadCount} · {t("dashboard.orders")}, {t("dashboard.payments")}, {t("product.shippingInfo").split(" ")[0]}, system, and future marketing communications.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={category} onValueChange={(value) => setCategory(value as "ALL" | NotificationCategory)}>
            <SelectTrigger className="w-[180px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {formatCategoryLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={unreadOnly ? "default" : "outline"} className="rounded-full" onClick={() => setUnreadOnly((current) => !current)}>
            {unreadOnly ? `${t("common.all") === "All" ? "Unread" : "Unread"} Only` : `${t("common.showMore").includes("Show") ? "Show" : "Show"} ${t("common.all") === "All" ? "Unread" : "Unread"}`}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => void onMarkAllRead()}>
            {t("dashboard.markAllRead")}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">{t("dashboard.settings")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.notificationsEmpty")}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {groupedPreferences.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{t("common.enabled")} or {t("common.disabled")} this communication category.</p>
              </div>
              <Switch
                checked={item.value}
                onCheckedChange={(checked) =>
                  void onPreferenceToggle(item.key as keyof NotificationPreferenceRecord, checked)
                }
              />
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 rounded-2xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center">
          <BellRing className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">{t("dashboard.notificationsEmpty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.title}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{item.category}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{item.priority}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{item.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>{formatDate(item.createdAt)}</span>
                    <span>{item.eventName ?? "General Event"}</span>
                    {item.data?.orderNumber ? <span>{t("dashboard.orders")} {String(item.data.orderNumber)}</span> : null}
                    {item.data?.trackingNumber ? <span>Tracking {String(item.data.trackingNumber)}</span> : null}
                  </div>
                  {item.deliveries.length ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {item.deliveries.map((delivery) => (
                        <span key={delivery.id} className="rounded-full bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
                          {delivery.channelCode}: {delivery.state}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {item.status === "UNREAD" ? (
                  <Button variant="outline" className="rounded-full" onClick={() => void onMarkRead(item.id)}>
                    {t("dashboard.markAllRead").split(" ").slice(0, 2).join(" ")}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
