import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { Plus, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function AdminBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", website: "", logo_url: "", margin_percent: 15, is_luxury: false, is_featured: false });

  useEffect(() => {
    appClient.entities.Brand.list("-created_date", 50).then(setBrands).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", description: "", website: "", logo_url: "", margin_percent: 15, is_luxury: false, is_featured: false }); setDialogOpen(true); };
  const openEdit = (b) => { setEditing(b); setForm({ name: b.name, description: b.description||"", website: b.website||"", logo_url: b.logo||"", margin_percent: b.margin_percent||15, is_luxury: b.is_luxury||false, is_featured: b.is_featured||false }); setDialogOpen(true); };

  const save = async () => {
    const data = { ...form, margin_percent: Number(form.margin_percent) };
    if (editing) {
      await appClient.entities.Brand.update(editing.id, data);
      setBrands(brands.map(b => b.id === editing.id ? { ...b, ...data } : b));
    } else {
      const created = await appClient.entities.Brand.create({ ...data, status: "active" });
      setBrands([created, ...brands]);
    }
    setDialogOpen(false);
  };

  const deleteBrand = async (id) => {
    await appClient.entities.Brand.delete(id);
    setBrands(brands.filter(b => b.id !== id));
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit" : "Add"} Brand</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1" /></div>
            <div><Label className="text-xs">Logo URL</Label><Input value={form.logo_url} onChange={e=>setForm({...form,logo_url:e.target.value})} className="mt-1" /></div>
            <div><Label className="text-xs">Website</Label><Input value={form.website} onChange={e=>setForm({...form,website:e.target.value})} className="mt-1" /></div>
            <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1" /></div>
            <div><Label className="text-xs">Margin %</Label><Input type="number" value={form.margin_percent} onChange={e=>setForm({...form,margin_percent:e.target.value})} className="mt-1" /></div>
            <div className="flex items-center justify-between"><Label>Luxury Brand</Label><Switch checked={form.is_luxury} onCheckedChange={v=>setForm({...form,is_luxury:v})} /></div>
            <div className="flex items-center justify-between"><Label>Featured</Label><Switch checked={form.is_featured} onCheckedChange={v=>setForm({...form,is_featured:v})} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Update" : "Create"} Brand</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

