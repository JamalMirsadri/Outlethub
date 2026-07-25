import { Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

function decimal(value: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }

  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) {
    return 0;
  }

  return Number(value);
}

export interface ProductPricingInput {
  id?: string;
  brandId: string;
  categoryId: string;
  supplierPrice?: Prisma.Decimal | number | null;
  fallbackPrice?: Prisma.Decimal | number | null;
  currency?: string | null;
  useCustomPricing?: boolean;
  customPrice?: Prisma.Decimal | number | null;
}

export interface ProductPricingResult {
  supplierPrice: Prisma.Decimal;
  customerPrice: Prisma.Decimal;
  profitAmount: Prisma.Decimal;
  currency: string;
  marginPercent: Prisma.Decimal;
  localShippingFee: Prisma.Decimal;
  internationalShippingFee: Prisma.Decimal;
  handlingFee: Prisma.Decimal;
  minimumProfitAmount: Prisma.Decimal;
  vatPercent: Prisma.Decimal;
  pricingRuleId: string | null;
}

export interface CartPricingItem {
  quantity: number;
  customerPaid: Prisma.Decimal | number | null;
  unitWeightKg?: Prisma.Decimal | number | null;
}

export interface CartPricingResult {
  currency: string;
  subtotalAmount: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
  handlingAmount: Prisma.Decimal;
  paymentFeeAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  minimumOrderValue: Prisma.Decimal;
  freeShippingThreshold: Prisma.Decimal;
  totalWeightKg: Prisma.Decimal;
}

export class PricingService {
  private getCountryShippingDefault(
    settings: Awaited<ReturnType<PricingService["getBusinessSettings"]>>,
    countryCode?: string | null,
  ): Prisma.Decimal {
    switch ((countryCode ?? settings.defaultCountryCode).toUpperCase()) {
      case "ES":
        return decimal(settings.spainShippingFee);
      case "IR":
        return decimal(settings.iranShippingFee);
      case "PT":
      default:
        return decimal(settings.portugalShippingFee);
    }
  }

  public async getBusinessSettings() {
    const settings = await prisma.businessSettings.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!settings) {
      throw new ApiError(500, "Business settings are missing. Run the seed to initialize commerce settings.");
    }

