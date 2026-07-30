import { PaymentKind, PaymentStatus, Prisma, type OrderStatus, type PaymentProvider } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { cartService } from "./cart.service.js";
import { commerceAdminService } from "./commerce-admin.service.js";
import { currencyService } from "./currency.service.js";
import { manualPaymentProvider } from "./payment-providers/manual-payment-provider.js";
import type { PaymentProviderAdapter } from "./payment-providers/payment-provider.js";
import { paymentsService } from "./payments.service.js";
import { pricingService } from "./pricing.service.js";
import { procurementService } from "./procurement.service.js";
import { couponService } from "./coupon.service.js";
import { loyaltyService } from "./loyalty.service.js";
import { referralService } from "./referral.service.js";
import { notificationsService } from "../notifications/notifications.service.js";

function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) {
    return 0;
  }

  return Number(value);
}

function buildOrderNumber(): string {
  return `OH-${Date.now()}`;
}

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

function shouldGenerateProcurementTasks(status: OrderStatus) {
  return ["PAID", "PROCESSING", "PURCHASED_FROM_SUPPLIER", "SHIPPED", "DELIVERED"].includes(status);
}

const orderInclude = {
  items: true,
  customerAddress: true,
  billingAddressRef: true,
  shippingMethod: true,
  couponApplication: {
    include: {
      coupon: true,
    },
  },
  payments: {
    orderBy: {
      createdAt: "desc",
    },
  },
  procurementTasks: {
    orderBy: {
      createdAt: "asc",
    },
  },
} as const;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

function buildOrderTimeline(order: OrderWithRelations) {
  const payment = order.payments[0] ?? null;
  const procurementTasks = order.procurementTasks;
  const earliestTask = procurementTasks[0] ?? null;
  const purchasedMilestone = procurementTasks
    .map((task) => task.purchasedAt)
    .find((value) => value instanceof Date);
  const warehouseMilestone = procurementTasks
    .map((task) => task.receivedAtWarehouseAt)
    .find((value) => value instanceof Date);
  const readyToShipMilestone = procurementTasks
    .map((task) => task.readyToShipAt)
    .find((value) => value instanceof Date);

  return [
    {
      key: "ORDER_CREATED",
      label: "Order Created",
      happenedAt: order.createdAt,
      status: "completed",
    },
    {
      key: "PAYMENT_PENDING_REVIEW",
      label: "Payment Pending Review",
      happenedAt: payment?.reviewRequestedAt ?? null,
      status: payment?.reviewRequestedAt ? "completed" : "pending",
    },
    {
      key: "PAYMENT_APPROVED",
      label: "Payment Approved",
      happenedAt: payment?.approvedAt ?? null,
      status: payment?.approvedAt ? "completed" : "pending",
    },
    {
      key: "PAYMENT_COMPLETED",
      label: "Payment Completed",
      happenedAt: payment?.processedAt ?? order.paidAt ?? null,
      status: payment?.status === "PAID" || order.paidAt ? "completed" : "pending",
    },
    {
      key: "PROCUREMENT_STARTED",
      label: "Procurement Started",
      happenedAt: earliestTask?.createdAt ?? null,
      status: earliestTask ? "completed" : "pending",
    },
    {
      key: "PURCHASED_FROM_SUPPLIER",
      label: "Purchased From Supplier",
      happenedAt: purchasedMilestone ?? order.purchasedAt ?? null,
      status: purchasedMilestone || order.status === "PURCHASED_FROM_SUPPLIER" || order.status === "SHIPPED" || order.status === "DELIVERED" ? "completed" : "pending",
    },
    {
      key: "RECEIVED_AT_WAREHOUSE",
      label: "Received At Warehouse",
      happenedAt: warehouseMilestone ?? null,
      status: warehouseMilestone ? "completed" : "pending",
    },
    {
      key: "READY_TO_SHIP",
      label: "Ready To Ship",
      happenedAt: readyToShipMilestone ?? null,
      status: readyToShipMilestone ? "completed" : "pending",
    },
    {
      key: "SHIPPED",
      label: "Shipped",
      happenedAt: order.shippedAt ?? null,
      status: order.shippedAt ? "completed" : "pending",
    },
    {
      key: "DELIVERED",
      label: "Delivered",
      happenedAt: order.deliveredAt ?? null,
      status: order.deliveredAt ? "completed" : "pending",
    },
  ];
}

