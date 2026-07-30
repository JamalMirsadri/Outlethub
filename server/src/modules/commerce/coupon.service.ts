import { CouponDiscountType, CouponStatus, LoyaltyRewardType, OrderStatus, Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { pricingService } from "./pricing.service.js";

type PrismaExecutor = typeof prisma | Prisma.TransactionClient;

function decimal(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }

  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return value instanceof Prisma.Decimal ? Number(value) : value;
}

function normalizeCouponCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

function uniqueIds(values?: string[] | null) {
  if (!values?.length) {
    return [];
  }

  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function buildDuplicateCode(code: string) {
  const suffix = Date.now().toString().slice(-6);
  const normalized = normalizeCouponCode(code);
  const maxBaseLength = Math.max(1, 48 - suffix.length - 1);
  return `${normalized.slice(0, maxBaseLength)}-${suffix}`;
}

function buildIssuedRewardCouponCode(prefix: string | null | undefined, fallbackLabel: string) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const normalizedPrefix = normalizeCouponCode(prefix || fallbackLabel).slice(0, 18);
  return `${normalizedPrefix || "REWARD"}-${Date.now().toString().slice(-6)}-${suffix}`;
}

function extractPercentageValue(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*%/i);
  return match ? Number(match[1]) : null;
}

function extractEuroAmount(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(?:€|eur)/i);
  return match ? Number(match[1]) : null;
}

interface CartContextItem {
  id: string;
  productId: string;
  quantity: number;
  customerPaid: Prisma.Decimal;
  product: {
    brandId: string;
    categoryId: string;
  };
}

interface CartContext {
  id: string;
  userId: string | null;
  countryCode: string;
  subtotalAmount: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
  handlingAmount: Prisma.Decimal;
  paymentFeeAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  items: CartContextItem[];
}

interface PromotionTotals {
  currency: string;
  subtotalAmount: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
  handlingAmount: Prisma.Decimal;
  paymentFeeAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  taxPercent: Prisma.Decimal;
  minimumOrderValue: Prisma.Decimal;
}

interface EvaluatedPromotionSummary {
  couponId: string | null;
  cartApplicationId: string | null;
  code: string;
  description: string | null;
  status: "applied" | "invalid";
  message: string | null;
  discountType: CouponDiscountType | null;
  percentage: number | null;
  fixedAmount: number | null;
  freeShipping: boolean;
  qualifiedSubtotal: number;
  discountAmount: number;
  shippingDiscountAmount: number;
  savingsAmount: number;
  totalBeforeDiscount: number;
  totalAfterDiscount: number;
  subtotalAfterDiscount: number;
  shippingAfterDiscount: number;
  handlingAmount: number;
  paymentFeeAmount: number;
  taxAmount: number;
  currency: string;
}

function buildCategoryAncestorMap(categories: Array<{ id: string; parentId: string | null }>) {
  const byId = new Map(categories.map((category) => [category.id, category.parentId]));

  return (categoryId: string) => {
    const ids = new Set<string>();
    let cursor: string | null | undefined = categoryId;

    while (cursor) {
      if (ids.has(cursor)) {
        break;
      }

      ids.add(cursor);
      cursor = byId.get(cursor) ?? null;
    }

    return ids;
  };
}

function mapCoupon(coupon: {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  percentage: Prisma.Decimal | null;
  fixedAmount: Prisma.Decimal | null;
  freeShipping: boolean;
  minimumOrderAmount: Prisma.Decimal | null;
  maximumDiscountAmount: Prisma.Decimal | null;
  usageLimit: number | null;
  usagePerUser: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  allowedProductIds: string[];
  allowedCategoryIds: string[];
  allowedBrandIds: string[];
  excludedProductIds: string[];
  excludedCategoryIds: string[];
  excludedBrandIds: string[];
  allowedMembershipLevelIds: string[];
  status: CouponStatus;
  issuedToUserId?: string | null;
  sourceRewardId?: string | null;
  sourceRedemptionId?: string | null;
  isGeneratedRewardCoupon?: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    orderApplications: number;
  };
}) {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    percentage: coupon.percentage ? toNumber(coupon.percentage) : null,
    fixedAmount: coupon.fixedAmount ? toNumber(coupon.fixedAmount) : null,
    freeShipping: coupon.freeShipping,
    minimumOrderAmount: coupon.minimumOrderAmount ? toNumber(coupon.minimumOrderAmount) : null,
    maximumDiscountAmount: coupon.maximumDiscountAmount ? toNumber(coupon.maximumDiscountAmount) : null,
    usageLimit: coupon.usageLimit,
    usagePerUser: coupon.usagePerUser,
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
    allowedProductIds: coupon.allowedProductIds,
    allowedCategoryIds: coupon.allowedCategoryIds,
    allowedBrandIds: coupon.allowedBrandIds,
    excludedProductIds: coupon.excludedProductIds,
    excludedCategoryIds: coupon.excludedCategoryIds,
    excludedBrandIds: coupon.excludedBrandIds,
    allowedMembershipLevelIds: coupon.allowedMembershipLevelIds,
    status: coupon.status,
    issuedToUserId: coupon.issuedToUserId ?? null,
    sourceRewardId: coupon.sourceRewardId ?? null,
    sourceRedemptionId: coupon.sourceRedemptionId ?? null,
    isGeneratedRewardCoupon: coupon.isGeneratedRewardCoupon ?? false,
    usageCount: coupon._count?.orderApplications ?? 0,
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
  };
}

