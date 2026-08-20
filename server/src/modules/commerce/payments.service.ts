import {
  PaymentKind,
  type OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  type Payment,
  type PaymentProviderConfig,
} from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

import { cloudinary } from "../../config/cloudinary.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { currencyService } from "./currency.service.js";
import { pricingService } from "./pricing.service.js";
import { procurementService } from "./procurement.service.js";
import { notificationsService } from "../notifications/notifications.service.js";

// #region debug-point B:payments-runtime
const DEBUG_SESSION_ID = "payment-runtime-blockers";

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
      source: "server:payments-service",
      ...payload,
    }),
  }).catch(() => undefined);
}
// #endregion debug-point B:payments-runtime

function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) {
    return 0;
  }

  return Number(value);
}

function providerDisplayName(provider: PaymentProvider) {
  switch (provider) {
    case "BANK_TRANSFER":
      return "Bank Transfer";
    case "MB_WAY":
      return "MB Way";
    case "MULTIBANCO":
      return "Multibanco";
    case "PAYPAL":
      return "PayPal";
    case "STRIPE":
      return "Stripe";
    case "MANUAL":
    default:
      return "Manual";
  }
}

function paymentStatusLabel(status: PaymentStatus) {
  return status.replaceAll("_", " ");
}

const EXPIRABLE_BANK_TRANSFER_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.PAYMENT_PENDING,
  PaymentStatus.PAYMENT_REJECTED,
]);

const CANCELLABLE_EXPIRED_ORDER_STATUSES = new Set<OrderStatus>([
  "PENDING",
  "PAYMENT_APPROVED",
]);

function inferReceiptExtension(fileName?: string | null, mimeType?: string | null) {
  const directExtension = fileName ? extname(fileName).trim().toLowerCase() : "";
  if (directExtension) {
    return directExtension;
  }

  switch (mimeType) {
    case "application/pdf":
      return ".pdf";
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    default:
      return ".bin";
  }
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new ApiError(400, "Receipt payload must be a valid base64 data URL.");
  }

  const mimeType = match[1];
  const base64Payload = match[2];
  if (!mimeType || !base64Payload) {
    throw new ApiError(400, "Receipt payload must include mime type and base64 data.");
  }
  return {
    mimeType,
    buffer: Buffer.from(base64Payload, "base64"),
  };
}

function normalizeCurrencyCode(currency?: string | null) {
  return (currency ?? "").trim().toUpperCase();
}

function getExchangeRateSnapshotRate(snapshot: Prisma.JsonValue | null | undefined) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return 0;
  }

  const maybeRate = snapshot.rate;
  return typeof maybeRate === "number" ? maybeRate : 0;
}

const paymentOrderInclude = {
  customerAddress: true,
  items: true,
} as const;

async function incrementProductPurchasesForOrderItems(
  transaction: Prisma.TransactionClient,
  items: Array<{ productId: string | null; quantity: number }>,
) {
  const purchaseTotals = new Map<string, number>();

  for (const item of items) {
    if (!item.productId || item.quantity <= 0) {
      continue;
    }

    purchaseTotals.set(item.productId, (purchaseTotals.get(item.productId) ?? 0) + item.quantity);
  }

  await Promise.all(
    Array.from(purchaseTotals.entries()).map(([productId, quantity]) =>
      transaction.product.update({
        where: { id: productId },
        data: {
          purchases: {
            increment: quantity,
          },
        },
      }),
    ),
  );
}

async function uploadPaymentReceipt(input: {
  dataUrl: string;
  paymentId: string;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  // #region debug-point B:receipt-upload-config
  reportDebugEvent({
    hypothesisId: "B",
    message: "[DEBUG] Receipt upload config check",
    data: {
      paymentId: input.paymentId,
      hasCloudinaryCloudName: Boolean(env.CLOUDINARY_CLOUD_NAME),
      hasCloudinaryApiKey: Boolean(env.CLOUDINARY_API_KEY),
      hasCloudinaryApiSecret: Boolean(env.CLOUDINARY_API_SECRET),
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
    },
  });
  // #endregion debug-point B:receipt-upload-config

  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    const uploadsRoot = resolve(process.cwd(), "uploads", "payments", "receipts");
    const { mimeType, buffer } = decodeDataUrl(input.dataUrl);
    const extension = inferReceiptExtension(input.fileName, input.mimeType ?? mimeType);
    const receiptFileName = `payment-${input.paymentId}-${Date.now()}${extension}`;
    const receiptRelativePath = `payments/receipts/${receiptFileName}`;
    const receiptAbsolutePath = resolve(uploadsRoot, receiptFileName);

    await mkdir(uploadsRoot, { recursive: true });
    await writeFile(receiptAbsolutePath, buffer);

    const receiptUrl = `/uploads/${receiptRelativePath}`;

    // #region debug-point B:receipt-upload-local-fallback
    reportDebugEvent({
      hypothesisId: "B",
      message: "[DEBUG] Receipt upload saved locally",
      data: {
        paymentId: input.paymentId,
        receiptUrl,
        receiptRelativePath,
      },
    });
    // #endregion debug-point B:receipt-upload-local-fallback

    return {
      receiptUrl,
      receiptPublicId: receiptRelativePath,
      receiptFileName: input.fileName ?? receiptFileName,
      receiptMimeType: input.mimeType ?? mimeType,
    };
  }

  const result = await cloudinary.uploader.upload(input.dataUrl, {
    folder: "payments/receipts",
    public_id: `payment-${input.paymentId}-${Date.now()}`,
    resource_type: "auto",
  });

  // #region debug-point B:receipt-upload-success
  reportDebugEvent({
    hypothesisId: "B",
    message: "[DEBUG] Receipt upload success",
    data: {
      paymentId: input.paymentId,
      receiptUrl: result.secure_url,
      receiptPublicId: result.public_id,
      resourceType: result.resource_type,
    },
  });
  // #endregion debug-point B:receipt-upload-success

  return {
    receiptUrl: result.secure_url,
    receiptPublicId: result.public_id,
    receiptFileName: input.fileName ?? null,
    receiptMimeType: input.mimeType ?? result.resource_type ?? null,
  };
}

