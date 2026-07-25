import { Prisma, ProcurementStatus, type OrderStatus } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { notificationsService } from "../notifications/notifications.service.js";

function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) {
    return 0;
  }

  return Number(value);
}

function toOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toWebsiteOrigin(value: string | null | undefined): string | null {
  const candidate = toOptionalText(value);
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate).origin;
  } catch {
    return candidate;
  }
}

function computeProcurementMetrics(input: {
  quantity: number;
  supplierPrice: number;
  shippingToPortugal: number;
  customsCost: number;
  orderRevenue: number;
  expectedProfit: number;
}) {
  const totalProcurementCost = input.supplierPrice * input.quantity + input.shippingToPortugal + input.customsCost;
  const realProfit = input.orderRevenue - totalProcurementCost;
  const actualMarginPercent = input.orderRevenue > 0 ? Number(((realProfit / input.orderRevenue) * 100).toFixed(2)) : 0;

  return {
    totalProcurementCost,
    realProfit,
    actualMarginPercent,
    expectedProfit: input.expectedProfit,
  };
}

const PROCUREMENT_TASK_ORDER_STATUSES: OrderStatus[] = [
  "PAID",
  "PROCESSING",
  "PURCHASED_FROM_SUPPLIER",
  "SHIPPED",
  "DELIVERED",
];

const ACTIVE_PROCUREMENT_ORDER_STATUSES: OrderStatus[] = ["PAID", "PROCESSING", "PURCHASED_FROM_SUPPLIER"];

function supportsProcurementTasks(status: OrderStatus) {
  return PROCUREMENT_TASK_ORDER_STATUSES.includes(status);
}

function isActiveProcurementOrderStatus(status: OrderStatus) {
  return ACTIVE_PROCUREMENT_ORDER_STATUSES.includes(status);
}

function hasProcurementHistory(order: {
  status: OrderStatus;
  paidAt: Date | null;
  purchasedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  refundedAt: Date | null;
}) {
  return (
    supportsProcurementTasks(order.status) ||
    Boolean(order.paidAt || order.purchasedAt || order.shippedAt || order.deliveredAt || order.refundedAt)
  );
}

function buildTaskStateFromOrder(order: {
  status: OrderStatus;
  createdAt: Date;
  paidAt: Date | null;
  purchasedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
}) {
  if (order.status === "PURCHASED_FROM_SUPPLIER") {
    return {
      status: "PURCHASED_FROM_SUPPLIER" as ProcurementStatus,
      purchasedAt: order.purchasedAt ?? order.paidAt ?? order.createdAt,
      receivedAtWarehouseAt: null,
      readyToShipAt: null,
    };
  }

  if (order.status === "SHIPPED" || order.status === "DELIVERED") {
    const milestone = order.shippedAt ?? order.deliveredAt ?? order.purchasedAt ?? order.paidAt ?? order.createdAt;
    return {
      status: "READY_TO_SHIP" as ProcurementStatus,
      purchasedAt: order.purchasedAt ?? order.paidAt ?? milestone,
      receivedAtWarehouseAt: milestone,
      readyToShipAt: milestone,
    };
  }

  return {
    status: "PURCHASE_REQUIRED" as ProcurementStatus,
    purchasedAt: null,
    receivedAtWarehouseAt: null,
    readyToShipAt: null,
  };
}

function buildStatusTimestamps(task: {
  purchasedAt: Date | null;
  receivedAtWarehouseAt: Date | null;
  readyToShipAt: Date | null;
}, status: ProcurementStatus) {
  const now = new Date();

  if (status === "PURCHASE_REQUIRED") {
    return {
      purchasedAt: null,
      receivedAtWarehouseAt: null,
      readyToShipAt: null,
    };
  }

  if (status === "PURCHASED_FROM_SUPPLIER") {
    return {
      purchasedAt: task.purchasedAt ?? now,
      receivedAtWarehouseAt: null,
      readyToShipAt: null,
    };
  }

  if (status === "RECEIVED_AT_WAREHOUSE") {
    return {
      purchasedAt: task.purchasedAt ?? now,
      receivedAtWarehouseAt: task.receivedAtWarehouseAt ?? now,
      readyToShipAt: null,
    };
  }

  return {
    purchasedAt: task.purchasedAt ?? now,
    receivedAtWarehouseAt: task.receivedAtWarehouseAt ?? now,
    readyToShipAt: task.readyToShipAt ?? now,
  };
}