function mapOrder(order: OrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    supplierSubtotal: toNumber(order.supplierSubtotal),
    subtotal: toNumber(order.subtotal),
    shippingAmount: toNumber(order.shippingAmount),
    handlingAmount: toNumber(order.handlingAmount),
    paymentFeeAmount: toNumber(order.paymentFeeAmount),
    taxAmount: toNumber(order.taxAmount),
    totalAmount: toNumber(order.totalAmount),
    customerPaid: toNumber(order.customerPaid),
    profitAmount: toNumber(order.profitAmount),
    currency: order.currency,
    displayCurrency: order.displayCurrency,
    exchangeRateSnapshot: order.exchangeRateSnapshot,
    paymentProvider: order.paymentProvider,
    paymentMethodLabel: order.paymentMethodLabel,
    promotion: order.couponApplication
      ? {
          code: order.couponApplication.codeSnapshot,
          discountAmount: toNumber(order.couponApplication.discountAmount),
          shippingDiscountAmount: toNumber(order.couponApplication.shippingDiscountAmount),
          totalSavingsAmount: toNumber(order.couponApplication.totalSavingsAmount),
        }
      : null,
    trackingNumber: order.trackingNumber,
    carrier: order.carrier,
    trackingUrl: order.trackingUrl,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    shipmentNotes: order.shipmentNotes,
    notes: order.notes,
    internalNotes: order.internalNotes,
    refundedAmount: toNumber(order.refundedAmount),
    totalWeightKg: toNumber(order.totalWeightKg),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    purchasedAt: order.purchasedAt,
    refundedAt: order.refundedAt,
    tracking: {
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      trackingUrl: order.trackingUrl,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      shipmentNotes: order.shipmentNotes,
    },
    timeline: buildOrderTimeline(order),
    customerAddress: order.customerAddress
      ? {
          id: order.customerAddress.id,
          fullName: order.customerAddress.fullName,
          phone: order.customerAddress.phone,
          countryCode: order.customerAddress.countryCode,
          city: order.customerAddress.city,
          postalCode: order.customerAddress.postalCode,
          addressLine1: order.customerAddress.addressLine1,
          addressLine2: order.customerAddress.addressLine2,
        }
      : null,
    billingAddress: order.billingAddressRef
      ? {
          id: order.billingAddressRef.id,
          fullName: order.billingAddressRef.fullName,
          phone: order.billingAddressRef.phone,
          countryCode: order.billingAddressRef.countryCode,
          city: order.billingAddressRef.city,
          postalCode: order.billingAddressRef.postalCode,
          addressLine1: order.billingAddressRef.addressLine1,
          addressLine2: order.billingAddressRef.addressLine2,
        }
      : null,
    shippingMethod: order.shippingMethod
      ? {
          id: order.shippingMethod.id,
          name: order.shippingMethod.name,
          countryCode: order.shippingMethod.countryCode,
          originCountryCode: order.shippingMethod.originCountryCode,
          minWeightKg: toNumber(order.shippingMethod.minWeightKg),
          maxWeightKg: toNumber(order.shippingMethod.maxWeightKg),
          minDeliveryDays: order.shippingMethod.minDeliveryDays,
          maxDeliveryDays: order.shippingMethod.maxDeliveryDays,
          deliveryEstimate: order.shippingMethod.deliveryEstimate,
          baseFee: toNumber(order.shippingMethod.baseFee),
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      title: item.title,
      brandName: item.brandName,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      supplierCost: toNumber(item.supplierCost),
      customerPaid: toNumber(item.customerPaid),
      profitAmount: toNumber(item.profitAmount),
      unitPrice: toNumber(item.unitPrice),
      totalPrice: toNumber(item.totalPrice),
      imageUrl: item.imageUrl,
      sourceUrl: item.sourceUrl,
      sourceStore: item.sourceStore,
      currency: item.currency,
    })),
  };
}

function getPaymentProviderAdapter(provider: PaymentProvider): PaymentProviderAdapter {
  switch (provider) {
    case "MANUAL":
      return manualPaymentProvider;
    default:
      return manualPaymentProvider;
  }
}

