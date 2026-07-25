import { useEffect, useState } from "react";

import {
  listExchangeRates,
  upsertExchangeRate,
  type ExchangeRateRecord,
} from "@/api/commerce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_FORM = {
  baseCurrency: "EUR",
  quoteCurrency: "TOMAN",
  rate: "184000",
  notes: "",
};

export default function AdminExchangeRates() {
  const [items, setItems] = useState<ExchangeRateRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => setItems(await listExchangeRates());

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const save = async () => {
    await upsertExchangeRate({
      id: editingId ?? undefined,
      baseCurrency: form.baseCurrency,
      quoteCurrency: form.quoteCurrency,
      rate: Number(form.rate),
      notes: form.notes || null,
      isActive: true,
    });
    setEditingId(null);
    setForm(EMPTY_FORM);
    await load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Exchange Rates</h1>
        <p className="mt-2 text-sm text-muted-foreground">Configure dynamic rates for EUR, IRR, and TOMAN. These are applied across catalog, cart, checkout, and orders.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label className="text-xs">Base Currency</Label>
            <Input className="mt-1" value={form.baseCurrency} onChange={(event) => setForm((current) => ({ ...current, baseCurrency: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Quote Currency</Label>
            <Input className="mt-1" value={form.quoteCurrency} onChange={(event) => setForm((current) => ({ ...current, quoteCurrency: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Rate</Label>
            <Input className="mt-1" type="number" value={form.rate} onChange={(event) => setForm((current) => ({ ...current, rate: event.target.value }))} />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">Notes</Label>
            <Textarea className="mt-1" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button onClick={() => void save()}>{editingId ? "Update Rate" : "Save Rate"}</Button>
          {editingId ? <Button variant="outline" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Cancel</Button> : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Pair", "Rate", "Updated", "Action"].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs tracking-widest text-muted-foreground">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 font-medium">{item.baseCurrency} {"->"} {item.quoteCurrency}</td>
                  <td className="px-4 py-3">{item.rate}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(item.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          baseCurrency: item.baseCurrency,
                          quoteCurrency: item.quoteCurrency,
                          rate: String(item.rate),
                          notes: item.notes ?? "",
                        });
                      }}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
