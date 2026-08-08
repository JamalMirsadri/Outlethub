import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";
import type { SiteContentSettings } from "@/lib/site-content";

export type PaymentProvider = "BANK_TRANSFER" | "STRIPE" | "PAYPAL" | "MB_WAY" | "MULTIBANCO" | "MANUAL";
export type PaymentStatus =
  | "PAYMENT_PENDING_REVIEW"
  | "PAYMENT_APPROVED"
  | "PAYMENT_REJECTED"
  | "PAYMENT_PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "PENDING"
  | "REQUIRES_ACTION"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";
export type OrderStatus =
  | "PENDING"
  | "PAYMENT_APPROVED"
  | "PAID"
  | "PROCESSING"
  | "PURCHASED_FROM_SUPPLIER"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";
export type ProcurementStatus =
  | "PURCHASE_REQUIRED"
  | "PURCHASED_FROM_SUPPLIER"
  | "RECEIVED_AT_WAREHOUSE"
  | "READY_TO_SHIP";
export type PricingTargetType = "GLOBAL" | "BRAND" | "CATEGORY";
export type CouponDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type CouponStatus = "ACTIVE" | "DISABLED";

export interface CartPromotionRecord {
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

export interface CartItemRecord {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  currency: string;
  supplierCost: number;
  customerPaid: number;
  profitAmount: number;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  size: string | null;
  color: string | null;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string;
    stockStatus: string;
    imageUrl: string | null;
  };
}

export interface CartRecord {
  id: string | null;
  itemCount: number;
  currency: string;
  countryCode: string;
  subtotalAmount: number;
  shippingAmount: number;
  handlingAmount: number;
  paymentFeeAmount: number;
  taxAmount: number;
  totalAmount: number;
  promotion: CartPromotionRecord | null;
  items: CartItemRecord[];
  shippingMethod: {
    id: string;
    name: string;
    countryCode: string;
    originCountryCode: string | null;
    baseFee: number;
    minWeightKg: number;
    maxWeightKg: number;
    minDeliveryDays: number;
    maxDeliveryDays: number;
    deliveryEstimate: string | null;
  } | null;
}

