import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Pencil, Plus, Save, Trash2 } from "lucide-react";

import {
  createAdminEmailNotificationRecipient,
  deleteAdminEmailNotificationRecipient,
  getAdminEmailNotificationSettings,
  sendAdminEmailNotificationTestEmail,
  updateAdminEmailNotificationRecipient,
  updateAdminEmailNotificationSettings,
  type AdminEmailNotificationRecipientRecord,
} from "@/api/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";

interface RecipientFormState {
  name: string;
  email: string;
  isActive: boolean;
}

const DEFAULT_FORM: RecipientFormState = {
  name: "",
  email: "",
  isActive: true,
};

function buildForm(recipient?: AdminEmailNotificationRecipientRecord | null): RecipientFormState {
  if (!recipient) {
    return DEFAULT_FORM;
  }

  return {
    name: recipient.name,
    email: recipient.email,
    isActive: recipient.isActive,
  };
}

export default function AdminEmailNotifications() {
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [recipients, setRecipients] = useState<AdminEmailNotificationRecipientRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RecipientFormState>(DEFAULT_FORM);

  const activeRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.isActive),
    [recipients],
  );

  const load = async () => {
    const settings = await getAdminEmailNotificationSettings();
    setEnabled(settings.enabled);
    setRecipients(settings.recipients);
  };

  useEffect(() => {
    load()
      .catch((error) => {
        toast({
          title: "Email notifications failed to load",
          description: error instanceof Error ? error.message : "Please refresh the page.",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const onToggleEnabled = async (checked: boolean) => {
    const previous = enabled;
    setEnabled(checked);
    setSavingSettings(true);

    try {
      const saved = await updateAdminEmailNotificationSettings(checked);
      setEnabled(saved.enabled);
      toast({
        title: checked ? "Email notifications enabled" : "Email notifications disabled",
        description: checked
          ? "New order emails will be sent to active recipients."
          : "New order emails will stop until notifications are enabled again.",
      });
    } catch (error) {
      setEnabled(previous);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const onSubmitRecipient = async () => {
    setSavingRecipient(true);

    try {
      if (editingId) {
        const updated = await updateAdminEmailNotificationRecipient(editingId, form);
        setRecipients((current) =>
          current.map((recipient) => (recipient.id === editingId ? updated : recipient)),
        );
        toast({ title: "Recipient updated" });
      } else {
        const created = await createAdminEmailNotificationRecipient(form);
        setRecipients((current) => [...current, created]);
        toast({ title: "Recipient added" });
      }

      resetForm();
    } catch (error) {
      toast({
        title: "Recipient save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingRecipient(false);
    }
  };

  const onEditRecipient = (recipient: AdminEmailNotificationRecipientRecord) => {
    setEditingId(recipient.id);
    setForm(buildForm(recipient));
  };

  const onDeleteRecipient = async (recipient: AdminEmailNotificationRecipientRecord) => {
    const confirmed = window.confirm(`Delete ${recipient.email} from email notifications?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteAdminEmailNotificationRecipient(recipient.id);
      setRecipients((current) => current.filter((item) => item.id !== recipient.id));
      if (editingId === recipient.id) {
        resetForm();
      }
      toast({ title: "Recipient deleted" });
    } catch (error) {
      toast({
        title: "Recipient delete failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const onToggleRecipientActive = async (recipient: AdminEmailNotificationRecipientRecord, isActive: boolean) => {
    const previous = recipients;
    setRecipients((current) =>
      current.map((item) => (item.id === recipient.id ? { ...item, isActive } : item)),
    );

    try {
      const updated = await updateAdminEmailNotificationRecipient(recipient.id, { isActive });
      setRecipients((current) =>
        current.map((item) => (item.id === recipient.id ? updated : item)),
      );
    } catch (error) {
      setRecipients(previous);
      toast({
        title: "Recipient status update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSendTestEmail = async () => {
    setSendingTest(true);
    try {
      const result = await sendAdminEmailNotificationTestEmail();
      toast({
        title: "Test email finished",
        description: `Delivered: ${result.deliveredCount} · Failed: ${result.failedCount}`,
      });
    } catch (error) {
      toast({
        title: "Test email failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-2xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Email Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Send new order notifications to active admin, manager, and employee recipients using the existing SMTP delivery service.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => void onSendTestEmail()}
          disabled={sendingTest || activeRecipients.length === 0}
        >
          {sendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
          Send Test Email
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Notification Status</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              When enabled, every new order sends an email to all active recipients.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {savingSettings ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            <Switch checked={enabled} onCheckedChange={(checked) => void onToggleEnabled(checked)} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Recipients</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Active recipients receive new order emails and test emails.
              </p>
            </div>
            <Badge variant="secondary">{activeRecipients.length} active</Badge>
          </div>

          {recipients.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No recipients configured yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recipients.map((recipient) => (
                <div
                  key={recipient.id}
                  className="flex flex-col gap-4 rounded-xl border border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{recipient.name}</p>
                      <Badge variant={recipient.isActive ? "default" : "secondary"}>
                        {recipient.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{recipient.email}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-border px-3 py-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={recipient.isActive}
                        onCheckedChange={(checked) => void onToggleRecipientActive(recipient, checked)}
                      />
                    </div>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => onEditRecipient(recipient)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => void onDeleteRecipient(recipient)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">{editingId ? "Edit Recipient" : "Add Recipient"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure the name, email address, and active status for each recipient.
              </p>
            </div>
            {editingId ? (
              <Button type="button" variant="ghost" className="rounded-full" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Admin, Manager, Employee"
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                className="mt-1"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="team@example.com"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Recipient active</p>
                <p className="text-xs text-muted-foreground">Inactive recipients stay saved but will not receive emails.</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
              />
            </div>

            <Button type="button" className="w-full rounded-full" onClick={() => void onSubmitRecipient()} disabled={savingRecipient}>
              {savingRecipient ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Save className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editingId ? "Save Recipient" : "Add Recipient"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