async function publishOrderEvent(input: {
  eventKey: string;
  eventName:
    | "ORDER_CREATED"
    | "PROCUREMENT_STARTED"
    | "PRODUCT_SHIPPED"
    | "TRACKING_UPDATED"
    | "PRODUCT_DELIVERED"
    | "REFUND_ISSUED";
  actorUserId?: string | null;
  targetUserId: string;
  order: {
    id: string;
    orderNumber: string;
    currency: string;
    totalAmount: Prisma.Decimal;
    trackingNumber: string | null;
    carrier: string | null;
  };
  message: string;
}) {
  await notificationsService.publishEvent({
    eventKey: input.eventKey,
    eventName: input.eventName,
    eventSource:
      input.eventName === "REFUND_ISSUED"
        ? "PAYMENTS"
        : input.eventName === "PROCUREMENT_STARTED"
          ? "PROCUREMENT"
          : input.eventName === "TRACKING_UPDATED" || input.eventName === "PRODUCT_SHIPPED" || input.eventName === "PRODUCT_DELIVERED"
            ? "SHIPPING"
            : "ORDERS",
    actorUserId: input.actorUserId ?? null,
    targetUserId: input.targetUserId,
    orderId: input.order.id,
    entityType: "order",
    entityId: input.order.id,
    title: input.message,
    message: input.message,
    metadata: {
      orderNumber: input.order.orderNumber,
      paymentAmount: toNumber(input.order.totalAmount).toFixed(2),
      currency: input.order.currency,
      trackingNumber: input.order.trackingNumber,
      carrier: input.order.carrier,
    },
  });
}

export class OrdersService {
  public async listAddresses(userId: string) {
    const addresses = await prisma.customerAddress.findMany({
      where: {
        userId,
      },
      orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
    });

    return addresses.map((address) => ({
      id: address.id,
      fullName: address.fullName,
      phone: address.phone,
      countryCode: address.countryCode,
      city: address.city,
      postalCode: address.postalCode,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      isDefaultShipping: address.isDefaultShipping,
      isDefaultBilling: address.isDefaultBilling,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    }));
  }

  public async upsertAddress(
    userId: string,
    input: {
      id?: string;
      fullName: string;
      phone?: string | null;
      countryCode: string;
      city: string;
      postalCode: string;
      addressLine1: string;
      addressLine2?: string | null;
      isDefaultShipping?: boolean;
      isDefaultBilling?: boolean;
    },
  ) {
    if (input.isDefaultShipping) {
      await prisma.customerAddress.updateMany({
        where: {
          userId,
        },
        data: {
          isDefaultShipping: false,
        },
      });
    }

    if (input.isDefaultBilling) {
      await prisma.customerAddress.updateMany({
        where: {
          userId,
        },
        data: {
          isDefaultBilling: false,
        },
      });
    }

    const payload = {
      userId,
      fullName: input.fullName,
      phone: input.phone ?? null,
      countryCode: input.countryCode,
      city: input.city,
      postalCode: input.postalCode,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2 ?? null,
      isDefaultShipping: input.isDefaultShipping ?? false,
      isDefaultBilling: input.isDefaultBilling ?? false,
    };

    const address = input.id
      ? await prisma.customerAddress.update({
          where: { id: input.id },
          data: payload,
        })
      : await prisma.customerAddress.create({
          data: payload,
        });

    return {
      id: address.id,
      fullName: address.fullName,
      phone: address.phone,
      countryCode: address.countryCode,
      city: address.city,
      postalCode: address.postalCode,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      isDefaultShipping: address.isDefaultShipping,
      isDefaultBilling: address.isDefaultBilling,
    };
  }

  public async deleteAddress(userId: string, addressId: string) {
    const address = await prisma.customerAddress.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!address) {
      throw new ApiError(404, "Address not found.");
    }