export class CouponService {
  private async createCouponRecord(
    executor: PrismaExecutor,
    input: {
      code: string;
      description?: string | null;
      discountType: CouponDiscountType;
      percentage?: number | Prisma.Decimal | null;
      fixedAmount?: number | Prisma.Decimal | null;
      freeShipping?: boolean;
      minimumOrderAmount?: number | Prisma.Decimal | null;
      maximumDiscountAmount?: number | Prisma.Decimal | null;
      usageLimit?: number | null;
      usagePerUser?: number | null;
      startsAt?: Date | string | null;
      endsAt?: Date | string | null;
      allowedProductIds?: string[];
      allowedCategoryIds?: string[];
      allowedBrandIds?: string[];
      excludedProductIds?: string[];
      excludedCategoryIds?: string[];
      excludedBrandIds?: string[];
      allowedMembershipLevelIds?: string[];
      status?: CouponStatus;
      issuedToUserId?: string | null;
      sourceRewardId?: string | null;
      sourceRedemptionId?: string | null;
      isGeneratedRewardCoupon?: boolean;
    },
  ) {
    return executor.coupon.create({
      data: {
        code: normalizeCouponCode(input.code),
        description: input.description ?? null,
        discountType: input.discountType,
        percentage:
          input.percentage !== null && input.percentage !== undefined ? decimal(input.percentage) : null,
        fixedAmount:
          input.fixedAmount !== null && input.fixedAmount !== undefined ? decimal(input.fixedAmount) : null,
        freeShipping: input.freeShipping ?? false,
        minimumOrderAmount:
          input.minimumOrderAmount !== null && input.minimumOrderAmount !== undefined
            ? decimal(input.minimumOrderAmount)
            : null,
        maximumDiscountAmount:
          input.maximumDiscountAmount !== null && input.maximumDiscountAmount !== undefined
            ? decimal(input.maximumDiscountAmount)
            : null,
        usageLimit: input.usageLimit ?? null,
        usagePerUser: input.usagePerUser ?? null,
        startsAt:
          input.startsAt instanceof Date ? input.startsAt : input.startsAt ? new Date(input.startsAt) : null,
        endsAt:
          input.endsAt instanceof Date ? input.endsAt : input.endsAt ? new Date(input.endsAt) : null,
        allowedProductIds: uniqueIds(input.allowedProductIds),
        allowedCategoryIds: uniqueIds(input.allowedCategoryIds),
        allowedBrandIds: uniqueIds(input.allowedBrandIds),
        excludedProductIds: uniqueIds(input.excludedProductIds),
        excludedCategoryIds: uniqueIds(input.excludedCategoryIds),
        excludedBrandIds: uniqueIds(input.excludedBrandIds),
        allowedMembershipLevelIds: uniqueIds(input.allowedMembershipLevelIds),
        status: input.status ?? CouponStatus.ACTIVE,
        issuedToUserId: input.issuedToUserId ?? null,
        sourceRewardId: input.sourceRewardId ?? null,
        sourceRedemptionId: input.sourceRedemptionId ?? null,
        isGeneratedRewardCoupon: input.isGeneratedRewardCoupon ?? false,
      },
    });
  }