export interface CommerceSettingsResponse {
  businessSettings: {
    id: string;
    businessName: string;
    supportEmail: string;
    defaultCurrency: string;
    defaultCountryCode: string;
    defaultMarginPercent: number | null;
    minimumProfitAmount: number | null;
    portugalShippingFee: number | null;
    spainShippingFee: number | null;
    iranShippingFee: number | null;
    fixedProfitAmount: number | null;
    handlingFee: number | null;
    paymentFee: number | null;
    vatPercent: number | null;
    freeShippingThreshold: number | null;
    minimumOrderValue: number | null;
    returnPeriodDays: number;
  };
  pricingRules: Array<{
    id: string;
    name: string;
    targetType: PricingTargetType;
    brandId: string | null;
    categoryId: string | null;
    countryCode: string | null;
    currency: string;
    marginPercent: number | null;
    localShippingFee: number | null;
    minimumProfitAmount: number | null;
    fixedFee: number | null;
    shippingFee: number | null;
    handlingFee: number | null;
    paymentFee: number | null;
    taxPercent: number | null;
    freeShippingThreshold: number | null;
    minimumOrderValue: number | null;
    isDefault: boolean;
    isActive: boolean;
    priority: number;
    brand: { id: string; name: string } | null;
    category: { id: string; name: string } | null;
    country: { code: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
  }>;
  shippingMethods: Array<{
    id: string;
    name: string;
    countryCode: string;
    originCountryCode: string | null;
    currency: string;
    minWeightKg: number | null;
    maxWeightKg: number | null;
    minDeliveryDays: number;
    maxDeliveryDays: number;
    baseFee: number;
    freeShippingThreshold: number | null;
    deliveryEstimate: string | null;
    isActive: boolean;
    country: { code: string; name: string };
  }>;
  countries: Array<{
    code: string;
    name: string;
    region: string | null;
    isActive: boolean;
  }>;
  currencies: Array<{
    code: string;
    name: string;
    symbol: string;
    isDefault: boolean;
  }>;
  taxSettings: Array<{
    id: string;
    countryCode: string;
    name: string;
    taxPercent: number | null;
    isActive: boolean;
    country: { code: string; name: string };
  }>;
  sources: BrandSourceRecord[];
}

export type SiteContentSettingsResponse = SiteContentSettings;

export interface BrandSourceRecord {
  id: string;
  brandName: string;
  website: string;
  countryCode: string | null;
  currencyCode: string | null;
  region: string | null;
  sourceType: "PLAYWRIGHT" | "JSON_FEED" | "XML_FEED" | "MANUAL_IMPORT";
  status: "ACTIVE" | "DISABLED" | "ERROR";
  notes: string | null;
  pricingRuleId: string | null;
  shippingMethodId: string | null;
  pricingRule: { id: string; name: string } | null;
  shippingMethod: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddressRecord {
  id: string;
  fullName: string;
  phone: string | null;
  countryCode: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string | null;
  customerEmail: string;
  supplierSubtotal: number;
  subtotal: number;
  shippingAmount: number;
  handlingAmount: number;
  paymentFeeAmount: number;
  taxAmount: number;
  totalAmount: number;
  customerPaid: number;
  profitAmount: number;
  currency: string;
  displayCurrency: string;
  exchangeRateSnapshot: {
    baseCurrency?: string;
    quoteCurrency?: string;
    rate?: number;
    originalAmount?: number;
    convertedAmount?: number;
  } | null;
  paymentProvider: PaymentProvider;
  paymentMethodLabel: string | null;
  promotion: {
    code: string;
    discountAmount: number;
    shippingDiscountAmount: number;
    totalSavingsAmount: number;
  } | null;
  trackingNumber: string | null;
  carrier: string | null;
  trackingUrl: string | null;
  estimatedDeliveryDate: string | null;
  shipmentNotes: string | null;
  notes: string | null;
  internalNotes: string | null;
  refundedAmount: number;
  totalWeightKg: number;
  createdAt: string;
  updatedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  purchasedAt: string | null;
  refundedAt: string | null;
  tracking: {
    trackingNumber: string | null;
    carrier: string | null;
    trackingUrl: string | null;
    estimatedDeliveryDate: string | null;
    shipmentNotes: string | null;
  };
  timeline: Array<{
    key: string;
    label: string;
    happenedAt: string | null;
    status: "completed" | "pending";
  }>;
  customerAddress: CustomerAddressRecord | null;
  billingAddress: CustomerAddressRecord | null;
  shippingMethod: {
    id: string;
    name: string;
    countryCode: string;
    originCountryCode: string | null;
    minWeightKg: number;
    maxWeightKg: number;
    minDeliveryDays: number;
    maxDeliveryDays: number;
    deliveryEstimate: string | null;
    baseFee: number;
  } | null;
  items: Array<{
    id: string;
    productId: string | null;
    title: string;
    brandName: string | null;
    size: string | null;
    color: string | null;
    quantity: number;
    supplierCost: number;
    customerPaid: number;
    profitAmount: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl: string | null;
    sourceUrl: string | null;
    sourceStore: string | null;
    currency: string;
  }>;
}

export interface PaymentProviderConfigRecord {
  id: string;
  code: PaymentProvider;
  displayName: string;
  isActive: boolean;
  priority: number;
  supportsReceipts: boolean;
  supportsRefunds: boolean;
  supportsWebhooks: boolean;
  supportedCurrencies: string[];
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccountRecord {
  id: string;
  bankName: string;
  accountHolder: string;
  iban: string | null;
  accountNumber: string | null;
  cardNumber: string | null;
  swift: string | null;
  country: string;
  currency: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeRateRecord {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  isActive: boolean;
  updatedByUserId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrencyContextResponse {
  preferredCurrency: string;
  supportedDisplayCurrencies: Array<{
    code: string;
    name: string;
    symbol: string;
    isDefault: boolean;
  }>;
  exchangeRates: ExchangeRateRecord[];
}

export interface PaymentRecord {
  id: string;
  orderId: string | null;
  provider: PaymentProvider;
  providerLabel: string;
  providerConfiguration: PaymentProviderConfigRecord | null;
  status: PaymentStatus;
  statusLabel: string;
  kind: string;
  currency: string;
  displayCurrency: string;
  amount: number;
  exchangeRate: number;
  paymentReference: string | null;
  receiptUrl: string | null;
  receiptFileName: string | null;
  receiptMimeType: string | null;
  receiptUploadedAt: string | null;
  customerNotes: string | null;
  internalNotes: string | null;
  reviewRequestedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  processedAt: string | null;
  metadata: Record<string, unknown> | null;
  order: {
    id: string;
    orderNumber: string;
    customerEmail: string;
    status: OrderStatus;
    totalAmount: number;
    currency: string;
    displayCurrency: string;
    customerAddress: {
      fullName: string;
      phone: string | null;
      countryCode: string;
      city: string;
      postalCode: string;
      addressLine1: string;
      addressLine2: string | null;
    } | null;
    items: Array<{
      id: string;
      title: string;
      brandName: string | null;
      size: string | null;
      color: string | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      imageUrl: string | null;
      sourceUrl: string | null;
    }>;
  } | null;
  transactions: Array<{
    id: string;
    provider: PaymentProvider;
    status: PaymentStatus;
    kind: string;
    amount: number;
    currency: string;
    exchangeRate: number;
    externalReference: string | null;
    externalTransactionId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  refunds: Array<{
    id: string;
    provider: PaymentProvider;
    status: PaymentStatus;
    amount: number;
    currency: string;
    externalRefundId: string | null;
    reason: string | null;
    processedAt: string | null;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    fromStatus: PaymentStatus | null;
    toStatus: PaymentStatus | null;
    notes: string | null;
    metadata: Record<string, unknown> | null;
    actorUser: {
      id: string;
      email: string;
    } | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentsAdminDashboardResponse {
  summary: {
    revenueEur: number;
    revenueToman: number;
    successfulPayments: number;
    approvedAwaitingSettlement: number;
    pendingReviews: number;
    failedPayments: number;
    refunds: number;
  };
  providers: Array<PaymentProviderConfigRecord & {
    revenueEur: number;
    revenueToman: number;
    paymentCount: number;
  }>;
  items: PaymentRecord[];
}

export interface ProcurementTaskRecord {
  id: string;
  status: ProcurementStatus;
  supplier: string | null;
  sourceWebsite: string | null;
  productUrl: string | null;
  quantity: number;
  currency: string;
  supplierPrice: number;
  shippingToPortugal: number;
  customsCost: number;
  totalProcurementCost: number;
  expectedProfit: number;
  realProfit: number;
  actualMargin: number;
  notes: string | null;
  purchasedAt: string | null;
  receivedAtWarehouseAt: string | null;
  readyToShipAt: string | null;
  createdAt: string;
  updatedAt: string;
  supplierSource: {
    id: string;
    brandName: string;
    website: string;
    countryCode: string | null;
  } | null;
  customerOrder: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    customerName: string | null;
    customerEmail: string;
    trackingNumber: string | null;
    totalAmount: number;
    currency: string;
    createdAt: string;
    shippedAt: string | null;
    deliveredAt: string | null;
  };
  orderItem: {
    id: string;
    title: string;
    brandName: string | null;
    quantity: number;
    totalPrice: number;
    customerPaid: number;
    sourceUrl: string | null;
    sourceStore: string | null;
    imageUrl: string | null;
  };
  product: {
    id: string;
    name: string;
    brandName: string;
    sourceUrl: string | null;
    sourceStore: string | null;
  } | null;
  trace: {
    customerPurchasedAt: string | null;
    supplierPurchasedAt: string | null;
    warehouseReceivedAt: string | null;
    readyToShipAt: string | null;
    customerShippedAt: string | null;
    deliveredAt: string | null;
  };
}

export interface ProcurementDashboardResponse {
  summary: {
    totalTasks: number;
    waitingToPurchase: number;
    purchased: number;
    received: number;
    readyToShip: number;
    expectedProfit: number;
    realProfit: number;
    totalProcurementCost: number;
    actualMargin: number;
  };
  items: ProcurementTaskRecord[];
}

function getOptionalToken(): string | null {
  return getAccessToken();
}

function getRequiredToken(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

export async function getCart() {
  return http<CartRecord>("/cart", {
    token: getOptionalToken(),
  });
}

export async function addCartItem(payload: { productId: string; variantId?: string | null; quantity: number }) {
  return http<CartRecord>("/cart/items", {
    method: "POST",
    token: getOptionalToken(),
    body: JSON.stringify(payload),
  });
}

export async function updateCartItem(id: string, payload: { quantity: number }) {
  return http<CartRecord>(`/cart/items/${id}`, {
    method: "PATCH",
    token: getOptionalToken(),
    body: JSON.stringify(payload),
  });
}

export async function removeCartItem(id: string) {
  return http<CartRecord>(`/cart/items/${id}`, {
    method: "DELETE",
    token: getOptionalToken(),
  });
}

export async function clearCart() {
  return http<CartRecord>("/cart/clear", {
    method: "DELETE",
    token: getOptionalToken(),
  });
}

export async function updateCartCountry(payload: { countryCode: string; shippingMethodId?: string | null }) {
  return http<CartRecord>("/cart/country", {
    method: "PATCH",
    token: getOptionalToken(),
    body: JSON.stringify(payload),
  });
}

export async function mergeGuestCart() {
  return http<CartRecord>("/cart/merge", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify({}),
  });
}

export async function getCheckoutSummary() {
  return http<{
    cart: CartRecord;
    addresses: CustomerAddressRecord[];
    shippingMethods: CommerceSettingsResponse["shippingMethods"];
    countries: CommerceSettingsResponse["countries"];
    paymentProviders: PaymentProviderConfigRecord[];
    bankAccounts: BankAccountRecord[];
    businessSettings: CommerceSettingsResponse["businessSettings"];
    currencyContext: CurrencyContextResponse;
    checkoutSteps: string[];
  }>("/checkout", {
    token: getRequiredToken(),
  });
}

export async function listAddresses() {
  const response = await http<{ items: CustomerAddressRecord[] }>("/addresses", {
    token: getRequiredToken(),
  });

  return response.items;
}

export async function upsertAddress(payload: Partial<CustomerAddressRecord> & Omit<CustomerAddressRecord, "id">) {
  return http<CustomerAddressRecord>("/addresses", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deleteAddress(id: string) {
  return http<void>(`/addresses/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

export async function createOrder(payload: {
  customerEmail: string;
  shippingAddressId: string;
  billingAddressId?: string | null;
  shippingMethodId?: string | null;
  paymentProvider: PaymentProvider;
  displayCurrency?: string | null;
  paymentMethodLabel?: string | null;
  notes?: string | null;
}) {
  return http<OrderRecord>("/checkout/orders", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function listCustomerOrders() {
  const response = await http<{ items: OrderRecord[] }>("/orders", {
    token: getRequiredToken(),
  });

  return response.items;
}

export async function listCustomerPayments() {
  const response = await http<{ items: PaymentRecord[] }>("/payments", {
    token: getRequiredToken(),
  });

  return response.items;
}

export async function uploadPaymentReceipt(
  id: string,
  payload: {
    dataUrl: string;
    fileName?: string | null;
    mimeType?: string | null;
    paymentReference?: string | null;
    notes?: string | null;
  },
) {
  return http<PaymentRecord>(`/payments/${id}/receipt`, {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function listAccountOrders() {
  const response = await http<{ items: OrderRecord[] }>("/account/orders", {
    token: getRequiredToken(),
  });

  return response.items;
}

export async function getCommerceSettings() {
  return http<CommerceSettingsResponse>("/admin/pricing", {
    token: getRequiredToken(),
  });
}

export async function getSiteContentSettings() {
  return http<SiteContentSettingsResponse>("/site-content");
}

export async function getAdminSiteContentSettings() {
  return http<SiteContentSettingsResponse>("/admin/site-content", {
    token: getRequiredToken(),
  });
}

export async function updateAdminSiteContentSettings(payload: SiteContentSettings) {
  return http<SiteContentSettingsResponse>("/admin/site-content", {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function updateBusinessSettings(payload: Partial<CommerceSettingsResponse["businessSettings"]>) {
  return http<CommerceSettingsResponse["businessSettings"]>("/admin/pricing/business", {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function createPricingRule(payload: Omit<CommerceSettingsResponse["pricingRules"][number], "id" | "brand" | "category" | "country" | "createdAt" | "updatedAt">) {
  return http<CommerceSettingsResponse["pricingRules"][number]>("/admin/pricing/rules", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function updatePricingRule(id: string, payload: Partial<CommerceSettingsResponse["pricingRules"][number]>) {
  return http<CommerceSettingsResponse["pricingRules"][number]>(`/admin/pricing/rules/${id}`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deletePricingRule(id: string) {
  return http<void>(`/admin/pricing/rules/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

export async function upsertShippingMethod(payload: CommerceSettingsResponse["shippingMethods"][number]) {
  return http<CommerceSettingsResponse["shippingMethods"][number]>("/admin/shipping/methods", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deleteShippingMethod(id: string) {
  return http<void>(`/admin/shipping/methods/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

export async function previewProfit(payload: {
  supplierPrice: number;
  marginPercent: number;
  localShippingFee: number;
  internationalShippingFee: number;
  handlingFee: number;
  minimumProfitAmount: number;
  vatPercent: number;
}) {
  return http<{
    customerPrice: number;
    profitAmount: number;
    profitPercentage: number;
  }>("/checkout/preview-profit", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function listAdminOrders() {
  const response = await http<{ items: OrderRecord[] }>("/admin/orders", {
    token: getRequiredToken(),
  });

  return response.items;
}

export async function updateAdminOrderStatus(id: string, status: OrderStatus) {
  return http<OrderRecord>(`/admin/orders/${id}/status`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify({ status }),
  });
}

export async function updateAdminOrderTracking(
  id: string,
  payload: {
    trackingNumber?: string | null;
    carrier?: string | null;
    trackingUrl?: string | null;
    estimatedDeliveryDate?: string | null;
    shipmentNotes?: string | null;
  },
) {
  return http<OrderRecord>(`/admin/orders/${id}/tracking`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function getProductSourceInfo(id: string) {
  return http<{
    id: string;
    name: string;
    sku: string;
    sourceStore: string | null;
    sourceUrl: string | null;
    supplierPrice: number;
    customerPrice: number;
    profitAmount: number;
    useCustomPricing: boolean;
    customPrice: number | null;
    importedAt: string | null;
    lastSyncDate: string | null;
    monitoring: {
      productId: string;
      sourceUrl: string | null;
      enabled: boolean;
      intervalMinutes: number;
      timeoutMs: number;
      lastCheckedAt: string | null;
      nextScheduledCheck: string | null;
      latestLog: {
        id: string;
        status: "UPDATED" | "NO_CHANGES" | "FAILED" | "BLOCKED" | "REMOVED";
        changedFields: string[];
        errorMessage: string | null;
        responseTimeMs: number | null;
        responseStatus: number | null;
        lastCheckedAt: string;
        nextScheduledCheck: string | null;
        createdAt: string;
      } | null;
    };
    importSource: { id: string; name: string } | null;
  }>(`/admin/products/${id}/source-info`, {
    token: getRequiredToken(),
  });
}

export async function updateProductPricingOverride(
  id: string,
  payload: { useCustomPricing?: boolean; customPrice?: number | null },
) {
  return http(`/admin/products/${id}/pricing-override`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function getCommerceAnalytics() {
  return http<{
    totalRevenue: number;
    totalProfit: number;
    ordersCount: number;
    averageOrderValue: number;
    monthlyProfit: number;
    profitByProduct: Array<{
      productId: string | null;
      title: string;
      quantitySold: number;
      revenueAmount: number;
      profitAmount: number;
    }>;
    profitByBrand: Array<{
      brandName: string | null;
      quantitySold: number;
      revenueAmount: number;
      profitAmount: number;
    }>;
    topSellingProducts: Array<{
      productId: string | null;
      title: string;
      quantitySold: number;
      revenueAmount: number;
      profitAmount: number;
    }>;
  }>("/admin/analytics/commerce", {
    token: getRequiredToken(),
  });
}

export async function updateAdminOrder(
  id: string,
  payload: {
    status?: OrderStatus;
    trackingNumber?: string | null;
    carrier?: string | null;
    trackingUrl?: string | null;
    estimatedDeliveryDate?: string | null;
    shipmentNotes?: string | null;
    internalNotes?: string | null;
  },
) {
  return http<OrderRecord>(`/admin/orders/${id}`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function refundAdminOrder(id: string, payload?: { amount?: number | null; internalNotes?: string | null }) {
  return http<OrderRecord>(`/admin/orders/${id}/refund`, {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload ?? {}),
  });
}

export async function listSources() {
  const response = await http<{ items: BrandSourceRecord[] }>("/admin/sources", {
    token: getRequiredToken(),
  });

  return response.items;
}

export async function upsertSource(payload: Partial<BrandSourceRecord> & Pick<BrandSourceRecord, "brandName" | "website" | "sourceType">) {
  return http<BrandSourceRecord>("/admin/sources", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deleteSource(id: string) {
  return http<void>(`/admin/sources/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

export async function getProcurementDashboard() {
  return http<ProcurementDashboardResponse>("/admin/procurement", {
    token: getRequiredToken(),
  });
}

export async function updateProcurementTask(
  id: string,
  payload: {
    status?: ProcurementStatus;
    supplierPrice?: number;
    shippingToPortugal?: number;
    customsCost?: number;
    notes?: string | null;
  },
) {
  return http<ProcurementTaskRecord>(`/admin/procurement/tasks/${id}`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function getCurrencyContext() {
  return http<CurrencyContextResponse>("/currencies/context", {
    token: getOptionalToken(),
  });
}

export async function updatePreferredCurrency(currency: string) {
  return http<{ preferredCurrency: string }>("/currencies/preference", {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify({ currency }),
  });
}

export async function getAdminPayments() {
  return http<PaymentsAdminDashboardResponse>("/admin/payments", {
    token: getRequiredToken(),
  });
}

export async function getPaymentReviewQueue() {
  const response = await http<{ items: PaymentRecord[] }>("/admin/payments/review", {
    token: getRequiredToken(),
  });

  return response.items;
}

export async function reviewPayment(id: string, payload: { decision: "approve" | "reject"; internalNotes?: string | null }) {
  return http<PaymentRecord>(`/admin/payments/${id}/review`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function completePayment(id: string) {
  return http<PaymentRecord>(`/admin/payments/${id}/complete`, {
    method: "PATCH",
    token: getRequiredToken(),
  });
}

export async function listBankAccounts() {
  const response = await http<{ items: BankAccountRecord[] }>("/admin/bank-accounts", {
    token: getRequiredToken(),
  });

  return response.items;
}

export async function upsertBankAccount(payload: Partial<BankAccountRecord> & Pick<BankAccountRecord, "bankName" | "accountHolder" | "country" | "currency">) {
  const path = payload.id ? `/admin/bank-accounts/${payload.id}` : "/admin/bank-accounts";
  return http<BankAccountRecord>(path, {
    method: payload.id ? "PATCH" : "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deleteBankAccount(id: string) {
  return http<void>(`/admin/bank-accounts/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

export async function listExchangeRates() {
  const response = await http<{ items: ExchangeRateRecord[] }>("/admin/exchange-rates", {
    token: getRequiredToken(),
  });

  return response.items;
}

export async function upsertExchangeRate(payload: Partial<ExchangeRateRecord> & Pick<ExchangeRateRecord, "baseCurrency" | "quoteCurrency" | "rate">) {
  const path = payload.id ? `/admin/exchange-rates/${payload.id}` : "/admin/exchange-rates";
  return http<ExchangeRateRecord>(path, {
    method: payload.id ? "PATCH" : "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function listPaymentProviderConfigs() {
  const response = await http<{ items: PaymentProviderConfigRecord[] }>(
    "/admin/payments/providers",
    { token: getRequiredToken() }
  );
  return response.items;
}

export async function updatePaymentProviderConfig(
  id: string,
  payload: Partial<Omit<PaymentProviderConfigRecord, "id" | "code" | "createdAt" | "updatedAt">>
) {
  return http<PaymentProviderConfigRecord>(`/admin/payments/providers/${id}`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}
