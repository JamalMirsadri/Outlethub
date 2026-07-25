import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { Link2, Unlink, RefreshCw, Zap, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import moment from "moment";

const PLATFORMS = [
  { type: "awin", name: "Awin Affiliate", description: "Connect to Awin's affiliate network to import products from thousands of fashion advertisers.", fields: [{ key: "api_key", label: "API Key" }, { key: "publisher_id", label: "Publisher ID" }] },
  { type: "cj", name: "CJ Affiliate", description: "Connect to CJ Affiliate (Commission Junction) to access a global network of fashion brands.", fields: [{ key: "api_key", label: "API Key" }, { key: "website_id", label: "Website ID" }] },
];

const STATUS_ICON = { connected: CheckCircle, disconnected: AlertCircle, error: AlertCircle };

export default function AdminIntegrations() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    appClient.entities.AffiliateIntegration.list("-created_date", 10).then(setIntegrations).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const getIntegration = (type) => integrations.find(i => i.type === type);

  const connect = async () => {
    const data = { name: selectedPlatform.name, type: selectedPlatform.type, ...form, status: "connected", last_sync: new Date().toISOString() };
    const existing = getIntegration(selectedPlatform.type);
    if (existing) {
      await appClient.entities.AffiliateIntegration.update(existing.id, { ...form, status: "connected" });
      setIntegrations(integrations.map(i => i.id === existing.id ? { ...i, ...form, status: "connected" } : i));
    } else {
      const created = await appClient.entities.AffiliateIntegration.create(data);
      setIntegrations([...integrations, created]);
    }
    setDialogOpen(false);
  };

  const disconnect = async (type) => {
    const intg = getIntegration(type);
    if (intg) {
      await appClient.entities.AffiliateIntegration.update(intg.id, { status: "disconnected" });
      setIntegrations(integrations.map(i => i.id === intg.id ? { ...i, status: "disconnected" } : i));
    }
  };

  if (loading) return <div className="space-y-4">{Array.from({length:2}).map((_,i)=><div key={i} className="h-40 bg-secondary rounded-xl animate-pulse"/>)}</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground">Connect affiliate networks to import products</p>
      </div>

      <div className="space-y-4">
        {PLATFORMS.map(platform => {
          const intg = getIntegration(platform.type);
          const connected = intg?.status === "connected";
          const StatusIcon = STATUS_ICON[intg?.status] || AlertCircle;
          return (
            <div key={platform.type} className="p-6 rounded-xl border border-border bg-card">
              <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{platform.name}</h3>
                    <Badge variant="secondary" className={connected ? "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]" : ""}>
                      <StatusIcon className="w-3 h-3 mr-1" />{intg?.status || "disconnected"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{platform.description}</p>
                  {connected && (
                    <div className="flex flex-wrap gap-6 text-sm">
                      <div><span className="text-muted-foreground">Last Sync:</span> <span className="font-mono">{intg.last_sync ? moment(intg.last_sync).fromNow() : "Never"}</span></div>
                      <div><span className="text-muted-foreground">Products:</span> <span className="font-mono">{intg.product_count || 0}</span></div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {connected ? (
                    <>
                      <Button variant="outline" size="sm" className="rounded-full"><RefreshCw className="w-4 h-4 mr-1" /> Sync</Button>
                      <Button variant="outline" size="sm" className="rounded-full"><Zap className="w-4 h-4 mr-1" /> Test</Button>
                      <Button variant="outline" size="sm" className="rounded-full text-destructive" onClick={() => disconnect(platform.type)}><Unlink className="w-4 h-4 mr-1" /> Disconnect</Button>
                    </>
                  ) : (
                    <Button size="sm" className="rounded-full" onClick={() => { setSelectedPlatform(platform); setForm({}); setDialogOpen(true); }}>
                      <Link2 className="w-4 h-4 mr-1" /> Connect
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Connect {selectedPlatform?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {selectedPlatform?.fields.map(f => (
              <div key={f.key}>
                <Label className="text-xs">{f.label}</Label>
                <Input value={form[f.key] || ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="mt-1" type={f.key.includes("key") ? "password" : "text"} />
              </div>
            ))}
            <Button onClick={connect} className="w-full rounded-full">Connect</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

