import {
  NotificationCategory,
  NotificationChannelCode,
  NotificationDeliveryState,
  NotificationEventSource,
  NotificationPriority,
  type NotificationType,
  Prisma,
  RoleCode,
} from "@prisma/client";
import nodemailer, { type Transporter } from "nodemailer";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  notificationAdminOperationalQueue,
  notificationEmailQueue,
  notificationInAppQueue,
} from "../../config/bullmq.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import {
  CHANNEL_SEEDS,
  EVENT_DEFINITIONS,
  TEMPLATE_SEEDS,
  type NotificationEventName,
} from "./notification-catalog.js";
import { renderTemplate } from "./template-renderer.js";

type PrismaExecutor = Prisma.TransactionClient | typeof prisma;

interface PublishNotificationEventInput {
  eventKey: string;
  eventName: NotificationEventName;
  eventSource:
    | "AUTH"
    | "ORDERS"
    | "PAYMENTS"
    | "PROCUREMENT"
    | "SHIPPING"
    | "IMPORTS"
    | "MONITORING"
    | "CONNECTORS"
    | "SYSTEM"
    | "MARKETING";
  actorUserId?: string | null;
  targetUserId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  procurementTaskId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  title?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface NotificationFilters {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

interface TemplatePreviewInput {
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
  samplePayload: Record<string, unknown>;
}

interface AdminEmailNotificationRecipientRecord {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminEmailNotificationSettingsRecord {
  enabled: boolean;
  recipients: AdminEmailNotificationRecipientRecord[];
}

interface AdminOrderNotificationPayload {
  id: string;
  orderNumber: string;
  customerName: string | null;
  customerEmail: string;
  totalAmount: number;
  currency: string;
  paymentProvider: string;
  paymentMethodLabel: string | null;
  createdAt: Date | string;
  items: Array<{
    title: string;
    brandName: string | null;
    size: string | null;
    color: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    currency: string;
  }>;
}

let emailTransporter: Transporter | null = null;
const ADMIN_EMAIL_NOTIFICATION_SETTING_KEY = "admin_email_notifications";
const CUSTOMER_EMAIL_EVENT_NAMES = Object.entries(EVENT_DEFINITIONS)
  .filter(([, definition]) => definition.customerChannels.includes("EMAIL"))
  .map(([eventName]) => eventName as NotificationEventName);

function shouldDeliverEmailInline() {
  return !env.REDIS_URL || env.SERVICE_MODE === "web";
}

// #region debug-point A:notification-debug-bootstrap
const DEBUG_SESSION_ID = "verification-email";

function resolveDebugServerUrl() {
  if (process.env.DEBUG_SERVER_URL) {
    return process.env.DEBUG_SERVER_URL;
  }

  const debugEnvPath = resolve(process.cwd(), ".dbg", `${DEBUG_SESSION_ID}.env`);
  if (!existsSync(debugEnvPath)) {
    return "http://127.0.0.1:7777/event";
  }

  const debugEnvContent = readFileSync(debugEnvPath, "utf8");
  const debugUrl = debugEnvContent
    .split(/\r?\n/)
    .find((line) => line.startsWith("DEBUG_SERVER_URL="))
    ?.slice("DEBUG_SERVER_URL=".length)
    .trim();

  return debugUrl || "http://127.0.0.1:7777/event";
}

function reportDebugEvent(payload: Record<string, unknown>) {
  void fetch(resolveDebugServerUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
      source: "server:notifications-service",
      ...payload,
    }),
  }).catch(() => undefined);
}
// #endregion

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullablePrismaJsonValue(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return toPrismaJsonValue(value);
}

function toJsonRecord(value: Prisma.JsonValue | Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function buildEmailTransporter(): Transporter {
  const smtpHost = env.SMTP_HOST;
  if (!smtpHost) {
    console.warn("SMTP_HOST is not configured. Email delivery is using JSON transport and real emails will not be sent.");
    return nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE ?? false,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });
}

function getEmailTransporter(): Transporter {
  if (!emailTransporter) {
    emailTransporter = buildEmailTransporter();
  }

  return emailTransporter;
}

function toOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildAdminOrderLink(orderId: string) {
  const baseUrl = env.CLIENT_URL.replace(/\/+$/, "");
  return `${baseUrl}/admin/orders?orderId=${encodeURIComponent(orderId)}`;
}

function resolveAdminEmailNotificationSettings(
  value: Prisma.JsonValue | Record<string, unknown> | null | undefined,
): AdminEmailNotificationSettingsRecord {
  const record = toJsonRecord(value);
  const rawRecipients = Array.isArray(record.recipients) ? record.recipients : [];

  const recipients = rawRecipients
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const id = typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : randomUUID();
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const email = typeof candidate.email === "string" ? normalizeEmail(candidate.email) : "";
      const isActive = candidate.isActive !== false;
      const createdAt =
        typeof candidate.createdAt === "string" && candidate.createdAt.length > 0
          ? candidate.createdAt
          : new Date().toISOString();
      const updatedAt =
        typeof candidate.updatedAt === "string" && candidate.updatedAt.length > 0
          ? candidate.updatedAt
          : createdAt;

      if (name.length === 0 || email.length === 0) {
        return null;
      }

      return {
        id,
        name,
        email,
        isActive,
        createdAt,
        updatedAt,
      };
    })
    .filter((recipient): recipient is AdminEmailNotificationRecipientRecord => Boolean(recipient))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return {
    enabled: record.enabled !== false,
    recipients,
  };
}

