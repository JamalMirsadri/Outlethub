import { Prisma, StockStatus } from "@prisma/client";

import { prisma } from "../../config/prisma.js";

export interface ProductSnapshot {
  productId: string;
  sourceProductId: string | null;
  sourceUrl: string | null;
  price: string;
  stockStatus: StockStatus;
}

export interface ImportedProductKey {
  sourceProductId: string | null;
  sourceUrl: string | null;
}

export interface DetectedPriceChange {
  productId: string;
  oldPrice: Prisma.Decimal;
  newPrice: Prisma.Decimal;
  changePercent: Prisma.Decimal;
}

export interface DetectedStockChange {
  productId: string;
  oldStatus: StockStatus;
  newStatus: StockStatus;
}

export interface ChangeDetectionResult {
  productsChecked: number;
  productsChanged: number;
  priceChanges: DetectedPriceChange[];
  stockChanges: DetectedStockChange[];
  removedProductIds: string[];
  returnedProductIds: string[];
}

function buildProductKey(input: ImportedProductKey): string | null {
  if (input.sourceProductId) {
    return `id:${input.sourceProductId}`;
  }

  if (input.sourceUrl) {
    return `url:${input.sourceUrl}`;
  }

  return null;
}

function toDecimal(value: string | Prisma.Decimal): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function calculateChangePercent(oldPrice: Prisma.Decimal, newPrice: Prisma.Decimal): Prisma.Decimal {
  if (oldPrice.isZero()) {
    return new Prisma.Decimal(0);
  }

  return newPrice.minus(oldPrice).div(oldPrice).mul(100).toDecimalPlaces(2);
}

export class ChangeDetector {
  public async captureSourceSnapshot(sourceStore: string): Promise<ProductSnapshot[]> {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        sourceStore,
      },
      select: {
        id: true,
        sourceProductId: true,
        sourceUrl: true,
        price: true,
        stockStatus: true,
      },
    });

    return products.map((product) => ({
      productId: product.id,
      sourceProductId: product.sourceProductId,
      sourceUrl: product.sourceUrl,
      price: product.price.toString(),
      stockStatus: product.stockStatus,
    }));
  }

  public async detectChanges(input: {
    sourceStore: string;
    beforeSnapshot: ProductSnapshot[];
    importedProducts: ImportedProductKey[];
  }): Promise<ChangeDetectionResult> {
    const beforeMap = new Map<string, ProductSnapshot>();
    for (const snapshot of input.beforeSnapshot) {
      const key = buildProductKey(snapshot);
      if (key) {
        beforeMap.set(key, snapshot);
      }
    }

    const importedKeySet = new Set<string>();
    for (const product of input.importedProducts) {
      const key = buildProductKey(product);
      if (key) {
        importedKeySet.add(key);
      }
    }

    const currentProducts = await prisma.product.findMany({
      where: {
        deletedAt: null,
        sourceStore: input.sourceStore,
      },
      select: {
        id: true,
        sourceProductId: true,
        sourceUrl: true,
        price: true,
        stockStatus: true,
      },
    });

    const priceChanges: DetectedPriceChange[] = [];
    const stockChanges: DetectedStockChange[] = [];
    const changedProducts = new Set<string>();
    const returnedProductIds: string[] = [];
    const removedProductIds: string[] = [];

    for (const currentProduct of currentProducts) {
      const key = buildProductKey(currentProduct);
      if (!key) {
        continue;
      }

      const previous = beforeMap.get(key);
      if (!previous) {
        continue;
      }

      const previousPrice = toDecimal(previous.price);
      if (!previousPrice.equals(currentProduct.price)) {
        priceChanges.push({
          productId: currentProduct.id,
          oldPrice: previousPrice,
          newPrice: currentProduct.price,
          changePercent: calculateChangePercent(previousPrice, currentProduct.price),
        });
        changedProducts.add(currentProduct.id);
      }

      if (previous.stockStatus !== currentProduct.stockStatus) {
        stockChanges.push({
          productId: currentProduct.id,
          oldStatus: previous.stockStatus,
          newStatus: currentProduct.stockStatus,
        });
        changedProducts.add(currentProduct.id);
        if (previous.stockStatus === StockStatus.OUT_OF_STOCK && currentProduct.stockStatus !== StockStatus.OUT_OF_STOCK) {
          returnedProductIds.push(currentProduct.id);
        }
      }
    }

    const removedSnapshots = input.beforeSnapshot.filter((snapshot) => {
      const key = buildProductKey(snapshot);
      return Boolean(key && !importedKeySet.has(key) && snapshot.stockStatus !== StockStatus.OUT_OF_STOCK);
    });

    if (removedSnapshots.length > 0) {
      await Promise.all(
        removedSnapshots.map((snapshot) =>
          prisma.product.update({
            where: { id: snapshot.productId },
            data: {
              stock: 0,
              stockStatus: StockStatus.OUT_OF_STOCK,
            },
          }),
        ),
      );

      for (const snapshot of removedSnapshots) {
        removedProductIds.push(snapshot.productId);
        changedProducts.add(snapshot.productId);
        stockChanges.push({
          productId: snapshot.productId,
          oldStatus: snapshot.stockStatus,
          newStatus: StockStatus.OUT_OF_STOCK,
        });
      }
    }

    return {
      productsChecked: input.importedProducts.length,
      productsChanged: changedProducts.size,
      priceChanges,
      stockChanges,
      removedProductIds,
      returnedProductIds,
    };
  }
}

export const changeDetector = new ChangeDetector();