function deriveOrderProcurementStatus(statuses: ProcurementStatus[]): ProcurementStatus | null {
  if (!statuses.length) {
    return null;
  }

  if (statuses.every((status) => status === "READY_TO_SHIP")) {
    return "READY_TO_SHIP";
  }

  if (statuses.every((status) => status === "RECEIVED_AT_WAREHOUSE" || status === "READY_TO_SHIP")) {
    return "RECEIVED_AT_WAREHOUSE";
  }

  if (
    statuses.every(
      (status) =>
        status === "PURCHASED_FROM_SUPPLIER" || status === "RECEIVED_AT_WAREHOUSE" || status === "READY_TO_SHIP",
    )
  ) {
    return "PURCHASED_FROM_SUPPLIER";
  }

  return "PURCHASE_REQUIRED";
}

async function resolveBrandSourceId(input: {
  supplierName: string | null;
  sourceWebsite: string | null;
}) {
  const orConditions: Prisma.BrandSourceWhereInput[] = [];

  if (input.sourceWebsite) {
    orConditions.push({ website: input.sourceWebsite });
  }

  if (input.supplierName) {
    orConditions.push({ brandName: input.supplierName });
  }

  if (!orConditions.length) {
    return null;
  }

  const brandSource = await prisma.brandSource.findFirst({
    where: {
      OR: orConditions,
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
    },
  });

  return brandSource?.id ?? null;
}

function mapProcurementTask(
  task: Prisma.ProcurementTaskGetPayload<{
    include: {
      order: true;
      orderItem: true;
      product: {
        include: {
          brand: true;
        };
      };
      brandSource: true;
    };
  }>,
) {
  return {
    id: task.id,
    status: task.status,
    supplier: task.supplierName,
    sourceWebsite: task.sourceWebsite,
    productUrl: task.productUrl,
    quantity: task.quantity,
    currency: task.currency,
    supplierPrice: toNumber(task.supplierPrice),
    shippingToPortugal: toNumber(task.shippingToPortugal),
    customsCost: toNumber(task.customsCost),
    totalProcurementCost: toNumber(task.totalProcurementCost),
    expectedProfit: toNumber(task.expectedProfit),
    realProfit: toNumber(task.realProfit),
    actualMargin: toNumber(task.actualMarginPercent),
    notes: task.notes,
    purchasedAt: task.purchasedAt,
    receivedAtWarehouseAt: task.receivedAtWarehouseAt,
    readyToShipAt: task.readyToShipAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    supplierSource: task.brandSource
      ? {
          id: task.brandSource.id,
          brandName: task.brandSource.brandName,
          website: task.brandSource.website,
          countryCode: task.brandSource.countryCode,
        }
      : null,
    customerOrder: {
      id: task.order.id,
      orderNumber: task.order.orderNumber,
      status: task.order.status,
      customerName: task.order.customerName,
      customerEmail: task.order.customerEmail,
      trackingNumber: task.order.trackingNumber,
      totalAmount: toNumber(task.order.totalAmount),
      currency: task.order.currency,
      createdAt: task.order.createdAt,
      shippedAt: task.order.shippedAt,
      deliveredAt: task.order.deliveredAt,
    },
    orderItem: {
      id: task.orderItem.id,
      title: task.orderItem.title,
      brandName: task.orderItem.brandName,
      quantity: task.orderItem.quantity,
      totalPrice: toNumber(task.orderItem.totalPrice),
      customerPaid: toNumber(task.orderItem.customerPaid),
      sourceUrl: task.orderItem.sourceUrl,
      sourceStore: task.orderItem.sourceStore,
      imageUrl: task.orderItem.imageUrl,
    },
    product: task.product
      ? {
          id: task.product.id,
          name: task.product.name,
          brandName: task.product.brand.name,
          sourceUrl: task.product.sourceUrl,
          sourceStore: task.product.sourceStore,
        }
      : null,
    trace: {
      customerPurchasedAt: task.order.createdAt,
      supplierPurchasedAt: task.purchasedAt,
      warehouseReceivedAt: task.receivedAtWarehouseAt,
      readyToShipAt: task.readyToShipAt,
      customerShippedAt: task.order.shippedAt,
      deliveredAt: task.order.deliveredAt,
    },
  };
}

