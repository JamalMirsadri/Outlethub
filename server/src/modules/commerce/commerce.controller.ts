import type { Request, Response } from "express";

import { env } from "../../config/env.js";
import { cartService } from "./cart.service.js";
import { commerceAdminService } from "./commerce-admin.service.js";
import { couponService } from "./coupon.service.js";
import { currencyService } from "./currency.service.js";
import { loyaltyService } from "./loyalty.service.js";
import { ordersService } from "./orders.service.js";
import { paymentsService } from "./payments.service.js";
import { pricingService } from "./pricing.service.js";
import { procurementService } from "./procurement.service.js";
import { referralService } from "./referral.service.js";

const CART_COOKIE_NAME = "outlethub_cart_token";
const cartCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
};

function getGuestToken(request: Request): string | null {
  const value = request.cookies[CART_COOKIE_NAME];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function setGuestCartCookie(response: Response, guestToken: string | null) {
  if (!guestToken) {
    response.clearCookie(CART_COOKIE_NAME, cartCookieOptions);
    return;
  }

  response.cookie(CART_COOKIE_NAME, guestToken, {
    ...cartCookieOptions,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
}

function requireUserId(request: Request): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new Error("Authentication is required.");
  }

  return userId;
}

function getParam(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing route param: ${key}`);
  }

  return value;
}

export class CommerceController {
  public async getCart(request: Request, response: Response) {
    const result = await cartService.getCart({
      userId: request.auth?.userId,
      guestToken: getGuestToken(request),
      createIfMissing: true,
    });

    setGuestCartCookie(response, result.guestToken);
    response.status(200).json(result.cart);
  }

  public async addCartItem(request: Request, response: Response) {
    const result = await cartService.addItem({
      userId: request.auth?.userId,
      guestToken: getGuestToken(request),
      productId: request.body.productId,
      variantId: request.body.variantId ?? null,
      quantity: request.body.quantity,
    });

    setGuestCartCookie(response, result.guestToken);
    response.status(201).json(result.cart);
  }

  public async updateCartItem(request: Request, response: Response) {
    const result = await cartService.updateItem({
      userId: request.auth?.userId,
      guestToken: getGuestToken(request),
      itemId: getParam(request, "id"),
      quantity: request.body.quantity,
    });

    setGuestCartCookie(response, result.guestToken);
    response.status(200).json(result.cart);
  }

  public async removeCartItem(request: Request, response: Response) {
    const result = await cartService.removeItem({
      userId: request.auth?.userId,
      guestToken: getGuestToken(request),
      itemId: getParam(request, "id"),
    });

    setGuestCartCookie(response, result.guestToken);
    response.status(200).json(result.cart);
  }

  public async clearCart(request: Request, response: Response) {
    const result = await cartService.clearCart({
      userId: request.auth?.userId,
      guestToken: getGuestToken(request),
    });

    setGuestCartCookie(response, result.guestToken);
    response.status(200).json(result.cart);
  }

  public async mergeGuestCart(request: Request, response: Response) {
    const result = await cartService.mergeGuestCartIntoUser({
      userId: requireUserId(request),
      guestToken: request.body.guestToken ?? getGuestToken(request),
    });

    setGuestCartCookie(response, result.guestToken);
    response.status(200).json(result.cart);
  }

  public async updateCartCountry(request: Request, response: Response) {
    const result = await cartService.updateCartCountry({
      userId: request.auth?.userId,
      guestToken: getGuestToken(request),
      countryCode: request.body.countryCode,
      shippingMethodId: request.body.shippingMethodId ?? null,
    });

    setGuestCartCookie(response, result.guestToken);
    response.status(200).json(result.cart);
  }

  public async getCurrencyContext(request: Request, response: Response) {
    response.status(200).json(await currencyService.getCurrencyContext(request.auth?.userId));
  }

  public async updatePreferredCurrency(request: Request, response: Response) {
    response.status(200).json({
      preferredCurrency: await currencyService.updatePreferredCurrency(requireUserId(request), request.body.currency),
    });
  }

  public async previewProfit(request: Request, response: Response) {
    response.status(200).json(pricingService.previewProfit(request.body));
  }

  public async getCommerceSettings(_request: Request, response: Response) {
    response.status(200).json(await commerceAdminService.getCommerceSettings());
  }

  public async getSiteContentSettings(_request: Request, response: Response) {
    response.status(200).json(await commerceAdminService.getSiteContentSettings());
  }

  public async updateSiteContentSettings(request: Request, response: Response) {
    response.status(200).json(await commerceAdminService.updateSiteContentSettings(request.body));
  }

  public async updateBusinessSettings(request: Request, response: Response) {
    response.status(200).json(await commerceAdminService.updateBusinessSettings(request.body));
  }

  public async createPricingRule(request: Request, response: Response) {
    response.status(201).json(await commerceAdminService.createPricingRule(request.body));
  }

  public async updatePricingRule(request: Request, response: Response) {
    response.status(200).json(await commerceAdminService.updatePricingRule(getParam(request, "id"), request.body));
  }

  public async deletePricingRule(request: Request, response: Response) {
    await commerceAdminService.deletePricingRule(getParam(request, "id"));
    response.status(204).send();
  }

  public async upsertShippingMethod(request: Request, response: Response) {
    const statusCode = request.body.id ? 200 : 201;
    response.status(statusCode).json(await commerceAdminService.upsertShippingMethod(request.body));
  }

  public async deleteShippingMethod(request: Request, response: Response) {
    await commerceAdminService.deleteShippingMethod(getParam(request, "id"));
    response.status(204).send();
  }

  public async getProductCommerceDetail(request: Request, response: Response) {
    response.status(200).json(await commerceAdminService.getProductCommerceDetail(getParam(request, "id")));
  }

  public async updateProductPricingOverride(request: Request, response: Response) {
    response
      .status(200)
      .json(await commerceAdminService.updateProductPricingOverride(getParam(request, "id"), request.body));
  }

  public async getRevenueAnalytics(_request: Request, response: Response) {
    response.status(200).json(await commerceAdminService.getRevenueAnalytics());
  }

  public async getAdminLoyaltyOverview(_request: Request, response: Response) {
    response.status(200).json(await loyaltyService.getAdminOverview());
  }

  public async getAdminCouponOverview(_request: Request, response: Response) {
    response.status(200).json(await couponService.getAdminOverview());
  }

  public async createCoupon(request: Request, response: Response) {
    response.status(201).json(await couponService.createCoupon(request.body));
  }

  public async updateCoupon(request: Request, response: Response) {
    response.status(200).json(await couponService.updateCoupon(getParam(request, "id"), request.body));
  }

  public async duplicateCoupon(request: Request, response: Response) {
    response.status(201).json(await couponService.duplicateCoupon(getParam(request, "id")));
  }

  public async deleteCoupon(request: Request, response: Response) {
    await couponService.deleteCoupon(getParam(request, "id"));
    response.status(204).send();
  }

  public async createLoyaltyPointRule(request: Request, response: Response) {
    response.status(201).json(await loyaltyService.createPointRule(request.body));
  }

  public async updateLoyaltyPointRule(request: Request, response: Response) {
    response.status(200).json(await loyaltyService.updatePointRule(getParam(request, "id"), request.body));
  }

  public async deleteLoyaltyPointRule(request: Request, response: Response) {
    await loyaltyService.deletePointRule(getParam(request, "id"));
    response.status(204).send();
  }

  public async createLoyaltyMembershipLevel(request: Request, response: Response) {
    response.status(201).json(await loyaltyService.createMembershipLevel(request.body));
  }

  public async updateLoyaltyMembershipLevel(request: Request, response: Response) {
    response.status(200).json(await loyaltyService.updateMembershipLevel(getParam(request, "id"), request.body));
  }

  public async deleteLoyaltyMembershipLevel(request: Request, response: Response) {
    await loyaltyService.deleteMembershipLevel(getParam(request, "id"));
    response.status(204).send();
  }

  public async createLoyaltyReward(request: Request, response: Response) {
    response.status(201).json(await loyaltyService.createReward(request.body));
  }

  public async updateLoyaltyReward(request: Request, response: Response) {
    response.status(200).json(await loyaltyService.updateReward(getParam(request, "id"), request.body));
  }

  public async deleteLoyaltyReward(request: Request, response: Response) {
    await loyaltyService.deleteReward(getParam(request, "id"));
    response.status(204).send();
  }

  public async createLoyaltyManualAdjustment(request: Request, response: Response) {
    response.status(201).json(await loyaltyService.applyManualAdjustment(requireUserId(request), request.body));
  }

  public async listSources(_request: Request, response: Response) {
    response.status(200).json({ items: await commerceAdminService.listSources() });
  }

  public async upsertSource(request: Request, response: Response) {
    const statusCode = request.body.id ? 200 : 201;
    response.status(statusCode).json(await commerceAdminService.upsertSource(request.body));
  }

  public async deleteSource(request: Request, response: Response) {
    await commerceAdminService.deleteSource(getParam(request, "id"));
    response.status(204).send();
  }

  public async listAddresses(request: Request, response: Response) {
    response.status(200).json({ items: await ordersService.listAddresses(requireUserId(request)) });
  }

  public async upsertAddress(request: Request, response: Response) {
    const statusCode = request.body.id ? 200 : 201;
    response.status(statusCode).json(await ordersService.upsertAddress(requireUserId(request), request.body));
  }

  public async deleteAddress(request: Request, response: Response) {
    await ordersService.deleteAddress(requireUserId(request), getParam(request, "id"));
    response.status(204).send();
  }

  public async getCheckoutSummary(request: Request, response: Response) {
    response
      .status(200)
      .json(await ordersService.getCheckoutSummary(requireUserId(request), getGuestToken(request)));
  }

  public async createOrder(request: Request, response: Response) {
    response.status(201).json(
      await ordersService.createOrderFromCart({
        userId: requireUserId(request),
        guestToken: getGuestToken(request),
        customerEmail: request.body.customerEmail,
        shippingAddressId: request.body.shippingAddressId,
        billingAddressId: request.body.billingAddressId ?? null,
        shippingMethodId: request.body.shippingMethodId ?? null,
        paymentProvider: request.body.paymentProvider,
        displayCurrency: request.body.displayCurrency ?? null,
        paymentMethodLabel: request.body.paymentMethodLabel ?? null,
        notes: request.body.notes ?? null,
      }),
    );
  }

  public async applyCheckoutCoupon(request: Request, response: Response) {
    response.status(200).json(await couponService.applyCouponToCheckout(requireUserId(request), request.body.code));
  }

  public async clearCheckoutCoupon(request: Request, response: Response) {
    await couponService.clearCheckoutCoupon(requireUserId(request));
    response.status(204).send();
  }

  public async listCustomerOrders(request: Request, response: Response) {
    response.status(200).json({ items: await ordersService.listCustomerOrders(requireUserId(request)) });
  }

  public async listCustomerPayments(request: Request, response: Response) {
    response.status(200).json({ items: await paymentsService.getCustomerPayments(requireUserId(request)) });
  }

  public async getCustomerRewards(request: Request, response: Response) {
    response.status(200).json(await loyaltyService.getCustomerRewards(requireUserId(request)));
  }

  public async redeemReward(request: Request, response: Response) {
    response.status(200).json(await loyaltyService.redeemReward(requireUserId(request), getParam(request, "id")));
  }

  public async getCustomerReferrals(request: Request, response: Response) {
    response.status(200).json(await referralService.getCustomerOverview(requireUserId(request)));
  }

  public async getAdminReferrals(_request: Request, response: Response) {
    response.status(200).json(await referralService.getAdminOverview());
  }

  public async createReferralRule(request: Request, response: Response) {
    response.status(201).json(await referralService.createRule(request.body));
  }

  public async updateReferralRule(request: Request, response: Response) {
    response.status(200).json(await referralService.updateRule(getParam(request, "id"), request.body));
  }

  public async deleteReferralRule(request: Request, response: Response) {
    await referralService.deleteRule(getParam(request, "id"));
    response.status(204).send();
  }

  public async createReferralRelationship(request: Request, response: Response) {
    response.status(201).json(await referralService.createRelationship(requireUserId(request), request.body));
  }

  public async updateReferralRelationship(request: Request, response: Response) {
    response.status(200).json(
      await referralService.updateRelationship(requireUserId(request), getParam(request, "id"), request.body),
    );
  }

  public async deleteReferralRelationship(request: Request, response: Response) {
    await referralService.deleteRelationship(requireUserId(request), getParam(request, "id"));
    response.status(204).send();
  }

  public async updateReferralUserCode(request: Request, response: Response) {
    response.status(200).json(
      await referralService.updateUserReferralCode(requireUserId(request), {
        userId: getParam(request, "id"),
        referralCode: request.body.referralCode,
      }),
    );
  }

  public async uploadPaymentReceipt(request: Request, response: Response) {
    response
      .status(200)
      .json(await paymentsService.uploadReceipt(requireUserId(request), getParam(request, "id"), request.body));
  }

  public async listAdminOrders(_request: Request, response: Response) {
    response.status(200).json({ items: await ordersService.listAdminOrders() });
  }

  public async updateOrderStatus(request: Request, response: Response) {
    response
      .status(200)
      .json(await ordersService.updateOrderStatus(getParam(request, "id"), request.body.status));
  }

  public async updateTrackingNumber(request: Request, response: Response) {
    response
      .status(200)
      .json(
        await ordersService.updateTrackingNumber(getParam(request, "id"), {
          trackingNumber: request.body.trackingNumber ?? undefined,
          carrier: request.body.carrier ?? undefined,
          trackingUrl: request.body.trackingUrl ?? undefined,
          estimatedDeliveryDate: request.body.estimatedDeliveryDate
            ? new Date(request.body.estimatedDeliveryDate)
            : request.body.estimatedDeliveryDate ?? undefined,
          shipmentNotes: request.body.shipmentNotes ?? undefined,
        }),
      );
  }

  public async updateAdminOrder(request: Request, response: Response) {
    response
      .status(200)
      .json(
        await ordersService.updateAdminOrder(getParam(request, "id"), {
          ...request.body,
          estimatedDeliveryDate: request.body.estimatedDeliveryDate
            ? new Date(request.body.estimatedDeliveryDate)
            : request.body.estimatedDeliveryDate ?? undefined,
        }),
      );
  }

  public async refundOrder(request: Request, response: Response) {
    response
      .status(200)
      .json(
        await ordersService.refundOrder(
          getParam(request, "id"),
          request.body.amount ?? null,
          request.body.internalNotes ?? undefined,
        ),
      );
  }

  public async getProcurementDashboard(_request: Request, response: Response) {
    response.status(200).json(await procurementService.getDashboard());
  }

  public async updateProcurementTask(request: Request, response: Response) {
    response.status(200).json(await procurementService.updateTask(getParam(request, "id"), request.body));
  }

  public async getAdminPayments(_request: Request, response: Response) {
    response.status(200).json(await paymentsService.getAdminPaymentsDashboard());
  }

  public async getPaymentReviewQueue(_request: Request, response: Response) {
    response.status(200).json({ items: await paymentsService.getPaymentReviewQueue() });
  }

  public async reviewPayment(request: Request, response: Response) {
    response
      .status(200)
      .json(await paymentsService.reviewPayment(requireUserId(request), getParam(request, "id"), request.body));
  }

  public async completePayment(request: Request, response: Response) {
    response
      .status(200)
      .json(await paymentsService.completePayment(requireUserId(request), getParam(request, "id")));
  }

  public async listBankAccounts(_request: Request, response: Response) {
    response.status(200).json({ items: await paymentsService.listBankAccounts() });
  }

  public async upsertBankAccount(request: Request, response: Response) {
    const id = request.params.id ? getParam(request, "id") : request.body.id;
    const statusCode = id ? 200 : 201;
    response.status(statusCode).json(await paymentsService.upsertBankAccount({ ...request.body, id }));
  }

  public async deleteBankAccount(request: Request, response: Response) {
    await paymentsService.deleteBankAccount(getParam(request, "id"));
    response.status(204).send();
  }

  public async listExchangeRates(_request: Request, response: Response) {
    response.status(200).json({ items: await paymentsService.listExchangeRates() });
  }

  public async upsertExchangeRate(request: Request, response: Response) {
    const id = request.params.id ? getParam(request, "id") : request.body.id;
    const statusCode = id ? 200 : 201;
    response
      .status(statusCode)
      .json(await paymentsService.upsertExchangeRate(requireUserId(request), { ...request.body, id }));
  }
}

export const commerceController = new CommerceController();
