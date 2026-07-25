import React, { useEffect, useMemo, useState } from "react";

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
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferenceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<"ALL" | NotificationCategory>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
        title: "Notifications failed to load",
        description: error instanceof Error ? error.message : "Please try again.",
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
            { key: "orderNotifications", label: "Order Notifications", value: preferences.orderNotifications },
            { key: "paymentNotifications", label: "Payment Notifications", value: preferences.paymentNotifications },
            { key: "shippingNotifications", label: "Shipping Notifications", value: preferences.shippingNotifications },
            { key: "marketingEmails", label: "Marketing Emails", value: preferences.marketingEmails },
            { key: "systemNotifications", label: "System Notifications", value: preferences.systemNotifications },
          ]
        : [],
    [preferences],
  );

  const onMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      await load();
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const onMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      await load();
      toast({ title: "All notifications marked as read" });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Please try again.",
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
      toast({ title: "Notification preferences updated" });
    } catch (error) {
      toast({
        title: "Preference update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">Unread: {unreadCount} · Orders, payments, shipping, system, and future marketing communications.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={category} onValueChange={(value) => setCategory(value as "ALL" | NotificationCategory)}>
            <SelectTrigger className="w-[180px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "ALL" ? "All Categories" : option.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={unreadOnly ? "default" : "outline"} className="rounded-full" onClick={() => setUnreadOnly((current) => !current)}>
            {unreadOnly ? "Unread Only" : "Show Unread"}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => void onMarkAllRead()}>
            Mark All Read
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">Preferences</h3>
        <p className="mt-1 text-sm text-muted-foreground">Control which categories you receive through the unified communication center.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {groupedPreferences.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">Enable or disable this communication category.</p>
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
          <p className="mt-4 text-sm text-muted-foreground">No notifications available for this filter.</p>
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
                    {item.data?.orderNumber ? <span>Order {String(item.data.orderNumber)}</span> : null}
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
                    Mark Read
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
