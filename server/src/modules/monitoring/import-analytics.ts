import { Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";

export class ImportAnalytics {
  public async getSummary(sourceStore: string) {
    const [importedProducts, activeProducts, priceChangeCount, averageDiscount, topDeals] = await Promise.all([
      prisma.product.count({
        where: {
          sourceStore,
        },
      }),
      prisma.product.count({
        where: {
          sourceStore,
          deletedAt: null,
          stockStatus: {
            not: "OUT_OF_STOCK",
          },
        },
      }),
      prisma.priceChange.count({
        where: {
          product: {
            sourceStore,
          },
        },
      }),
      prisma.product.aggregate({
        where: {
          sourceStore,
          deletedAt: null,
        },
        _avg: {
          discountPercent: true,
        },
      }),
      prisma.product.findMany({
        where: {
          sourceStore,
          deletedAt: null,
        },
        orderBy: [{ discountPercent: "desc" }, { updatedAt: "desc" }],
        take: 5,
        select: {
          id: true,
          name: true,
          price: true,
          oldPrice: true,
          discountPercent: true,
          dealLevel: true,
          sourceUrl: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      importedProducts,
      activeProducts,
      priceChangeCount,
      averageDiscount: Number(averageDiscount._avg.discountPercent ?? 0),
      topDeals: topDeals.map((product) => ({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        oldPrice: product.oldPrice ? Number(product.oldPrice) : null,
        discountPercent: product.discountPercent ?? 0,
        dealLevel: product.dealLevel,
        sourceUrl: product.sourceUrl,
        updatedAt: product.updatedAt,
      })),
    };
  }
}

export const importAnalytics = new ImportAnalytics();