  private async getUserCart(executor: PrismaExecutor, userId: string) {
    const cart = await executor.cart.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        items: {
          include: {
            product: {
              select: {
                brandId: true,
                categoryId: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      throw new ApiError(404, "Cart not found.");
    }

    return cart;
  }

  private async getCartMembershipLevelId(executor: PrismaExecutor, userId?: string | null) {
    const firstActiveLevel = await executor.loyaltyMembershipLevel.findFirst({
      where: { isActive: true },
      orderBy: [{ minPoints: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    if (!userId) {
      return firstActiveLevel?.id ?? null;
    }

    const account = await executor.loyaltyAccount.findUnique({
      where: { userId },
      select: { membershipLevelId: true },
    });

    return account?.membershipLevelId ?? firstActiveLevel?.id ?? null;
  }

  private async buildCartContext(executor: PrismaExecutor, cartId: string): Promise<CartContext> {
    const cart = await executor.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: {
              select: {
                brandId: true,
                categoryId: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      throw new ApiError(404, "Cart not found.");
    }

    return cart;
  }

  private async countCouponUsage(
    executor: PrismaExecutor,
    input: { couponId: string; userId?: string | null },
  ) {
    const inactiveOrderStatuses: OrderStatus[] = ["CANCELLED", "REFUNDED"];
    const baseWhere = {
      couponId: input.couponId,
      order: {
        is: {
          status: {
            notIn: inactiveOrderStatuses,
          },
        },
      },
    };

    const [usageCount, usageCountByUser] = await Promise.all([
      executor.couponOrderApplication.count({
        where: baseWhere,
      }),
      input.userId
        ? executor.couponOrderApplication.count({
            where: {
              ...baseWhere,
              userId: input.userId,
            },
          })
        : Promise.resolve(0),
    ]);

    return { usageCount, usageCountByUser };
  }

  private async evaluateCoupon(
    executor: PrismaExecutor,
    input: {
      coupon: {
        id: string;
        code: string;
        description: string | null;
        discountType: CouponDiscountType;
        percentage: Prisma.Decimal | null;
        fixedAmount: Prisma.Decimal | null;
        freeShipping: boolean;
        minimumOrderAmount: Prisma.Decimal | null;
        maximumDiscountAmount: Prisma.Decimal | null;
        usageLimit: number | null;
        usagePerUser: number | null;
        startsAt: Date | null;
        endsAt: Date | null;
        allowedProductIds: string[];
        allowedCategoryIds: string[];
        allowedBrandIds: string[];
        excludedProductIds: string[];
        excludedCategoryIds: string[];
        excludedBrandIds: string[];
        allowedMembershipLevelIds: string[];
        status: CouponStatus;
        issuedToUserId?: string | null;
      };
      cart: CartContext;
      totals: PromotionTotals;
      userId?: string | null;
      cartApplicationId?: string | null;
    },
  ): Promise<EvaluatedPromotionSummary> {
    const baseTotal = decimal(input.totals.totalAmount);
    const invalid = (message: string): EvaluatedPromotionSummary => ({
      couponId: input.coupon.id,
      cartApplicationId: input.cartApplicationId ?? null,
      code: input.coupon.code,
      description: input.coupon.description,
      status: "invalid",
      message,
      discountType: input.coupon.discountType,
      percentage: input.coupon.percentage ? toNumber(input.coupon.percentage) : null,
      fixedAmount: input.coupon.fixedAmount ? toNumber(input.coupon.fixedAmount) : null,
      freeShipping: input.coupon.freeShipping,
      qualifiedSubtotal: 0,
      discountAmount: 0,
      shippingDiscountAmount: 0,
      savingsAmount: 0,
      totalBeforeDiscount: toNumber(baseTotal),
      totalAfterDiscount: toNumber(baseTotal),
      subtotalAfterDiscount: toNumber(input.totals.subtotalAmount),
      shippingAfterDiscount: toNumber(input.totals.shippingAmount),
      handlingAmount: toNumber(input.totals.handlingAmount),
      paymentFeeAmount: toNumber(input.totals.paymentFeeAmount),
      taxAmount: toNumber(input.totals.taxAmount),
      currency: input.totals.currency,
    });

    if (input.coupon.status !== CouponStatus.ACTIVE) {
      return invalid("This promotion code is currently disabled.");
    }

    if (input.coupon.issuedToUserId && input.userId && input.coupon.issuedToUserId !== input.userId) {
      return invalid("This promotion code belongs to another customer account.");
    }

    const now = new Date();
    if (input.coupon.startsAt && input.coupon.startsAt > now) {
      return invalid("This promotion code is not active yet.");
    }

    if (input.coupon.endsAt && input.coupon.endsAt < now) {
      return invalid("This promotion code has expired.");
    }

    if (!input.cart.items.length) {
      return invalid("Your cart is empty.");
    }

    const membershipLevelId = await this.getCartMembershipLevelId(executor, input.userId ?? input.cart.userId);
    if (
      input.coupon.allowedMembershipLevelIds.length > 0 &&
      (!membershipLevelId || !input.coupon.allowedMembershipLevelIds.includes(membershipLevelId))
    ) {
      return invalid("Your membership level is not eligible for this promotion.");
    }

    const { usageCount, usageCountByUser } = await this.countCouponUsage(executor, {
      couponId: input.coupon.id,
      userId: input.userId ?? input.cart.userId,
    });

    if (input.coupon.usageLimit !== null && usageCount >= input.coupon.usageLimit) {
      return invalid("This promotion code has reached its usage limit.");
    }

    if (
      input.coupon.usagePerUser !== null &&
      usageCountByUser >= input.coupon.usagePerUser
    ) {
      return invalid("You have already reached the usage limit for this promotion.");
    }

    const categories = await executor.category.findMany({
      select: {
        id: true,
        parentId: true,
      },
    });
    const getCategoryAncestors = buildCategoryAncestorMap(categories);
    const hasAllowScope =
      input.coupon.allowedProductIds.length > 0 ||
      input.coupon.allowedCategoryIds.length > 0 ||
      input.coupon.allowedBrandIds.length > 0;

    const eligibleItems = input.cart.items.filter((item) => {
      const categoryIds = getCategoryAncestors(item.product.categoryId);
      const excluded =
        input.coupon.excludedProductIds.includes(item.productId) ||
        input.coupon.excludedBrandIds.includes(item.product.brandId) ||
        input.coupon.excludedCategoryIds.some((categoryId) => categoryIds.has(categoryId));

      if (excluded) {
        return false;
      }

      if (!hasAllowScope) {
        return true;
      }

      return (
        input.coupon.allowedProductIds.includes(item.productId) ||
        input.coupon.allowedBrandIds.includes(item.product.brandId) ||
        input.coupon.allowedCategoryIds.some((categoryId) => categoryIds.has(categoryId))
      );
    });

    if (!eligibleItems.length) {
      return invalid("This promotion code does not apply to the current cart.");
    }

    const qualifiedSubtotal = eligibleItems.reduce(
      (sum, item) => sum.plus(item.customerPaid.mul(item.quantity)),
      new Prisma.Decimal(0),
    );

    if (
      input.coupon.minimumOrderAmount &&
      qualifiedSubtotal.lessThan(input.coupon.minimumOrderAmount)
    ) {
      return invalid(
        `This promotion requires a minimum qualifying order of ${input.coupon.minimumOrderAmount.toFixed(2)} ${input.totals.currency}.`,
      );
    }

    let discountAmount = new Prisma.Decimal(0);
    if (input.coupon.discountType === CouponDiscountType.PERCENTAGE) {
      const percentage = decimal(input.coupon.percentage);
      if (percentage.lessThanOrEqualTo(0)) {
        return invalid("This promotion code is not configured correctly.");
      }

      discountAmount = qualifiedSubtotal.mul(percentage).div(100).toDecimalPlaces(2);
    } else {
      const fixedAmount = decimal(input.coupon.fixedAmount);
      if (fixedAmount.lessThanOrEqualTo(0)) {
        return invalid("This promotion code is not configured correctly.");
      }

      discountAmount = Prisma.Decimal.min(qualifiedSubtotal, fixedAmount).toDecimalPlaces(2);
    }

    if (input.coupon.maximumDiscountAmount && input.coupon.maximumDiscountAmount.greaterThan(0)) {
      discountAmount = Prisma.Decimal.min(discountAmount, input.coupon.maximumDiscountAmount).toDecimalPlaces(2);
    }

    const shippingDiscountAmount =
      input.coupon.freeShipping && decimal(input.totals.shippingAmount).greaterThan(0)
        ? decimal(input.totals.shippingAmount).toDecimalPlaces(2)
        : new Prisma.Decimal(0);

    if (discountAmount.lessThanOrEqualTo(0) && shippingDiscountAmount.lessThanOrEqualTo(0)) {
      return invalid("This promotion code does not reduce the current total.");
    }

    const subtotalAfterDiscount = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      decimal(input.totals.subtotalAmount).minus(discountAmount),
    ).toDecimalPlaces(2);
    const shippingAfterDiscount = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      decimal(input.totals.shippingAmount).minus(shippingDiscountAmount),
    ).toDecimalPlaces(2);
    const taxableAmount = subtotalAfterDiscount
      .plus(decimal(input.totals.handlingAmount))
      .plus(decimal(input.totals.paymentFeeAmount))
      .plus(shippingAfterDiscount);
    const adjustedTaxAmount = taxableAmount.mul(decimal(input.totals.taxPercent)).div(100).toDecimalPlaces(2);
    const totalAfterDiscount = taxableAmount.plus(adjustedTaxAmount).toDecimalPlaces(2);
    const savingsAmount = Prisma.Decimal.max(new Prisma.Decimal(0), baseTotal.minus(totalAfterDiscount)).toDecimalPlaces(2);

    return {
      couponId: input.coupon.id,
      cartApplicationId: input.cartApplicationId ?? null,
      code: input.coupon.code,
      description: input.coupon.description,
      status: "applied",
      message: null,
      discountType: input.coupon.discountType,
      percentage: input.coupon.percentage ? toNumber(input.coupon.percentage) : null,
      fixedAmount: input.coupon.fixedAmount ? toNumber(input.coupon.fixedAmount) : null,
      freeShipping: input.coupon.freeShipping,
      qualifiedSubtotal: toNumber(qualifiedSubtotal),
      discountAmount: toNumber(discountAmount),
      shippingDiscountAmount: toNumber(shippingDiscountAmount),
      savingsAmount: toNumber(savingsAmount),
      totalBeforeDiscount: toNumber(baseTotal),
      totalAfterDiscount: toNumber(totalAfterDiscount),
      subtotalAfterDiscount: toNumber(subtotalAfterDiscount),
      shippingAfterDiscount: toNumber(shippingAfterDiscount),
      handlingAmount: toNumber(input.totals.handlingAmount),
      paymentFeeAmount: toNumber(input.totals.paymentFeeAmount),
      taxAmount: toNumber(adjustedTaxAmount),
      currency: input.totals.currency,
    };
  }

  public async getCartPromotionSummary(
    cartId: string,
    totals: PromotionTotals,
    userId?: string | null,
  ): Promise<EvaluatedPromotionSummary | null> {
    const application = await prisma.couponCartApplication.findUnique({
      where: { cartId },
      include: {
        coupon: true,
      },
    });

    if (!application) {
      return null;
    }

    if (!application.coupon) {
      return {
        couponId: null,
        cartApplicationId: application.id,
        code: application.codeSnapshot,
        description: null,
        status: "invalid",
        message: "This promotion code is no longer available.",
        discountType: null,
        percentage: null,
        fixedAmount: null,
        freeShipping: false,
        qualifiedSubtotal: 0,
        discountAmount: 0,
        shippingDiscountAmount: 0,
        savingsAmount: 0,
        totalBeforeDiscount: toNumber(totals.totalAmount),
        totalAfterDiscount: toNumber(totals.totalAmount),
        subtotalAfterDiscount: toNumber(totals.subtotalAmount),
        shippingAfterDiscount: toNumber(totals.shippingAmount),
        handlingAmount: toNumber(totals.handlingAmount),
        paymentFeeAmount: toNumber(totals.paymentFeeAmount),
        taxAmount: toNumber(totals.taxAmount),
        currency: totals.currency,
      };
    }

    const cart = await this.buildCartContext(prisma, cartId);
    return this.evaluateCoupon(prisma, {
      coupon: application.coupon,
      cart,
      totals,
      userId: userId ?? cart.userId,
      cartApplicationId: application.id,
    });
  }

  public async applyCouponToCheckout(userId: string, rawCode: string) {
    const code = normalizeCouponCode(rawCode);
    const [coupon, cart] = await Promise.all([
      prisma.coupon.findUnique({
        where: { code },
      }),
      this.getUserCart(prisma, userId),
    ]);

    if (!coupon) {
      throw new ApiError(404, "Promotion code not found.");
    }

    const totals = await pricingService.calculateCartTotals({
      items: cart.items.map((item) => ({
        quantity: item.quantity,
        customerPaid: item.customerPaid,
        unitWeightKg: 1,
      })),
      countryCode: cart.countryCode,
      shippingMethodId: cart.shippingMethodId,
    });

    const evaluated = await this.evaluateCoupon(prisma, {
      coupon,
      cart,
      totals,
      userId,
    });

    if (evaluated.status !== "applied") {
      throw new ApiError(400, evaluated.message ?? "Promotion code is invalid.");
    }

    await prisma.couponCartApplication.upsert({
      where: { cartId: cart.id },
      update: {
        couponId: coupon.id,
        userId,
        codeSnapshot: coupon.code,
      },
      create: {
        couponId: coupon.id,
        cartId: cart.id,
        userId,
        codeSnapshot: coupon.code,
      },
    });

    return evaluated;
  }

  public async clearCheckoutCoupon(userId: string) {
    const cart = await prisma.cart.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!cart) {
      return;
    }

    await prisma.couponCartApplication.deleteMany({
      where: { cartId: cart.id },
    });
  }

  public async getOrderCouponSummary(
    input: {
      cartId: string;
      userId: string;
      cart: CartContext;
      totals: PromotionTotals;
    },
    executor: PrismaExecutor = prisma,
  ) {
    const application = await executor.couponCartApplication.findUnique({
      where: { cartId: input.cartId },
      include: { coupon: true },
    });

    if (!application || !application.coupon) {
      return null;
    }

    const evaluated = await this.evaluateCoupon(executor, {
      coupon: application.coupon,
      cart: input.cart,
      totals: input.totals,
      userId: input.userId,
      cartApplicationId: application.id,
    });

    if (evaluated.status !== "applied") {
      throw new ApiError(400, evaluated.message ?? "Promotion code is no longer valid.");
    }

    return evaluated;
  }

  public async recordOrderCouponUsage(
    executor: PrismaExecutor,
    input: {
      orderId: string;
      userId: string;
      couponSummary: EvaluatedPromotionSummary;
    },
  ) {
    if (!input.couponSummary.couponId) {
      return;
    }

    await executor.couponOrderApplication.create({
      data: {
        couponId: input.couponSummary.couponId,
        orderId: input.orderId,
        cartApplicationId: input.couponSummary.cartApplicationId,
        userId: input.userId,
        codeSnapshot: input.couponSummary.code,
        descriptionSnapshot: input.couponSummary.description,
        discountType: input.couponSummary.discountType ?? CouponDiscountType.FIXED_AMOUNT,
        percentageSnapshot:
          input.couponSummary.percentage !== null ? new Prisma.Decimal(input.couponSummary.percentage) : null,
        fixedAmountSnapshot:
          input.couponSummary.fixedAmount !== null ? new Prisma.Decimal(input.couponSummary.fixedAmount) : null,
        freeShippingSnapshot: input.couponSummary.freeShipping,
        discountAmount: new Prisma.Decimal(input.couponSummary.discountAmount),
        shippingDiscountAmount: new Prisma.Decimal(input.couponSummary.shippingDiscountAmount),
        totalSavingsAmount: new Prisma.Decimal(input.couponSummary.savingsAmount),
        qualifiedSubtotal: new Prisma.Decimal(input.couponSummary.qualifiedSubtotal),
        metadata: {
          totalBeforeDiscount: input.couponSummary.totalBeforeDiscount,
          totalAfterDiscount: input.couponSummary.totalAfterDiscount,
          currency: input.couponSummary.currency,
        },
      },
    });

    if (input.couponSummary.cartApplicationId) {
      await executor.couponCartApplication.deleteMany({
        where: { id: input.couponSummary.cartApplicationId },
      });
    }
  }

  public async getAdminOverview() {
    const [coupons, usageHistory, membershipLevels] = await Promise.all([
      prisma.coupon.findMany({
        include: {
          _count: {
            select: {
              orderApplications: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.couponOrderApplication.findMany({
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              customerEmail: true,
            },
          },
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
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.loyaltyMembershipLevel.findMany({
        where: { isActive: true },
        orderBy: [{ minPoints: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          title: true,
          color: true,
          icon: true,
          minPoints: true,
        },
      }),
    ]);

    return {
      summary: {
        totalCoupons: coupons.length,
        activeCoupons: coupons.filter((coupon) => coupon.status === CouponStatus.ACTIVE).length,
        totalUsages: usageHistory.length,
      },
      coupons: coupons.map(mapCoupon),
      usageHistory: usageHistory.map((usage) => ({
        id: usage.id,
        code: usage.codeSnapshot,
        discountAmount: toNumber(usage.discountAmount),
        shippingDiscountAmount: toNumber(usage.shippingDiscountAmount),
        totalSavingsAmount: toNumber(usage.totalSavingsAmount),
        qualifiedSubtotal: toNumber(usage.qualifiedSubtotal),
        createdAt: usage.createdAt,
        order: usage.order,
        user: usage.user
          ? {
              id: usage.user.id,
              email: usage.user.email,
              name:
                usage.user.fullName ||
                [usage.user.firstName, usage.user.lastName].filter(Boolean).join(" ") ||
                usage.user.email,
            }
          : null,
      })),
      membershipLevels,
    };
  }

  public async createCoupon(input: {
    code: string;
    description?: string | null;
    discountType: CouponDiscountType;
    percentage?: number | null;
    fixedAmount?: number | null;
    freeShipping?: boolean;
    minimumOrderAmount?: number | null;
    maximumDiscountAmount?: number | null;
    usageLimit?: number | null;
    usagePerUser?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
    allowedProductIds?: string[];
    allowedCategoryIds?: string[];
    allowedBrandIds?: string[];
    excludedProductIds?: string[];
    excludedCategoryIds?: string[];
    excludedBrandIds?: string[];
    allowedMembershipLevelIds?: string[];
    status?: CouponStatus;
  }) {
    const created = await this.createCouponRecord(prisma, input);

    return mapCoupon(created);
  }

  public async updateCoupon(
    id: string,
    input: {
      code?: string;
      description?: string | null;
      discountType?: CouponDiscountType;
      percentage?: number | null;
      fixedAmount?: number | null;
      freeShipping?: boolean;
      minimumOrderAmount?: number | null;
      maximumDiscountAmount?: number | null;
      usageLimit?: number | null;
      usagePerUser?: number | null;
      startsAt?: string | null;
      endsAt?: string | null;
      allowedProductIds?: string[];
      allowedCategoryIds?: string[];
      allowedBrandIds?: string[];
      excludedProductIds?: string[];
      excludedCategoryIds?: string[];
      excludedBrandIds?: string[];
      allowedMembershipLevelIds?: string[];
      status?: CouponStatus;
    },
  ) {
    const updated = await prisma.coupon.update({
      where: { id },
      data: {
        code: input.code ? normalizeCouponCode(input.code) : undefined,
        description: input.description,
        discountType: input.discountType,
        percentage:
          input.percentage === undefined
            ? undefined
            : input.percentage === null
              ? null
              : new Prisma.Decimal(input.percentage),
        fixedAmount:
          input.fixedAmount === undefined
            ? undefined
            : input.fixedAmount === null
              ? null
              : new Prisma.Decimal(input.fixedAmount),
        freeShipping: input.freeShipping,
        minimumOrderAmount:
          input.minimumOrderAmount === undefined
            ? undefined
            : input.minimumOrderAmount === null
              ? null
              : new Prisma.Decimal(input.minimumOrderAmount),
        maximumDiscountAmount:
          input.maximumDiscountAmount === undefined
            ? undefined
            : input.maximumDiscountAmount === null
              ? null
              : new Prisma.Decimal(input.maximumDiscountAmount),
        usageLimit: input.usageLimit === undefined ? undefined : input.usageLimit,
        usagePerUser: input.usagePerUser === undefined ? undefined : input.usagePerUser,
        startsAt:
          input.startsAt === undefined
            ? undefined
            : input.startsAt === null
              ? null
              : new Date(input.startsAt),
        endsAt:
          input.endsAt === undefined
            ? undefined
            : input.endsAt === null
              ? null
              : new Date(input.endsAt),
        allowedProductIds: input.allowedProductIds ? uniqueIds(input.allowedProductIds) : undefined,
        allowedCategoryIds: input.allowedCategoryIds ? uniqueIds(input.allowedCategoryIds) : undefined,
        allowedBrandIds: input.allowedBrandIds ? uniqueIds(input.allowedBrandIds) : undefined,
        excludedProductIds: input.excludedProductIds ? uniqueIds(input.excludedProductIds) : undefined,
        excludedCategoryIds: input.excludedCategoryIds ? uniqueIds(input.excludedCategoryIds) : undefined,
        excludedBrandIds: input.excludedBrandIds ? uniqueIds(input.excludedBrandIds) : undefined,
        allowedMembershipLevelIds: input.allowedMembershipLevelIds ? uniqueIds(input.allowedMembershipLevelIds) : undefined,
        status: input.status,
      },
    });

    return mapCoupon(updated);
  }

  public async deleteCoupon(id: string) {
    await prisma.coupon.delete({
      where: { id },
    });
  }

  public async duplicateCoupon(id: string) {
    const existing = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError(404, "Coupon not found.");
    }

    const duplicated = await this.createCouponRecord(prisma, {
      code: buildDuplicateCode(existing.code),
      description: existing.description,
      discountType: existing.discountType,
      percentage: existing.percentage,
      fixedAmount: existing.fixedAmount,
      freeShipping: existing.freeShipping,
      minimumOrderAmount: existing.minimumOrderAmount,
      maximumDiscountAmount: existing.maximumDiscountAmount,
      usageLimit: existing.usageLimit,
      usagePerUser: existing.usagePerUser,
      startsAt: existing.startsAt,
      endsAt: existing.endsAt,
      allowedProductIds: existing.allowedProductIds,
      allowedCategoryIds: existing.allowedCategoryIds,
      allowedBrandIds: existing.allowedBrandIds,
      excludedProductIds: existing.excludedProductIds,
      excludedCategoryIds: existing.excludedCategoryIds,
      excludedBrandIds: existing.excludedBrandIds,
      allowedMembershipLevelIds: existing.allowedMembershipLevelIds,
      status: CouponStatus.DISABLED,
    });

    return mapCoupon(duplicated);
  }

  public async createIssuedCouponFromReward(
    executor: PrismaExecutor,
    input: {
      userId: string;
      reward: {
        id: string;
        title: string;
        description: string | null;
        rewardType: LoyaltyRewardType;
        startsAt: Date | null;
        endsAt: Date | null;
        couponTemplateId: string | null;
        couponPercentage: Prisma.Decimal | null;
        couponFixedAmount: Prisma.Decimal | null;
        couponMinimumOrderAmount: Prisma.Decimal | null;
        couponMaximumDiscountAmount: Prisma.Decimal | null;
        couponDurationDays: number | null;
        couponCodePrefix: string | null;
        couponTemplate?: {
          code: string;
          description: string | null;
          discountType: CouponDiscountType;
          percentage: Prisma.Decimal | null;
          fixedAmount: Prisma.Decimal | null;
          freeShipping: boolean;
          minimumOrderAmount: Prisma.Decimal | null;
          maximumDiscountAmount: Prisma.Decimal | null;
          endsAt: Date | null;
          allowedProductIds: string[];
          allowedCategoryIds: string[];
          allowedBrandIds: string[];
          excludedProductIds: string[];
          excludedCategoryIds: string[];
          excludedBrandIds: string[];
        } | null;
      };
      redemptionId: string;
    },
  ) {
    const now = new Date();
    const rewardCopyText = `${input.reward.title} ${input.reward.description ?? ""}`;
    const inferredPercentage =
      input.reward.couponPercentage ?? (extractPercentageValue(rewardCopyText) ?? null);
    const inferredFixedAmount =
      input.reward.couponFixedAmount ?? (extractEuroAmount(rewardCopyText) ?? null);
    const generatedEndsAt = input.reward.couponDurationDays
      ? new Date(now.getTime() + input.reward.couponDurationDays * 24 * 60 * 60 * 1000)
      : input.reward.endsAt;

    if (input.reward.rewardType === LoyaltyRewardType.COUPON_TEMPLATE) {
      if (!input.reward.couponTemplate) {
        throw new ApiError(400, "The selected reward template coupon no longer exists.");
      }

      return this.createCouponRecord(executor, {
        code: buildIssuedRewardCouponCode(input.reward.couponCodePrefix ?? input.reward.couponTemplate.code, input.reward.title),
        description: input.reward.description || input.reward.couponTemplate.description,
        discountType: input.reward.couponTemplate.discountType,
        percentage: input.reward.couponTemplate.percentage,
        fixedAmount: input.reward.couponTemplate.fixedAmount,
        freeShipping: input.reward.couponTemplate.freeShipping,
        minimumOrderAmount: input.reward.couponTemplate.minimumOrderAmount,
        maximumDiscountAmount: input.reward.couponTemplate.maximumDiscountAmount,
        usageLimit: 1,
        usagePerUser: 1,
        startsAt: now,
        endsAt: generatedEndsAt ?? input.reward.couponTemplate.endsAt ?? null,
        allowedProductIds: input.reward.couponTemplate.allowedProductIds,
        allowedCategoryIds: input.reward.couponTemplate.allowedCategoryIds,
        allowedBrandIds: input.reward.couponTemplate.allowedBrandIds,
        excludedProductIds: input.reward.couponTemplate.excludedProductIds,
        excludedCategoryIds: input.reward.couponTemplate.excludedCategoryIds,
        excludedBrandIds: input.reward.couponTemplate.excludedBrandIds,
        allowedMembershipLevelIds: [],
        issuedToUserId: input.userId,
        sourceRewardId: input.reward.id,
        sourceRedemptionId: input.redemptionId,
        isGeneratedRewardCoupon: true,
      });
    }

    if (
      input.reward.rewardType === LoyaltyRewardType.PERCENTAGE_DISCOUNT &&
      !(typeof inferredPercentage === "number" && inferredPercentage > 0)
    ) {
      throw new ApiError(400, "This percentage reward is missing its coupon value.");
    }

    if (
      input.reward.rewardType === LoyaltyRewardType.FIXED_AMOUNT_DISCOUNT &&
      !(typeof inferredFixedAmount === "number" && inferredFixedAmount > 0)
    ) {
      throw new ApiError(400, "This fixed-amount reward is missing its coupon value.");
    }

    return this.createCouponRecord(executor, {
      code: buildIssuedRewardCouponCode(input.reward.couponCodePrefix, input.reward.title),
      description: input.reward.description || `Issued from reward ${input.reward.title}`,
      discountType:
        input.reward.rewardType === LoyaltyRewardType.PERCENTAGE_DISCOUNT
          ? CouponDiscountType.PERCENTAGE
          : CouponDiscountType.FIXED_AMOUNT,
      percentage:
        input.reward.rewardType === LoyaltyRewardType.PERCENTAGE_DISCOUNT
          ? inferredPercentage
          : null,
      fixedAmount:
        input.reward.rewardType === LoyaltyRewardType.FIXED_AMOUNT_DISCOUNT
          ? inferredFixedAmount
          : null,
      freeShipping: input.reward.rewardType === LoyaltyRewardType.FREE_SHIPPING,
      minimumOrderAmount: input.reward.couponMinimumOrderAmount,
      maximumDiscountAmount: input.reward.couponMaximumDiscountAmount,
      usageLimit: 1,
      usagePerUser: 1,
      startsAt: now,
      endsAt: generatedEndsAt ?? null,
      allowedMembershipLevelIds: [],
      issuedToUserId: input.userId,
      sourceRewardId: input.reward.id,
      sourceRedemptionId: input.redemptionId,
      isGeneratedRewardCoupon: true,
    });
  }
}

export const couponService = new CouponService();
