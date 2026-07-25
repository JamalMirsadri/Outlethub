import React, { useEffect, useMemo, useState } from "react";

import {
  listEmailTemplates,
  previewEmailTemplate,
  rollbackEmailTemplate,
  sendTestEmail,
  updateEmailTemplate,
  type EmailTemplateRecord,
} from "@/api/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

interface TemplateFormState {
  name: string;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
  changeNotes: string;
  samplePayload: string;
  testEmail: string;
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
    changeNotes: "",
    samplePayload: stringifyPayload(template?.samplePayload),
    testEmail: "admin@outlethub.local",
  };
}

export default function AdminEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<TemplateFormState>(buildFormState(null));
  const [preview, setPreview] = useState<{ subject: string; html: string; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId],
  );

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const nextTemplates = await listEmailTemplates();
      setTemplates(nextTemplates);
      const nextSelected = selectedId && nextTemplates.some((template) => template.id === selectedId)
        ? selectedId
        : nextTemplates[0]?.id ?? "";
      setSelectedId(nextSelected);
      const nextTemplate = nextTemplates.find((template) => template.id === nextSelected) ?? null;
      setForm(buildFormState(nextTemplate));
      setPreview(null);
    } catch (error) {
      toast({
        title: "Templates failed to load",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
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
        changeNotes: form.changeNotes || "Admin template update",
      });
      await loadTemplates();
      toast({ title: "Template saved" });
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

  const onRollback = async (version: number) => {
    if (!selectedTemplate) {
      return;
    }

    try {
      await rollbackEmailTemplate(selectedTemplate.id, version);
      await loadTemplates();
      toast({ title: `Rolled back to version ${version}` });
    } catch (error) {
      toast({
        title: "Rollback failed",
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
      toast({ title: "Test email queued" });
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
          <div key={index} className="h-24 rounded-2xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Email Templates</h1>
          <p className="text-sm text-muted-foreground">Edit, preview, version, rollback, and send test emails for the unified communication center.</p>
        </div>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-[280px] rounded-full">
            <SelectValue placeholder="Select a template" />
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

      {!selectedTemplate ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
          No email templates available.
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="grid gap-4">
                <div>
                  <Label className="text-xs">Template Name</Label>
                  <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Input value={form.subjectTemplate} onChange={(event) => setForm((current) => ({ ...current, subjectTemplate: event.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">HTML Body</Label>
                  <Textarea value={form.htmlTemplate} onChange={(event) => setForm((current) => ({ ...current, htmlTemplate: event.target.value }))} className="mt-1 min-h-[240px] font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Text Body</Label>
                  <Textarea value={form.textTemplate} onChange={(event) => setForm((current) => ({ ...current, textTemplate: event.target.value }))} className="mt-1 min-h-[140px] font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Sample Payload JSON</Label>
                  <Textarea value={form.samplePayload} onChange={(event) => setForm((current) => ({ ...current, samplePayload: event.target.value }))} className="mt-1 min-h-[180px] font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Change Notes</Label>
                  <Input value={form.changeNotes} onChange={(event) => setForm((current) => ({ ...current, changeNotes: event.target.value }))} className="mt-1" />
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

            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">Version History</h2>
              <div className="mt-4 space-y-3">
                {selectedTemplate.versions.map((version) => (
                  <div key={version.id} className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-medium">Version {version.version}</p>
                      <p className="text-xs text-muted-foreground">{version.changeNotes || "No change notes"} · {new Date(version.createdAt).toLocaleString()}</p>
                    </div>
                    <Button variant="outline" className="rounded-full" onClick={() => void onRollback(version.version)}>
                      Rollback
                    </Button>
                  </div>
                ))}
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
                <p>Updated: {new Date(selectedTemplate.updatedAt).toLocaleString()}</p>
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
                <p className="mt-4 text-sm text-muted-foreground">Run a preview to inspect rendered subject, text, and HTML.</p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">Send Test Email</h2>
              <div className="mt-4 space-y-3">
                <div>
                  <Label className="text-xs">Target Email</Label>
                  <Input value={form.testEmail} onChange={(event) => setForm((current) => ({ ...current, testEmail: event.target.value }))} className="mt-1" />
                </div>
                <Button className="w-full rounded-full" onClick={() => void onSendTest()}>
                  Queue Test Email
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
