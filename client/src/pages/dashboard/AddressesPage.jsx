import React, { useState, useEffect } from "react";
import { deleteAddress, getCheckoutSummary, upsertAddress } from "@/api/commerce";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "react-i18next";

export default function AddressesPage() {
  const { t } = useTranslation(["dashboard", "common", "product"]);
  const [addresses, setAddresses] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", countryCode: "PT", city: "", postalCode: "", addressLine1: "", addressLine2: "", isDefaultShipping: true, isDefaultBilling: true });

  const getFormLabel = (key) => {
    switch (key) {
      case "fullName": return t("common.name");
      case "phone": return t("common.phone");
      case "addressLine1": return t("common.address");
      case "addressLine2": return t("common.address");
      case "city": return t("common.address");
      case "postalCode": return t("common.address");
      default: return key;
    }
  };

  useEffect(() => {
    getCheckoutSummary().then((summary) => {
      setAddresses(summary.addresses);
      setCountries(summary.countries);
    }).catch(()=>{}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    try {
      const addr = await upsertAddress(form);
      setAddresses([addr, ...addresses]);
      setOpen(false);
      setForm({ fullName: "", phone: "", countryCode: "PT", city: "", postalCode: "", addressLine1: "", addressLine2: "", isDefaultShipping: true, isDefaultBilling: true });
    } catch (error) {
      toast({
        title: t("common.errorOccurred"),
        description: error instanceof Error ? error.message : t("common.tryAgain"),
        variant: "destructive",
      });
    }
  };

  const remove = async (id) => {
    await deleteAddress(id);
    setAddresses(addresses.filter(a => a.id !== id));
  };

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-20 bg-secondary rounded-xl"/><div className="h-20 bg-secondary rounded-xl"/></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display text-xl font-bold">{t("dashboard.addresses")}</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full"><Plus className="w-4 h-4 mr-1" /> {t("common.add")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{t("common.add")} {t("common.address")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {[{k:"fullName",l:"Full Name"},{k:"phone",l:"Phone"},{k:"addressLine1",l:"Address Line 1"},{k:"addressLine2",l:"Address Line 2"},{k:"city",l:"City"},{k:"postalCode",l:"Postal Code"}].map(f=>(
                <div key={f.k}>
                  <Label className="text-xs">{getFormLabel(f.k)}</Label>
                  <Input value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})} className="mt-1" />
                </div>
              ))}
              <div>
                <Label className="text-xs">{t("common.address")}</Label>
                <Select value={form.countryCode} onValueChange={(value) => setForm({ ...form, countryCode: value })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={save} className="w-full rounded-full">{t("common.save")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-xl">
          <MapPin className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("common.noResults")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map(a => (
            <div key={a.id} className="flex justify-between items-start p-4 border border-border rounded-xl">
              <div>
                <p className="text-sm font-medium">{a.fullName}</p>
                <p className="text-sm text-muted-foreground">{a.addressLine1}</p>
                {a.addressLine2 && <p className="text-sm text-muted-foreground">{a.addressLine2}</p>}
                <p className="text-sm text-muted-foreground">{a.city} {a.postalCode}</p>
                <p className="text-sm text-muted-foreground">{a.countryCode}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
