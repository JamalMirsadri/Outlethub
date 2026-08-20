import {
  NotificationCategory,
  NotificationChannelCode,
  NotificationPriority,
  NotificationType,
} from "@prisma/client";

export type NotificationEventName =
  | "REGISTRATION"
  | "EMAIL_VERIFICATION"
  | "PASSWORD_RESET"
  | "ORDER_CREATED"
  | "ORDER_CANCELLED"
  | "PAYMENT_INSTRUCTIONS"
  | "RECEIPT_UPLOADED"
  | "PAYMENT_WAITING_REVIEW"
  | "PAYMENT_APPROVED"
  | "PAYMENT_REJECTED"
  | "PAYMENT_COMPLETED"
  | "PROCUREMENT_STARTED"
  | "PURCHASED_FROM_SUPPLIER"
  | "RECEIVED_AT_WAREHOUSE"
  | "READY_TO_SHIP"
  | "PRODUCT_SHIPPED"
  | "TRACKING_UPDATED"
  | "PRODUCT_DELIVERED"
  | "REFUND_ISSUED"
  | "LOYALTY_POINTS_EARNED"
  | "LOYALTY_POINTS_REDEEMED"
  | "REWARD_GRANTED"
  | "COUPON_RECEIVED"
  | "NEW_ORDER"
  | "NEW_RECEIPT_UPLOAD"
  | "PROCUREMENT_REQUIRED"
  | "LOW_STOCK_ALERT"
  | "FAILED_CONNECTOR"
  | "FAILED_IMPORT"
  | "FAILED_SYNC"
  | "MONITORING_FAILURE"
  | "SHIPPING_DELAY"
  | "PAYMENT_EXCEPTION";

export interface ChannelSeedDefinition {
  code: NotificationChannelCode;
  displayName: string;
  queueName: string;
  supportsOpenTracking: boolean;
  supportsRetries: boolean;
}

export interface TemplateSeedDefinition {
  key: NotificationEventName;
  name: string;
  channelCode: NotificationChannelCode;
  category: NotificationCategory;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
  samplePayload: Record<string, unknown>;
  variablesSchema: Record<string, unknown>;
}

export interface EventDefinition {
  name: NotificationEventName;
  category: NotificationCategory;
  priority: NotificationPriority;
  notificationType: NotificationType;
  customerChannels: NotificationChannelCode[];
  adminChannels: NotificationChannelCode[];
}

export const CHANNEL_SEEDS: ChannelSeedDefinition[] = [
  {
    code: "EMAIL",
    displayName: "Email",
    queueName: "notification-deliveries-email",
    supportsOpenTracking: true,
    supportsRetries: true,
  },
  {
    code: "IN_APP",
    displayName: "In-App",
    queueName: "notification-deliveries-inapp",
    supportsOpenTracking: false,
    supportsRetries: false,
  },
  {
    code: "ADMIN_OPERATIONAL",
    displayName: "Admin Operational",
    queueName: "notification-deliveries-admin-operational",
    supportsOpenTracking: false,
    supportsRetries: true,
  },
  {
    code: "SMS",
    displayName: "SMS",
    queueName: "notification-deliveries-sms",
    supportsOpenTracking: false,
    supportsRetries: true,
  },
  {
    code: "WHATSAPP",
    displayName: "WhatsApp",
    queueName: "notification-deliveries-whatsapp",
    supportsOpenTracking: false,
    supportsRetries: true,
  },
  {
    code: "TELEGRAM",
    displayName: "Telegram",
    queueName: "notification-deliveries-telegram",
    supportsOpenTracking: false,
    supportsRetries: true,
  },
  {
    code: "PUSH_NOTIFICATION",
    displayName: "Push Notification",
    queueName: "notification-deliveries-push",
    supportsOpenTracking: true,
    supportsRetries: true,
  },
];

