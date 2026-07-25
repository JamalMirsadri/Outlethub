import React, { useEffect, useState } from "react";

import {
  listAdminNotifications,
  markNotificationRead,
  type NotificationCategory,
  type NotificationRecord,
} from "@/api/notifications";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { BellRing, RefreshCw } from "lucide-react";

const CATEGORY_OPTIONS: Array<"ALL" | NotificationCategory> = [
  "ALL",
  "OPERATIONS",
  "PAYMENTS",
  "ORDERS",
  "PROCUREMENT",
  "SHIPPING",
  "IMPORTS",
  "MONITORING",
  "CONNECTORS",
  "SYSTEM",
];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export default function AdminNotificationsCenter() {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [category, setCategory] = useState<"ALL" | NotificationCategory>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await listAdminNotifications({
        category: category === "ALL" ? undefined : category,
        unreadOnly,
      });
      setItems(response.items);
      setUnreadCount(response.unreadCount);
    } catch (error) {
      toast({
        title: "Operations center failed to load",
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Operations Center</h1>
          <p className="text-sm text-muted-foreground">Unread: {unreadCount} · Unified operational visibility across payments, orders, procurement, shipping, imports, monitoring, connectors, and system events.</p>
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
          <Button variant="outline" className="rounded-full" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 rounded-2xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
          <BellRing className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          No operational notifications available.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.title}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{item.category}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{item.priority}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.message}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>{formatDate(item.createdAt)}</span>
                    {item.data?.orderNumber ? <span>Order {String(item.data.orderNumber)}</span> : null}
                    {item.data?.supplierName ? <span>{String(item.data.supplierName)}</span> : null}
                    {item.data?.trackingNumber ? <span>Tracking {String(item.data.trackingNumber)}</span> : null}
                  </div>
                  {item.deliveries.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
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