    return settings;
  }

  public async resolvePricingRule(input: { brandId: string; categoryId: string; countryCode?: string | null }) {
    return prisma.pricingRule.findFirst({
      where: {
        isActive: true,
        OR: [
          {
            targetType: "BRAND",
            brandId: input.brandId,
            ...(input.countryCode ? { countryCode: input.countryCode } : {}),
          },
          {
            targetType: "CATEGORY",
            categoryId: input.categoryId,
            ...(input.countryCode ? { countryCode: input.countryCode } : {}),
          },
          {
            targetType: "GLOBAL",
            ...(input.countryCode ? { OR: [{ countryCode: input.countryCode }, { countryCode: null }] } : {}),
          },
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  }

  public async calculateProductPricing(input: ProductPricingInput, countryCode?: string | null): Promise<ProductPricingResult> {
    const [settings, pricingRule] = await Promise.all([
      this.getBusinessSettings(),
      this.resolvePricingRule({
        brandId: input.brandId,
        categoryId: input.categoryId,
        countryCode: countryCode ?? null,
      }),
    ]);

    const supplierPrice = decimal(input.supplierPrice ?? input.fallbackPrice);
    const currency = input.currency || pricingRule?.currency || settings.defaultCurrency;

    if (input.useCustomPricing && input.customPrice !== null && input.customPrice !== undefined) {
      return {
        supplierPrice,
        customerPrice: decimal(input.customPrice),
        profitAmount: decimal(input.customPrice).minus(supplierPrice),
        currency,
        marginPercent: new Prisma.Decimal(0),
        localShippingFee: new Prisma.Decimal(0),
        internationalShippingFee: new Prisma.Decimal(0),
        handlingFee: new Prisma.Decimal(0),
        minimumProfitAmount: new Prisma.Decimal(0),
        vatPercent: new Prisma.Decimal(0),
        pricingRuleId: pricingRule?.id ?? null,
      };
    }

    const marginPercent = pricingRule?.marginPercent ?? settings.defaultMarginPercent;
    const marginAmount = supplierPrice.mul(marginPercent).div(100);
    const localShippingFee = pricingRule?.localShippingFee ?? this.getCountryShippingDefault(settings, countryCode);
    const internationalShippingFee = decimal(pricingRule?.shippingFee ?? this.getCountryShippingDefault(settings));
    const handlingFee = pricingRule?.handlingFee ?? settings.handlingFee;
    const minimumProfitAmount = pricingRule?.minimumProfitAmount ?? settings.minimumProfitAmount;
    const baseProfit = marginAmount.plus(decimal(localShippingFee)).plus(internationalShippingFee).plus(decimal(handlingFee));
    const minimumProfitAdjustment = baseProfit.greaterThanOrEqualTo(decimal(minimumProfitAmount))
      ? new Prisma.Decimal(0)
      : decimal(minimumProfitAmount).minus(baseProfit);
    const preTaxPrice = supplierPrice
      .plus(marginAmount)
      .plus(decimal(localShippingFee))
      .plus(internationalShippingFee)
      .plus(decimal(handlingFee))
      .plus(minimumProfitAdjustment)
      .toDecimalPlaces(2);
    const vatPercent = decimal(pricingRule?.taxPercent ?? settings.vatPercent);
    const vatAmount = preTaxPrice.mul(vatPercent).div(100);
    const customerPrice = preTaxPrice.plus(vatAmount).toDecimalPlaces(2);
    const profitAmount = baseProfit.plus(minimumProfitAdjustment).toDecimalPlaces(2);

    return {
      supplierPrice,
      customerPrice,
      profitAmount,
      currency,
      marginPercent,
      localShippingFee: decimal(localShippingFee),
      internationalShippingFee,
      handlingFee: decimal(handlingFee),
      minimumProfitAmount: decimal(minimumProfitAmount),
      vatPercent,
      pricingRuleId: pricingRule?.id ?? null,
    };
  }

  public async calculateCartTotals(input: {
    items: CartPricingItem[];
    countryCode?: string | null;
    shippingMethodId?: string | null;
  }): Promise<CartPricingResult> {
    const settings = await this.getBusinessSettings();
    const countryCode = input.countryCode || settings.defaultCountryCode;
    const totalWeightKg = input.items.reduce(
      (sum, item) => sum.plus(decimal(item.unitWeightKg ?? 1).mul(item.quantity)),
      new Prisma.Decimal(0),
    );
    const shippingMethod =
      (input.shippingMethodId
        ? await prisma.shippingMethod.findUnique({
            where: { id: input.shippingMethodId },
          })
        : await prisma.shippingMethod.findFirst({
            where: {
              countryCode,
              isActive: true,
              AND: [
                {
                  OR: [{ minWeightKg: null }, { minWeightKg: { lte: totalWeightKg } }],
                },
                {
                  OR: [{ maxWeightKg: null }, { maxWeightKg: { gte: totalWeightKg } }],
                },
              ],
            },
            orderBy: [{ originCountryCode: "asc" }, { createdAt: "asc" }],
          })) ?? null;

    const taxSettings =
      (await prisma.taxSettings.findFirst({
        where: {
          countryCode,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      })) ?? null;

    const subtotalAmount = input.items.reduce(
      (sum, item) => sum.plus(decimal(item.customerPaid).mul(item.quantity)),
      new Prisma.Decimal(0),
    );
    const freeShippingThreshold = decimal(
      shippingMethod?.freeShippingThreshold ?? settings.freeShippingThreshold,
    );
    const shippingAmount =
      subtotalAmount.greaterThanOrEqualTo(freeShippingThreshold) && !freeShippingThreshold.isZero()
        ? new Prisma.Decimal(0)
        : decimal(shippingMethod?.baseFee);
    const handlingAmount = decimal(settings.handlingFee);
    const paymentFeeAmount = decimal(settings.paymentFee);
    const taxPercent = decimal(taxSettings?.taxPercent ?? settings.vatPercent);
    const taxableAmount = subtotalAmount.plus(shippingAmount).plus(handlingAmount).plus(paymentFeeAmount);
    const taxAmount = taxableAmount.mul(taxPercent).div(100).toDecimalPlaces(2);
    const totalAmount = taxableAmount.plus(taxAmount).toDecimalPlaces(2);

    return {
      currency: settings.defaultCurrency,
      subtotalAmount: subtotalAmount.toDecimalPlaces(2),
      shippingAmount,
      handlingAmount,
      paymentFeeAmount,
      taxAmount,
      totalAmount,
      minimumOrderValue: decimal(settings.minimumOrderValue),
      freeShippingThreshold,
      totalWeightKg: totalWeightKg.toDecimalPlaces(2),
    };
  }

  public async repriceProduct(productId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        brandId: true,
        categoryId: true,
        price: true,
        supplierPrice: true,
        outletPrice: true,
        customPrice: true,
        currency: true,
        useCustomPricing: true,
      },
    });

    if (!product) {
      return;
    }

    const pricingBase = product.outletPrice ?? product.supplierPrice ?? product.price;

    const pricing = await this.calculateProductPricing({
      id: product.id,
      brandId: product.brandId,
      categoryId: product.categoryId,
      supplierPrice: pricingBase,
      fallbackPrice: pricingBase,
      currency: product.currency,
      useCustomPricing: product.useCustomPricing,
      customPrice: product.customPrice,
    });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        supplierPrice: pricing.supplierPrice,
        price: pricing.customerPrice,
        profitAmount: pricing.profitAmount,
        currency: pricing.currency,
      },
    });
  }

  public async repriceCatalogProducts(): Promise<void> {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    for (const product of products) {
      await this.repriceProduct(product.id);
    }
  }

  public previewProfit(input: {
    supplierPrice: number;
    marginPercent: number;
    localShippingFee: number;
    internationalShippingFee: number;
    handlingFee: number;
    minimumProfitAmount: number;
    vatPercent: number;
  }) {
    const supplierPrice = decimal(input.supplierPrice);
    const marginAmount = supplierPrice.mul(input.marginPercent).div(100);
    const localShippingFee = decimal(input.localShippingFee);
    const internationalShippingFee = decimal(input.internationalShippingFee);
    const handlingFee = decimal(input.handlingFee);
    const baseProfit = marginAmount.plus(handlingFee);
    const minimumProfitAdjustment = baseProfit.greaterThanOrEqualTo(decimal(input.minimumProfitAmount))
      ? new Prisma.Decimal(0)
      : decimal(input.minimumProfitAmount).minus(baseProfit);
    const preTax = supplierPrice
      .plus(marginAmount)
      .plus(localShippingFee)
      .plus(internationalShippingFee)
      .plus(handlingFee)
      .plus(minimumProfitAdjustment);
    const vatAmount = preTax.mul(input.vatPercent).div(100);
    const customerPrice = preTax.plus(vatAmount).toDecimalPlaces(2);
    const profitAmount = baseProfit.plus(minimumProfitAdjustment).toDecimalPlaces(2);
    const profitPercentage = customerPrice.isZero()
      ? 0
      : Number(profitAmount.div(customerPrice).mul(100).toDecimalPlaces(2));

    return {
      customerPrice: toNumber(customerPrice),
      profitAmount: toNumber(profitAmount),
      profitPercentage,
    };
  }
}

export const pricingService = new PricingService();