export class ProcurementService {
  private async backfillMissingTasks() {
    const trackedOrders = await prisma.order.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                status: {
                  in: PROCUREMENT_TASK_ORDER_STATUSES,
                },
              },
              { paidAt: { not: null } },
              { purchasedAt: { not: null } },
              { shippedAt: { not: null } },
              { deliveredAt: { not: null } },
              { refundedAt: { not: null } },
            ],
          },
          {
            OR: [
              {
                items: {
                  some: {
                    procurementTask: null,
                  },
                },
              },
              {
                procurementTasks: {
                  some: {
                    status: "PURCHASE_REQUIRED",
                    purchasedAt: null,
                    receivedAtWarehouseAt: null,
                    readyToShipAt: null,
                  },
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
      },
    });

    for (const order of trackedOrders) {
      await this.createTasksForOrder(order.id);
    }
  }

  public async createTasksForOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                importSource: true,
                brand: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new ApiError(404, "Order not found.");
    }

    if (!hasProcurementHistory(order)) {
      return;
    }

    const taskState = buildTaskStateFromOrder(order);

    for (const item of order.items) {
      const supplierName =
        toOptionalText(item.sourceStore) ??
        toOptionalText(item.brandName) ??
        toOptionalText(item.product?.importSource?.brandName) ??
        toOptionalText(item.product?.sourceStore) ??
        toOptionalText(item.product?.brand.name);
      const sourceWebsite =
        toWebsiteOrigin(item.sourceUrl) ??
        toWebsiteOrigin(item.product?.sourceUrl) ??
        toWebsiteOrigin(item.product?.importSource?.website);
      const productUrl = toOptionalText(item.sourceUrl) ?? toOptionalText(item.product?.sourceUrl);
      const brandSourceId = await resolveBrandSourceId({ supplierName, sourceWebsite });
      const orderRevenue = toNumber(item.totalPrice);
      const expectedProfit = toNumber(item.profitAmount) * item.quantity;
      const metrics = computeProcurementMetrics({
        quantity: item.quantity,
        supplierPrice: toNumber(item.supplierCost),
        shippingToPortugal: 0,
        customsCost: 0,
        orderRevenue,
        expectedProfit,
      });

      await prisma.procurementTask.upsert({
        where: {
          orderItemId: item.id,
        },
        update: {
          orderId: order.id,
          productId: item.productId ?? null,
          brandSourceId,
          status: taskState.status,
          supplierName,
          sourceWebsite,
          productUrl,
          quantity: item.quantity,
          currency: item.currency,
          supplierPrice: item.supplierCost,
          totalProcurementCost: new Prisma.Decimal(metrics.totalProcurementCost),
          expectedProfit: new Prisma.Decimal(metrics.expectedProfit),
          realProfit: new Prisma.Decimal(metrics.realProfit),
          actualMarginPercent: new Prisma.Decimal(metrics.actualMarginPercent),
          purchasedAt: taskState.purchasedAt,
          receivedAtWarehouseAt: taskState.receivedAtWarehouseAt,
          readyToShipAt: taskState.readyToShipAt,
        },
        create: {
          orderId: order.id,
          orderItemId: item.id,
          productId: item.productId ?? null,
          brandSourceId,
          status: taskState.status,
          supplierName,
          sourceWebsite,
          productUrl,
          quantity: item.quantity,
          currency: item.currency,
          supplierPrice: item.supplierCost,
          shippingToPortugal: new Prisma.Decimal(0),
          customsCost: new Prisma.Decimal(0),
          totalProcurementCost: new Prisma.Decimal(metrics.totalProcurementCost),
          expectedProfit: new Prisma.Decimal(metrics.expectedProfit),
          realProfit: new Prisma.Decimal(metrics.realProfit),
          actualMarginPercent: new Prisma.Decimal(metrics.actualMarginPercent),
          purchasedAt: taskState.purchasedAt,
          receivedAtWarehouseAt: taskState.receivedAtWarehouseAt,
          readyToShipAt: taskState.readyToShipAt,
        },
      });
    }

    await notificationsService.publishEvent({
      eventKey: `procurement-started:${order.id}`,
      eventName: "PROCUREMENT_STARTED",
      eventSource: "PROCUREMENT",
      targetUserId: order.userId,
      orderId: order.id,
      entityType: "order",
      entityId: order.id,
      title: `Procurement started for ${order.orderNumber}`,
      message: `Procurement started for order ${order.orderNumber}.`,
      metadata: {
        orderNumber: order.orderNumber,
        currency: order.currency,
      },
    });

    await notificationsService.publishEvent({
      eventKey: `procurement-required:${order.id}`,
      eventName: "PROCUREMENT_REQUIRED",
      eventSource: "PROCUREMENT",
      targetUserId: order.userId,
      orderId: order.id,
      entityType: "order",
      entityId: order.id,
      title: `Procurement required for ${order.orderNumber}`,
      message: `Order ${order.orderNumber} is ready for procurement.`,
      metadata: {
        orderNumber: order.orderNumber,
        currency: order.currency,
      },
    });
  }

  public async getDashboard() {
    await this.backfillMissingTasks();

    const tasks = await prisma.procurementTask.findMany({
      include: {
        order: true,
        orderItem: true,
        product: {
          include: {
            brand: true,
          },
        },
        brandSource: true,
      },
      orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
    });
    const activeTasks = tasks.filter((task) => isActiveProcurementOrderStatus(task.order.status));

    const groupedOrders = new Map<string, ProcurementStatus[]>();
    for (const task of activeTasks) {
      const statuses = groupedOrders.get(task.orderId) ?? [];
      statuses.push(task.status);
      groupedOrders.set(task.orderId, statuses);
    }

    const orderStatusCounts = {
      waitingToPurchase: 0,
      purchased: 0,
      received: 0,
      readyToShip: 0,
    };

    for (const statuses of groupedOrders.values()) {
      const status = deriveOrderProcurementStatus(statuses);
      if (status === "PURCHASE_REQUIRED") {
        orderStatusCounts.waitingToPurchase += 1;
      } else if (status === "PURCHASED_FROM_SUPPLIER") {
        orderStatusCounts.purchased += 1;
      } else if (status === "RECEIVED_AT_WAREHOUSE") {
        orderStatusCounts.received += 1;
      } else if (status === "READY_TO_SHIP") {
        orderStatusCounts.readyToShip += 1;
      }
    }

    const profitTotals = activeTasks.reduce(
      (summary, task) => ({
        expectedProfit: summary.expectedProfit + toNumber(task.expectedProfit),
        realProfit: summary.realProfit + toNumber(task.realProfit),
        totalRevenue: summary.totalRevenue + toNumber(task.orderItem.totalPrice),
        totalProcurementCost: summary.totalProcurementCost + toNumber(task.totalProcurementCost),
      }),
      {
        expectedProfit: 0,
        realProfit: 0,
        totalRevenue: 0,
        totalProcurementCost: 0,
      },
    );

    const actualMargin =
      profitTotals.totalRevenue > 0 ? Number(((profitTotals.realProfit / profitTotals.totalRevenue) * 100).toFixed(2)) : 0;

    return {
      summary: {
        totalTasks: activeTasks.length,
        waitingToPurchase: orderStatusCounts.waitingToPurchase,
        purchased: orderStatusCounts.purchased,
        received: orderStatusCounts.received,
        readyToShip: orderStatusCounts.readyToShip,
        expectedProfit: Number(profitTotals.expectedProfit.toFixed(2)),
        realProfit: Number(profitTotals.realProfit.toFixed(2)),
        totalProcurementCost: Number(profitTotals.totalProcurementCost.toFixed(2)),
        actualMargin,
      },
      items: tasks.map(mapProcurementTask),
    };
  }

  public async updateTask(
    taskId: string,
    input: {
      status?: ProcurementStatus;
      supplierPrice?: number;
      shippingToPortugal?: number;
      customsCost?: number;
      notes?: string | null;
    },
  ) {
    const task = await prisma.procurementTask.findUnique({
      where: { id: taskId },
      include: {
        order: true,
        orderItem: true,
        product: {
          include: {
            brand: true,
          },
        },
        brandSource: true,
      },
    });

    if (!task) {
      throw new ApiError(404, "Procurement task not found.");
    }

    const supplierPrice = input.supplierPrice ?? toNumber(task.supplierPrice);
    const shippingToPortugal = input.shippingToPortugal ?? toNumber(task.shippingToPortugal);
    const customsCost = input.customsCost ?? toNumber(task.customsCost);
    const metrics = computeProcurementMetrics({
      quantity: task.quantity,
      supplierPrice,
      shippingToPortugal,
      customsCost,
      orderRevenue: toNumber(task.orderItem.totalPrice),
      expectedProfit: toNumber(task.expectedProfit),
    });
    const timestamps = input.status
      ? buildStatusTimestamps(
          {
            purchasedAt: task.purchasedAt,
            receivedAtWarehouseAt: task.receivedAtWarehouseAt,
            readyToShipAt: task.readyToShipAt,
          },
          input.status,
        )
      : null;

    const updated = await prisma.procurementTask.update({
      where: { id: taskId },
      data: {
        status: input.status,
        supplierPrice: input.supplierPrice !== undefined ? new Prisma.Decimal(input.supplierPrice) : undefined,
        shippingToPortugal:
          input.shippingToPortugal !== undefined ? new Prisma.Decimal(input.shippingToPortugal) : undefined,
        customsCost: input.customsCost !== undefined ? new Prisma.Decimal(input.customsCost) : undefined,
        totalProcurementCost: new Prisma.Decimal(metrics.totalProcurementCost),
        realProfit: new Prisma.Decimal(metrics.realProfit),
        actualMarginPercent: new Prisma.Decimal(metrics.actualMarginPercent),
        notes: input.notes !== undefined ? input.notes : undefined,
        purchasedAt: timestamps ? timestamps.purchasedAt : undefined,
        receivedAtWarehouseAt: timestamps ? timestamps.receivedAtWarehouseAt : undefined,
        readyToShipAt: timestamps ? timestamps.readyToShipAt : undefined,
      },
      include: {
        order: true,
        orderItem: true,
        product: {
          include: {
            brand: true,
          },
        },
        brandSource: true,
      },
    });

    if (input.status && input.status !== task.status) {
      const orderNumber = updated.order.orderNumber;
      const eventMap: Partial<Record<ProcurementStatus, "PURCHASED_FROM_SUPPLIER" | "RECEIVED_AT_WAREHOUSE" | "READY_TO_SHIP">> =
        {
          PURCHASED_FROM_SUPPLIER: "PURCHASED_FROM_SUPPLIER",
          RECEIVED_AT_WAREHOUSE: "RECEIVED_AT_WAREHOUSE",
          READY_TO_SHIP: "READY_TO_SHIP",
        };
      const eventName = eventMap[input.status];

      if (eventName) {
        await notificationsService.publishEvent({
          eventKey: `procurement-milestone:${updated.orderId}:${eventName}`,
          eventName,
          eventSource: "PROCUREMENT",
          targetUserId: updated.order.userId,
          orderId: updated.orderId,
          procurementTaskId: updated.id,
          entityType: "procurementTask",
          entityId: updated.id,
          title: `${prettifyProcurementStatus(eventName)} for ${orderNumber}`,
          message: `${prettifyProcurementStatus(eventName)} for order ${orderNumber}.`,
          metadata: {
            orderNumber,
            supplierName: updated.supplierName,
            productName: updated.orderItem.title,
            currency: updated.order.currency,
          },
        });
      }
    }

    return mapProcurementTask(updated);
  }
}

function prettifyProcurementStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export const procurementService = new ProcurementService();
