import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { Edit, MoreHorizontal, Plus, Trash2 } from "lucide-react";

import { appClient } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CategoryRecord {
  id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  parent_name?: string | null;
  sort_order?: number;
}

interface CategoryFormState {
  name: string;
  description: string;
  parentId: string;
  sortOrder: string;
}

const EMPTY_FORM: CategoryFormState = {
  name: "",
  description: "",
  parentId: "none",
  sortOrder: "0",
};

export default function AdminCategories() {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRecord | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);

  useEffect(() => {
    appClient.entities.Category
      .list()
      .then((items) => setCategories(items as unknown as CategoryRecord[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const parentOptions = useMemo(
    () => categories.filter((category) => !editing || category.id !== editing.id),
    [categories, editing],
  );

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(category: CategoryRecord) {
    setEditing(category);
    setForm({
      name: category.name ?? "",
      description: category.description ?? "",
      parentId: category.parent_id ?? "none",
      sortOrder: String(category.sort_order ?? 0),
    });
    setDialogOpen(true);
  }

  async function saveCategory(): Promise<void> {
    const payload = {
      name: form.name,
      description: form.description,
      parent_id: form.parentId === "none" ? null : form.parentId,
      sort_order: Number(form.sortOrder),
    };

    if (editing) {
      const updated = (await appClient.entities.Category.update(editing.id, payload)) as unknown as CategoryRecord;
      setCategories((current) => current.map((item) => (item.id === editing.id ? updated : item)));
    } else {
      const created = (await appClient.entities.Category.create(payload)) as unknown as CategoryRecord;
      setCategories((current) => [...current, created]);
    }

    setDialogOpen(false);
  }

  async function deleteCategory(id: string): Promise<void> {
    await appClient.entities.Category.delete(id);
    setCategories((current) => current.filter((category) => category.id !== id));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-16 rounded-xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">{categories.length} categories</p>
        </div>
        <Button onClick={openNew} className="rounded-full">
          <Plus className="mr-1 h-4 w-4" /> Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <div key={category.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{category.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {category.parent_name ? `Parent: ${category.parent_name}` : "Top-level category"}
                </p>
                {category.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{category.description}</p>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(category)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => deleteCategory(category.id)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Edit" : "Add"} Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Parent Category</Label>
              <Select
                value={form.parentId}
                onValueChange={(value) => setForm((current) => ({ ...current, parentId: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {parentOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sort Order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                className="mt-1"
              />
            </div>
            <Button onClick={() => void saveCategory()} className="w-full rounded-full">
              {editing ? "Update" : "Create"} Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
