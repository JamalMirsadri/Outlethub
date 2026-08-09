import React, { useCallback, useEffect, useState } from "react";
import { appClient } from "@/api/appClient";
import { Plus, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { HttpError } from "@/services/http";

const EMPTY_FORM = {
  name: "",
  description: "",
  website: "",
  logo_url: "",
  margin_percent: 15,
  is_luxury: false,
  is_featured: false,
};

function isValidUrl(value) {
  if (!value) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function formatFieldLabel(field) {
  return field
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (value) => value.toUpperCase());
}

function getValidationMessages(data) {
  if (!data || typeof data !== "object") {
    return [];
  }

  const formErrors = Array.isArray(data.formErrors)
    ? data.formErrors.filter((value) => typeof value === "string" && value.trim())
    : [];
  const fieldErrors = data.fieldErrors && typeof data.fieldErrors === "object" ? data.fieldErrors : {};

  const fieldMessages = Object.entries(fieldErrors).flatMap(([field, value]) => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((message) => typeof message === "string" && message.trim())
      .map((message) => `${formatFieldLabel(field)}: ${message}`);
  });

  return [...formErrors, ...fieldMessages];
}

function getErrorMessage(error) {
  if (error instanceof HttpError) {
    const validationMessages = getValidationMessages(error.data);
    if (validationMessages.length > 0) {
      return validationMessages.join(" ");
    }

    return error.message || "Unable to save brand.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to save brand.";
}

export default function AdminBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadBrands = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const items = await appClient.entities.Brand.list("-created_date", 50);
      setBrands(items);
      return items;
    } catch (error) {
      toast({
        title: "Unable to load brands",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      return [];
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({
      name: b.name,
      description: b.description || "",
      website: b.website || "",
      logo_url: b.logo || "",
      margin_percent: b.margin_percent ?? 15,
      is_luxury: b.is_luxury || false,
      is_featured: b.is_featured || false,
    });
    setDialogOpen(true);
  };

  const validateForm = () => {
    const name = form.name.trim();
    if (name.length < 2) {
      toast({
        title: "Name is required",
        description: "Brand name must be at least 2 characters.",
        variant: "destructive",
      });
      return null;
    }

    const website = form.website.trim();
    if (website && !isValidUrl(website)) {
      toast({
        title: "Website is invalid",
        description: "Enter a full URL, including http:// or https://.",
        variant: "destructive",
      });
      return null;
    }

    const logoUrl = form.logo_url.trim();
    if (logoUrl && !isValidUrl(logoUrl)) {
      toast({
        title: "Logo URL is invalid",
        description: "Enter a full image URL, including http:// or https://.",
        variant: "destructive",
      });
      return null;
    }

    const marginPercent = Number(form.margin_percent);
    if (!Number.isFinite(marginPercent) || marginPercent < 0) {
      toast({
        title: "Margin is invalid",
        description: "Margin percent must be a valid non-negative number.",
        variant: "destructive",
      });
      return null;
    }

    return {
      name,
      description: form.description.trim(),
      website,
      logo_url: logoUrl,
      margin_percent: marginPercent,
      is_luxury: Boolean(form.is_luxury),
      is_featured: Boolean(form.is_featured),
    };
  };

  const save = async () => {
    const data = validateForm();
    if (!data) {
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await appClient.entities.Brand.update(editing.id, data);
      } else {
        await appClient.entities.Brand.create({ ...data, status: "active" });
      }

      await loadBrands({ silent: true });
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast({
        title: editing ? "Brand updated" : "Brand created",
      });
    } catch (error) {
      await loadBrands({ silent: true });
      toast({
        title: editing ? "Unable to update brand" : "Unable to create brand",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteBrand = async (id) => {
    try {
      await appClient.entities.Brand.delete(id);
      setBrands((current) => current.filter((brand) => brand.id !== id));
      toast({ title: "Brand deleted" });
    } catch (error) {
      toast({
        title: "Unable to delete brand",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) return <div className="space-y-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-16 bg-secondary rounded-xl animate-pulse"/>)}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Brands</h1>
          <p className="text-sm text-muted-foreground">{brands.length} brands</p>
        </div>
        <Button onClick={openNew} className="rounded-full"><Plus className="w-4 h-4 mr-1" /> Add Brand</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.map(b => (
          <div key={b.id} className="p-5 rounded-xl border border-border bg-card">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{b.name}</h3>
                <div className="flex gap-2 mt-2">
                  {b.is_luxury && <Badge variant="secondary">Luxury</Badge>}
                  {b.is_featured && <Badge variant="secondary" className="bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]">Featured</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-2">Margin: <span className="font-mono text-[hsl(var(--accent))]">+{b.margin_percent}%</span></p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={()=>openEdit(b)}><Edit className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={()=>deleteBrand(b.id)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit" : "Add"} Brand</DialogTitle></DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1" /></div>
            <div><Label className="text-xs">Logo URL</Label><Input value={form.logo_url} onChange={e=>setForm({...form,logo_url:e.target.value})} className="mt-1" /></div>
            <div><Label className="text-xs">Website</Label><Input value={form.website} onChange={e=>setForm({...form,website:e.target.value})} className="mt-1" /></div>
            <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1" /></div>
            <div><Label className="text-xs">Margin %</Label><Input type="number" value={form.margin_percent} onChange={e=>setForm({...form,margin_percent:e.target.value})} className="mt-1" /></div>
            <div className="flex items-center justify-between"><Label>Luxury Brand</Label><Switch checked={form.is_luxury} onCheckedChange={v=>setForm({...form,is_luxury:v})} /></div>
            <div className="flex items-center justify-between"><Label>Featured</Label><Switch checked={form.is_featured} onCheckedChange={v=>setForm({...form,is_featured:v})} /></div>
            <Button type="submit" disabled={saving} className="w-full rounded-full">{saving ? "Saving..." : editing ? "Update" : "Create"} Brand</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

