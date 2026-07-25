import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { Bell, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appClient.entities.PriceAlert.list("-created_date", 50)
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const removeAlert = async (id) => {
    await appClient.entities.PriceAlert.delete(id);
    setAlerts(alerts.filter(a => a.id !== id));
  };

  if (loading) return <div className="space-y-4">{Array.from({length:3}).map((_,i)=><div key={i} className="h-24 bg-secondary rounded-xl animate-pulse"/>)}</div>;

  return (
    <div>
      <h2 className="font-display text-xl font-bold mb-6">Price Alerts</h2>
      {alerts.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-xl">
          <Bell className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No price alerts set</p>
          <p className="text-xs text-muted-foreground mt-1">Visit a product and tap the bell icon to set one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert.id} className="flex items-center gap-4 p-4 border border-border rounded-xl">
              <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                {alert.product_image && <img src={alert.product_image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{alert.product_title}</p>
                <div className="flex gap-2 items-center mt-1">
                  <span className="text-xs text-muted-foreground">Target: <span className="font-mono text-[hsl(var(--accent))]">${alert.target_price?.toFixed(2)}</span></span>
                  <span className="text-xs text-muted-foreground">Current: <span className="font-mono">${alert.current_price?.toFixed(2)}</span></span>
                </div>
              </div>
              <Badge variant="secondary" className={alert.is_triggered ? "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]" : ""}>{alert.status}</Badge>
              <Button variant="ghost" size="icon" onClick={() => removeAlert(alert.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

