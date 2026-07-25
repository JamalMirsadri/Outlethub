import { useEffect, useState } from "react";

import {
  deleteBankAccount,
  listBankAccounts,
  upsertBankAccount,
  type BankAccountRecord,
} from "@/api/commerce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

type BankAccountForm = {
  bankName: string;
  accountHolder: string;
  iban: string;
  accountNumber: string;
  cardNumber: string;
  swift: string;
  country: string;
  currency: string;
  notes: string;
};

const FORM_FIELDS: Array<{ key: keyof BankAccountForm; label: string }> = [
  { key: "bankName", label: "Bank Name" },
  { key: "accountHolder", label: "Account Holder" },
  { key: "iban", label: "IBAN" },
  { key: "accountNumber", label: "Account Number" },
  { key: "cardNumber", label: "Card Number" },
  { key: "swift", label: "SWIFT" },
  { key: "country", label: "Country" },
  { key: "currency", label: "Currency" },
];

const EMPTY_FORM = {
  bankName: "",
  accountHolder: "",
  iban: "",
  accountNumber: "",
  cardNumber: "",
  swift: "",
  country: "Portugal",
  currency: "EUR",
  notes: "",
} satisfies BankAccountForm;

export default function AdminBankAccounts() {
  const [items, setItems] = useState<BankAccountRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "Failed to save bank account.";
  };

  const load = async () => setItems(await listBankAccounts());

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const reset = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = async () => {
    if (!form.bankName.trim()) {
      toast({ title: "Bank name is required", variant: "destructive" });
      return;
    }

    if (!form.accountHolder.trim()) {
      toast({ title: "Account holder is required", variant: "destructive" });
      return;
    }

    if (!form.country.trim()) {
      toast({ title: "Country is required", variant: "destructive" });
      return;
    }

    if (!form.currency.trim()) {
      toast({ title: "Currency is required", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      await upsertBankAccount({
        id: editingId ?? undefined,
        bankName: form.bankName.trim(),
        accountHolder: form.accountHolder.trim(),
        iban: form.iban.trim() || null,
        accountNumber: form.accountNumber.trim() || null,
        cardNumber: form.cardNumber.trim() || null,
        swift: form.swift.trim() || null,
        country: form.country.trim(),
        currency: form.currency.trim().toUpperCase(),
        notes: form.notes.trim() || null,
        isActive: true,
      });
      await load();
      reset();
      toast({ title: editingId ? "Bank account updated" : "Bank account added" });
    } catch (error) {
      toast({
        title: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Bank Accounts</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage multiple bank transfer destinations for international and Iran-based customers.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {FORM_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <Input
                className="mt-1"
                value={form[key]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </div>
          ))}
          <div className="md:col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea className="mt-1" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button disabled={isSaving} onClick={() => void save()}>
            {isSaving ? "Saving..." : editingId ? "Update Account" : "Add Account"}
          </Button>
          {editingId ? <Button variant="outline" onClick={reset}>Cancel</Button> : null}
        </div>
      </div>

      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold">{item.bankName}</p>
                <p className="text-sm text-muted-foreground">{item.accountHolder} · {item.currency} · {item.country}</p>
                <p className="text-xs text-muted-foreground mt-2">IBAN {item.iban ?? "N/A"} · SWIFT {item.swift ?? "N/A"}</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingId(item.id);
                    setForm({
                      bankName: item.bankName,
                      accountHolder: item.accountHolder,
                      iban: item.iban ?? "",
                      accountNumber: item.accountNumber ?? "",
                      cardNumber: item.cardNumber ?? "",
                      swift: item.swift ?? "",
                      country: item.country,
                      currency: item.currency,
                      notes: item.notes ?? "",
                    });
                  }}
                >
                  Edit
                </Button>
                <Button variant="outline" onClick={() => void deleteBankAccount(item.id).then(load)}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