export const EVENT_DEFINITIONS: Record<NotificationEventName, EventDefinition> = {
  REGISTRATION: {
    name: "REGISTRATION",
    category: "SYSTEM",
    priority: "MEDIUM",
    notificationType: "SYSTEM",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  EMAIL_VERIFICATION: {
    name: "EMAIL_VERIFICATION",
    category: "SYSTEM",
    priority: "HIGH",
    notificationType: "SYSTEM",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  PASSWORD_RESET: {
    name: "PASSWORD_RESET",
    category: "SYSTEM",
    priority: "HIGH",
    notificationType: "SYSTEM",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  ORDER_CREATED: {
    name: "ORDER_CREATED",
    category: "ORDERS",
    priority: "HIGH",
    notificationType: "ORDER_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  ORDER_CANCELLED: {
    name: "ORDER_CANCELLED",
    category: "ORDERS",
    priority: "HIGH",
    notificationType: "ORDER_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  PAYMENT_INSTRUCTIONS: {
    name: "PAYMENT_INSTRUCTIONS",
    category: "PAYMENTS",
    priority: "HIGH",
    notificationType: "PAYMENT_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  RECEIPT_UPLOADED: {
    name: "RECEIPT_UPLOADED",
    category: "PAYMENTS",
    priority: "HIGH",
    notificationType: "PAYMENT_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  PAYMENT_WAITING_REVIEW: {
    name: "PAYMENT_WAITING_REVIEW",
    category: "PAYMENTS",
    priority: "HIGH",
    notificationType: "ADMIN_OPERATIONAL",
    customerChannels: [],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  PAYMENT_APPROVED: {
    name: "PAYMENT_APPROVED",
    category: "PAYMENTS",
    priority: "HIGH",
    notificationType: "PAYMENT_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  PAYMENT_REJECTED: {
    name: "PAYMENT_REJECTED",
    category: "PAYMENTS",
    priority: "CRITICAL",
    notificationType: "PAYMENT_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  PAYMENT_COMPLETED: {
    name: "PAYMENT_COMPLETED",
    category: "PAYMENTS",
    priority: "HIGH",
    notificationType: "PAYMENT_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  PROCUREMENT_STARTED: {
    name: "PROCUREMENT_STARTED",
    category: "PROCUREMENT",
    priority: "MEDIUM",
    notificationType: "PROCUREMENT_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  PURCHASED_FROM_SUPPLIER: {
    name: "PURCHASED_FROM_SUPPLIER",
    category: "PROCUREMENT",
    priority: "MEDIUM",
    notificationType: "PROCUREMENT_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  RECEIVED_AT_WAREHOUSE: {
    name: "RECEIVED_AT_WAREHOUSE",
    category: "PROCUREMENT",
    priority: "MEDIUM",
    notificationType: "PROCUREMENT_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  READY_TO_SHIP: {
    name: "READY_TO_SHIP",
    category: "SHIPPING",
    priority: "MEDIUM",
    notificationType: "SHIPPING_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  PRODUCT_SHIPPED: {
    name: "PRODUCT_SHIPPED",
    category: "SHIPPING",
    priority: "HIGH",
    notificationType: "SHIPPING_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  TRACKING_UPDATED: {
    name: "TRACKING_UPDATED",
    category: "SHIPPING",
    priority: "MEDIUM",
    notificationType: "SHIPPING_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  PRODUCT_DELIVERED: {
    name: "PRODUCT_DELIVERED",
    category: "SHIPPING",
    priority: "HIGH",
    notificationType: "SHIPPING_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  REFUND_ISSUED: {
    name: "REFUND_ISSUED",
    category: "PAYMENTS",
    priority: "HIGH",
    notificationType: "PAYMENT_UPDATE",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  LOYALTY_POINTS_EARNED: {
    name: "LOYALTY_POINTS_EARNED",
    category: "SYSTEM",
    priority: "MEDIUM",
    notificationType: "SYSTEM",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  LOYALTY_POINTS_REDEEMED: {
    name: "LOYALTY_POINTS_REDEEMED",
    category: "SYSTEM",
    priority: "MEDIUM",
    notificationType: "SYSTEM",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  REWARD_GRANTED: {
    name: "REWARD_GRANTED",
    category: "SYSTEM",
    priority: "MEDIUM",
    notificationType: "SYSTEM",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  COUPON_RECEIVED: {
    name: "COUPON_RECEIVED",
    category: "SYSTEM",
    priority: "MEDIUM",
    notificationType: "SYSTEM",
    customerChannels: ["EMAIL", "IN_APP"],
    adminChannels: [],
  },
  NEW_ORDER: {
    name: "NEW_ORDER",
    category: "OPERATIONS",
    priority: "HIGH",
    notificationType: "ADMIN_OPERATIONAL",
    customerChannels: [],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  NEW_RECEIPT_UPLOAD: {
    name: "NEW_RECEIPT_UPLOAD",
    category: "OPERATIONS",
    priority: "HIGH",
    notificationType: "ADMIN_OPERATIONAL",
    customerChannels: [],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  PROCUREMENT_REQUIRED: {
    name: "PROCUREMENT_REQUIRED",
    category: "PROCUREMENT",
    priority: "HIGH",
    notificationType: "ADMIN_OPERATIONAL",
    customerChannels: [],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  LOW_STOCK_ALERT: {
    name: "LOW_STOCK_ALERT",
    category: "OPERATIONS",
    priority: "HIGH",
    notificationType: "ADMIN_OPERATIONAL",
    customerChannels: [],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  FAILED_CONNECTOR: {
    name: "FAILED_CONNECTOR",
    category: "CONNECTORS",
    priority: "CRITICAL",
    notificationType: "ADMIN_OPERATIONAL",
    customerChannels: [],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  FAILED_IMPORT: {
    name: "FAILED_IMPORT",
    category: "IMPORTS",
    priority: "CRITICAL",
    notificationType: "ADMIN_OPERATIONAL",
    customerChannels: [],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  FAILED_SYNC: {
    name: "FAILED_SYNC",
    category: "MONITORING",
    priority: "CRITICAL",
    notificationType: "ADMIN_OPERATIONAL",
    customerChannels: [],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  MONITORING_FAILURE: {
    name: "MONITORING_FAILURE",
    category: "MONITORING",
    priority: "CRITICAL",
    notificationType: "ADMIN_OPERATIONAL",
    customerChannels: [],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  SHIPPING_DELAY: {
    name: "SHIPPING_DELAY",
    category: "SHIPPING",
    priority: "HIGH",
    notificationType: "ADMIN_OPERATIONAL",
    customerChannels: [],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
  PAYMENT_EXCEPTION: {
    name: "PAYMENT_EXCEPTION",
    category: "PAYMENTS",
    priority: "CRITICAL",
    notificationType: "ADMIN_OPERATIONAL",
    customerChannels: [],
    adminChannels: ["ADMIN_OPERATIONAL"],
  },
};

function buildHtmlTemplate(title: string, body: string) {
  return `<div style="font-family: Arial, sans-serif; line-height: 1.6;"><h2>${title}</h2><p>${body}</p></div>`;
}

function buildTemplate(
  key: NotificationEventName,
  category: NotificationCategory,
  subjectTemplate: string,
  textTemplate: string,
  samplePayload: Record<string, unknown>,
): TemplateSeedDefinition[] {
  const title = subjectTemplate.replace(/{{\s*([^}]+)\s*}}/g, "$1");
  return [
    {
      key,
      name: `${key.replaceAll("_", " ")} Email`,
      channelCode: "EMAIL",
      category,
      subjectTemplate,
      htmlTemplate: buildHtmlTemplate(title, textTemplate),
      textTemplate,
      samplePayload,
      variablesSchema: samplePayload,
    },
    {
      key,
      name: `${key.replaceAll("_", " ")} In-App`,
      channelCode: "IN_APP",
      category,
      subjectTemplate,
      htmlTemplate: buildHtmlTemplate(title, textTemplate),
      textTemplate,
      samplePayload,
      variablesSchema: samplePayload,
    },
    {
      key,
      name: `${key.replaceAll("_", " ")} Admin Operational`,
      channelCode: "ADMIN_OPERATIONAL",
      category,
      subjectTemplate,
      htmlTemplate: buildHtmlTemplate(title, textTemplate),
      textTemplate,
      samplePayload,
      variablesSchema: samplePayload,
    },
  ];
}

export const TEMPLATE_SEEDS: TemplateSeedDefinition[] = [
  ...buildTemplate(
    "REGISTRATION",
    "SYSTEM",
    "Welcome to OutletHub, {{customerName}}",
    "Your account is ready. You can now track orders, payments, and shipping from your dashboard.",
    { customerName: "Customer Name" },
  ),
  ...buildTemplate(
    "EMAIL_VERIFICATION",
    "SYSTEM",
    "Verify your OutletHub email",
    "Use this verification token: {{verificationToken}}",
    { customerName: "Customer Name", verificationToken: "123456" },
  ),
  ...buildTemplate(
    "PASSWORD_RESET",
    "SYSTEM",
    "Reset your OutletHub password",
    "Use this reset token: {{resetToken}}",
    { customerName: "Customer Name", resetToken: "123456" },
  ),
  ...buildTemplate(
    "ORDER_CREATED",
    "ORDERS",
    "Order {{orderNumber}} confirmed",
    "Thank you {{customerName}}. Your order {{orderNumber}} was created on {{orderDate}} for {{orderTotal}}. Payment method: {{paymentMethod}}. Products: {{productList}} {{couponCode}} {{couponDiscount}}",
    {
      customerName: "Customer Name",
      customerEmail: "customer@example.com",
      orderNumber: "OH-123",
      orderDate: "2026-08-20T10:00:00.000Z",
      orderTotal: "EUR 299.00",
      paymentMethod: "Bank Transfer",
      paymentStatus: "PAYMENT_PENDING",
      productList: "Bag x1, Shoes x1",
      couponCode: "WELCOME10",
      couponDiscount: "10%",
    },
  ),
  ...buildTemplate(
    "ORDER_CANCELLED",
    "ORDERS",
    "Order {{orderNumber}} cancelled",
    "Your order {{orderNumber}} has been cancelled. If a payment was already captured, our team will follow up about the refund.",
    {
      customerName: "Customer Name",
      orderNumber: "OH-123",
      orderDate: "2026-08-20T10:00:00.000Z",
      orderTotal: "EUR 299.00",
    },
  ),
  ...buildTemplate(
    "PAYMENT_INSTRUCTIONS",
    "PAYMENTS",
    "Payment instructions for {{orderNumber}}",
    "Payment method: {{paymentMethod}}. Payment reference: {{paymentReference}}. Payment amount: {{orderTotal}}. Payment status: {{paymentStatus}}. Complete payment before {{paymentExpiresAt}}.",
    {
      customerName: "Customer Name",
      orderNumber: "OH-123",
      orderTotal: "EUR 299.00",
      paymentMethod: "Bank Transfer",
      paymentStatus: "PAYMENT_PENDING",
      paymentReference: "BT-ABC12345",
      paymentExpiresAt: "2026-08-21T10:00:00.000Z",
    },
  ),
  ...buildTemplate(
    "RECEIPT_UPLOADED",
    "PAYMENTS",
    "Receipt uploaded for {{orderNumber}}",
    "Your payment receipt for order {{orderNumber}} was uploaded and is waiting for review.",
    { customerName: "Customer Name", orderNumber: "OH-123" },
  ),
  ...buildTemplate(
    "PAYMENT_WAITING_REVIEW",
    "PAYMENTS",
    "Payment waiting review for {{orderNumber}}",
    "A receipt for order {{orderNumber}} is waiting for admin review.",
    { orderNumber: "OH-123", paymentAmount: "299.00", currency: "EUR" },
  ),
  ...buildTemplate(
    "PAYMENT_APPROVED",
    "PAYMENTS",
    "Payment approved for {{orderNumber}}",
    "Your receipt for order {{orderNumber}} has been approved. Payment status: {{paymentStatus}}.",
    { customerName: "Customer Name", orderNumber: "OH-123", paymentStatus: "PAYMENT_APPROVED" },
  ),
  ...buildTemplate(
    "PAYMENT_REJECTED",
    "PAYMENTS",
    "Payment rejected for {{orderNumber}}",
    "Your payment for order {{orderNumber}} was rejected. Payment status: {{paymentStatus}}. Please review your receipt and try again.",
    { customerName: "Customer Name", orderNumber: "OH-123", paymentStatus: "PAYMENT_REJECTED" },
  ),
  ...buildTemplate(
    "PAYMENT_COMPLETED",
    "PAYMENTS",
    "Payment completed for {{orderNumber}}",
    "Your payment for order {{orderNumber}} is complete. Procurement starts now.",
    { customerName: "Customer Name", orderNumber: "OH-123" },
  ),
  ...buildTemplate(
    "PROCUREMENT_STARTED",
    "PROCUREMENT",
    "Procurement started for {{orderNumber}}",
    "We started procurement for order {{orderNumber}}.",
    { customerName: "Customer Name", orderNumber: "OH-123", supplierName: "Supplier Name" },
  ),
  ...buildTemplate(
    "PURCHASED_FROM_SUPPLIER",
    "PROCUREMENT",
    "Purchased from supplier for {{orderNumber}}",
    "The item for order {{orderNumber}} has been purchased from the supplier.",
    { customerName: "Customer Name", orderNumber: "OH-123", supplierName: "Supplier Name" },
  ),
  ...buildTemplate(
    "RECEIVED_AT_WAREHOUSE",
    "PROCUREMENT",
    "Received at warehouse for {{orderNumber}}",
    "Your item for order {{orderNumber}} arrived at our warehouse.",
    { customerName: "Customer Name", orderNumber: "OH-123" },
  ),
  ...buildTemplate(
    "READY_TO_SHIP",
    "SHIPPING",
    "Ready to ship for {{orderNumber}}",
    "Your order {{orderNumber}} is packed and ready to ship.",
    { customerName: "Customer Name", orderNumber: "OH-123" },
  ),
  ...buildTemplate(
    "PRODUCT_SHIPPED",
    "SHIPPING",
    "Order {{orderNumber}} shipped",
    "Your order {{orderNumber}} shipped with {{carrier}}. Tracking number: {{trackingNumber}}",
    { customerName: "Customer Name", orderNumber: "OH-123", carrier: "DHL", trackingNumber: "TRACK123" },
  ),
  ...buildTemplate(
    "TRACKING_UPDATED",
    "SHIPPING",
    "Tracking updated for {{orderNumber}}",
    "Tracking for order {{orderNumber}} was updated. Carrier: {{carrier}}, tracking number: {{trackingNumber}}.",
    { customerName: "Customer Name", orderNumber: "OH-123", carrier: "DHL", trackingNumber: "TRACK123" },
  ),
  ...buildTemplate(
    "PRODUCT_DELIVERED",
    "SHIPPING",
    "Order {{orderNumber}} delivered",
    "Your order {{orderNumber}} has been delivered.",
    { customerName: "Customer Name", orderNumber: "OH-123" },
  ),
  ...buildTemplate(
    "REFUND_ISSUED",
    "PAYMENTS",
    "Refund issued for {{orderNumber}}",
    "A refund of {{refundAmount}} was issued for order {{orderNumber}}.",
    { customerName: "Customer Name", orderNumber: "OH-123", refundAmount: "EUR 299.00" },
  ),
  ...buildTemplate(
    "LOYALTY_POINTS_EARNED",
    "SYSTEM",
    "You earned {{points}} loyalty points",
    "You earned {{points}} loyalty points from order {{orderNumber}}. Your current balance is {{pointsBalance}}.",
    {
      customerName: "Customer Name",
      points: "25",
      pointsBalance: "120",
      orderNumber: "OH-123",
    },
  ),
  ...buildTemplate(
    "LOYALTY_POINTS_REDEEMED",
    "SYSTEM",
    "You redeemed {{points}} loyalty points",
    "You redeemed {{points}} loyalty points for {{rewardTitle}}. Your current balance is {{pointsBalance}}.",
    {
      customerName: "Customer Name",
      points: "50",
      pointsBalance: "70",
      rewardTitle: "10% Off Reward",
    },
  ),
  ...buildTemplate(
    "REWARD_GRANTED",
    "SYSTEM",
    "Reward granted: {{rewardTitle}}",
    "Your reward {{rewardTitle}} is ready. {{couponCode}} {{couponDiscount}}",
    {
      customerName: "Customer Name",
      rewardTitle: "10% Off Reward",
      couponCode: "WELCOME10",
      couponDiscount: "10%",
    },
  ),
  ...buildTemplate(
    "COUPON_RECEIVED",
    "SYSTEM",
    "Your coupon {{couponCode}} is ready",
    "You received coupon {{couponCode}} with discount {{couponDiscount}}.",
    {
      customerName: "Customer Name",
      couponCode: "WELCOME10",
      couponDiscount: "10%",
    },
  ),
  ...buildTemplate(
    "NEW_ORDER",
    "OPERATIONS",
    "New order {{orderNumber}}",
    "A new order {{orderNumber}} was created by {{customerName}}.",
    { customerName: "Customer Name", orderNumber: "OH-123", paymentAmount: "299.00", currency: "EUR" },
  ),
  ...buildTemplate(
    "NEW_RECEIPT_UPLOAD",
    "OPERATIONS",
    "New receipt upload for {{orderNumber}}",
    "A new receipt was uploaded for order {{orderNumber}}.",
    { orderNumber: "OH-123", customerName: "Customer Name" },
  ),
  ...buildTemplate(
    "PROCUREMENT_REQUIRED",
    "PROCUREMENT",
    "Procurement required for {{orderNumber}}",
    "Order {{orderNumber}} is ready for procurement.",
    { orderNumber: "OH-123", supplierName: "Supplier Name", productName: "Product Name" },
  ),
  ...buildTemplate(
    "LOW_STOCK_ALERT",
    "OPERATIONS",
    "Low stock alert for {{productName}}",
    "{{productName}} is low on stock and requires review.",
    { productName: "Product Name" },
  ),
  ...buildTemplate(
    "FAILED_CONNECTOR",
    "CONNECTORS",
    "Connector failure: {{supplierName}}",
    "A connector failed for {{supplierName}}.",
    { supplierName: "Supplier Name" },
  ),
  ...buildTemplate(
    "FAILED_IMPORT",
    "IMPORTS",
    "Import failed for {{supplierName}}",
    "An import failed for {{supplierName}}.",
    { supplierName: "Supplier Name" },
  ),
  ...buildTemplate(
    "FAILED_SYNC",
    "MONITORING",
    "Sync failed for {{supplierName}}",
    "A sync failed for {{supplierName}}.",
    { supplierName: "Supplier Name" },
  ),
  ...buildTemplate(
    "MONITORING_FAILURE",
    "MONITORING",
    "Monitoring failure for {{supplierName}}",
    "Monitoring reported a failure for {{supplierName}}.",
    { supplierName: "Supplier Name" },
  ),
  ...buildTemplate(
    "SHIPPING_DELAY",
    "SHIPPING",
    "Shipping delay for {{orderNumber}}",
    "Order {{orderNumber}} is delayed in transit.",
    { orderNumber: "OH-123", carrier: "DHL", trackingNumber: "TRACK123" },
  ),
  ...buildTemplate(
    "PAYMENT_EXCEPTION",
    "PAYMENTS",
    "Payment exception for {{orderNumber}}",
    "A payment exception was recorded for order {{orderNumber}}.",
    { orderNumber: "OH-123", paymentAmount: "299.00", currency: "EUR" },
  ),
];
