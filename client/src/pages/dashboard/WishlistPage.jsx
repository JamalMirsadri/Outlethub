import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { Heart, Trash2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function WishlistPage() {
  const { t } = useTranslation(["dashboard", "common", "product"]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appClient.entities.Wishlist.list("-created_date", 50)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const removeItem = async (id) => {
    await appClient.entities.Wishlist.delete(id);
    setItems(items.filter(i => i.id !== id));
  };

  if (loading) return <div className="space-y-4">{Array.from({length:3}).map((_,i)=><div key={i} className="h-24 bg-secondary rounded-xl animate-pulse"/>)}</div>;

  return (
    <div>
      <h2 className="font-display text-xl font-bold mb-6">{t("dashboard.wishlist")}</h2>
      {items.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-xl">
          <Heart className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("common.noResults")}</p>
          <Button asChild variant="outline" className="mt-4 rounded-full">
            <Link to="/shop">{t("common.viewAll")}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-4 p-4 border border-border rounded-xl">
              <div className="w-16 h-16 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground tracking-widest uppercase">{item.product_brand}</p>
                <p className="text-sm font-medium truncate">{item.product_title}</p>
                <div className="flex gap-2 items-center mt-1">
                  <span className="font-mono text-sm text-[hsl(var(--accent))]">${item.product_price?.toFixed(2)}</span>
                  {item.original_price && <span className="font-mono text-xs text-muted-foreground line-through">${item.original_price?.toFixed(2)}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="ghost" size="icon"><Link to={`/product/${item.product_id}`}><ExternalLink className="w-4 h-4" /></Link></Button>
                <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
