import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

export type NotificationCategory =
  | "ORDERS"
  | "PAYMENTS"
  | "SHIPPING"
  | "PROCUREMENT"
  | "SYSTEM"
  | "MARKETING"
  | "IMPORTS"
  | "MONITORING"
  | "CONNECTORS"
  | "OPERATIONS";

export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type NotificationStatus = "UNREAD" | "READ" | "ARCHIVED";
export type NotificationChannelCode =
  | "EMAIL"
  | "IN_APP"
  | "ADMIN_OPERATIONAL"
  | "SMS"
  | "WHATSAPP"
  | "TELEGRAM"
  | "PUSH_NOTIFICATION";
export type NotificationDeliveryState =
  | "PENDING"
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "OPENED"
  | "FAILED"
  | "SKIPPED";

export interface NotificationRecord {
  id: string;
  eventId: string | null;
  orderId: string | null;
  paymentId: string | null;
  category: NotificationCategory;
  priority: NotificationPriority;
  type: string;
  status: NotificationStatus;
  channelCode: NotificationChannelCode;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  eventName: string | null;
  deliveries: Array<{
    id: string;
    channelCode: NotificationChannelCode;
    state: NotificationDeliveryState;
    renderedSubject: string | null;
    failureReason: string | null;
    retryCount: number;
    sentAt: string | null;
    deliveredAt: string | null;
    openedAt: string | null;
    createdAt: string;
  }>;
}

export interface NotificationPreferenceRecord {
  id: string;
  orderNotifications: boolean;
  paymentNotifications: boolean;
  shippingNotifications: boolean;
  marketingEmails: boolean;
  systemNotifications: boolean;
  channelSettings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplateRecord {
  id: string;
  key: string;
  name: string;
  category: NotificationCategory;
  channelCode: NotificationChannelCode;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
  variablesSchema: Record<string, unknown> | null;
  samplePayload: Record<string, unknown> | null;
  description: string | null;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  versions: Array<{
    id: string;
    version: number;
    subjectTemplate: string;
    htmlTemplate: string;
    textTemplate: string;
    samplePayload: Record<string, unknown> | null;
    variablesSchema: Record<string, unknown> | null;
    changeNotes: string | null;
    createdAt: string;
  }>;
}

export interface AdminEmailNotificationRecipientRecord {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminEmailNotificationSettingsRecord {
  enabled: boolean;
  recipients: AdminEmailNotificationRecipientRecord[];
}

function getTokenOrThrow(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

export async function listNotifications(params?: Partial<{ category: NotificationCategory; unreadOnly: boolean; dateFrom: string; dateTo: string }>) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (typeof params?.unreadOnly === "boolean") searchParams.set("unreadOnly", String(params.unreadOnly));
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);

  return http<{ unreadCount: number; items: NotificationRecord[] }>(
    `/notifications${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    {
      token: getTokenOrThrow(),
    },
  );
}

export async function markNotificationRead(id: string) {
  return http<{ id: string; status: NotificationStatus; readAt: string }>(`/notifications/${id}/read`, {
    method: "PATCH",
    token: getTokenOrThrow(),
  });
}

export async function markAllNotificationsRead() {
  return http<{ updatedCount: number }>("/notifications/read-all", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({}),
  });
}

export async function getNotificationPreferences() {
  return http<NotificationPreferenceRecord>("/notification-preferences", {
    token: getTokenOrThrow(),
  });
}

export async function updateNotificationPreferences(payload: Partial<NotificationPreferenceRecord>) {
  return http<NotificationPreferenceRecord>("/notification-preferences", {
    method: "PUT",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function listAdminNotifications(params?: Partial<{ category: NotificationCategory; unreadOnly: boolean; dateFrom: string; dateTo: string }>) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (typeof params?.unreadOnly === "boolean") searchParams.set("unreadOnly", String(params.unreadOnly));
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);

  return http<{ unreadCount: number; items: NotificationRecord[] }>(
    `/admin/notifications${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    {
      token: getTokenOrThrow(),
    },
  );
}

export async function listEmailTemplates() {
  const response = await http<{ items: EmailTemplateRecord[] }>("/admin/email-templates", {
    token: getTokenOrThrow(),
  });

  return response.items;
}

export async function updateEmailTemplate(
  id: string,
  payload: Partial<{
    name: string;
    subjectTemplate: string;
    htmlTemplate: string;
    textTemplate: string;
    samplePayload: Record<string, unknown>;
    variablesSchema: Record<string, unknown>;
    description: string | null;
    isActive: boolean;
    changeNotes: string | null;
  }>,
) {
  return http<EmailTemplateRecord>(`/admin/email-templates/${id}`, {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function previewEmailTemplate(id: string, variables: Record<string, unknown>) {
  return http<{ subject: string; html: string; text: string }>(`/admin/email-templates/${id}/preview`, {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ variables }),
  });
}

export async function rollbackEmailTemplate(id: string, version: number) {
  return http<EmailTemplateRecord>(`/admin/email-templates/${id}/rollback`, {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ version }),
  });
}

export async function sendTestEmail(id: string, targetEmail: string, variables: Record<string, unknown>) {
  return http<{ eventId: string; deliveryId: string; state: NotificationDeliveryState }>(
    `/admin/email-templates/${id}/test`,
    {
      method: "POST",
      token: getTokenOrThrow(),
      body: JSON.stringify({ targetEmail, variables }),
    },
  );
}

export async function getAdminEmailNotificationSettings() {
  return http<AdminEmailNotificationSettingsRecord>("/admin/email-notifications", {
    token: getTokenOrThrow(),
  });
}

export async function updateAdminEmailNotificationSettings(enabled: boolean) {
  return http<AdminEmailNotificationSettingsRecord>("/admin/email-notifications", {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify({ enabled }),
  });
}

export async function createAdminEmailNotificationRecipient(payload: {
  name: string;
  email: string;
  isActive?: boolean;
}) {
  return http<AdminEmailNotificationRecipientRecord>("/admin/email-notifications/recipients", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function updateAdminEmailNotificationRecipient(
  id: string,
  payload: Partial<{
    name: string;
    email: string;
    isActive: boolean;
  }>,
) {
  return http<AdminEmailNotificationRecipientRecord>(`/admin/email-notifications/recipients/${id}`, {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminEmailNotificationRecipient(id: string) {
  return http<void>(`/admin/email-notifications/recipients/${id}`, {
    method: "DELETE",
    token: getTokenOrThrow(),
  });
}

export async function sendAdminEmailNotificationTestEmail() {
  return http<{
    eventId: string;
    recipientCount: number;
    deliveredCount: number;
    failedCount: number;
  }>("/admin/email-notifications/test", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({}),
  });
}
