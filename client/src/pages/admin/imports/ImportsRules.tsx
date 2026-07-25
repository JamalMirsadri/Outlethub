import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import {
  createImportRule,
  deleteImportRule,
  listImportRules,
  type ImportRuleRecord,
  updateImportRule,
} from "@/api/imports";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RuleFormState {
  name: string;
  minDiscount: string;
  allowedBrands: string;
  allowedCategories: string;
  isActive: boolean;
}

const EMPTY_RULE_FORM: RuleFormState = {
  name: "",
  minDiscount: "50",
  allowedBrands: "",
  allowedCategories: "",
  isActive: true,
};

function parseDelimitedList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseRuleForm(rule: ImportRuleRecord | null): RuleFormState {
  if (!rule) {
    return EMPTY_RULE_FORM;
  }

  return {
    name: rule.name,
    minDiscount: String(rule.minDiscount),
    allowedBrands: rule.allowedBrands.join(", "),
    allowedCategories: rule.allowedCategories.join(", "),
    isActive: rule.isActive,
  };
}

export default function ImportsRules() {
  const [rules, setRules] = useState<ImportRuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ImportRuleRecord | null>(null);
  const [form, setForm] = useState<RuleFormState>(EMPTY_RULE_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRules(await listImportRules());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load import rules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreateDialog = () => {
    setEditing(null);
    setForm(EMPTY_RULE_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (rule: ImportRuleRecord) => {
    setEditing(rule);
    setForm(parseRuleForm(rule));
    setDialogOpen(true);
  };

  const saveRule = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        minDiscount: Number(form.minDiscount),
        allowedBrands: parseDelimitedList(form.allowedBrands),
        allowedCategories: parseDelimitedList(form.allowedCategories),
        isActive: form.isActive,
      };

      if (editing) {
        await updateImportRule(editing.id, payload);
      } else {
        await createImportRule(payload);
      }

      setDialogOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save import rule.");
    } finally {
      setSaving(false);
    }
  };

  const removeRule = async (id: string) => {
    setError("");
    try {
      await deleteImportRule(id);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete import rule.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Import Rules</h2>
          <p className="text-sm text-muted-foreground">Whitelist brands/categories and control minimum deal quality.</p>
        </div>
        <Button className="rounded-full" onClick={openCreateDialog}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {rules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-16 text-center text-muted-foreground">
              No import rules configured.
            </div>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{rule.name}</p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {rule.minDiscount}%+
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Brands: {rule.allowedBrands.length ? rule.allowedBrands.join(", ") : "All"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Categories: {rule.allowedCategories.length ? rule.allowedCategories.join(", ") : "All"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded-full" onClick={() => openEditDialog(rule)}>
                      Edit
                    </Button>
                    <Button variant="outline" className="rounded-full" onClick={() => void removeRule(rule.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Import Rule" : "Add Import Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div>
              <Label>Minimum Discount</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                max={100}
                value={form.minDiscount}
                onChange={(event) => setForm((current) => ({ ...current, minDiscount: event.target.value }))}
              />
            </div>
            <div>
              <Label>Allowed Brands</Label>
              <Textarea
                className="mt-1"
                rows={3}
                placeholder="nike, coach"
                value={form.allowedBrands}
                onChange={(event) => setForm((current) => ({ ...current, allowedBrands: event.target.value }))}
              />
            </div>
            <div>
              <Label>Allowed Categories</Label>
              <Textarea
                className="mt-1"
                rows={3}
                placeholder="clothing, bags"
                value={form.allowedCategories}
                onChange={(event) => setForm((current) => ({ ...current, allowedCategories: event.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={form.isActive}
                type="checkbox"
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              Active rule
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button disabled={saving || !form.name.trim()} onClick={() => void saveRule()}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Create Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