function mapProviderConfiguration(config: PaymentProviderConfig) {
  return {
    id: config.id,
    code: config.code,
    displayName: config.displayName,
    isActive: config.isActive,
    priority: config.priority,
    supportsReceipts: config.supportsReceipts,
    supportsRefunds: config.supportsRefunds,
    supportsWebhooks: config.supportsWebhooks,
    supportedCurrencies: config.supportedCurrencies,
    settings: config.settings,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

async function publishPaymentEvent(input: {
  eventKey: string;
  eventName:
    | "PAYMENT_INSTRUCTIONS"
    | "RECEIPT_UPLOADED"
    | "NEW_RECEIPT_UPLOAD"
    | "PAYMENT_WAITING_REVIEW"
    | "PAYMENT_APPROVED"
    | "PAYMENT_REJECTED"
    | "PAYMENT_COMPLETED";
  actorUserId?: string | null;
  payment: {
    id: string;
    userId: string;
    orderId: string | null;
    provider: PaymentProvider;
    status: PaymentStatus;
    amount: Prisma.Decimal;
    currency: string;
    displayCurrency?: string | null;
    paymentReference: string | null;
    expiresAt?: Date | null;
    metadata?: Prisma.JsonValue | null;
    order?: {
      id: string;
      orderNumber: string;
      customerEmail: string;
    } | null;
  };
  message: string;
}) {
  const paymentMetadata =
    input.payment.metadata && typeof input.payment.metadata === "object" && !Array.isArray(input.payment.metadata)
      ? (input.payment.metadata as Record<string, unknown>)
      : null;

  await notificationsService.publishEvent({
    eventKey: input.eventKey,
    eventName: input.eventName,
    eventSource: "PAYMENTS",
    actorUserId: input.actorUserId ?? null,
    targetUserId: input.payment.userId,
    orderId: input.payment.orderId,
    paymentId: input.payment.id,
    entityType: "payment",
    entityId: input.payment.id,
    title: input.message,
    message: input.message,
    metadata: {
      orderNumber: input.payment.order?.orderNumber,
      paymentAmount: toNumber(input.payment.amount).toFixed(2),
      currency: input.payment.currency,
      paymentReference: input.payment.paymentReference,
      paymentStatus: input.eventName === "PAYMENT_COMPLETED" ? PaymentStatus.PAID : input.payment.status,
      paymentMethod:
        paymentMetadata && typeof paymentMetadata.paymentMethodLabel === "string"
          ? paymentMetadata.paymentMethodLabel
          : providerDisplayName(input.payment.provider),
      paymentExpiresAt: input.payment.expiresAt?.toISOString(),
    },
  });
}

function mapPayment(payment: Prisma.PaymentGetPayload<{
  include: {
    order: {
      include: typeof paymentOrderInclude;
    };
    providerConfiguration: true;
    transactions: true;
    refunds: true;
    auditLogs: {
      include: {
        actorUser: true;
      };
    };
  };
}>) {
  const effectiveDisplayCurrency = payment.displayCurrency || payment.order?.displayCurrency || payment.currency;
  const effectiveExchangeRate = toNumber(payment.exchangeRate) || getExchangeRateSnapshotRate(payment.order?.exchangeRateSnapshot) || 1;

  return {
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    providerLabel: providerDisplayName(payment.provider),
    providerConfiguration: payment.providerConfiguration ? mapProviderConfiguration(payment.providerConfiguration) : null,
    status: payment.status,
    statusLabel: paymentStatusLabel(payment.status),
    kind: payment.kind,
    currency: payment.currency,
    displayCurrency: effectiveDisplayCurrency,
    amount: toNumber(payment.amount),
    exchangeRate: effectiveExchangeRate,
    paymentReference: payment.paymentReference,
    receiptUrl: payment.receiptUrl,
    receiptFileName: payment.receiptFileName,
    receiptMimeType: payment.receiptMimeType,
    receiptUploadedAt: payment.receiptUploadedAt,
    expiresAt: payment.expiresAt,
    customerNotes: payment.customerNotes,
    internalNotes: payment.internalNotes,
    reviewRequestedAt: payment.reviewRequestedAt,
    approvedAt: payment.approvedAt,
    rejectedAt: payment.rejectedAt,
    processedAt: payment.processedAt,
    metadata: payment.metadata,
    order: payment.order
      ? {
          id: payment.order.id,
          orderNumber: payment.order.orderNumber,
          customerEmail: payment.order.customerEmail,
          status: payment.order.status,
          totalAmount: toNumber(payment.order.totalAmount),
          currency: payment.order.currency,
          displayCurrency: payment.order.displayCurrency,
          customerAddress: payment.order.customerAddress
            ? {
                fullName: payment.order.customerAddress.fullName,
                phone: payment.order.customerAddress.phone,
                countryCode: payment.order.customerAddress.countryCode,
                city: payment.order.customerAddress.city,
                postalCode: payment.order.customerAddress.postalCode,
                addressLine1: payment.order.customerAddress.addressLine1,
                addressLine2: payment.order.customerAddress.addressLine2,
              }
            : null,
          items: payment.order.items.map((item) => ({
            id: item.id,
            title: item.title,
            brandName: item.brandName,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            unitPrice: toNumber(item.unitPrice),
            totalPrice: toNumber(item.totalPrice),
            imageUrl: item.imageUrl,
            sourceUrl: item.sourceUrl,
          })),
        }
      : null,
    transactions: payment.transactions.map((transaction) => ({
      id: transaction.id,
      provider: transaction.provider,
      status: transaction.status,
      kind: transaction.kind,
      amount: toNumber(transaction.amount),
      currency: transaction.currency,
      exchangeRate: toNumber(transaction.exchangeRate),
      externalReference: transaction.externalReference,
      externalTransactionId: transaction.externalTransactionId,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    })),
    refunds: payment.refunds.map((refund) => ({
      id: refund.id,
      provider: refund.provider,
      status: refund.status,
      amount: toNumber(refund.amount),
      currency: refund.currency,
      externalRefundId: refund.externalRefundId,
      reason: refund.reason,
      processedAt: refund.processedAt,
      createdAt: refund.createdAt,
    })),
    auditLogs: payment.auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      notes: log.notes,
      metadata: log.metadata,
      actorUser: log.actorUser
        ? {
            id: log.actorUser.id,
            email: log.actorUser.email,
          }
        : null,
      createdAt: log.createdAt,
    })),
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

export class PaymentsService {
  private async expirePendingBankTransferPayments(filters?: {
    userId?: string;
    paymentId?: string;
  }): Promise<void> {
    const now = new Date();
    const expiredPayments = await prisma.payment.findMany({
      where: {
        provider: PaymentProvider.BANK_TRANSFER,
        status: {
          in: Array.from(EXPIRABLE_BANK_TRANSFER_STATUSES),
        },
        expiresAt: {
          lte: now,
        },
        userId: filters?.userId,
        id: filters?.paymentId,
      },
      select: {
        id: true,
        orderId: true,
      },
    });

    for (const expiredPayment of expiredPayments) {
      const cancelledOrderEvent = await prisma.$transaction(async (transaction) => {
        const payment = await transaction.payment.findUnique({
          where: { id: expiredPayment.id },
          include: {
            order: {
              select: {
                id: true,
                status: true,
                userId: true,
                orderNumber: true,
              },
            },
          },
        });

        if (
          !payment
          || payment.provider !== PaymentProvider.BANK_TRANSFER
          || !payment.expiresAt
          || payment.expiresAt > now
          || !EXPIRABLE_BANK_TRANSFER_STATUSES.has(payment.status)
        ) {
          return null;
        }

        await transaction.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.EXPIRED,
            processedAt: now,
            transactions: {
              create: {
                orderId: payment.orderId,
                providerConfigurationId: payment.providerConfigurationId,
                provider: payment.provider,
                kind: PaymentKind.CHARGE,
                status: PaymentStatus.EXPIRED,
                currency: payment.currency,
                amount: payment.amount,
                exchangeRate: payment.exchangeRate,
                externalReference: payment.paymentReference,
                metadata: {
                  stage: "payment-expired",
                  expiredAt: now.toISOString(),
                },
                failedAt: now,
              },
            },
            auditLogs: {
              create: {
                action: "PAYMENT_EXPIRED",
                fromStatus: payment.status,
                toStatus: PaymentStatus.EXPIRED,
                notes: "Bank transfer payment reservation expired before receipt submission.",
                metadata: {
                  expiredAt: now.toISOString(),
                },
              },
            },
          },
        });

        if (payment.orderId && payment.order && CANCELLABLE_EXPIRED_ORDER_STATUSES.has(payment.order.status)) {
          await transaction.order.update({
            where: { id: payment.orderId },
            data: {
              status: "CANCELLED",
            },
          });

          return {
            orderId: payment.order.id,
            userId: payment.order.userId,
            orderNumber: payment.order.orderNumber,
          };
        }

        return null;
      });

      if (cancelledOrderEvent) {
        await notificationsService.publishEvent({
          eventKey: `order-cancelled:expired-payment:${expiredPayment.id}:${now.toISOString()}`,
          eventName: "ORDER_CANCELLED",
          eventSource: "PAYMENTS",
          targetUserId: cancelledOrderEvent.userId,
          orderId: cancelledOrderEvent.orderId,
          entityType: "order",
          entityId: cancelledOrderEvent.orderId,
          title: `Order ${cancelledOrderEvent.orderNumber} cancelled`,
          message: `Order ${cancelledOrderEvent.orderNumber} was cancelled because the payment expired.`,
          metadata: {
            orderNumber: cancelledOrderEvent.orderNumber,
            paymentStatus: PaymentStatus.EXPIRED,
          },
        });
      }
    }
  }

  public async ensureProviderConfigurations() {
    const defaults: Array<{
      code: PaymentProvider;
      displayName: string;
      priority: number;
      supportsReceipts: boolean;
      supportsRefunds: boolean;
      supportsWebhooks: boolean;
      supportedCurrencies: string[];
    }> = [
      {
        code: "BANK_TRANSFER",
        displayName: "Bank Transfer",
        priority: 100,
        supportsReceipts: true,
        supportsRefunds: false,
        supportsWebhooks: false,
        supportedCurrencies: ["EUR", "IRR", "TOMAN"],
      },
      {
        code: "STRIPE",
        displayName: "Stripe",
        priority: 80,
        supportsReceipts: false,
        supportsRefunds: true,
        supportsWebhooks: true,
        supportedCurrencies: ["EUR"],
      },
      {
        code: "PAYPAL",
        displayName: "PayPal",
        priority: 70,
        supportsReceipts: false,
        supportsRefunds: true,
        supportsWebhooks: true,
        supportedCurrencies: ["EUR"],
      },
      {
        code: "MB_WAY",
        displayName: "MB Way",
        priority: 60,
        supportsReceipts: false,
        supportsRefunds: false,
        supportsWebhooks: true,
        supportedCurrencies: ["EUR"],
      },
      {
        code: "MULTIBANCO",
        displayName: "Multibanco",
        priority: 50,
        supportsReceipts: false,
        supportsRefunds: false,
        supportsWebhooks: true,
        supportedCurrencies: ["EUR"],
      },
    ];

    await Promise.all(
      defaults.map((config) =>
        prisma.paymentProviderConfig.upsert({
          where: { code: config.code },
          update: {
            displayName: config.displayName,
            priority: config.priority,
            supportsReceipts: config.supportsReceipts,
            supportsRefunds: config.supportsRefunds,
            supportsWebhooks: config.supportsWebhooks,
            supportedCurrencies: config.supportedCurrencies,
          },
          create: {
            code: config.code,
            displayName: config.displayName,
            priority: config.priority,
            supportsReceipts: config.supportsReceipts,
            supportsRefunds: config.supportsRefunds,
            supportsWebhooks: config.supportsWebhooks,
            supportedCurrencies: config.supportedCurrencies,
          },
        }),
      ),
    );
  }

  public async getAvailableCheckoutProviders() {
    await this.ensureProviderConfigurations();

    const providers = await prisma.paymentProviderConfig.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ priority: "desc" }, { displayName: "asc" }],
    });

    return providers.map(mapProviderConfiguration);
  }

  public async listAllProviderConfigs() {
    await this.ensureProviderConfigurations();
    const providers = await prisma.paymentProviderConfig.findMany({
      orderBy: [{ priority: "desc" }, { code: "asc" }],
    });
    return providers.map((p) => ({
      id: p.id,
      code: p.code,
      displayName: p.displayName,
      isActive: p.isActive,
      priority: p.priority,
      supportsReceipts: p.supportsReceipts,
      supportsRefunds: p.supportsRefunds,
      supportsWebhooks: p.supportsWebhooks,
      supportedCurrencies: p.supportedCurrencies ?? [],
      settings: p.settings ?? {},
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  public async updateProviderConfig(id: string, input: {
    displayName?: string;
    isActive?: boolean;
    priority?: number;
    supportsReceipts?: boolean;
    supportsRefunds?: boolean;
    supportsWebhooks?: boolean;
    supportedCurrencies?: string[];
    settings?: Record<string, unknown>;
  }) {
    const existing = await prisma.paymentProviderConfig.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Payment provider config not found.");

    const mergedSettings = {
      ...((existing.settings as Record<string, unknown>) ?? {}),
      ...(input.settings ?? {}),
    } as Prisma.InputJsonObject;

    const updated = await prisma.paymentProviderConfig.update({
      where: { id },
      data: {
        displayName: input.displayName ?? undefined,
        isActive: input.isActive ?? undefined,
        priority: input.priority ?? undefined,
        supportsReceipts: input.supportsReceipts ?? undefined,
        supportsRefunds: input.supportsRefunds ?? undefined,
        supportsWebhooks: input.supportsWebhooks ?? undefined,
        supportedCurrencies: input.supportedCurrencies ? (input.supportedCurrencies as unknown as Prisma.InputJsonValue) : undefined,
        settings: input.settings !== undefined ? mergedSettings : undefined,
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      displayName: updated.displayName,
      isActive: updated.isActive,
      priority: updated.priority,
      supportsReceipts: updated.supportsReceipts,
      supportsRefunds: updated.supportsRefunds,
      supportsWebhooks: updated.supportsWebhooks,
      supportedCurrencies: updated.supportedCurrencies ?? [],
      settings: updated.settings ?? {},
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  public async initializeOrderPayment(input: {
    userId: string;
    orderId: string;
    orderCurrency: string;
    displayCurrency: string;
    provider: PaymentProvider;
    amount: Prisma.Decimal;
    paymentMethodLabel?: string | null;
  }) {
    await this.ensureProviderConfigurations();

    const providerConfiguration = await prisma.paymentProviderConfig.findUnique({
      where: { code: input.provider },
    });

    const exchangeRate =
      input.displayCurrency === input.orderCurrency
        ? 1
        : await currencyService.getExchangeRate(input.orderCurrency, input.displayCurrency);

    const paymentReference =
      input.provider === "BANK_TRANSFER"
        ? `BT-${input.orderId.slice(-8).toUpperCase()}`
        : `${input.provider}-${input.orderId.slice(-8).toUpperCase()}`;

    const initialStatus =
      input.provider === "BANK_TRANSFER" ? PaymentStatus.PAYMENT_PENDING : PaymentStatus.PENDING;
    const businessSettings =
      input.provider === "BANK_TRANSFER" ? await pricingService.getBusinessSettings() : null;
    const expiresAt =
      input.provider === "BANK_TRANSFER" && businessSettings
        ? new Date(Date.now() + businessSettings.bankTransferPaymentDeadlineHours * 60 * 60 * 1000)
        : null;

    const payment = await prisma.payment.create({
      data: {
        userId: input.userId,
        orderId: input.orderId,
        providerConfigurationId: providerConfiguration?.id ?? null,
        provider: input.provider,
        kind: PaymentKind.CHARGE,
        status: initialStatus,
        currency: input.orderCurrency,
        displayCurrency: input.displayCurrency,
        amount: input.amount,
        exchangeRate: new Prisma.Decimal(exchangeRate),
        paymentReference,
        expiresAt,
        metadata: {
          paymentMethodLabel: input.paymentMethodLabel ?? providerDisplayName(input.provider),
        },
        transactions: {
          create: {
            orderId: input.orderId,
            providerConfigurationId: providerConfiguration?.id ?? null,
            provider: input.provider,
            kind: PaymentKind.CHARGE,
            status: initialStatus,
            currency: input.orderCurrency,
            amount: input.amount,
            exchangeRate: new Prisma.Decimal(exchangeRate),
            externalReference: paymentReference,
            metadata: {
              stage: "initialize",
            },
          },
        },
        auditLogs: {
          create: {
            actorUserId: input.userId,
            action: "PAYMENT_INITIALIZED",
            toStatus: initialStatus,
            notes: `Initialized via ${providerDisplayName(input.provider)}.`,
            metadata: {
              provider: input.provider,
            },
          },
        },
      },
      include: {
        order: {
          include: paymentOrderInclude,
        },
        providerConfiguration: true,
        transactions: true,
        refunds: true,
        auditLogs: {
          include: {
            actorUser: true,
          },
        },
      },
    });

    if (payment.provider === PaymentProvider.BANK_TRANSFER) {
      void publishPaymentEvent({
        eventKey: `payment-instructions:${payment.id}:${payment.createdAt.toISOString()}`,
        eventName: "PAYMENT_INSTRUCTIONS",
        actorUserId: input.userId,
        payment,
        message: `Payment instructions for ${payment.order?.orderNumber ?? payment.id}`,
      }).catch(() => undefined);
    }

    return mapPayment(payment);
  }

  public async getCustomerPayments(userId: string) {
    await this.expirePendingBankTransferPayments({ userId });

    const payments = await prisma.payment.findMany({
      where: {
        userId,
      },
      include: {
        order: {
          include: paymentOrderInclude,
        },
        providerConfiguration: true,
        transactions: {
          orderBy: { createdAt: "desc" },
        },
        refunds: {
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          include: {
            actorUser: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return payments.map(mapPayment);
  }

  public async uploadReceipt(userId: string, paymentId: string, input: {
    dataUrl: string;
    fileName?: string | null;
    mimeType?: string | null;
    paymentReference?: string | null;
    notes?: string | null;
  }) {
    // #region debug-point B:upload-receipt-start
    reportDebugEvent({
      hypothesisId: "B",
      message: "[DEBUG] Upload receipt start",
      data: {
        userId,
        paymentId,
        paymentReference: input.paymentReference ?? null,
        hasNotes: Boolean(input.notes),
      },
    });
    // #endregion debug-point B:upload-receipt-start

    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId,
      },
      include: {
        order: {
          include: paymentOrderInclude,
        },
      },
    });

    if (!payment) {
      throw new ApiError(404, "Payment not found.");
    }

    if (payment.provider !== "BANK_TRANSFER") {
      throw new ApiError(400, "Receipt upload is only available for bank transfer payments.");
    }

    if (
      payment.expiresAt
      && payment.expiresAt <= new Date()
      && EXPIRABLE_BANK_TRANSFER_STATUSES.has(payment.status)
    ) {
      await this.expirePendingBankTransferPayments({
        userId,
        paymentId: payment.id,
      });
      throw new ApiError(409, "This bank transfer payment reservation has expired.");
    }

    if (!EXPIRABLE_BANK_TRANSFER_STATUSES.has(payment.status)) {
      throw new ApiError(409, "Receipt upload is only available while payment is pending or rejected.");
    }

    const uploaded = await uploadPaymentReceipt({
      dataUrl: input.dataUrl,
      paymentId: payment.id,
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
    });

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAYMENT_PENDING_REVIEW,
        paymentReference: input.paymentReference ?? payment.paymentReference,
        receiptUrl: uploaded.receiptUrl,
        receiptPublicId: uploaded.receiptPublicId,
        receiptFileName: uploaded.receiptFileName,
        receiptMimeType: uploaded.receiptMimeType,
        receiptUploadedAt: new Date(),
        customerNotes: input.notes ?? undefined,
        reviewRequestedAt: new Date(),
        transactions: {
          create: {
            orderId: payment.orderId,
            providerConfigurationId: payment.providerConfigurationId,
            provider: payment.provider,
            kind: PaymentKind.CHARGE,
            status: PaymentStatus.PAYMENT_PENDING_REVIEW,
            currency: payment.currency,
            amount: payment.amount,
            exchangeRate: payment.exchangeRate,
            externalReference: input.paymentReference ?? payment.paymentReference,
            metadata: {
              stage: "receipt-uploaded",
            },
          },
        },
        auditLogs: {
          create: {
            actorUserId: userId,
            action: "PAYMENT_RECEIPT_UPLOADED",
            fromStatus: payment.status,
            toStatus: PaymentStatus.PAYMENT_PENDING_REVIEW,
            notes: input.notes ?? "Customer uploaded a bank transfer receipt.",
          },
        },
      },
      include: {
        order: {
          include: paymentOrderInclude,
        },
        providerConfiguration: true,
        transactions: {
          orderBy: { createdAt: "desc" },
        },
        refunds: {
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          include: {
            actorUser: true,
          },
        },
      },
    });

    // #region debug-point B:upload-receipt-updated
    reportDebugEvent({
      hypothesisId: "B",
      message: "[DEBUG] Upload receipt payment updated",
      data: {
        paymentId: updated.id,
        status: updated.status,
        paymentReference: updated.paymentReference,
        receiptUrl: updated.receiptUrl,
      },
    });
    // #endregion debug-point B:upload-receipt-updated

    void publishPaymentEvent({
      eventKey: `receipt-uploaded:${updated.id}:${updated.receiptUploadedAt?.toISOString() ?? Date.now()}`,
      eventName: "RECEIPT_UPLOADED",
      actorUserId: userId,
      payment: updated,
      message: `Receipt uploaded for ${updated.order?.orderNumber ?? updated.id}`,
    }).catch(() => undefined);
    void publishPaymentEvent({
      eventKey: `new-receipt-upload:${updated.id}:${updated.receiptUploadedAt?.toISOString() ?? Date.now()}`,
      eventName: "NEW_RECEIPT_UPLOAD",
      actorUserId: userId,
      payment: updated,
      message: `New receipt upload for ${updated.order?.orderNumber ?? updated.id}`,
    }).catch(() => undefined);
    void publishPaymentEvent({
      eventKey: `payment-waiting-review:${updated.id}:${updated.reviewRequestedAt?.toISOString() ?? Date.now()}`,
      eventName: "PAYMENT_WAITING_REVIEW",
      actorUserId: userId,
      payment: updated,
      message: `Payment waiting review for ${updated.order?.orderNumber ?? updated.id}`,
    }).catch(() => undefined);

    return mapPayment(updated);
  }

  public async reviewPayment(adminUserId: string, paymentId: string, input: {
    decision: "approve" | "reject";
    internalNotes?: string | null;
  }) {
    // #region debug-point D:review-start
    reportDebugEvent({
      hypothesisId: "D",
      message: "[DEBUG] Review payment start",
      data: {
        adminUserId,
        paymentId,
        decision: input.decision,
        hasInternalNotes: Boolean(input.internalNotes),
      },
    });
    // #endregion debug-point D:review-start

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: paymentOrderInclude,
        },
      },
    });

    if (!payment) {
      throw new ApiError(404, "Payment not found.");
    }

    if (payment.provider !== "BANK_TRANSFER") {
      throw new ApiError(400, "Only bank transfer payments can be reviewed manually.");
    }

    if (payment.status !== PaymentStatus.PAYMENT_PENDING_REVIEW) {
      throw new ApiError(409, "Only payments pending review can be approved or rejected.");
    }

    const approved = input.decision === "approve";
    const transitionTimestamp = new Date();
    const nextStatus = approved ? PaymentStatus.PAYMENT_APPROVED : PaymentStatus.PAYMENT_REJECTED;

    // #region debug-point D:review-transition
    reportDebugEvent({
      hypothesisId: "D",
      message: "[DEBUG] Review payment transition computed",
      data: {
        paymentId,
        previousStatus: payment.status,
        decision: input.decision,
        nextStatus,
      },
    });
    // #endregion debug-point D:review-transition

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        internalNotes: input.internalNotes ?? undefined,
        approvedAt: approved ? transitionTimestamp : undefined,
        rejectedAt: approved ? undefined : transitionTimestamp,
        processedAt: approved ? undefined : transitionTimestamp,
        transactions: {
          create: {
            orderId: payment.orderId,
            providerConfigurationId: payment.providerConfigurationId,
            provider: payment.provider,
            kind: PaymentKind.CHARGE,
            status: nextStatus,
            currency: payment.currency,
            amount: payment.amount,
            exchangeRate: payment.exchangeRate,
            externalReference: payment.paymentReference,
            metadata: {
              stage: approved ? "payment-approved" : "payment-rejected",
            },
            failedAt: approved ? undefined : transitionTimestamp,
          },
        },
        auditLogs: {
          create: {
            actorUserId: adminUserId,
            action: approved ? "PAYMENT_APPROVED" : "PAYMENT_REJECTED",
            fromStatus: payment.status,
            toStatus: nextStatus,
            notes: input.internalNotes ?? null,
            metadata: {
              paymentMethod: payment.provider,
              approvedAt: approved ? transitionTimestamp : null,
              rejectedAt: approved ? null : transitionTimestamp,
            },
          },
        },
      },
      include: {
        order: {
          include: paymentOrderInclude,
        },
        providerConfiguration: true,
        transactions: {
          orderBy: { createdAt: "desc" },
        },
        refunds: {
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          include: {
            actorUser: true,
          },
        },
      },
    });

    if (payment.orderId) {
      if (approved) {
        await prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: "PAYMENT_APPROVED",
          },
        });
      }
    }

    // #region debug-point D:review-complete
    reportDebugEvent({
      hypothesisId: "D",
      message: "[DEBUG] Review payment complete",
      data: {
        paymentId: updated.id,
        status: updated.status,
        approvedAt: updated.approvedAt,
        rejectedAt: updated.rejectedAt,
        processedAt: updated.processedAt,
        orderId: updated.orderId,
      },
    });
    // #endregion debug-point D:review-complete

    await publishPaymentEvent({
      eventKey: `${approved ? "payment-approved" : "payment-rejected"}:${updated.id}:${transitionTimestamp.toISOString()}`,
      eventName: approved ? "PAYMENT_APPROVED" : "PAYMENT_REJECTED",
      actorUserId: adminUserId,
      payment: updated,
      message: `${approved ? "Payment approved" : "Payment rejected"} for ${updated.order?.orderNumber ?? updated.id}`,
    });

    return mapPayment(updated);
  }

  public async completePayment(adminUserId: string, paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: paymentOrderInclude,
        },
      },
    });

    if (!payment) {
      throw new ApiError(404, "Payment not found.");
    }

    if (payment.provider !== "BANK_TRANSFER") {
      throw new ApiError(400, "Only bank transfer payments can be completed manually.");
    }

    if (payment.status !== PaymentStatus.PAYMENT_APPROVED) {
      throw new ApiError(409, "Only approved payments can be completed.");
    }

    const processedAt = new Date();
    const completed = await prisma.$transaction(async (transaction) => {
      const updatedPayment = await transaction.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          processedAt,
          transactions: {
            create: {
              orderId: payment.orderId,
              providerConfigurationId: payment.providerConfigurationId,
              provider: payment.provider,
              kind: PaymentKind.CHARGE,
              status: PaymentStatus.PAID,
              currency: payment.currency,
              amount: payment.amount,
              exchangeRate: payment.exchangeRate,
              externalReference: payment.paymentReference,
              metadata: {
                stage: "payment-completed",
              },
              paidAt: processedAt,
            },
          },
          auditLogs: {
            create: {
              actorUserId: adminUserId,
              action: "PAYMENT_COMPLETED",
              fromStatus: payment.status,
              toStatus: PaymentStatus.PAID,
              notes: payment.internalNotes ?? "Payment completed after approval.",
              metadata: {
                approvedAt: payment.approvedAt,
                paymentMethod: payment.provider,
                approvalNotes: payment.internalNotes ?? null,
              },
            },
          },
        },
        include: {
          order: {
            include: paymentOrderInclude,
          },
          providerConfiguration: true,
          transactions: {
            orderBy: { createdAt: "desc" },
          },
          refunds: {
            orderBy: { createdAt: "desc" },
          },
          auditLogs: {
            orderBy: { createdAt: "desc" },
            include: {
              actorUser: true,
            },
          },
        },
      });

      if (payment.orderId && payment.order && !payment.order.paidAt) {
        await transaction.order.update({
          where: { id: payment.orderId },
          data: {
            status: "PAID",
            paidAt: processedAt,
          },
        });

        await incrementProductPurchasesForOrderItems(transaction, payment.order.items);
      }

      return updatedPayment;
    });

    if (payment.orderId) {
      await procurementService.createTasksForOrder(payment.orderId);
    }

    await publishPaymentEvent({
      eventKey: `payment-completed:${completed.id}:${processedAt.toISOString()}`,
      eventName: "PAYMENT_COMPLETED",
      actorUserId: adminUserId,
      payment: completed,
      message: `Payment completed for ${completed.order?.orderNumber ?? completed.id}`,
    });

    return mapPayment(completed);
  }

  public async getAdminPaymentsDashboard() {
    await this.ensureProviderConfigurations();
    await this.expirePendingBankTransferPayments();

    const [payments, providers] = await Promise.all([
      prisma.payment.findMany({
        include: {
          order: {
            include: paymentOrderInclude,
          },
          providerConfiguration: true,
          transactions: true,
          refunds: true,
          auditLogs: {
            include: {
              actorUser: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.paymentProviderConfig.findMany({
        orderBy: [{ priority: "desc" }, { displayName: "asc" }],
      }),
    ]);

    const revenueByProvider = new Map<string, { eur: number; toman: number; count: number }>();

    for (const payment of payments) {
      const key = payment.provider;
      const summary = revenueByProvider.get(key) ?? { eur: 0, toman: 0, count: 0 };
      const effectiveDisplayCurrency = payment.displayCurrency || payment.order?.displayCurrency || payment.currency;
      if (payment.status === "PAID" || payment.status === "SUCCEEDED") {
        summary.eur += toNumber(payment.amount);
        const rate = toNumber(payment.exchangeRate) || 1;
        summary.toman += effectiveDisplayCurrency === "TOMAN" ? toNumber(payment.amount) * rate : 0;
      }
      summary.count += 1;
      revenueByProvider.set(key, summary);
    }

    const summary = payments.reduce(
      (totals, payment) => {
        const amount = toNumber(payment.amount);
        const rate = toNumber(payment.exchangeRate) || 1;
        const effectiveDisplayCurrency = payment.displayCurrency || payment.order?.displayCurrency || payment.currency;

        if (payment.status === "PAID" || payment.status === "SUCCEEDED") {
          totals.revenueEur += amount;
          if (effectiveDisplayCurrency === "TOMAN") {
            totals.revenueToman += amount * rate;
          }
          totals.successfulPayments += 1;
        }

        if (payment.status === "PAYMENT_APPROVED") {
          totals.approvedAwaitingSettlement += 1;
        }

        if (payment.status === "PAYMENT_PENDING_REVIEW") {
          totals.pendingReviews += 1;
        }

        if (payment.status === "FAILED") {
          totals.failedPayments += 1;
        }

        if (payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") {
          totals.refunds += 1;
        }

        return totals;
      },
      {
        revenueEur: 0,
        revenueToman: 0,
        successfulPayments: 0,
        approvedAwaitingSettlement: 0,
        pendingReviews: 0,
        failedPayments: 0,
        refunds: 0,
      },
    );

    return {
      summary: {
        revenueEur: Number(summary.revenueEur.toFixed(2)),
        revenueToman: Number(summary.revenueToman.toFixed(2)),
        successfulPayments: summary.successfulPayments,
        approvedAwaitingSettlement: summary.approvedAwaitingSettlement,
        pendingReviews: summary.pendingReviews,
        failedPayments: summary.failedPayments,
        refunds: summary.refunds,
      },
      providers: providers.map((provider) => ({
        ...mapProviderConfiguration(provider),
        revenueEur: Number((revenueByProvider.get(provider.code)?.eur ?? 0).toFixed(2)),
        revenueToman: Number((revenueByProvider.get(provider.code)?.toman ?? 0).toFixed(2)),
        paymentCount: revenueByProvider.get(provider.code)?.count ?? 0,
      })),
      items: payments.map(mapPayment),
    };
  }

  public async getPaymentReviewQueue() {
    const payments = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.PAYMENT_PENDING_REVIEW,
      },
      include: {
        order: {
          include: paymentOrderInclude,
        },
        providerConfiguration: true,
        transactions: {
          orderBy: { createdAt: "desc" },
        },
        refunds: {
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          include: {
            actorUser: true,
          },
        },
      },
      orderBy: { reviewRequestedAt: "asc" },
    });

    return payments.map(mapPayment);
  }

  public async listBankAccounts() {
    const accounts = await prisma.bankAccount.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    // #region debug-point E:list-bank-accounts
    reportDebugEvent({
      hypothesisId: "E",
      message: "[DEBUG] Bank accounts listed",
      data: {
        count: accounts.length,
        activeCount: accounts.filter((account) => account.isActive).length,
      },
    });
    // #endregion debug-point E:list-bank-accounts

    return accounts.map((account) => ({
      id: account.id,
      bankName: account.bankName,
      accountHolder: account.accountHolder,
      iban: account.iban,
      accountNumber: account.accountNumber,
      cardNumber: account.cardNumber,
      swift: account.swift,
      country: account.country,
      currency: account.currency,
      isActive: account.isActive,
      notes: account.notes,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }));
  }

  public async upsertBankAccount(input: {
    id?: string;
    bankName: string;
    accountHolder: string;
    iban?: string | null;
    accountNumber?: string | null;
    cardNumber?: string | null;
    swift?: string | null;
    country: string;
    currency: string;
    isActive?: boolean;
    notes?: string | null;
  }) {
    const account = input.id
      ? await prisma.bankAccount.update({
          where: { id: input.id },
          data: {
            bankName: input.bankName,
            accountHolder: input.accountHolder,
            iban: input.iban ?? null,
            accountNumber: input.accountNumber ?? null,
            cardNumber: input.cardNumber ?? null,
            swift: input.swift ?? null,
            country: input.country,
            currency: input.currency,
            isActive: input.isActive ?? true,
            notes: input.notes ?? null,
          },
        })
      : await prisma.bankAccount.create({
          data: {
            bankName: input.bankName,
            accountHolder: input.accountHolder,
            iban: input.iban ?? null,
            accountNumber: input.accountNumber ?? null,
            cardNumber: input.cardNumber ?? null,
            swift: input.swift ?? null,
            country: input.country,
            currency: input.currency,
            isActive: input.isActive ?? true,
            notes: input.notes ?? null,
          },
        });

    return {
      id: account.id,
      bankName: account.bankName,
      accountHolder: account.accountHolder,
      iban: account.iban,
      accountNumber: account.accountNumber,
      cardNumber: account.cardNumber,
      swift: account.swift,
      country: account.country,
      currency: account.currency,
      isActive: account.isActive,
      notes: account.notes,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  public async deleteBankAccount(id: string) {
    await prisma.bankAccount.delete({
      where: { id },
    });
  }

  public async listExchangeRates() {
    const rates = await prisma.exchangeRate.findMany({
      orderBy: [{ baseCurrency: "asc" }, { quoteCurrency: "asc" }],
    });

    // #region debug-point E:list-exchange-rates
    reportDebugEvent({
      hypothesisId: "E",
      message: "[DEBUG] Exchange rates listed",
      data: {
        count: rates.length,
        eurToTomanActive: rates.some(
          (rate) => rate.baseCurrency === "EUR" && rate.quoteCurrency === "TOMAN" && rate.isActive,
        ),
      },
    });
    // #endregion debug-point E:list-exchange-rates

    return rates.map((rate) => ({
      id: rate.id,
      baseCurrency: normalizeCurrencyCode(rate.baseCurrency),
      quoteCurrency: normalizeCurrencyCode(rate.quoteCurrency),
      rate: toNumber(rate.rate),
      isActive: rate.isActive,
      updatedByUserId: rate.updatedByUserId,
      notes: rate.notes,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    }));
  }

  public async upsertExchangeRate(adminUserId: string, input: {
    id?: string;
    baseCurrency: string;
    quoteCurrency: string;
    rate: number;
    isActive?: boolean;
    notes?: string | null;
  }) {
    const normalizedBaseCurrency = normalizeCurrencyCode(input.baseCurrency);
    const normalizedQuoteCurrency = normalizeCurrencyCode(input.quoteCurrency);
    const exchangeRate = input.id
      ? await prisma.exchangeRate.update({
          where: { id: input.id },
          data: {
            baseCurrency: normalizedBaseCurrency,
            quoteCurrency: normalizedQuoteCurrency,
            rate: new Prisma.Decimal(input.rate),
            isActive: input.isActive ?? true,
            updatedByUserId: adminUserId,
            notes: input.notes ?? null,
          },
        })
      : await prisma.exchangeRate.upsert({
          where: {
            baseCurrency_quoteCurrency: {
              baseCurrency: normalizedBaseCurrency,
              quoteCurrency: normalizedQuoteCurrency,
            },
          },
          update: {
            rate: new Prisma.Decimal(input.rate),
            isActive: input.isActive ?? true,
            updatedByUserId: adminUserId,
            notes: input.notes ?? null,
          },
          create: {
            baseCurrency: normalizedBaseCurrency,
            quoteCurrency: normalizedQuoteCurrency,
            rate: new Prisma.Decimal(input.rate),
            isActive: input.isActive ?? true,
            updatedByUserId: adminUserId,
            notes: input.notes ?? null,
          },
        });

    return {
      id: exchangeRate.id,
      baseCurrency: exchangeRate.baseCurrency,
      quoteCurrency: exchangeRate.quoteCurrency,
      rate: toNumber(exchangeRate.rate),
      isActive: exchangeRate.isActive,
      updatedByUserId: exchangeRate.updatedByUserId,
      notes: exchangeRate.notes,
      createdAt: exchangeRate.createdAt,
      updatedAt: exchangeRate.updatedAt,
    };
  }
}

export const paymentsService = new PaymentsService();
