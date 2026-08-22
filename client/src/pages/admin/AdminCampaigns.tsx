import React, { useEffect, useRef, useState } from "react";
import { CalendarRange, ExternalLink, EyeOff, ImagePlus, Loader2, Megaphone, Plus, Save, Trash2, Upload } from "lucide-react";
import moment from "moment";

import {
  createCampaign,
  deleteCampaign,
  getAdminCampaignOverview,
  type CampaignAdminOverviewResponse,
  type CampaignPayload,
  type CampaignRecord,
  updateCampaign,
  uploadCampaignImage,
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
  maxDisplaysPerUser: null as number | null,
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
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

function formatDisplayType(value: CampaignRecord["displayType"]) {
  return value.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function AdminCampaigns() {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      maxDisplaysPerUser: campaign.maxDisplaysPerUser,
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
      maxDisplaysPerUser: form.maxDisplaysPerUser,
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

  const handleImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await uploadCampaignImage({ dataUrl });
      setForm((current) => ({ ...current, image: uploaded.imageUrl }));
      toast({
        title: "Image uploaded",
        description: "Campaign image was uploaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to upload image",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
            <div className="md:col-span-2 space-y-3">
              <Label>Image</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:w-48">
                  {form.image ? (
                    <img src={form.image} alt="Campaign preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handleImageFile(event)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingImage ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {uploadingImage ? "Uploading..." : "Upload image"}
                  </Button>
                  <Input
                    placeholder="Or paste image URL (https://...)"
                    value={form.image}
                    onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))}
                  />
                </div>
              </div>
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
            <div className="md:col-span-2">
              <Label>Display frequency per user</Label>
              <Select
                value={form.maxDisplaysPerUser == null ? "unlimited" : String(form.maxDisplaysPerUser)}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    maxDisplaysPerUser: value === "unlimited" ? null : Number(value),
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                  <SelectItem value="1">Once per day</SelectItem>
                  <SelectItem value="2">2 times per day</SelectItem>
                  <SelectItem value="3">3 times per day</SelectItem>
                  <SelectItem value="4">4 times per day</SelectItem>
                  <SelectItem value="5">5 times per day</SelectItem>
                </SelectContent>
              </Select>
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

          {form.displayType === "POPUP" && (
            <div className="mt-6">
              <Label>Preview</Label>
              <div className="relative mt-2 h-72 w-full overflow-hidden rounded-2xl border border-border">
                {form.image ? (
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${form.image})` }} />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--accent)/0.3),transparent_60%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--background)))]" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.25),rgba(6,10,20,0.82))]" />
                <div className="relative flex h-full flex-col justify-end p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[hsl(var(--accent))]">Campaign</p>
                  <h3 className="font-display text-xl font-semibold text-foreground">{form.title || "Campaign title"}</h3>
                  <p className="text-sm text-foreground/90">{form.description || "Campaign description"}</p>
                </div>
              </div>
            </div>
          )}

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
