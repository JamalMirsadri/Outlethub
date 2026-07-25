import { Prisma, SyncRunStatus } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { alertManager } from "./alert-manager.js";
import { changeDetector, type ImportedProductKey, type ProductSnapshot } from "./change-detector.js";

export class PriceMonitor {
  public async processSyncResult(input: {
    syncRunId: string;
    sourceId: string;
    sourceStore: string;
    beforeSnapshot: ProductSnapshot[];
    importedProducts: ImportedProductKey[];
  }) {
    const detection = await changeDetector.detectChanges({
      sourceStore: input.sourceStore,
      beforeSnapshot: input.beforeSnapshot,
      importedProducts: input.importedProducts,
    });

    if (detection.priceChanges.length > 0) {
      await prisma.priceChange.createMany({
        data: detection.priceChanges.map((change) => ({
          productId: change.productId,
          oldPrice: change.oldPrice,
          newPrice: change.newPrice,
          changePercent: change.changePercent,
        })),
      });
    }

    if (detection.stockChanges.length > 0) {
      await prisma.stockChange.createMany({
        data: detection.stockChanges.map((change) => ({
          productId: change.productId,
          oldStatus: change.oldStatus,
          newStatus: change.newStatus,
        })),
      });
    }

    const alertCount =
      (await alertManager.createPriceAlerts({
        sourceStore: input.sourceStore,
        priceChanges: detection.priceChanges.map((change) => ({
          productId: change.productId,
          oldPrice: change.oldPrice.toFixed(2),
          newPrice: change.newPrice.toFixed(2),
          changePercent: change.changePercent.toFixed(2),
        })),
      })) +
      (await alertManager.createStockAlerts({
        sourceStore: input.sourceStore,
        stockChanges: detection.stockChanges,
      }));

    await prisma.syncRun.update({
      where: { id: input.syncRunId },
      data: {
        status: SyncRunStatus.COMPLETED,
        completedAt: new Date(),
        productsChecked: input.importedProducts.length,
        productsChanged: detection.productsChanged,
      },
    });

    return {
      ...detection,
      alertCount,
    };
  }

  public async failSyncRun(syncRunId: string) {
    await prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: SyncRunStatus.FAILED,
        completedAt: new Date(),
      },
    });
  }

  public async getPriceChangeStats(sourceStore: string) {
    const [count, drops, increases] = await Promise.all([
      prisma.priceChange.count({
        where: {
          product: {
            sourceStore,
            deletedAt: null,
          },
        },
      }),
      prisma.priceChange.count({
        where: {
          changePercent: {
            lt: new Prisma.Decimal(0),
          },
          product: {
            sourceStore,
            deletedAt: null,
          },
        },
      }),
      prisma.priceChange.count({
        where: {
          changePercent: {
            gt: new Prisma.Decimal(0),
          },
          product: {
            sourceStore,
            deletedAt: null,
          },
        },
      }),
    ]);

    return {
      count,
      drops,
      increases,
    };
  }
}

export const priceMonitor = new PriceMonitor();
