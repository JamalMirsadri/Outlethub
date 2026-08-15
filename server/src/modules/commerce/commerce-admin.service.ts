import {
  Prisma,
  ScraperStatus,
  type BrandSourceStatus,
  type BrandSourceType,
} from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { connectorsService } from "../connectors/connectors.service.js";
import { productMonitoringService } from "../monitoring/product-monitoring.service.js";
import { pricingService } from "./pricing.service.js";
import {
  DEFAULT_SITE_CONTENT_SETTINGS,
  resolveSiteContentSettings,
  type SiteContentSettings,
} from "./site-content.js";

const SITE_CONTENT_SETTING_KEY = "site_content";

function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (!value) {
    return null;
  }

  return Number(value);
}

function mapShippingMethod(method: {
  id: string;
  name: string;
  countryCode: string;
  originCountryCode: string | null;
  currency: string;
  minWeightKg: Prisma.Decimal | null;
  maxWeightKg: Prisma.Decimal | null;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  baseFee: Prisma.Decimal;
  freeShippingThreshold: Prisma.Decimal | null;
  deliveryEstimate: string | null;
  isActive: boolean;
  country?: { code: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: method.id,
    name: method.name,
    countryCode: method.countryCode,
    originCountryCode: method.originCountryCode,
    currency: method.currency,
    minWeightKg: toNumber(method.minWeightKg),
    maxWeightKg: toNumber(method.maxWeightKg),
    minDeliveryDays: method.minDeliveryDays,
    maxDeliveryDays: method.maxDeliveryDays,
    baseFee: toNumber(method.baseFee),
    freeShippingThreshold: toNumber(method.freeShippingThreshold),
    deliveryEstimate: method.deliveryEstimate,
    isActive: method.isActive,
    country: method.country ?? null,
    createdAt: method.createdAt,
    updatedAt: method.updatedAt,
  };
}

function mapBrandSource(source: {
  id: string;
  brandName: string;
  website: string;
  countryCode: string | null;
  currencyCode: string | null;
  region: string | null;
  sourceType: BrandSourceType;
  status: BrandSourceStatus;
  notes: string | null;
  shippingMethodId: string | null;
  shippingMethod?: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: source.id,
    brandName: source.brandName,
    website: source.website,
    countryCode: source.countryCode,
    currencyCode: source.currencyCode,
    region: source.region,
    sourceType: source.sourceType,
    status: source.status,
    notes: source.notes,
    shippingMethodId: source.shippingMethodId,
    shippingMethod: source.shippingMethod ?? null,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export class CommerceAdminService {
  public async getSiteContentSettings() {
    const setting = await prisma.setting.findUnique({
      where: { key: SITE_CONTENT_SETTING_KEY },
    });

    return resolveSiteContentSettings(setting?.value ?? DEFAULT_SITE_CONTENT_SETTINGS);
  }

  public async updateSiteContentSettings(input: SiteContentSettings) {
    const resolved = resolveSiteContentSettings(input);

    const setting = await prisma.setting.upsert({
      where: { key: SITE_CONTENT_SETTING_KEY },
      update: {
        value: resolved,
        description: "Storefront content, homepage content, slideshow, and SEO settings.",
        isPublic: true,
      },
      create: {
        key: SITE_CONTENT_SETTING_KEY,
        value: resolved,
        description: "Storefront content, homepage content, slideshow, and SEO settings.",
        isPublic: true,
      },
    });

    return resolveSiteContentSettings(setting.value);
  }

  public async getCommerceSettings() {
    const [businessSettings, shippingMethods, countries, currencies, sources] = await Promise.all([
      prisma.businessSettings.findFirst({
        include: {
          country: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.shippingMethod.findMany({
        include: {
          country: true,
        },
        orderBy: [{ countryCode: "asc" }, { createdAt: "asc" }],
      }),
      prisma.country.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.currency.findMany({
        orderBy: { code: "asc" },
      }),
      prisma.brandSource.findMany({
        include: {
          shippingMethod: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    if (!businessSettings) {
      throw new ApiError(500, "Business settings are missing.");
    }

    return {
      businessSettings: {
        id: businessSettings.id,
        businessName: businessSettings.businessName,
        supportEmail: businessSettings.supportEmail,
        defaultCurrency: businessSettings.defaultCurrency,
        defaultCountryCode: businessSettings.defaultCountryCode,
        defaultMarginPercent: toNumber(businessSettings.defaultMarginPercent),
        minimumProfitAmount: toNumber(businessSettings.minimumProfitAmount),
        portugalShippingFee: toNumber(businessSettings.portugalShippingFee),
        spainShippingFee: toNumber(businessSettings.spainShippingFee),
        iranShippingFee: toNumber(businessSettings.iranShippingFee),
        fixedProfitAmount: toNumber(businessSettings.fixedProfitAmount),
        handlingFee: toNumber(businessSettings.handlingFee),
        paymentFee: toNumber(businessSettings.paymentFee),
        vatPercent: toNumber(businessSettings.vatPercent),
        freeShippingThreshold: toNumber(businessSettings.freeShippingThreshold),
        minimumOrderValue: toNumber(businessSettings.minimumOrderValue),
        returnPeriodDays: businessSettings.returnPeriodDays,
        country: businessSettings.country,
        createdAt: businessSettings.createdAt,
        updatedAt: businessSettings.updatedAt,
      },
      shippingMethods: shippingMethods.map(mapShippingMethod),
      countries,
      currencies,
      sources: sources.map(mapBrandSource),
    };
  }

  public async updateBusinessSettings(input: {
    businessName?: string;
    supportEmail?: string;
    defaultCurrency?: string;
    defaultCountryCode?: string;
    defaultMarginPercent?: number;
    minimumProfitAmount?: number;
    portugalShippingFee?: number;
    spainShippingFee?: number;
    iranShippingFee?: number;
    fixedProfitAmount?: number;
    handlingFee?: number;
    paymentFee?: number;
    vatPercent?: number;
    freeShippingThreshold?: number;
    minimumOrderValue?: number;
    returnPeriodDays?: number;
  }) {
    const existing = await prisma.businessSettings.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!existing) {
      throw new ApiError(500, "Business settings are missing.");
    }

    const updated = await prisma.businessSettings.update({
      where: { id: existing.id },
      data: {
        businessName: input.businessName,
        supportEmail: input.supportEmail,
        defaultCurrency: input.defaultCurrency,
        defaultCountryCode: input.defaultCountryCode,
        defaultMarginPercent:
          input.defaultMarginPercent !== undefined ? new Prisma.Decimal(input.defaultMarginPercent) : undefined,
        minimumProfitAmount:
          input.minimumProfitAmount !== undefined ? new Prisma.Decimal(input.minimumProfitAmount) : undefined,
        portugalShippingFee:
          input.portugalShippingFee !== undefined ? new Prisma.Decimal(input.portugalShippingFee) : undefined,
        spainShippingFee:
          input.spainShippingFee !== undefined ? new Prisma.Decimal(input.spainShippingFee) : undefined,
        iranShippingFee:
          input.iranShippingFee !== undefined ? new Prisma.Decimal(input.iranShippingFee) : undefined,
        fixedProfitAmount:
          input.fixedProfitAmount !== undefined ? new Prisma.Decimal(input.fixedProfitAmount) : undefined,
        handlingFee: input.handlingFee !== undefined ? new Prisma.Decimal(input.handlingFee) : undefined,
        paymentFee: input.paymentFee !== undefined ? new Prisma.Decimal(input.paymentFee) : undefined,
        vatPercent: input.vatPercent !== undefined ? new Prisma.Decimal(input.vatPercent) : undefined,
        freeShippingThreshold:
          input.freeShippingThreshold !== undefined
            ? new Prisma.Decimal(input.freeShippingThreshold)
            : undefined,
        minimumOrderValue:
          input.minimumOrderValue !== undefined ? new Prisma.Decimal(input.minimumOrderValue) : undefined,
        returnPeriodDays: input.returnPeriodDays,
      },
    });

    await pricingService.repriceCatalogProducts();

    return {
      id: updated.id,
      businessName: updated.businessName,
      supportEmail: updated.supportEmail,
      defaultCurrency: updated.defaultCurrency,
      defaultCountryCode: updated.defaultCountryCode,
      defaultMarginPercent: toNumber(updated.defaultMarginPercent),
      minimumProfitAmount: toNumber(updated.minimumProfitAmount),
      portugalShippingFee: toNumber(updated.portugalShippingFee),
      spainShippingFee: toNumber(updated.spainShippingFee),
      iranShippingFee: toNumber(updated.iranShippingFee),
      fixedProfitAmount: toNumber(updated.fixedProfitAmount),
      handlingFee: toNumber(updated.handlingFee),
      paymentFee: toNumber(updated.paymentFee),
      vatPercent: toNumber(updated.vatPercent),
      freeShippingThreshold: toNumber(updated.freeShippingThreshold),
      minimumOrderValue: toNumber(updated.minimumOrderValue),
      returnPeriodDays: updated.returnPeriodDays,
    };
  }

  public async upsertShippingMethod(input: {
    id?: string;
    name: string;
    countryCode: string;
    originCountryCode?: string | null;
    currency?: string;
    minWeightKg?: number | null;
    maxWeightKg?: number | null;
    minDeliveryDays: number;
    maxDeliveryDays: number;
    baseFee: number;
    freeShippingThreshold?: number | null;
    deliveryEstimate?: string | null;
    isActive?: boolean;
  }) {
    const payload = {
      name: input.name,
      countryCode: input.countryCode,
      originCountryCode: input.originCountryCode ?? null,
      currency: input.currency ?? "EUR",
      minWeightKg:
        input.minWeightKg === null || input.minWeightKg === undefined
          ? null
          : new Prisma.Decimal(input.minWeightKg),
      maxWeightKg:
        input.maxWeightKg === null || input.maxWeightKg === undefined
          ? null
          : new Prisma.Decimal(input.maxWeightKg),
      minDeliveryDays: input.minDeliveryDays,
      maxDeliveryDays: input.maxDeliveryDays,
      baseFee: new Prisma.Decimal(input.baseFee),
      freeShippingThreshold:
        input.freeShippingThreshold === null || input.freeShippingThreshold === undefined
          ? null
          : new Prisma.Decimal(input.freeShippingThreshold),
      deliveryEstimate: input.deliveryEstimate ?? null,
      isActive: input.isActive ?? true,
    };

    const method = input.id
      ? await prisma.shippingMethod.update({
          where: { id: input.id },
          data: payload,
          include: {
            country: true,
          },
        })
      : await prisma.shippingMethod.create({
          data: payload,
          include: {
            country: true,
          },
        });

    return mapShippingMethod(method);
  }

  public async deleteShippingMethod(id: string) {
    await prisma.shippingMethod.delete({
      where: { id },
    });
  }

  public async getProductCommerceDetail(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: true,
        category: true,
        importSource: true,
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    const [pricing, monitoring] = await Promise.all([
      pricingService.calculateProductPricing({
        id: product.id,
        brandId: product.brandId,
        categoryId: product.categoryId,
        supplierPrice: product.supplierPrice,
        fallbackPrice: product.price,
        currency: product.currency,
        useCustomPricing: product.useCustomPricing,
        customPrice: product.customPrice,
      }),
      productMonitoringService.getProductOverview(product.id),
    ]);

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      brand: {
        id: product.brand.id,
        name: product.brand.name,
      },
      category: {
        id: product.category.id,
        name: product.category.name,
      },
      sourceStore: product.sourceStore,
      sourceUrl: product.sourceUrl,
      supplierPrice: toNumber(pricing.supplierPrice),
      customerPrice: toNumber(pricing.customerPrice),
      profitAmount: toNumber(pricing.profitAmount),
      useCustomPricing: product.useCustomPricing,
      customPrice: toNumber(product.customPrice),
      importedAt: product.importedAt,
      lastSyncDate: product.lastSyncedAt,
      monitoring,
      importSource: product.importSource
        ? {
            id: product.importSource.id,
            name: product.importSource.name,
          }
        : null,
    };
  }

  public async updateProductPricingOverride(
    productId: string,
    input: {
      useCustomPricing?: boolean;
      customPrice?: number | null;
    },
  ) {
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        useCustomPricing: input.useCustomPricing,
        customPrice:
          input.customPrice === null
            ? null
            : input.customPrice !== undefined
              ? new Prisma.Decimal(input.customPrice)
              : undefined,
      },
      select: {
        id: true,
      },
    });

    await pricingService.repriceProduct(product.id);
    return this.getProductCommerceDetail(product.id);
  }

  public async getRevenueAnalytics() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [orders, monthlyOrders, topProducts, profitByBrand] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: {
            in: ["PAID", "PROCESSING", "PURCHASED_FROM_SUPPLIER", "SHIPPED", "DELIVERED"],
          },
        },
        _sum: {
          totalAmount: true,
          profitAmount: true,
        },
        _avg: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
          status: {
            in: ["PAID", "PROCESSING", "PURCHASED_FROM_SUPPLIER", "SHIPPED", "DELIVERED"],
          },
        },
        _sum: {
          profitAmount: true,
        },
      }),
      prisma.orderItem.groupBy({
        by: ["productId", "title"],
        _sum: {
          quantity: true,
          profitAmount: true,
          totalPrice: true,
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 10,
      }),
      prisma.orderItem.groupBy({
        by: ["brandName"],
        _sum: {
          profitAmount: true,
          quantity: true,
          totalPrice: true,
        },
        orderBy: {
          _sum: {
            profitAmount: "desc",
          },
        },
        take: 20,
      }),
    ]);

    return {
      totalRevenue: toNumber(orders._sum.totalAmount),
      totalProfit: toNumber(orders._sum.profitAmount),
      ordersCount: orders._count.id,
      averageOrderValue: toNumber(orders._avg.totalAmount),
      monthlyProfit: toNumber(monthlyOrders._sum.profitAmount),
      profitByProduct: topProducts.map((item) => ({
        productId: item.productId,
        title: item.title,
        quantitySold: item._sum.quantity ?? 0,
        revenueAmount: toNumber(item._sum.totalPrice),
        profitAmount: toNumber(item._sum.profitAmount),
      })),
      profitByBrand: profitByBrand.map((item) => ({
        brandName: item.brandName,
        quantitySold: item._sum.quantity ?? 0,
        revenueAmount: toNumber(item._sum.totalPrice),
        profitAmount: toNumber(item._sum.profitAmount),
      })),
      topSellingProducts: topProducts.map((item) => ({
        productId: item.productId,
        title: item.title,
        quantitySold: item._sum.quantity ?? 0,
        revenueAmount: toNumber(item._sum.totalPrice),
        profitAmount: toNumber(item._sum.profitAmount),
      })),
    };
  }

  public async upsertSource(input: {
    id?: string;
    brandName: string;
    website: string;
    countryCode?: string | null;
    currencyCode?: string | null;
    region?: string | null;
    sourceType: BrandSourceType;
    status?: BrandSourceStatus;
    shippingMethodId?: string | null;
    notes?: string | null;
  }) {
    const payload = {
      brandName: input.brandName,
      website: input.website,
      countryCode: input.countryCode ?? null,
      currencyCode: input.currencyCode ?? null,
      region: input.region ?? null,
      sourceType: input.sourceType,
      status: input.status ?? "ACTIVE",
      pricingRuleId: null,
      shippingMethodId: input.shippingMethodId ?? null,
      notes: input.notes ?? null,
    };

    const existingSource =
      input.id
        ? await prisma.brandSource.findUnique({
            where: { id: input.id },
          })
        : await prisma.brandSource.findUnique({
            where: {
              brandName_website: {
                brandName: input.brandName,
                website: input.website,
              },
            },
          });

    const source = existingSource
      ? await prisma.brandSource.update({
          where: { id: existingSource.id },
          data: payload,
          include: {
            shippingMethod: { select: { id: true, name: true } },
          },
        })
      : await prisma.brandSource.create({
          data: payload,
          include: {
            shippingMethod: { select: { id: true, name: true } },
          },
        });

    await connectorsService.ensureConnectorForBrandSourceId(source.id);
    return mapBrandSource(source);
  }

  public async listSources() {
    const sources = await prisma.brandSource.findMany({
      include: {
        shippingMethod: { select: { id: true, name: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return sources.map(mapBrandSource);
  }

  public async deleteSource(id: string) {
    await connectorsService.cleanupForBrandSourceDeletion(id);
    await prisma.brandSource.delete({
      where: { id },
    });
  }

  public async prepareSourceMetadata() {
    const scrapers = await prisma.scraperSource.findMany({
      where: {
        connectorKey: "nike-outlet",
      },
    });

    for (const scraper of scrapers) {
      if (!scraper.countryCode || !scraper.currencyCode || !scraper.region) {
        await prisma.scraperSource.update({
          where: { id: scraper.id },
          data: {
            countryCode: scraper.countryCode ?? "PT",
            currencyCode: scraper.currencyCode ?? "EUR",
            region: scraper.region ?? "EUROPE",
          },
        });
      }
    }
  }
}

export const commerceAdminService = new CommerceAdminService();