function buildAdminOrderNotificationEmail(order: AdminOrderNotificationPayload) {
  const orderDate = new Date(order.createdAt);
  const orderLink = buildAdminOrderLink(order.id);
  const paymentMethod = order.paymentMethodLabel ?? order.paymentProvider;
  const customerName = toOptionalString(order.customerName) ?? "Customer";
  const productsText = order.items
    .map((item, index) => {
      const variantBits = [item.brandName, item.size, item.color].filter(Boolean).join(" / ");
      return `${index + 1}. ${item.title}${variantBits ? ` (${variantBits})` : ""} x${item.quantity} - ${formatMoney(item.totalPrice, item.currency || order.currency)}`;
    })
    .join("\n");
  const productsHtml = order.items
    .map((item) => {
      const variantBits = [item.brandName, item.size, item.color].filter(Boolean).join(" / ");
      return `<li><strong>${escapeHtml(item.title)}</strong>${variantBits ? ` <span style="color:#667085">(${escapeHtml(variantBits)})</span>` : ""} - Qty ${item.quantity} - ${escapeHtml(formatMoney(item.totalPrice, item.currency || order.currency))}</li>`;
    })
    .join("");
  const subject = `New order ${order.orderNumber} received`;
  const text = [
    `A new order has been created.`,
    ``,
    `Order Number: ${order.orderNumber}`,
    `Customer: ${customerName}`,
    `Customer Email: ${order.customerEmail}`,
    `Total Amount: ${formatMoney(order.totalAmount, order.currency)}`,
    `Payment Method: ${paymentMethod}`,
    `Order Date/Time: ${orderDate.toISOString()}`,
    `Admin Link: ${orderLink}`,
    ``,
    `Products:`,
    productsText,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 16px">New order received</h2>
      <p style="margin:0 0 12px">A new order has been created in OutletHub.</p>
      <table style="border-collapse:collapse;width:100%;max-width:640px;margin-bottom:16px">
        <tbody>
          <tr><td style="padding:6px 0;font-weight:600">Order Number</td><td style="padding:6px 0">${escapeHtml(order.orderNumber)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600">Customer</td><td style="padding:6px 0">${escapeHtml(customerName)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600">Customer Email</td><td style="padding:6px 0">${escapeHtml(order.customerEmail)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600">Total Amount</td><td style="padding:6px 0">${escapeHtml(formatMoney(order.totalAmount, order.currency))}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600">Payment Method</td><td style="padding:6px 0">${escapeHtml(paymentMethod)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600">Order Date/Time</td><td style="padding:6px 0">${escapeHtml(orderDate.toISOString())}</td></tr>
        </tbody>
      </table>
      <h3 style="margin:0 0 12px">Products</h3>
      <ul style="padding-left:20px;margin:0 0 20px">${productsHtml}</ul>
      <p style="margin:0">
        <a href="${escapeHtml(orderLink)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:999px">View order in Admin Panel</a>
      </p>
    </div>
  `.trim();

  return {
    subject,
    text,
    html,
    orderLink,
  };
}

function buildAdminTestNotificationEmail() {
  const subject = "OutletHub admin order notification test";
  const text = [
    "This is a test email for the Admin Email Notification Management system.",
    "",
    "If you received this email, SMTP delivery for admin order notifications is working.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 16px">Admin order notification test</h2>
      <p style="margin:0">If you received this email, SMTP delivery for admin order notifications is working.</p>
    </div>
  `.trim();

  return {
    subject,
    text,
    html,
  };
}

function buildProductListText(
  items:
    | Array<{
        title?: string | null;
        quantity?: number | null;
        brandName?: string | null;
        size?: string | null;
        color?: string | null;
      }>
    | undefined,
) {
  if (!items?.length) {
    return "";
  }

  return items
    .map((item) => {
      const title = toOptionalString(item.title) ?? "Product";
      const details = [item.brandName, item.size, item.color].filter(Boolean).join(" / ");
      const quantity = item.quantity ?? 1;
      return `${title}${details ? ` (${details})` : ""} x${quantity}`;
    })
    .join(", ");
}

function buildCustomerName(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fallbackEmail?: string | null;
}) {
  const fullName = toOptionalString(input.fullName);
  if (fullName) {
    return fullName;
  }

  const joinedName = [toOptionalString(input.firstName), toOptionalString(input.lastName)].filter(Boolean).join(" ");
  if (joinedName) {
    return joinedName;
  }

  return toOptionalString(input.fallbackEmail) ?? "Customer";
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function resolveCouponDiscountLabel(input: {
  percentage?: Prisma.Decimal | number | null;
  fixedAmount?: Prisma.Decimal | number | null;
  freeShipping?: boolean | null;
  currency?: string | null;
}) {
  if (typeof input.percentage === "number" && input.percentage > 0) {
    return `${input.percentage}%`;
  }

  if (input.percentage instanceof Prisma.Decimal && input.percentage.greaterThan(0)) {
    return `${Number(input.percentage).toFixed(2)}%`;
  }

  if (typeof input.fixedAmount === "number" && input.fixedAmount > 0) {
    return formatMoney(input.fixedAmount, input.currency ?? "EUR");
  }

  if (input.fixedAmount instanceof Prisma.Decimal && input.fixedAmount.greaterThan(0)) {
    return formatMoney(Number(input.fixedAmount), input.currency ?? "EUR");
  }

  if (input.freeShipping) {
    return "Free Shipping";
  }

  return "";
}

function prettifyEventName(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toNotificationType(category: NotificationCategory, fallback: NotificationType): NotificationType {
  switch (category) {
    case "ORDERS":
      return "ORDER_UPDATE";
    case "PAYMENTS":
      return "PAYMENT_UPDATE";
    case "PROCUREMENT":
      return "PROCUREMENT_UPDATE";
    case "SHIPPING":
      return "SHIPPING_UPDATE";
    case "MARKETING":
      return "MARKETING";
    case "OPERATIONS":
    case "IMPORTS":
    case "MONITORING":
    case "CONNECTORS":
      return "ADMIN_OPERATIONAL";
    case "SYSTEM":
    default:
      return fallback;
  }
}

function toNotificationTitle(input: { title?: string | null; eventName: NotificationEventName }) {
  return toOptionalString(input.title) ?? prettifyEventName(input.eventName);
}

function toNotificationMessage(input: { message?: string | null; eventName: NotificationEventName }) {
  return toOptionalString(input.message) ?? `${prettifyEventName(input.eventName)} recorded.`;
}

function shouldDeliverForPreference(input: {
  category: NotificationCategory;
  channelCode: NotificationChannelCode;
  preference: {
    orderNotifications: boolean;
    paymentNotifications: boolean;
    shippingNotifications: boolean;
    marketingEmails: boolean;
    systemNotifications: boolean;
  };
}) {
  if (input.channelCode === "ADMIN_OPERATIONAL") {
    return true;
  }

  switch (input.category) {
    case "ORDERS":
    case "PROCUREMENT":
      return input.preference.orderNotifications;
    case "PAYMENTS":
      return input.preference.paymentNotifications;
    case "SHIPPING":
      return input.preference.shippingNotifications;
    case "MARKETING":
      return input.channelCode === "EMAIL" ? input.preference.marketingEmails : true;
    case "SYSTEM":
      return input.preference.systemNotifications;
    case "IMPORTS":
    case "MONITORING":
    case "CONNECTORS":
    case "OPERATIONS":
    default:
      return input.preference.systemNotifications;
  }
}

function mergeSamplePayload(
  value: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  overrides: Record<string, unknown>,
) {
  const samplePayload = toJsonRecord(value);
  return {
    ...samplePayload,
    ...overrides,
  };
}

export class NotificationsService {
  public async ensureCatalog(): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const channel of CHANNEL_SEEDS) {
        await tx.notificationChannel.upsert({
          where: { code: channel.code },
          update: {
            displayName: channel.displayName,
            queueName: channel.queueName,
            supportsOpenTracking: channel.supportsOpenTracking,
            supportsRetries: channel.supportsRetries,
          },
          create: {
            code: channel.code,
            displayName: channel.displayName,
            queueName: channel.queueName,
            supportsOpenTracking: channel.supportsOpenTracking,
            supportsRetries: channel.supportsRetries,
          },
        });
      }

      for (const template of TEMPLATE_SEEDS) {
        const existing = await tx.notificationTemplate.findFirst({
          where: {
            key: template.key,
            channelCode: template.channelCode,
          },
          select: {
            id: true,
            version: true,
          },
        });

        if (!existing) {
          const created = await tx.notificationTemplate.create({
            data: {
              key: template.key,
              name: template.name,
              channelCode: template.channelCode,
              category: template.category,
              subjectTemplate: template.subjectTemplate,
              htmlTemplate: template.htmlTemplate,
              textTemplate: template.textTemplate,
              variablesSchema: toNullablePrismaJsonValue(template.variablesSchema),
              samplePayload: toNullablePrismaJsonValue(template.samplePayload),
              version: 1,
              isActive: true,
            },
          });

          await tx.notificationTemplateVersion.create({
            data: {
              templateId: created.id,
              version: 1,
              subjectTemplate: created.subjectTemplate,
              htmlTemplate: created.htmlTemplate,
              textTemplate: created.textTemplate,
              samplePayload: toNullablePrismaJsonValue(created.samplePayload),
              variablesSchema: toNullablePrismaJsonValue(created.variablesSchema),
              changeNotes: "Initial seed",
            },
          });

          continue;
        }

        const versionExists = await tx.notificationTemplateVersion.findUnique({
          where: {
            templateId_version: {
              templateId: existing.id,
              version: existing.version,
            },
          },
        });

        if (!versionExists) {
          await tx.notificationTemplateVersion.create({
            data: {
              templateId: existing.id,
              version: existing.version,
              subjectTemplate: template.subjectTemplate,
              htmlTemplate: template.htmlTemplate,
              textTemplate: template.textTemplate,
              samplePayload: toNullablePrismaJsonValue(template.samplePayload),
              variablesSchema: toNullablePrismaJsonValue(template.variablesSchema),
              changeNotes: "Backfilled current version",
            },
          });
        }
      }
    });
  }

  public async ensurePreferencesForExistingUsers(): Promise<void> {
    const users = await prisma.user.findMany({
      select: {
        id: true,
      },
    });

    for (const user of users) {
      await this.ensureUserPreference(user.id);
    }
  }

  public async ensureUserPreference(userId: string, tx: PrismaExecutor = prisma) {
    return tx.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
      },
    });
  }

  public async publishEvent(input: PublishNotificationEventInput) {
    // #region debug-point A:publish-event-entry
    reportDebugEvent({
      hypothesisId: "A",
      location: "notifications.service.ts:publishEvent",
      msg: "[DEBUG] publishEvent entered",
      data: {
        eventKey: input.eventKey,
        eventName: input.eventName,
        targetUserId: input.targetUserId ?? null,
      },
    });
    // #endregion
    const definition = EVENT_DEFINITIONS[input.eventName];
    if (!definition) {
      throw new ApiError(400, `Unsupported notification event: ${input.eventName}`);
    }

    const existingEvent = await prisma.notificationEvent.findUnique({
      where: { eventKey: input.eventKey },
      select: { id: true },
    });

    if (existingEvent) {
      return prisma.notificationEvent.findUnique({
        where: { id: existingEvent.id },
      });
    }

    const deliveryIds: string[] = [];

    const event = await prisma.$transaction(async (tx) => {
      const targetPreference = input.targetUserId ? await this.ensureUserPreference(input.targetUserId, tx) : null;
      const event = await tx.notificationEvent.create({
        data: {
          eventKey: input.eventKey,
          eventName: input.eventName,
          eventSource: input.eventSource,
          category: definition.category,
          priority: definition.priority,
          actorUserId: input.actorUserId ?? null,
          targetUserId: input.targetUserId ?? null,
          orderId: input.orderId ?? null,
          paymentId: input.paymentId ?? null,
          procurementTaskId: input.procurementTaskId ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          title: toNotificationTitle({ title: input.title, eventName: input.eventName }),
          message: toNotificationMessage({ message: input.message, eventName: input.eventName }),
          metadata: toNullablePrismaJsonValue(input.metadata),
          audits: {
            create: {
              actorUserId: input.actorUserId ?? null,
              action: "EVENT_CREATED",
              eventSource: input.eventSource,
              metadata: toNullablePrismaJsonValue(input.metadata),
            },
          },
        },
      });

      if (input.targetUserId) {
        const allowedCustomerChannels = definition.customerChannels.filter((channelCode) =>
          targetPreference
            ? shouldDeliverForPreference({
                category: definition.category,
                channelCode,
                preference: targetPreference,
              })
            : true,
        );

        if (allowedCustomerChannels.length > 0) {
          // #region debug-point A:publish-event-customer-channels
          reportDebugEvent({
            hypothesisId: "A",
            location: "notifications.service.ts:publishEvent",
            msg: "[DEBUG] publishEvent customer channels resolved",
            data: {
              eventId: event.id,
              eventName: input.eventName,
              allowedCustomerChannels,
              targetUserId: input.targetUserId,
            },
          });
          // #endregion
          const notification = await tx.notification.create({
            data: {
              userId: input.targetUserId,
              eventId: event.id,
              orderId: input.orderId ?? null,
              paymentId: input.paymentId ?? null,
              channelCode: "IN_APP",
              category: definition.category,
              priority: definition.priority,
              type: toNotificationType(definition.category, definition.notificationType),
              title: event.title ?? prettifyEventName(input.eventName),
              message: event.message ?? `${prettifyEventName(input.eventName)} recorded.`,
              entityType: input.entityType ?? null,
              entityId: input.entityId ?? null,
              data: toNullablePrismaJsonValue(input.metadata),
              audits: {
                create: {
                  actorUserId: input.actorUserId ?? null,
                  action: "NOTIFICATION_CREATED",
                  eventSource: input.eventSource,
                  metadata: toNullablePrismaJsonValue(input.metadata),
                },
              },
            },
          });

          for (const channelCode of allowedCustomerChannels) {
            const delivery = await tx.notificationDelivery.create({
              data: {
                eventId: event.id,
                notificationId: notification.id,
                channelCode,
                recipient: channelCode === "EMAIL" ? undefined : input.targetUserId,
                state: "PENDING",
                audits: {
                  create: {
                    actorUserId: input.actorUserId ?? null,
                    action: "DELIVERY_CREATED",
                    eventSource: input.eventSource,
                    metadata: {
                      channelCode,
                    },
                  },
                },
              },
            });

            deliveryIds.push(delivery.id);
          }
        }
      }

      if (definition.adminChannels.length > 0) {
        const adminUsers = await tx.user.findMany({
          where: {
            role: {
              code: {
                in: [RoleCode.SUPER_ADMIN, RoleCode.ADMIN],
              },
            },
          },
          select: {
            id: true,
          },
        });

        for (const adminUser of adminUsers) {
          const notification = await tx.notification.create({
            data: {
              userId: adminUser.id,
              eventId: event.id,
              orderId: input.orderId ?? null,
              paymentId: input.paymentId ?? null,
              channelCode: "ADMIN_OPERATIONAL",
              category:
                definition.category === "ORDERS" ||
                definition.category === "PAYMENTS" ||
                definition.category === "PROCUREMENT" ||
                definition.category === "SHIPPING"
                  ? "OPERATIONS"
                  : definition.category,
              priority: definition.priority,
              type: "ADMIN_OPERATIONAL",
              title: event.title ?? prettifyEventName(input.eventName),
              message: event.message ?? `${prettifyEventName(input.eventName)} recorded.`,
              entityType: input.entityType ?? null,
              entityId: input.entityId ?? null,
              data: toNullablePrismaJsonValue(input.metadata),
            },
          });

          for (const channelCode of definition.adminChannels) {
            const delivery = await tx.notificationDelivery.create({
              data: {
                eventId: event.id,
                notificationId: notification.id,
                channelCode,
                recipient: adminUser.id,
                state: "PENDING",
              },
            });

            deliveryIds.push(delivery.id);
          }
        }
      }

      return event;
    });

    await Promise.all(deliveryIds.map((deliveryId) => this.enqueueDelivery(deliveryId)));
    return event;
  }

  public async enqueueDelivery(deliveryId: string): Promise<void> {
    const delivery = await prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        channelCode: true,
      },
    });

    if (!delivery) {
      // #region debug-point A:enqueue-delivery-missing
      reportDebugEvent({
        hypothesisId: "A",
        location: "notifications.service.ts:enqueueDelivery",
        msg: "[DEBUG] enqueueDelivery could not find delivery",
        data: {
          deliveryId,
        },
      });
      // #endregion
      return;
    }

    const options = {
      jobId: `notification-delivery-${delivery.id}`,
    };

    if (delivery.channelCode === "EMAIL") {
      if (shouldDeliverEmailInline()) {
        await this.processDelivery(delivery.id);
        return;
      }

      // #region debug-point A:enqueue-delivery-email
      reportDebugEvent({
        hypothesisId: "A",
        location: "notifications.service.ts:enqueueDelivery",
        msg: "[DEBUG] enqueueDelivery scheduling email job",
        data: {
          deliveryId: delivery.id,
          channelCode: delivery.channelCode,
        },
      });
      // #endregion
      await notificationEmailQueue.add("deliver-email-notification", { deliveryId: delivery.id }, options);
      return;
    }

    if (delivery.channelCode === "IN_APP") {
      await notificationInAppQueue.add("deliver-in-app-notification", { deliveryId: delivery.id }, options);
      return;
    }

    await notificationAdminOperationalQueue.add(
      "deliver-admin-operational-notification",
      { deliveryId: delivery.id },
      options,
    );
  }

  public async processDelivery(deliveryId: string): Promise<void> {
    // #region debug-point B:process-delivery-entry
    reportDebugEvent({
      hypothesisId: "B",
      location: "notifications.service.ts:processDelivery",
      msg: "[DEBUG] processDelivery entered",
      data: {
        deliveryId,
      },
    });
    // #endregion
    const delivery = await prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        event: {
          include: {
            targetUser: {
              select: {
                id: true,
                email: true,
                fullName: true,
                firstName: true,
                lastName: true,
              },
            },
            order: {
              include: {
                items: true,
                couponApplication: {
                  include: {
                    coupon: true,
                  },
                },
                payments: {
                  orderBy: {
                    createdAt: "desc",
                  },
                },
              },
            },
            payment: {
              include: {
                order: {
                  include: {
                    items: true,
                    couponApplication: {
                      include: {
                        coupon: true,
                      },
                    },
                    payments: {
                      orderBy: {
                        createdAt: "desc",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        notification: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        channel: true,
      },
    });

    if (!delivery) {
      // #region debug-point B:process-delivery-missing
      reportDebugEvent({
        hypothesisId: "B",
        location: "notifications.service.ts:processDelivery",
        msg: "[DEBUG] processDelivery delivery missing",
        data: {
          deliveryId,
        },
      });
      // #endregion
      return;
    }

    const template = await prisma.notificationTemplate.findFirst({
      where: {
        key: delivery.event.eventName,
        channelCode: delivery.channelCode,
        isActive: true,
      },
      orderBy: {
        version: "desc",
      },
    });

    const eventMetadata = toJsonRecord(delivery.event.metadata);
    const order = delivery.event.order ?? delivery.event.payment?.order ?? null;
    const payment = delivery.event.payment ?? order?.payments[0] ?? null;
    const paymentMetadata = toJsonRecord(payment?.metadata);
    const notificationUser = delivery.notification?.user ?? delivery.event.targetUser ?? null;
    const customerName = buildCustomerName({
      fullName: notificationUser?.fullName ?? order?.customerName,
      firstName: notificationUser?.firstName,
      lastName: notificationUser?.lastName,
      fallbackEmail: notificationUser?.email ?? order?.customerEmail ?? delivery.recipient,
    });
    const customerEmail = toOptionalString(notificationUser?.email ?? order?.customerEmail ?? delivery.recipient) ?? "";
    const orderCurrency = toOptionalString(order?.displayCurrency ?? order?.currency ?? payment?.currency) ?? "EUR";
    const paymentCurrency = toOptionalString(payment?.displayCurrency ?? payment?.currency ?? order?.currency) ?? "EUR";
    const couponDiscount = order?.couponApplication
      ? resolveCouponDiscountLabel({
          percentage: order.couponApplication.coupon?.percentage,
          fixedAmount: order.couponApplication.coupon?.fixedAmount,
          freeShipping: order.couponApplication.coupon?.freeShipping,
          currency: order.currency,
        })
      : toOptionalString(String(eventMetadata.couponDiscount ?? "")) ?? "";
    const baseVariables = {
      customerName,
      customerEmail,
      eventName: delivery.event.eventName,
      orderNumber: toOptionalString(order?.orderNumber ?? String(eventMetadata.orderNumber ?? "")) ?? "",
      orderDate: toIsoString(
        order?.createdAt ?? (typeof eventMetadata.orderDate === "string" ? eventMetadata.orderDate : undefined),
      ),
      orderTotal:
        order?.totalAmount !== undefined && order?.totalAmount !== null
          ? formatMoney(Number(order.totalAmount), orderCurrency)
          : payment?.amount !== undefined && payment?.amount !== null
            ? formatMoney(Number(payment.amount), paymentCurrency)
            : toOptionalString(String(eventMetadata.orderTotal ?? "")) ?? "",
      paymentMethod:
        toOptionalString(
          order?.paymentMethodLabel
          ?? (typeof paymentMetadata.paymentMethodLabel === "string" ? paymentMetadata.paymentMethodLabel : null)
          ?? (payment?.provider ? String(payment.provider) : null)
          ?? (order?.paymentProvider ? String(order.paymentProvider) : null),
        ) ?? "",
      paymentStatus: toOptionalString(payment?.status ?? order?.status ?? String(eventMetadata.paymentStatus ?? "")) ?? "",
      paymentAmount:
        payment?.amount !== undefined && payment?.amount !== null
          ? formatMoney(Number(payment.amount), paymentCurrency)
          : eventMetadata.paymentAmount,
      paymentReference:
        toOptionalString(payment?.paymentReference ?? String(eventMetadata.paymentReference ?? "")) ?? "",
      paymentExpiresAt: toIsoString(
        payment?.expiresAt ?? (typeof eventMetadata.paymentExpiresAt === "string" ? eventMetadata.paymentExpiresAt : undefined),
      ),
      trackingNumber:
        toOptionalString(order?.trackingNumber ?? String(eventMetadata.trackingNumber ?? "")) ?? "",
      carrier: toOptionalString(order?.carrier ?? String(eventMetadata.carrier ?? "")) ?? "",
      deliveryDate: toIsoString(
        order?.deliveredAt
        ?? order?.estimatedDeliveryDate
        ?? (typeof eventMetadata.deliveryDate === "string" ? eventMetadata.deliveryDate : undefined),
      ),
      refundAmount:
        order?.refundedAmount !== undefined && order?.refundedAmount !== null && Number(order.refundedAmount) > 0
          ? formatMoney(Number(order.refundedAmount), orderCurrency)
          : toOptionalString(String(eventMetadata.refundAmount ?? "")) ?? "",
      walletBalance: toOptionalString(String(eventMetadata.walletBalance ?? "")) ?? "",
      points: eventMetadata.points ?? eventMetadata.pointsDelta ?? "",
      pointsBalance: eventMetadata.pointsBalance ?? eventMetadata.balanceAfter ?? "",
      couponCode:
        toOptionalString(
          order?.couponApplication?.codeSnapshot
          ?? order?.couponApplication?.coupon?.code
          ?? String(eventMetadata.couponCode ?? ""),
        ) ?? "",
      couponDiscount,
      productList:
        buildProductListText(
          order?.items.map((item) => ({
            title: item.title,
            quantity: item.quantity,
            brandName: item.brandName,
            size: item.size,
            color: item.color,
          })),
        )
        || (toOptionalString(String(eventMetadata.productList ?? "")) ?? ""),
      adminPanelLink: order ? buildAdminOrderLink(order.id) : env.CLIENT_URL,
      productName: toOptionalString(String(eventMetadata.productName ?? "")) ?? "",
      supplierName: toOptionalString(String(eventMetadata.supplierName ?? "")) ?? "",
      rewardTitle: toOptionalString(String(eventMetadata.rewardTitle ?? "")) ?? "",
      resetToken: toOptionalString(String(eventMetadata.resetToken ?? "")) ?? "",
      verificationToken: toOptionalString(String(eventMetadata.verificationToken ?? "")) ?? "",
    };
    const variables = mergeSamplePayload(delivery.event.metadata, {
      ...baseVariables,
      currency: toOptionalString(order?.currency ?? payment?.currency ?? String(eventMetadata.currency ?? "")) ?? "",
    });

    const rendered = renderTemplate({
      subjectTemplate: template?.subjectTemplate ?? (delivery.event.title ?? prettifyEventName(delivery.event.eventName)),
      htmlTemplate: template?.htmlTemplate ?? `<p>${delivery.event.message ?? prettifyEventName(delivery.event.eventName)}</p>`,
      textTemplate: template?.textTemplate ?? (delivery.event.message ?? prettifyEventName(delivery.event.eventName)),
      variables,
    });

    // #region debug-point D:process-delivery-rendered
    reportDebugEvent({
      hypothesisId: "D",
      location: "notifications.service.ts:processDelivery",
      msg: "[DEBUG] processDelivery rendered template",
      data: {
        deliveryId: delivery.id,
        eventName: delivery.event.eventName,
        channelCode: delivery.channelCode,
        hasTemplate: Boolean(template),
        renderedSubject: rendered.subject,
      },
    });
    // #endregion

    const templateMetadata = template
      ? {
          templateId: template.id,
          templateKey: template.key,
          templateName: template.name,
          templateVersion: template.version,
        }
      : {
          templateKey: delivery.event.eventName,
        };

    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        state: NotificationDeliveryState.QUEUED,
        queuedAt: new Date(),
        renderedSubject: rendered.subject,
        renderedBody: rendered.html,
        metadata: toNullablePrismaJsonValue({
          ...toJsonRecord(delivery.metadata),
          ...templateMetadata,
          customerName,
          customerEmail,
          orderNumber: baseVariables.orderNumber,
        }),
      },
    });

    await prisma.notificationAudit.create({
      data: {
        eventId: delivery.eventId,
        notificationId: delivery.notificationId ?? undefined,
        deliveryId: delivery.id,
        action: "DELIVERY_QUEUED",
        eventSource: delivery.event.eventSource,
        metadata: {
          channelCode: delivery.channelCode,
        },
      },
    });

    if (delivery.channelCode === "EMAIL") {
      const recipient = delivery.recipient ?? delivery.notification?.user.email ?? customerEmail;
      if (!recipient) {
        // #region debug-point E:process-delivery-missing-recipient
        reportDebugEvent({
          hypothesisId: "E",
          location: "notifications.service.ts:processDelivery",
          msg: "[DEBUG] processDelivery missing recipient",
          data: {
            deliveryId: delivery.id,
            notificationUserId: delivery.notification?.user.id ?? null,
          },
        });
        // #endregion
        await this.failDelivery(delivery.id, delivery.event, "Recipient email is missing.");
        return;
      }

      // #region debug-point C:process-delivery-before-send
      reportDebugEvent({
        hypothesisId: "C",
        location: "notifications.service.ts:processDelivery",
        msg: "[DEBUG] processDelivery about to send email",
        data: {
          deliveryId: delivery.id,
          recipient,
          smtpHost: env.SMTP_HOST ?? null,
          smtpPort: env.SMTP_PORT ?? 587,
          smtpSecure: env.SMTP_SECURE ?? false,
          smtpFrom: env.SMTP_FROM,
        },
      });
      // #endregion
      const result = await getEmailTransporter().sendMail({
        from: env.SMTP_FROM,
        to: recipient,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });

      const now = new Date();
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          recipient,
          provider: "nodemailer",
          providerMessageId: result.messageId,
          providerResponse: toPrismaJsonValue(result),
          state: NotificationDeliveryState.DELIVERED,
          sentAt: now,
          deliveredAt: now,
        },
      });

      await prisma.notificationAudit.create({
        data: {
          eventId: delivery.eventId,
          notificationId: delivery.notificationId ?? undefined,
          deliveryId: delivery.id,
          action: "DELIVERY_SENT",
          eventSource: delivery.event.eventSource,
          metadata: {
            recipient,
            provider: "nodemailer",
            messageId: result.messageId,
          },
        },
      });
      // #region debug-point C:process-delivery-send-success
      reportDebugEvent({
        hypothesisId: "C",
        location: "notifications.service.ts:processDelivery",
        msg: "[DEBUG] processDelivery email send success",
        data: {
          deliveryId: delivery.id,
          recipient,
          messageId: result.messageId,
        },
      });
      // #endregion
      return;
    }

    const now = new Date();
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        recipient: delivery.recipient ?? delivery.notification?.user.id ?? null,
        provider: delivery.channelCode,
        state: NotificationDeliveryState.DELIVERED,
        sentAt: now,
        deliveredAt: now,
      },
    });

    await prisma.notificationAudit.create({
      data: {
        eventId: delivery.eventId,
        notificationId: delivery.notificationId ?? undefined,
        deliveryId: delivery.id,
        action: "DELIVERY_DELIVERED",
        eventSource: delivery.event.eventSource,
        metadata: {
          channelCode: delivery.channelCode,
        },
      },
    });
  }

  public async failDelivery(
    deliveryId: string,
    event: { id: string; eventSource: NotificationEventSource } | null,
    failureReason: string,
  ): Promise<void> {
    // #region debug-point B:fail-delivery
    reportDebugEvent({
      hypothesisId: "B",
      location: "notifications.service.ts:failDelivery",
      msg: "[DEBUG] failDelivery invoked",
      data: {
        deliveryId,
        eventId: event?.id ?? null,
        failureReason,
      },
    });
    // #endregion
    const fallback = !event?.id
      ? await prisma.notificationDelivery.findUnique({
          where: { id: deliveryId },
          select: {
            notificationId: true,
            event: {
              select: {
                id: true,
                eventSource: true,
              },
            },
          },
        })
      : null;

    const resolvedEvent = event?.id
      ? event
      : fallback?.event
        ? {
            id: fallback.event.id,
            eventSource: fallback.event.eventSource,
          }
        : null;

    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        state: NotificationDeliveryState.FAILED,
        failureReason,
        failedAt: new Date(),
        retryCount: {
          increment: 1,
        },
      },
    });

    await prisma.notificationAudit.create({
      data: {
        eventId: resolvedEvent?.id,
        notificationId: fallback?.notificationId,
        deliveryId,
        action: "DELIVERY_FAILED",
        eventSource: resolvedEvent?.eventSource,
        metadata: {
          failureReason,
        },
      },
    });
  }

  public async listCustomerNotifications(userId: string, filters: NotificationFilters) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.unreadOnly ? { status: "UNREAD" } : {}),
      createdAt:
        filters.dateFrom || filters.dateTo
          ? {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            }
          : undefined,
    };

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          deliveries: {
            orderBy: { createdAt: "desc" },
          },
          event: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.notification.count({
        where: {
          userId,
          status: "UNREAD",
        },
      }),
    ]);

    return {
      unreadCount,
      items: items.map((item) => ({
        id: item.id,
        eventId: item.eventId,
        orderId: item.orderId,
        paymentId: item.paymentId,
        category: item.category,
        priority: item.priority,
        type: item.type,
        status: item.status,
        channelCode: item.channelCode,
        title: item.title,
        message: item.message,
        entityType: item.entityType,
        entityId: item.entityId,
        data: item.data,
        readAt: item.readAt,
        archivedAt: item.archivedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        eventName: item.event?.eventName ?? null,
        deliveries: item.deliveries.map((delivery) => ({
          id: delivery.id,
          channelCode: delivery.channelCode,
          state: delivery.state,
          renderedSubject: delivery.renderedSubject,
          failureReason: delivery.failureReason,
          retryCount: delivery.retryCount,
          sentAt: delivery.sentAt,
          deliveredAt: delivery.deliveredAt,
          openedAt: delivery.openedAt,
          createdAt: delivery.createdAt,
        })),
      })),
    };
  }

  public async markNotificationRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new ApiError(404, "Notification not found.");
    }

    const now = new Date();
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "READ",
        readAt: now,
      },
    });

    await prisma.notificationDelivery.updateMany({
      where: {
        notificationId: notification.id,
        state: {
          in: ["SENT", "DELIVERED"],
        },
      },
      data: {
        state: "OPENED",
        openTimestamp: now,
        openedAt: now,
      },
    });

    await prisma.notificationAudit.create({
      data: {
        notificationId: notification.id,
        actorUserId: userId,
        action: "NOTIFICATION_READ",
      },
    });

    return { id: notification.id, status: "READ" as const, readAt: now };
  }

  public async markAllNotificationsRead(userId: string) {
    const now = new Date();
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        status: "UNREAD",
      },
      select: {
        id: true,
      },
    });

    if (notifications.length === 0) {
      return { updatedCount: 0 };
    }

    const notificationIds = notifications.map((notification) => notification.id);

    await prisma.notification.updateMany({
      where: {
        id: {
          in: notificationIds,
        },
      },
      data: {
        status: "READ",
        readAt: now,
      },
    });

    await prisma.notificationDelivery.updateMany({
      where: {
        notificationId: {
          in: notificationIds,
        },
        state: {
          in: ["SENT", "DELIVERED"],
        },
      },
      data: {
        state: "OPENED",
        openTimestamp: now,
        openedAt: now,
      },
    });

    return {
      updatedCount: notificationIds.length,
    };
  }

  public async getNotificationPreferences(userId: string) {
    const preference = await this.ensureUserPreference(userId);
    return {
      id: preference.id,
      orderNotifications: preference.orderNotifications,
      paymentNotifications: preference.paymentNotifications,
      shippingNotifications: preference.shippingNotifications,
      marketingEmails: preference.marketingEmails,
      systemNotifications: preference.systemNotifications,
      channelSettings: preference.channelSettings,
      createdAt: preference.createdAt,
      updatedAt: preference.updatedAt,
    };
  }

  public async updateNotificationPreferences(
    userId: string,
    input: Partial<{
      orderNotifications: boolean;
      paymentNotifications: boolean;
      shippingNotifications: boolean;
      marketingEmails: boolean;
      systemNotifications: boolean;
    }>,
  ) {
    await this.ensureUserPreference(userId);
    const preference = await prisma.notificationPreference.update({
      where: { userId },
      data: input,
    });

    return {
      id: preference.id,
      orderNotifications: preference.orderNotifications,
      paymentNotifications: preference.paymentNotifications,
      shippingNotifications: preference.shippingNotifications,
      marketingEmails: preference.marketingEmails,
      systemNotifications: preference.systemNotifications,
      channelSettings: preference.channelSettings,
      createdAt: preference.createdAt,
      updatedAt: preference.updatedAt,
    };
  }

  private async readAdminEmailNotificationSettings() {
    const setting = await prisma.setting.findUnique({
      where: { key: ADMIN_EMAIL_NOTIFICATION_SETTING_KEY },
    });

    return resolveAdminEmailNotificationSettings(setting?.value);
  }

  private async writeAdminEmailNotificationSettings(settings: AdminEmailNotificationSettingsRecord) {
    const normalized = {
      enabled: settings.enabled,
      recipients: settings.recipients.map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        email: normalizeEmail(recipient.email),
        isActive: recipient.isActive,
        createdAt: recipient.createdAt,
        updatedAt: recipient.updatedAt,
      })),
    } satisfies AdminEmailNotificationSettingsRecord;

    await prisma.setting.upsert({
      where: { key: ADMIN_EMAIL_NOTIFICATION_SETTING_KEY },
      update: {
        value: toPrismaJsonValue(normalized),
        description: "Admin email notification recipients and enablement for new order emails.",
        isPublic: false,
      },
      create: {
        key: ADMIN_EMAIL_NOTIFICATION_SETTING_KEY,
        value: toPrismaJsonValue(normalized),
        description: "Admin email notification recipients and enablement for new order emails.",
        isPublic: false,
      },
    });

    return normalized;
  }

  private async deliverDirectAdminEmail(input: {
    eventId: string;
    eventSource: NotificationEventSource;
    recipient: AdminEmailNotificationRecipientRecord;
    subject: string;
    html: string;
    text: string;
    metadata?: Record<string, unknown>;
  }) {
    const delivery = await prisma.notificationDelivery.create({
      data: {
        eventId: input.eventId,
        channelCode: "EMAIL",
        recipient: input.recipient.email,
        state: "PENDING",
        renderedSubject: input.subject,
        renderedBody: input.html,
        metadata: toNullablePrismaJsonValue({
          recipientName: input.recipient.name,
          ...input.metadata,
        }),
      },
    });

    try {
      const result = await getEmailTransporter().sendMail({
        from: env.SMTP_FROM,
        to: input.recipient.email,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });

      const now = new Date();
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          provider: "nodemailer",
          providerMessageId: result.messageId,
          providerResponse: toPrismaJsonValue(result),
          state: NotificationDeliveryState.DELIVERED,
          sentAt: now,
          deliveredAt: now,
        },
      });

      await prisma.notificationAudit.create({
        data: {
          eventId: input.eventId,
          deliveryId: delivery.id,
          action: "DELIVERY_SENT",
          eventSource: input.eventSource,
          metadata: {
            recipient: input.recipient.email,
            recipientName: input.recipient.name,
            messageId: result.messageId,
          },
        },
      });

      return {
        deliveryId: delivery.id,
        state: NotificationDeliveryState.DELIVERED,
      };
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : "Unknown email delivery error.";

      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          provider: "nodemailer",
          state: NotificationDeliveryState.FAILED,
          failureReason,
          failedAt: new Date(),
        },
      });

      await prisma.notificationAudit.create({
        data: {
          eventId: input.eventId,
          deliveryId: delivery.id,
          action: "DELIVERY_FAILED",
          eventSource: input.eventSource,
          metadata: {
            recipient: input.recipient.email,
            recipientName: input.recipient.name,
            failureReason,
          },
        },
      });

      return {
        deliveryId: delivery.id,
        state: NotificationDeliveryState.FAILED,
        failureReason,
      };
    }
  }

  public async getAdminEmailNotificationSettings() {
    return this.readAdminEmailNotificationSettings();
  }

  public async updateAdminEmailNotificationSettings(enabled: boolean) {
    const current = await this.readAdminEmailNotificationSettings();
    return this.writeAdminEmailNotificationSettings({
      ...current,
      enabled,
    });
  }

  public async createAdminEmailNotificationRecipient(input: {
    name: string;
    email: string;
    isActive?: boolean;
  }) {
    const current = await this.readAdminEmailNotificationSettings();
    const normalizedEmail = normalizeEmail(input.email);

    if (current.recipients.some((recipient) => normalizeEmail(recipient.email) === normalizedEmail)) {
      throw new ApiError(409, "A recipient with this email already exists.");
    }

    const now = new Date().toISOString();
    const recipient: AdminEmailNotificationRecipientRecord = {
      id: randomUUID(),
      name: input.name.trim(),
      email: normalizedEmail,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await this.writeAdminEmailNotificationSettings({
      ...current,
      recipients: [...current.recipients, recipient],
    });

    return recipient;
  }

  public async updateAdminEmailNotificationRecipient(
    recipientId: string,
    input: Partial<{
      name: string;
      email: string;
      isActive: boolean;
    }>,
  ) {
    const current = await this.readAdminEmailNotificationSettings();
    const existing = current.recipients.find((recipient) => recipient.id === recipientId);

    if (!existing) {
      throw new ApiError(404, "Notification recipient not found.");
    }

    const nextEmail = input.email ? normalizeEmail(input.email) : existing.email;
    if (
      current.recipients.some(
        (recipient) => recipient.id !== recipientId && normalizeEmail(recipient.email) === nextEmail,
      )
    ) {
      throw new ApiError(409, "A recipient with this email already exists.");
    }

    const updated: AdminEmailNotificationRecipientRecord = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      email: nextEmail,
      isActive: input.isActive ?? existing.isActive,
      updatedAt: new Date().toISOString(),
    };

    await this.writeAdminEmailNotificationSettings({
      ...current,
      recipients: current.recipients.map((recipient) => (recipient.id === recipientId ? updated : recipient)),
    });

    return updated;
  }

  public async deleteAdminEmailNotificationRecipient(recipientId: string) {
    const current = await this.readAdminEmailNotificationSettings();
    const exists = current.recipients.some((recipient) => recipient.id === recipientId);

    if (!exists) {
      throw new ApiError(404, "Notification recipient not found.");
    }

    await this.writeAdminEmailNotificationSettings({
      ...current,
      recipients: current.recipients.filter((recipient) => recipient.id !== recipientId),
    });
  }

  public async sendAdminEmailNotificationTestEmail(adminUserId: string) {
    const settings = await this.readAdminEmailNotificationSettings();
    const activeRecipients = settings.recipients.filter((recipient) => recipient.isActive);

    if (activeRecipients.length === 0) {
      throw new ApiError(400, "At least one active recipient is required to send a test email.");
    }

    const event = await prisma.notificationEvent.create({
      data: {
        eventKey: `admin-email-notification-test:${Date.now()}`,
        eventName: "ADMIN_EMAIL_NOTIFICATION_TEST",
        eventSource: "SYSTEM",
        category: "OPERATIONS",
        priority: "LOW",
        actorUserId: adminUserId,
        title: "Admin email notification test",
        message: `Test email queued for ${activeRecipients.length} active recipients.`,
        metadata: toPrismaJsonValue({
          recipientCount: activeRecipients.length,
        }),
      },
    });

    const rendered = buildAdminTestNotificationEmail();
    const deliveries = await Promise.all(
      activeRecipients.map((recipient) =>
        this.deliverDirectAdminEmail({
          eventId: event.id,
          eventSource: "SYSTEM",
          recipient,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          metadata: {
            type: "test",
          },
        }),
      ),
    );

    return {
      eventId: event.id,
      recipientCount: activeRecipients.length,
      deliveredCount: deliveries.filter((delivery) => delivery.state === NotificationDeliveryState.DELIVERED).length,
      failedCount: deliveries.filter((delivery) => delivery.state === NotificationDeliveryState.FAILED).length,
    };
  }

  public async sendAdminOrderCreatedEmailNotification(order: AdminOrderNotificationPayload) {
    const settings = await this.readAdminEmailNotificationSettings();
    if (!settings.enabled) {
      return {
        skipped: true,
        reason: "disabled",
      };
    }

    const activeRecipients = settings.recipients.filter((recipient) => recipient.isActive);
    if (activeRecipients.length === 0) {
      return {
        skipped: true,
        reason: "no-active-recipients",
      };
    }

    const rendered = buildAdminOrderNotificationEmail(order);
    const event = await prisma.notificationEvent.create({
      data: {
        eventKey: `admin-order-email:${order.id}:${Date.now()}`,
        eventName: "ADMIN_ORDER_CREATED_EMAIL",
        eventSource: "ORDERS",
        category: "ORDERS",
        priority: "HIGH",
        orderId: order.id,
        title: `Admin notification for ${order.orderNumber}`,
        message: `Admin email notification queued for order ${order.orderNumber}.`,
        metadata: toPrismaJsonValue({
          orderNumber: order.orderNumber,
          customerEmail: order.customerEmail,
          recipientCount: activeRecipients.length,
          adminOrderLink: rendered.orderLink,
        }),
      },
    });

    const deliveries = await Promise.all(
      activeRecipients.map((recipient) =>
        this.deliverDirectAdminEmail({
          eventId: event.id,
          eventSource: "ORDERS",
          recipient,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          metadata: {
            type: "order-created",
            orderId: order.id,
            orderNumber: order.orderNumber,
          },
        }),
      ),
    );

    return {
      eventId: event.id,
      recipientCount: activeRecipients.length,
      deliveredCount: deliveries.filter((delivery) => delivery.state === NotificationDeliveryState.DELIVERED).length,
      failedCount: deliveries.filter((delivery) => delivery.state === NotificationDeliveryState.FAILED).length,
    };
  }

  public async listAdminNotifications(userId: string, filters: NotificationFilters) {
    return this.listCustomerNotifications(userId, filters);
  }

  private mapEmailTemplateRecord(
    template: Prisma.NotificationTemplateGetPayload<{
      include: {
        versions: true;
      };
    }>,
  ) {
    return {
      id: template.id,
      key: template.key,
      name: template.name,
      category: template.category,
      channelCode: template.channelCode,
      subjectTemplate: template.subjectTemplate,
      htmlTemplate: template.htmlTemplate,
      textTemplate: template.textTemplate,
      variablesSchema: template.variablesSchema,
      samplePayload: template.samplePayload,
      description: template.description,
      version: template.version,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      versions: template.versions.map((version) => ({
        id: version.id,
        version: version.version,
        subjectTemplate: version.subjectTemplate,
        htmlTemplate: version.htmlTemplate,
        textTemplate: version.textTemplate,
        samplePayload: version.samplePayload,
        variablesSchema: version.variablesSchema,
        changeNotes: version.changeNotes,
        createdAt: version.createdAt,
      })),
    };
  }

  private async listEmailTemplatesByEventNames(eventNames?: NotificationEventName[]) {
    const templates = await prisma.notificationTemplate.findMany({
      where: {
        channelCode: "EMAIL",
        ...(eventNames ? { key: { in: eventNames } } : {}),
      },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 20,
        },
      },
      orderBy: [{ key: "asc" }, { updatedAt: "desc" }],
    });

    return templates.map((template) => this.mapEmailTemplateRecord(template));
  }

  public async listEmailTemplates() {
    return this.listEmailTemplatesByEventNames();
  }

  public async listCustomerEmailTemplates() {
    return this.listEmailTemplatesByEventNames(CUSTOMER_EMAIL_EVENT_NAMES);
  }

  public async listCustomerEmailHistory() {
    const deliveries = await prisma.notificationDelivery.findMany({
      where: {
        channelCode: "EMAIL",
        event: {
          eventName: {
            in: CUSTOMER_EMAIL_EVENT_NAMES,
          },
        },
      },
      include: {
        event: {
          include: {
            targetUser: {
              select: {
                id: true,
                email: true,
                fullName: true,
                firstName: true,
                lastName: true,
              },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
              },
            },
          },
        },
        notification: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 250,
    });

    return {
      items: deliveries.map((delivery) => {
        const deliveryMetadata = toJsonRecord(delivery.metadata);
        const notificationUser = delivery.notification?.user ?? delivery.event.targetUser ?? null;
        return {
          id: delivery.id,
          eventId: delivery.eventId,
          eventName: delivery.event.eventName,
          templateId: typeof deliveryMetadata.templateId === "string" ? toOptionalString(deliveryMetadata.templateId) : null,
          templateKey: toOptionalString(String(deliveryMetadata.templateKey ?? "")) ?? delivery.event.eventName,
          templateName:
            typeof deliveryMetadata.templateName === "string" ? toOptionalString(deliveryMetadata.templateName) : null,
          templateVersion:
            typeof deliveryMetadata.templateVersion === "number" ? deliveryMetadata.templateVersion : null,
          customer: notificationUser
            ? {
                id: notificationUser.id,
                name: buildCustomerName({
                  fullName: notificationUser.fullName,
                  firstName: notificationUser.firstName,
                  lastName: notificationUser.lastName,
                  fallbackEmail: notificationUser.email,
                }),
                email: notificationUser.email,
              }
            : null,
          orderId: delivery.event.order?.id ?? null,
          orderNumber: delivery.event.order?.orderNumber ?? null,
          recipient: delivery.recipient,
          state: delivery.state,
          retryCount: delivery.retryCount,
          renderedSubject: delivery.renderedSubject,
          failureReason: delivery.failureReason,
          queuedAt: delivery.queuedAt,
          sentAt: delivery.sentAt,
          deliveredAt: delivery.deliveredAt,
          failedAt: delivery.failedAt,
          createdAt: delivery.createdAt,
        };
      }),
    };
  }

  public async updateEmailTemplate(
    adminUserId: string,
    templateId: string,
    input: Partial<{
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
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new ApiError(404, "Email template not found.");
    }

    const nextVersion = template.version + 1;
    const nextSamplePayload = input.samplePayload ?? toJsonRecord(template.samplePayload);
    const nextVariablesSchema = input.variablesSchema ?? toJsonRecord(template.variablesSchema);
    const updated = await prisma.notificationTemplate.update({
      where: { id: template.id },
      data: {
        name: input.name ?? template.name,
        subjectTemplate: input.subjectTemplate ?? template.subjectTemplate,
        htmlTemplate: input.htmlTemplate ?? template.htmlTemplate,
        textTemplate: input.textTemplate ?? template.textTemplate,
        samplePayload: toNullablePrismaJsonValue(nextSamplePayload),
        variablesSchema: toNullablePrismaJsonValue(nextVariablesSchema),
        description: input.description !== undefined ? input.description : template.description,
        isActive: input.isActive ?? template.isActive,
        version: nextVersion,
        createdByUserId: adminUserId,
        versions: {
          create: {
            version: nextVersion,
            subjectTemplate: input.subjectTemplate ?? template.subjectTemplate,
            htmlTemplate: input.htmlTemplate ?? template.htmlTemplate,
            textTemplate: input.textTemplate ?? template.textTemplate,
            samplePayload: toNullablePrismaJsonValue(nextSamplePayload),
            variablesSchema: toNullablePrismaJsonValue(nextVariablesSchema),
            createdByUserId: adminUserId,
            changeNotes: input.changeNotes ?? "Template updated",
          },
        },
      },
    });

    return updated;
  }

  public async previewEmailTemplate(templateId: string, variables: Record<string, unknown>) {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new ApiError(404, "Email template not found.");
    }

    const merged = mergeSamplePayload(template.samplePayload, variables);
    return renderTemplate({
      subjectTemplate: template.subjectTemplate,
      htmlTemplate: template.htmlTemplate,
      textTemplate: template.textTemplate,
      variables: merged,
    });
  }

  public async previewTemplatePayload(input: TemplatePreviewInput) {
    return renderTemplate({
      subjectTemplate: input.subjectTemplate,
      htmlTemplate: input.htmlTemplate,
      textTemplate: input.textTemplate,
      variables: input.samplePayload,
    });
  }

  public async rollbackEmailTemplate(adminUserId: string, templateId: string, version: number) {
    const [template, sourceVersion] = await Promise.all([
      prisma.notificationTemplate.findUnique({
        where: { id: templateId },
      }),
      prisma.notificationTemplateVersion.findUnique({
        where: {
          templateId_version: {
            templateId,
            version,
          },
        },
      }),
    ]);

    if (!template || !sourceVersion) {
      throw new ApiError(404, "Template version not found.");
    }

    const nextVersion = template.version + 1;
    return prisma.notificationTemplate.update({
      where: { id: template.id },
      data: {
        subjectTemplate: sourceVersion.subjectTemplate,
        htmlTemplate: sourceVersion.htmlTemplate,
        textTemplate: sourceVersion.textTemplate,
        samplePayload: toNullablePrismaJsonValue(sourceVersion.samplePayload),
        variablesSchema: toNullablePrismaJsonValue(sourceVersion.variablesSchema),
        version: nextVersion,
        createdByUserId: adminUserId,
        versions: {
          create: {
            version: nextVersion,
            subjectTemplate: sourceVersion.subjectTemplate,
            htmlTemplate: sourceVersion.htmlTemplate,
            textTemplate: sourceVersion.textTemplate,
            samplePayload: toNullablePrismaJsonValue(sourceVersion.samplePayload),
            variablesSchema: toNullablePrismaJsonValue(sourceVersion.variablesSchema),
            createdByUserId: adminUserId,
            changeNotes: `Rolled back to version ${version}`,
          },
        },
      },
    });
  }

  public async sendTestEmail(adminUserId: string, templateId: string, targetEmail: string, variables: Record<string, unknown>) {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new ApiError(404, "Email template not found.");
    }

    const eventKey = `test-email:${template.id}:${targetEmail}:${Date.now()}`;
    const event = await prisma.notificationEvent.create({
      data: {
        eventKey,
        eventName: template.key,
        eventSource: "SYSTEM",
        category: template.category,
        priority: "LOW",
        actorUserId: adminUserId,
        title: `Test email: ${template.name}`,
        message: `Template ${template.key} test email queued for ${targetEmail}.`,
        metadata: toNullablePrismaJsonValue(variables),
      },
    });

    const delivery = await prisma.notificationDelivery.create({
      data: {
        eventId: event.id,
        channelCode: "EMAIL",
        recipient: targetEmail,
        state: "PENDING",
      },
    });

    await this.enqueueDelivery(delivery.id);
    return {
      eventId: event.id,
      deliveryId: delivery.id,
      state: delivery.state,
    };
  }
}

export const notificationsService = new NotificationsService();
