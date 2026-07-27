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

let emailTransporter: Transporter | null = null;

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

        await tx.notificationTemplate.update({
          where: { id: existing.id },
          data: {
            name: template.name,
            category: template.category,
            subjectTemplate: template.subjectTemplate,
            htmlTemplate: template.htmlTemplate,
            textTemplate: template.textTemplate,
            variablesSchema: toNullablePrismaJsonValue(template.variablesSchema),
            samplePayload: toNullablePrismaJsonValue(template.samplePayload),
            isActive: true,
          },
        });

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
        event: true,
        notification: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
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
    const variables = mergeSamplePayload(delivery.event.metadata, {
      customerName: delivery.notification?.user.fullName ?? delivery.notification?.user.email ?? "Customer",
      eventName: delivery.event.eventName,
      orderNumber: eventMetadata.orderNumber,
      paymentAmount: eventMetadata.paymentAmount,
      currency: eventMetadata.currency,
      trackingNumber: eventMetadata.trackingNumber,
      carrier: eventMetadata.carrier,
      productName: eventMetadata.productName,
      supplierName: eventMetadata.supplierName,
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

    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        state: NotificationDeliveryState.QUEUED,
        queuedAt: new Date(),
        renderedSubject: rendered.subject,
        renderedBody: rendered.html,
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
      const recipient = delivery.recipient ?? delivery.notification?.user.email;
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

  public async listAdminNotifications(userId: string, filters: NotificationFilters) {
    return this.listCustomerNotifications(userId, filters);
  }

  public async listEmailTemplates() {
    const templates = await prisma.notificationTemplate.findMany({
      where: {
        channelCode: "EMAIL",
      },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 20,
        },
      },
      orderBy: [{ key: "asc" }, { updatedAt: "desc" }],
    });

    return templates.map((template) => ({
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
    }));
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