    await prisma.customerAddress.delete({
      where: { id: address.id },
    });
  }

  public async getCheckoutSummary(userId: string, guestToken?: string | null) {
    const [cart, addresses, settings, paymentProviders, bankAccounts, currencyContext] = await Promise.all([
      cartService.getCart({
        userId,
        guestToken,
        createIfMissing: true,
      }),
      this.listAddresses(userId),
      commerceAdminService.getCommerceSettings(),
      paymentsService.getAvailableCheckoutProviders(),
      paymentsService.listBankAccounts(),
      currencyService.getCurrencyContext(userId),
    ]);

    const sourceCart = cart.cart.id
      ? await prisma.cart.findUnique({
          where: { id: cart.cart.id },
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
        })
      : null;

    const checkoutTotals = sourceCart
      ? await pricingService.calculateCartTotals({
          items: sourceCart.items.map((item) => ({
            quantity: item.quantity,
            customerPaid: item.customerPaid,
            unitWeightKg: 1,
          })),
          countryCode: sourceCart.countryCode,
          shippingMethodId: sourceCart.shippingMethodId,
        })
      : null;

    const promotion = sourceCart && checkoutTotals
      ? await couponService.getCartPromotionSummary(sourceCart.id, checkoutTotals, userId)
      : null;

    const checkoutCart = promotion?.status === "applied"
      ? {
          ...cart.cart,
          shippingAmount: promotion.shippingAfterDiscount,
          taxAmount: promotion.taxAmount,
          totalAmount: promotion.totalAfterDiscount,
          promotion,
        }
      : {
          ...cart.cart,
          promotion,
        };

    return {
      cart: checkoutCart,
      addresses,
      shippingMethods: settings.shippingMethods,
      countries: settings.countries,
      paymentProviders,
      bankAccounts: bankAccounts.filter((account) => account.isActive),
      businessSettings: settings.businessSettings,
      currencyContext,
      checkoutSteps: [
        "Cart Review",
        "Shipping Address",
        "Shipping Method",
        "Payment Method",
        "Order Review",
        "Place Order",
      ],
    };
  }

  public async createOrderFromCart(input: {
    userId: string;
    guestToken?: string | null;
    customerEmail: string;
    shippingAddressId: string;
    billingAddressId?: string | null;
    shippingMethodId?: string | null;
    paymentProvider: PaymentProvider;
    displayCurrency?: string | null;
    paymentMethodLabel?: string | null;
    notes?: string | null;
  }) {
    const [cartResult, shippingAddress, billingAddress, businessSettings] = await Promise.all([
      cartService.getCart({
        userId: input.userId,
        guestToken: input.guestToken,
        createIfMissing: true,
      }),
      prisma.customerAddress.findFirst({
        where: {
          id: input.shippingAddressId,
          userId: input.userId,
        },
      }),
      input.billingAddressId
        ? prisma.customerAddress.findFirst({
            where: {
              id: input.billingAddressId,
              userId: input.userId,
            },
          })
        : Promise.resolve(null),
      pricingService.getBusinessSettings(),
    ]);

    if (!shippingAddress) {
      throw new ApiError(404, "Shipping address not found.");
    }

    if (!cartResult.cart.items.length) {
      throw new ApiError(400, "Cart is empty.");
    }

    const sourceCart = await prisma.cart.findUnique({
      where: {
        id: cartResult.cart.id!,
      },
      include: {
        items: {
          include: {
            variant: true,
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

    if (!sourceCart) {
      throw new ApiError(404, "Cart not found.");
    }

    const totals = await pricingService.calculateCartTotals({
      items: sourceCart.items.map((item) => ({
        quantity: item.quantity,
        customerPaid: item.customerPaid,
        unitWeightKg: 1,
      })),
      countryCode: shippingAddress.countryCode,
      shippingMethodId: input.shippingMethodId ?? sourceCart.shippingMethodId,
    });

    const couponSummary = await couponService.getOrderCouponSummary({
      cartId: sourceCart.id,
      userId: input.userId,
      cart: sourceCart,
      totals,
    });

    if (totals.totalAmount.lessThan(totals.minimumOrderValue)) {
      throw new ApiError(
        400,
        `Minimum order value is ${businessSettings.defaultCurrency} ${totals.minimumOrderValue.toFixed(2)}.`,
      );
    }

    const supplierSubtotal = sourceCart.items.reduce(
      (sum, item) => sum.plus(item.supplierCost.mul(item.quantity)),
      new Prisma.Decimal(0),
    );
    const baseOrderProfit = sourceCart.items.reduce(
      (sum, item) => sum.plus(item.profitAmount.mul(item.quantity)),
      new Prisma.Decimal(0),
    );
    const orderProfit = couponSummary
      ? baseOrderProfit
          .minus(new Prisma.Decimal(couponSummary.discountAmount))
          .minus(new Prisma.Decimal(couponSummary.shippingDiscountAmount))
          .toDecimalPlaces(2)
      : baseOrderProfit;
    const finalShippingAmount = couponSummary
      ? new Prisma.Decimal(couponSummary.shippingAfterDiscount)
      : totals.shippingAmount;
    const finalTaxAmount = couponSummary ? new Prisma.Decimal(couponSummary.taxAmount) : totals.taxAmount;
    const finalTotalAmount = couponSummary ? new Prisma.Decimal(couponSummary.totalAfterDiscount) : totals.totalAmount;

    const shippingMethod = input.shippingMethodId
      ? await prisma.shippingMethod.findUnique({
          where: { id: input.shippingMethodId },
        })
      : null;
    const displayCurrency = input.displayCurrency ?? "EUR";
    const exchangeRateSnapshot =
      displayCurrency === totals.currency
        ? {
            baseCurrency: totals.currency,
            quoteCurrency: displayCurrency,
            rate: 1,
            originalAmount: 1,
            convertedAmount: 1,
          }
        : await currencyService
            .convertAmount({
              amount: 1,
              fromCurrency: totals.currency,
              toCurrency: displayCurrency,
            })
            .then((conversion) => ({
              baseCurrency: conversion.fromCurrency,
              quoteCurrency: conversion.toCurrency,
              rate: conversion.rate,
              originalAmount: conversion.originalAmount,
              convertedAmount: conversion.convertedAmount,
            }));

    const order = await prisma.$transaction(async (transaction) => {
      const createdOrder = await transaction.order.create({
        data: {
          userId: input.userId,
          cartId: sourceCart.id,
          customerAddressId: shippingAddress.id,
          billingAddressId: billingAddress?.id ?? shippingAddress.id,
          shippingMethodId: shippingMethod?.id ?? null,
          orderNumber: buildOrderNumber(),
          customerName: shippingAddress.fullName,
          customerEmail: input.customerEmail,
          supplierSubtotal,
          subtotal: totals.subtotalAmount,
          shippingAmount: finalShippingAmount,
          handlingAmount: totals.handlingAmount,
          paymentFeeAmount: totals.paymentFeeAmount,
          taxAmount: finalTaxAmount,
          totalAmount: finalTotalAmount,
          customerPaid: finalTotalAmount,
          profitAmount: orderProfit,
          totalWeightKg: totals.totalWeightKg,
          currency: totals.currency,
          displayCurrency,
          shippingAddress: {
            fullName: shippingAddress.fullName,
            phone: shippingAddress.phone,
            countryCode: shippingAddress.countryCode,
            city: shippingAddress.city,
            postalCode: shippingAddress.postalCode,
            addressLine1: shippingAddress.addressLine1,
            addressLine2: shippingAddress.addressLine2,
          },
          billingAddress: billingAddress
            ? {
                fullName: billingAddress.fullName,
                phone: billingAddress.phone,
                countryCode: billingAddress.countryCode,
                city: billingAddress.city,
                postalCode: billingAddress.postalCode,
                addressLine1: billingAddress.addressLine1,
                addressLine2: billingAddress.addressLine2,
              }
            : undefined,
          businessSettingsSnapshot: {
            businessName: businessSettings.businessName,
            supportEmail: businessSettings.supportEmail,
            defaultCurrency: businessSettings.defaultCurrency,
            defaultCountryCode: businessSettings.defaultCountryCode,
            defaultMarginPercent: toNumber(businessSettings.defaultMarginPercent),
            fixedProfitAmount: toNumber(businessSettings.fixedProfitAmount),
            handlingFee: toNumber(businessSettings.handlingFee),
            paymentFee: toNumber(businessSettings.paymentFee),
            vatPercent: toNumber(businessSettings.vatPercent),
            freeShippingThreshold: toNumber(businessSettings.freeShippingThreshold),
            minimumOrderValue: toNumber(businessSettings.minimumOrderValue),
          },
          pricingSnapshot: {
            shippingMethodId: shippingMethod?.id ?? null,
            shippingMethodName: shippingMethod?.name ?? null,
            countryCode: shippingAddress.countryCode,
            totalWeightKg: toNumber(totals.totalWeightKg),
            subtotalAmount: toNumber(totals.subtotalAmount),
            shippingAmount: toNumber(finalShippingAmount),
            handlingAmount: toNumber(totals.handlingAmount),
            paymentFeeAmount: toNumber(totals.paymentFeeAmount),
            taxAmount: toNumber(finalTaxAmount),
            totalAmount: toNumber(finalTotalAmount),
            promotion: couponSummary
              ? {
                  code: couponSummary.code,
                  description: couponSummary.description,
                  discountAmount: couponSummary.discountAmount,
                  shippingDiscountAmount: couponSummary.shippingDiscountAmount,
                  savingsAmount: couponSummary.savingsAmount,
                  totalBeforeDiscount: couponSummary.totalBeforeDiscount,
                  totalAfterDiscount: couponSummary.totalAfterDiscount,
                }
              : null,
          },
          exchangeRateSnapshot,
          paymentProvider: input.paymentProvider,
          paymentMethodLabel: input.paymentMethodLabel ?? null,
          notes: input.notes ?? null,
          items: {
            create: sourceCart.items.map((item) => ({
              productId: item.productId,
              title: item.snapshotTitle,
              brandName: item.snapshotBrand,
              size: item.variant?.size ?? null,
              color: item.variant?.color ?? null,
              quantity: item.quantity,
              supplierCost: item.supplierCost,
              customerPaid: item.customerPaid,
              profitAmount: item.profitAmount,
              unitPrice: item.customerPaid,
              totalPrice: item.customerPaid.mul(item.quantity),
              imageUrl: item.snapshotImageUrl,
              sourceUrl: item.snapshotSourceUrl,
              sourceStore: item.snapshotBrand,
              currency: item.currency,
            })),
          },
        },
        include: {
          ...orderInclude,
        },
      });

      if (couponSummary) {
        await couponService.recordOrderCouponUsage(transaction, {
          orderId: createdOrder.id,
          userId: input.userId,
          couponSummary,
        });
      }

      await transaction.cartItem.deleteMany({
        where: {
          cartId: sourceCart.id,
        },
      });

      await transaction.couponCartApplication.deleteMany({
        where: {
          cartId: sourceCart.id,
        },
      });

      await transaction.cart.update({
        where: { id: sourceCart.id },
        data: {
          subtotalAmount: 0,
          shippingAmount: 0,
          handlingAmount: 0,
          paymentFeeAmount: 0,
          taxAmount: 0,
          totalAmount: 0,
        },
      });

      return createdOrder;
    });

    await paymentsService.initializeOrderPayment({
      userId: input.userId,
      orderId: order.id,
      orderCurrency: order.currency,
      displayCurrency,
      provider: input.paymentProvider,
      amount: order.totalAmount,
      paymentMethodLabel: input.paymentMethodLabel ?? null,
    });

    const persistedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: orderInclude,
    });

    if (!persistedOrder) {
      throw new ApiError(404, "Order not found after creation.");
    }

    void publishOrderEvent({
      eventKey: `order-created:${persistedOrder.id}`,
      eventName: "ORDER_CREATED",
      actorUserId: input.userId,
      targetUserId: persistedOrder.userId,
      order: persistedOrder,
      message: `Order ${persistedOrder.orderNumber} created`,
    })
      .catch(() => undefined);
    await referralService.syncOrderReferralRewards(persistedOrder.id);
    return mapOrder(persistedOrder);
  }

  public async listCustomerOrders(userId: string) {
    const orders = await prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });

    return orders.map(mapOrder);
  }

  public async listAdminOrders() {
    const orders = await prisma.order.findMany({
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });

    return orders.map(mapOrder);
  }

  public async updateOrderStatus(orderId: string, status: OrderStatus) {
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });

    if (!existingOrder) {
      throw new ApiError(404, "Order not found.");
    }

    const shouldCountPurchases = status === "PAID" && !existingOrder.paidAt;
    const timestampFields: Prisma.OrderUpdateInput = {};

    if (status === "PAID") {
      timestampFields.paidAt = new Date();
    }
    if (status === "PURCHASED_FROM_SUPPLIER") {
      timestampFields.purchasedAt = new Date();
    }
    if (status === "SHIPPED") {
      timestampFields.shippedAt = new Date();
    }
    if (status === "DELIVERED") {
      timestampFields.deliveredAt = new Date();
    }
    if (status === "REFUNDED") {
      timestampFields.refundedAt = new Date();
    }
    if (status === "CANCELLED") {
      timestampFields.cancelledAt = new Date();
    }

    const order = await prisma.$transaction(async (transaction) => {
      const updatedOrder = await transaction.order.update({
        where: { id: orderId },
        data: {
          status,
          ...timestampFields,
        },
        include: orderInclude,
      });

      if (shouldCountPurchases) {
        await incrementProductPurchasesForOrderItems(transaction, updatedOrder.items);
      }

      return updatedOrder;
    });

    if (shouldGenerateProcurementTasks(order.status)) {
      await procurementService.createTasksForOrder(order.id);
    }

    if (status === "SHIPPED") {
      await publishOrderEvent({
        eventKey: `order-shipped:${order.id}:${order.shippedAt?.toISOString() ?? Date.now()}`,
        eventName: "PRODUCT_SHIPPED",
        targetUserId: order.userId,
        order,
        message: `Order ${order.orderNumber} shipped`,
      });
    }

    if (status === "DELIVERED") {
      await publishOrderEvent({
        eventKey: `order-delivered:${order.id}:${order.deliveredAt?.toISOString() ?? Date.now()}`,
        eventName: "PRODUCT_DELIVERED",
        targetUserId: order.userId,
        order,
        message: `Order ${order.orderNumber} delivered`,
      });
    }

    if (status === "DELIVERED" || status === "CANCELLED" || status === "REFUNDED") {
      await loyaltyService.reconcileOrderPoints(order.id);
    }

    await referralService.syncOrderReferralRewards(order.id);

    return mapOrder(order);
  }

  public async updateTrackingNumber(
    orderId: string,
    input: {
      trackingNumber?: string | null;
      carrier?: string | null;
      trackingUrl?: string | null;
      estimatedDeliveryDate?: Date | null;
      shipmentNotes?: string | null;
    },
  ) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingNumber:
          input.trackingNumber !== undefined ? input.trackingNumber : undefined,
        carrier: input.carrier !== undefined ? input.carrier : undefined,
        trackingUrl: input.trackingUrl !== undefined ? input.trackingUrl : undefined,
        estimatedDeliveryDate:
          input.estimatedDeliveryDate !== undefined ? input.estimatedDeliveryDate : undefined,
        shipmentNotes: input.shipmentNotes !== undefined ? input.shipmentNotes : undefined,
      },
      include: orderInclude,
    });

    if (shouldGenerateProcurementTasks(order.status)) {
      await procurementService.createTasksForOrder(order.id);
    }

    await publishOrderEvent({
      eventKey: `tracking-updated:${order.id}:${Date.now()}`,
      eventName: "TRACKING_UPDATED",
      targetUserId: order.userId,
      order,
      message: `Tracking updated for ${order.orderNumber}`,
    });

    return mapOrder(order);
  }

  public async updateAdminOrder(
    orderId: string,
    input: {
      status?: OrderStatus;
      trackingNumber?: string | null;
      carrier?: string | null;
      trackingUrl?: string | null;
      estimatedDeliveryDate?: Date | null;
      shipmentNotes?: string | null;
      internalNotes?: string | null;
    },
  ) {
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });

    if (!existingOrder) {
      throw new ApiError(404, "Order not found.");
    }

    const shouldCountPurchases = input.status === "PAID" && !existingOrder.paidAt;
    const timestampFields: Prisma.OrderUpdateInput = {};

    if (input.status === "PAID") {
      timestampFields.paidAt = new Date();
    }
    if (input.status === "PURCHASED_FROM_SUPPLIER") {
      timestampFields.purchasedAt = new Date();
    }
    if (input.status === "SHIPPED") {
      timestampFields.shippedAt = new Date();
    }
    if (input.status === "DELIVERED") {
      timestampFields.deliveredAt = new Date();
    }
    if (input.status === "REFUNDED") {
      timestampFields.refundedAt = new Date();
    }
    if (input.status === "CANCELLED") {
      timestampFields.cancelledAt = new Date();
    }

    const order = await prisma.$transaction(async (transaction) => {
      const updatedOrder = await transaction.order.update({
        where: { id: orderId },
        data: {
          status: input.status,
          trackingNumber:
            input.trackingNumber === null
              ? null
              : input.trackingNumber !== undefined
                ? input.trackingNumber
                : undefined,
          carrier:
            input.carrier === null
              ? null
              : input.carrier !== undefined
                ? input.carrier
                : undefined,
          trackingUrl:
            input.trackingUrl === null
              ? null
              : input.trackingUrl !== undefined
                ? input.trackingUrl
                : undefined,
          estimatedDeliveryDate:
            input.estimatedDeliveryDate === null
              ? null
              : input.estimatedDeliveryDate !== undefined
                ? input.estimatedDeliveryDate
                : undefined,
          shipmentNotes:
            input.shipmentNotes === null
              ? null
              : input.shipmentNotes !== undefined
                ? input.shipmentNotes
                : undefined,
          internalNotes:
            input.internalNotes === null
              ? null
              : input.internalNotes !== undefined
                ? input.internalNotes
                : undefined,
          ...timestampFields,
        },
        include: orderInclude,
      });

      if (shouldCountPurchases) {
        await incrementProductPurchasesForOrderItems(transaction, updatedOrder.items);
      }

      return updatedOrder;
    });

    if (shouldGenerateProcurementTasks(order.status)) {
      await procurementService.createTasksForOrder(order.id);
    }

    if (input.status === "SHIPPED") {
      await publishOrderEvent({
        eventKey: `order-shipped:${order.id}:${order.shippedAt?.toISOString() ?? Date.now()}`,
        eventName: "PRODUCT_SHIPPED",
        targetUserId: order.userId,
        order,
        message: `Order ${order.orderNumber} shipped`,
      });
    }

    if (input.status === "DELIVERED") {
      await publishOrderEvent({
        eventKey: `order-delivered:${order.id}:${order.deliveredAt?.toISOString() ?? Date.now()}`,
        eventName: "PRODUCT_DELIVERED",
        targetUserId: order.userId,
        order,
        message: `Order ${order.orderNumber} delivered`,
      });
    }

    if (input.status === "DELIVERED" || input.status === "CANCELLED" || input.status === "REFUNDED") {
      await loyaltyService.reconcileOrderPoints(order.id);
    }

    await referralService.syncOrderReferralRewards(order.id);

    return mapOrder(order);
  }

  public async refundOrder(orderId: string, amount?: number | null, internalNotes?: string | null) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new ApiError(404, "Order not found.");
    }

    const provider = getPaymentProviderAdapter(order.paymentProvider);
    const refundAmount = amount ?? toNumber(order.totalAmount);
    const paymentReference =
      typeof order.paymentMethodLabel === "string" && order.paymentMethodLabel.length > 0
        ? order.paymentMethodLabel
        : order.orderNumber;

    await provider.refundPayment(paymentReference, refundAmount);

    const refunded = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "REFUNDED",
        refundedAmount: new Prisma.Decimal(refundAmount),
        refundedAt: new Date(),
        internalNotes:
          internalNotes !== undefined
            ? internalNotes
            : order.internalNotes,
      },
      include: orderInclude,
    });

    await prisma.payment.updateMany({
      where: {
        orderId,
        kind: PaymentKind.CHARGE,
      },
      data: {
        status: PaymentStatus.REFUNDED,
      },
    });

    await prisma.payment.create({
      data: {
        userId: refunded.userId,
        orderId: refunded.id,
        provider: refunded.paymentProvider,
        kind: PaymentKind.REFUND,
        status: PaymentStatus.REFUNDED,
        currency: refunded.currency,
        amount: new Prisma.Decimal(refundAmount),
        metadata: {
          internalNotes: internalNotes ?? null,
        },
        processedAt: new Date(),
      },
    });

    await publishOrderEvent({
      eventKey: `refund-issued:${refunded.id}:${refunded.refundedAt?.toISOString() ?? Date.now()}`,
      eventName: "REFUND_ISSUED",
      targetUserId: refunded.userId,
      order: refunded,
      message: `Refund issued for ${refunded.orderNumber}`,
    });

    await loyaltyService.reconcileOrderPoints(refunded.id);
    await referralService.syncOrderReferralRewards(refunded.id);

    return mapOrder(refunded);
  }
}

export const ordersService = new OrdersService();
