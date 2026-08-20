import React, { useEffect, useMemo, useState } from "react";

import {
  listCustomerEmailHistory,
  listCustomerEmailTemplates,
  previewEmailTemplate,
  sendTestEmail,
  updateEmailTemplate,
  type CustomerEmailHistoryRecord,
  type EmailTemplateRecord,
} from "@/api/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

interface TemplateFormState {
  name: string;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
  samplePayload: string;
  changeNotes: string;
  testEmail: string;
  isActive: boolean;
}

function stringifyPayload(value: Record<string, unknown> | null | undefined) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parsePayload(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    throw new Error("Sample payload must be valid JSON.");
  }
}

function buildFormState(template: EmailTemplateRecord | null): TemplateFormState {
  return {
    name: template?.name ?? "",
    subjectTemplate: template?.subjectTemplate ?? "",
    htmlTemplate: template?.htmlTemplate ?? "",
    textTemplate: template?.textTemplate ?? "",
    samplePayload: stringifyPayload(template?.samplePayload),
    changeNotes: "",
    testEmail: "customer@example.com",
    isActive: template?.isActive ?? true,
  };
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

function stateClassName(state: CustomerEmailHistoryRecord["state"]) {
  switch (state) {
    case "DELIVERED":
    case "OPENED":
      return "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]";
    case "FAILED":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-secondary text-foreground";
  }
}

export default function AdminCustomerEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [history, setHistory] = useState<CustomerEmailHistoryRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<TemplateFormState>(buildFormState(null));
  const [preview, setPreview] = useState<{ subject: string; html: string; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [nextTemplates, nextHistory] = await Promise.all([
        listCustomerEmailTemplates(),
        listCustomerEmailHistory(),
      ]);

      setTemplates(nextTemplates);
      setHistory(nextHistory.items);

      const nextSelectedId =
        selectedId && nextTemplates.some((template) => template.id === selectedId)
          ? selectedId
          : nextTemplates[0]?.id ?? "";
      setSelectedId(nextSelectedId);
      setForm(buildFormState(nextTemplates.find((template) => template.id === nextSelectedId) ?? null));
      setPreview(null);
    } catch (error) {
      toast({
        title: "Customer email center failed to load",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setForm(buildFormState(selectedTemplate));
    setPreview(null);
  }, [selectedTemplate]);

  const onSave = async () => {
    if (!selectedTemplate) {
      return;
    }

    try {
      await updateEmailTemplate(selectedTemplate.id, {
        name: form.name,
        subjectTemplate: form.subjectTemplate,
        htmlTemplate: form.htmlTemplate,
        textTemplate: form.textTemplate,
        samplePayload: parsePayload(form.samplePayload),
        isActive: form.isActive,
        changeNotes: form.changeNotes || "Customer email template update",
      });
      await load();
      toast({ title: "Customer template saved" });
    } catch (error) {
      toast({
        title: "Template save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const onPreview = async () => {
    if (!selectedTemplate) {
      return;
    }

    try {
      const rendered = await previewEmailTemplate(selectedTemplate.id, parsePayload(form.samplePayload));
      setPreview(rendered);
    } catch (error) {
      toast({
        title: "Preview failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSendTest = async () => {
    if (!selectedTemplate) {
      return;
    }

    try {
      await sendTestEmail(selectedTemplate.id, form.testEmail, parsePayload(form.samplePayload));
      toast({ title: "Customer test email queued" });
      await load();
    } catch (error) {
      toast({
        title: "Test email failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Customer Email Templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage customer lifecycle emails and review delivery history without touching the separate admin recipient system.
          </p>
        </div>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-[320px] rounded-full">
            <SelectValue placeholder="Select a customer template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-2xl bg-secondary/50 p-2">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          {!selectedTemplate ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
              No customer email templates available.
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <div className="space-y-6">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="grid gap-4">
                    <div>
                      <Label className="text-xs">Template Name</Label>
                      <Input className="mt-1" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">Template Enabled</p>
                        <p className="text-xs text-muted-foreground">Disabled templates stay in the database but no email will be sent for that event.</p>
                      </div>
                      <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Subject</Label>
                      <Input className="mt-1" value={form.subjectTemplate} onChange={(event) => setForm((current) => ({ ...current, subjectTemplate: event.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">HTML Body</Label>
                      <Textarea className="mt-1 min-h-[220px] font-mono text-xs" value={form.htmlTemplate} onChange={(event) => setForm((current) => ({ ...current, htmlTemplate: event.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Text Body</Label>
                      <Textarea className="mt-1 min-h-[140px] font-mono text-xs" value={form.textTemplate} onChange={(event) => setForm((current) => ({ ...current, textTemplate: event.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Sample Payload JSON</Label>
                      <Textarea className="mt-1 min-h-[180px] font-mono text-xs" value={form.samplePayload} onChange={(event) => setForm((current) => ({ ...current, samplePayload: event.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Change Notes</Label>
                      <Input className="mt-1" value={form.changeNotes} onChange={(event) => setForm((current) => ({ ...current, changeNotes: event.target.value }))} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button className="rounded-full" onClick={() => void onSave()}>
                        Save Template
                      </Button>
                      <Button variant="outline" className="rounded-full" onClick={() => void onPreview()}>
                        Preview Template
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="font-semibold">Current Template</h2>
                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <p>Key: {selectedTemplate.key}</p>
                    <p>Version: {selectedTemplate.version}</p>
                    <p>Category: {selectedTemplate.category}</p>
                    <p>Status: {selectedTemplate.isActive ? "Enabled" : "Disabled"}</p>
                    <p>Updated: {formatDate(selectedTemplate.updatedAt)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="font-semibold">Preview</h2>
                  {preview ? (
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Subject</p>
                        <p className="mt-1 font-medium">{preview.subject}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Text</p>
                        <pre className="mt-1 whitespace-pre-wrap rounded-xl bg-secondary p-3 text-xs">{preview.text}</pre>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">HTML</p>
                        <div className="mt-1 rounded-xl border border-border p-3 text-sm" dangerouslySetInnerHTML={{ __html: preview.html }} />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">Run a preview to inspect the rendered customer email.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="font-semibold">Send Test Email</h2>
                  <div className="mt-4 space-y-3">
                    <div>
                      <Label className="text-xs">Target Email</Label>
                      <Input className="mt-1" value={form.testEmail} onChange={(event) => setForm((current) => ({ ...current, testEmail: event.target.value }))} />
                    </div>
                    <Button className="w-full rounded-full" onClick={() => void onSendTest()}>
                      Queue Test Email
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
              No customer email delivery history available yet.
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.renderedSubject ?? item.templateKey}</p>
                      <Badge variant="secondary" className={stateClassName(item.state)}>
                        {item.state}
                      </Badge>
                      <Badge variant="outline">{item.eventName}</Badge>
                      {item.templateVersion !== null ? <Badge variant="outline">v{item.templateVersion}</Badge> : null}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Customer: {item.customer?.name ?? "-"} {item.customer?.email ? `(${item.customer.email})` : ""}</p>
                      <p>Recipient: {item.recipient ?? "-"}</p>
                      <p>Order: {item.orderNumber ?? "-"}</p>
                      <p>Template: {item.templateName ?? item.templateKey}</p>
                      <p>Queued: {formatDate(item.queuedAt)} · Delivered: {formatDate(item.deliveredAt)} · Failed: {formatDate(item.failedAt)}</p>
                      <p>Retry Count: {item.retryCount}</p>
                      {item.failureReason ? <p className="text-destructive">Failure: {item.failureReason}</p> : null}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
