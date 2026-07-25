import { AlertSeverity, AlertType, StockStatus } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { notificationsService } from "../notifications/notifications.service.js";

export class AlertManager {
  public async createAlert(input: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
  }) {
    return prisma.alert.create({
      data: input,
    });
  }

  public async createPriceAlerts(input: {
    sourceStore: string;
    priceChanges: Array<{
      productId: string;
      changePercent: string;
      oldPrice: string;
      newPrice: string;
    }>;
  }): Promise<number> {
    let created = 0;

    for (const change of input.priceChanges) {
      const changePercent = Number(change.changePercent);
      if (!Number.isFinite(changePercent)) {
        continue;
      }

      if (changePercent >= 0 || Math.abs(changePercent) <= 20) {
        continue;
      }

      const product = await prisma.product.findUnique({
        where: { id: change.productId },
        select: { name: true },
      });

      await this.createAlert({
        type: AlertType.PRICE_DROP,
        severity: AlertSeverity.CRITICAL,
        title: `${product?.name ?? "Product"} price dropped`,
        message: `${input.sourceStore}: ${product?.name ?? change.productId} changed from $${change.oldPrice} to $${change.newPrice} (${changePercent.toFixed(2)}%).`,
      });
      created += 1;
    }

    return created;
  }

  public async createStockAlerts(input: {
    sourceStore: string;
    stockChanges: Array<{
      productId: string;
      oldStatus: StockStatus;
      newStatus: StockStatus;
    }>;
  }): Promise<number> {
    let created = 0;

    for (const change of input.stockChanges) {
      if (change.newStatus !== StockStatus.OUT_OF_STOCK) {
        continue;
      }

      const product = await prisma.product.findUnique({
        where: { id: change.productId },
        select: { name: true },
      });

      await this.createAlert({
        type: AlertType.STOCK_CHANGE,
        severity: AlertSeverity.WARNING,
        title: `${product?.name ?? "Product"} is out of stock`,
        message: `${input.sourceStore}: ${product?.name ?? change.productId} changed from ${change.oldStatus} to ${change.newStatus}.`,
      });
      await notificationsService.publishEvent({
        eventKey: `low-stock:${change.productId}:${change.newStatus}:${Date.now()}`,
        eventName: "LOW_STOCK_ALERT",
        eventSource: "MONITORING",
        entityType: "product",
        entityId: change.productId,
        title: `${product?.name ?? "Product"} stock alert`,
        message: `${product?.name ?? change.productId} is now ${change.newStatus}.`,
        metadata: {
          productName: product?.name ?? change.productId,
          supplierName: input.sourceStore,
        },
      });
      created += 1;
    }

    return created;
  }

  public async createSyncFailureAlert(sourceName: string, message: string) {
    await notificationsService.publishEvent({
      eventKey: `failed-sync:${sourceName}:${Date.now()}`,
      eventName: "FAILED_SYNC",
      eventSource: "MONITORING",
      entityType: "sync",
      entityId: sourceName,
      title: `${sourceName} sync failed`,
      message,
      metadata: {
        supplierName: sourceName,
      },
    });

    return this.createAlert({
      type: AlertType.SYNC_FAILURE,
      severity: AlertSeverity.CRITICAL,
      title: `${sourceName} sync failed`,
      message,
    });
  }

  public async createScraperFailureAlert(sourceName: string, message: string) {
    await notificationsService.publishEvent({
      eventKey: `failed-connector:${sourceName}:${Date.now()}`,
      eventName: "FAILED_CONNECTOR",
      eventSource: "CONNECTORS",
      entityType: "connector",
      entityId: sourceName,
      title: `${sourceName} connector failed`,
      message,
      metadata: {
        supplierName: sourceName,
      },
    });

    return this.createAlert({
      type: AlertType.SCRAPER_FAILURE,
      severity: AlertSeverity.CRITICAL,
      title: `${sourceName} scraper failed`,
      message,
    });
  }

  public async listAlerts(limit: number, unreadOnly: boolean) {
    return prisma.alert.findMany({
      where: unreadOnly ? { isRead: false } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  public async markRead(id: string) {
    return prisma.alert.update({
      where: { id },
      data: { isRead: true },
    });
  }
}

export const alertManager = new AlertManager();
