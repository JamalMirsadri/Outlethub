import React, { useEffect, useState } from "react";
import { CalendarRange, ExternalLink, EyeOff, ImagePlus, Loader2, Megaphone, Plus, Save, Trash2 } from "lucide-react";
import moment from "moment";

import {
  createCampaign,
  deleteCampaign,
  getAdminCampaignOverview,
  type CampaignAdminOverviewResponse,
  type CampaignPayload,
  type CampaignRecord,
  updateCampaign,
} from "@/api/campaigns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

const EMPTY_OVERVIEW: CampaignAdminOverviewResponse = {
  summary: {
    totalCampaigns: 0,
    activeCampaigns: 0,
    scheduledCampaigns: 0,
  },
  campaigns: [],
};

const DEFAULT_FORM = {
  id: "",
  title: "",
  description: "",
  image: "",
  displayType: "POPUP" as CampaignRecord["displayType"],
  link: "",
  status: "DRAFT" as CampaignRecord["status"],
  startsAt: "",
  endsAt: "",
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function formatDisplayType(value: CampaignRecord["displayType"]) {
  return value.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function AdminCampaigns() {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const load = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      setOverview(await getAdminCampaignOverview());
    } catch (error) {
      toast({
        title: "Unable to load campaigns",
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

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (campaign: CampaignRecord) => {
    setForm({
      id: campaign.id,
      title: campaign.title,
      description: campaign.description || "",
      image: campaign.image || "",
      displayType: campaign.displayType,
      link: campaign.link || "",
      status: campaign.status,
      startsAt: campaign.startsAt ? moment(campaign.startsAt).format("YYYY-MM-DDTHH:mm") : "",
      endsAt: campaign.endsAt ? moment(campaign.endsAt).format("YYYY-MM-DDTHH:mm") : "",
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    setSaving(true);

    const payload: CampaignPayload = {
      title: form.title,
      description: form.description || null,
      image: form.image || null,
      displayType: form.displayType,
      link: form.link || null,
      status: form.status,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };

    try {
      if (form.id) {
        await updateCampaign(form.id, payload);
      } else {
        await createCampaign(payload);
      }

      await load({ silent: true });
      setDialogOpen(false);
      resetForm();
      toast({
        title: form.id ? "Campaign updated" : "Campaign created",
        description: "Campaign Center data was saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to save campaign",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);

    try {
      await deleteCampaign(id);
      await load({ silent: true });
      toast({
        title: "Campaign deleted",
        description: "The campaign was removed successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to delete campaign",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-secondary" />)}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Campaign Center</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage campaign records for future popups, banners, and campaign placements without affecting the storefront yet.
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-full">
          <Plus className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Campaigns" value={overview.summary.totalCampaigns} hint="All configured campaign records" />
        <StatCard label="Active Campaigns" value={overview.summary.activeCampaigns} hint="Marked active in Campaign Center" />
        <StatCard label="Scheduled" value={overview.summary.scheduledCampaigns} hint="Using start or end dates" />
      </div>

      <div className="space-y-4">
        {overview.campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
            No campaigns have been created yet.
          </div>
        ) : (
          overview.campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{campaign.title}</h2>
                    <Badge variant="secondary">{formatDisplayType(campaign.displayType)}</Badge>
                    <Badge variant={campaign.status === "ACTIVE" ? "default" : "outline"}>{campaign.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{campaign.description || "No description provided."}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <ImagePlus className="h-4 w-4" />
                      {campaign.image ? "Image configured" : "No image"}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      {campaign.link ? "Link configured" : "No link"}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CalendarRange className="h-4 w-4" />
                      {campaign.startsAt || campaign.endsAt
                        ? `${campaign.startsAt ? moment(campaign.startsAt).format("MMM D, YYYY") : "Now"} -> ${campaign.endsAt ? moment(campaign.endsAt).format("MMM D, YYYY") : "Open"}`
                        : "No schedule"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" onClick={() => openEdit(campaign)}>Edit</Button>
                  <Button variant="ghost" size="icon" onClick={() => void handleDelete(campaign.id)} disabled={busyId === campaign.id}>
                    {busyId === campaign.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <EyeOff className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Phase 1 Scope</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Campaign records are stored and manageable in admin only. No popup, banner, or storefront rendering is enabled in this phase.
        </p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{form.id ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Title</Label>
              <Input className="mt-1" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea className="mt-1" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Image</Label>
              <Input className="mt-1" placeholder="https://..." value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} />
            </div>
            <div>
              <Label>Display Type</Label>
              <Select value={form.displayType} onValueChange={(value) => setForm((current) => ({ ...current, displayType: value as CampaignRecord["displayType"] }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POPUP">Popup</SelectItem>
                  <SelectItem value="BANNER">Banner</SelectItem>
                  <SelectItem value="HERO">Hero</SelectItem>
                  <SelectItem value="INLINE">Inline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as CampaignRecord["status"] }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DISABLED">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Link</Label>
              <Input className="mt-1" placeholder="/shop or https://..." value={form.link} onChange={(event) => setForm((current) => ({ ...current, link: event.target.value }))} />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input className="mt-1" type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input className="mt-1" type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void submit()} disabled={saving} className="rounded-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {form.id ? "Save Changes" : "Create Campaign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
