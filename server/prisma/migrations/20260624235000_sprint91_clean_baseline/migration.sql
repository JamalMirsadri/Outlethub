-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('MANUAL', 'IMPORT', 'AWIN', 'CJ', 'SCRAPER');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DealLevel" AS ENUM ('NONE', 'GOOD', 'HOT', 'FEATURED');

-- CreateEnum
CREATE TYPE "SyncFrequency" AS ENUM ('MANUAL', 'HOURLY', 'EVERY_6_HOURS', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('MANUAL', 'JSON_FEED', 'XML_FEED', 'SCRAPER', 'AWIN', 'CJ');

-- CreateEnum
CREATE TYPE "BrandSourceType" AS ENUM ('PLAYWRIGHT', 'JSON_FEED', 'XML_FEED', 'MANUAL_IMPORT');

-- CreateEnum
CREATE TYPE "BrandSourceStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "ImportSourceStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "ScraperType" AS ENUM ('PLAYWRIGHT', 'PUPPETEER');

-- CreateEnum
CREATE TYPE "ScraperStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "ScraperRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConnectorRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportProductResultStatus" AS ENUM ('NEW', 'UPDATED', 'UNCHANGED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportFailureReason" AS ENUM ('MISSING_NAME', 'MISSING_PRICE', 'MISSING_IMAGE', 'INVALID_URL', 'INVALID_BRAND', 'MISSING_BRAND', 'MISSING_CATEGORY', 'NORMALIZATION_ERROR', 'RULE_REJECTED', 'UPSERT_ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ScraperArtifactType" AS ENUM ('SCREENSHOT', 'HTML_DUMP', 'JSON_DUMP');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE_DROP', 'PRICE_INCREASE', 'STOCK_CHANGE', 'SYNC_FAILURE', 'SCRAPER_FAILURE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('AWIN', 'CJ');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAYMENT_APPROVED', 'PAID', 'PROCESSING', 'PURCHASED_FROM_SUPPLIER', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ProcurementStatus" AS ENUM ('PURCHASE_REQUIRED', 'PURCHASED_FROM_SUPPLIER', 'RECEIVED_AT_WAREHOUSE', 'READY_TO_SHIP');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('BANK_TRANSFER', 'STRIPE', 'PAYPAL', 'MB_WAY', 'MULTIBANCO', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('CHARGE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAYMENT_PENDING_REVIEW', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED', 'PAYMENT_PENDING', 'AUTHORIZED', 'PAID', 'PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'TRIGGERED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PRICE_ALERT', 'ORDER_UPDATE', 'PAYMENT_UPDATE', 'PROCUREMENT_UPDATE', 'SHIPPING_UPDATE', 'ADMIN_OPERATIONAL', 'MARKETING', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationChannelCode" AS ENUM ('EMAIL', 'IN_APP', 'ADMIN_OPERATIONAL', 'SMS', 'WHATSAPP', 'TELEGRAM', 'PUSH_NOTIFICATION');

-- CreateEnum
CREATE TYPE "NotificationDeliveryState" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NotificationEventSource" AS ENUM ('AUTH', 'ORDERS', 'PAYMENTS', 'PROCUREMENT', 'SHIPPING', 'IMPORTS', 'MONITORING', 'CONNECTORS', 'SYSTEM', 'MARKETING');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('ORDERS', 'PAYMENTS', 'SHIPPING', 'PROCUREMENT', 'SYSTEM', 'MARKETING', 'IMPORTS', 'MONITORING', 'CONNECTORS', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'JOB');

-- CreateEnum
CREATE TYPE "PricingTargetType" AS ENUM ('GLOBAL', 'BRAND', 'CATEGORY');

-- CreateEnum
CREATE TYPE "CartType" AS ENUM ('GUEST', 'USER');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "fullName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "avatarPublicId" TEXT,
    "preferredCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByHash" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "logoPublicId" TEXT,
    "description" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "marginPercent" DECIMAL(5,2),
    "isLuxury" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "importSourceId" TEXT,
    "slug" TEXT NOT NULL,
    "externalId" TEXT,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalPrice" DECIMAL(10,2),
    "outletPrice" DECIMAL(10,2),
    "supplierPrice" DECIMAL(10,2),
    "finalPrice" DECIMAL(10,2) NOT NULL,
    "customPrice" DECIMAL(10,2),
    "profitAmount" DECIMAL(10,2),
    "discountPercent" INTEGER DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "marginPercent" DECIMAL(5,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'UNKNOWN',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "dealLevel" "DealLevel" NOT NULL DEFAULT 'NONE',
    "contentHash" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isTrending" BOOLEAN NOT NULL DEFAULT false,
    "useCustomPricing" BOOLEAN NOT NULL DEFAULT false,
    "source" "ProductSource" NOT NULL DEFAULT 'MANUAL',
    "sourceUrl" TEXT,
    "sourceStore" TEXT,
    "gender" TEXT,
    "material" TEXT,
    "sizes" TEXT[],
    "colors" TEXT[],
    "views" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceChange" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "oldPrice" DECIMAL(10,2),
    "newPrice" DECIMAL(10,2) NOT NULL,
    "changePercent" DECIMAL(8,2) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockChange" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "oldStatus" "StockStatus" NOT NULL,
    "newStatus" "StockStatus" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "altText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "bytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "importJobId" TEXT,
    "originalPrice" DECIMAL(10,2),
    "finalPrice" DECIMAL(10,2) NOT NULL,
    "discountPercent" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceAtAdd" DECIMAL(10,2),
    "originalPriceAtAdd" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "countryCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultBilling" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestToken" TEXT,
    "type" "CartType" NOT NULL DEFAULT 'GUEST',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "displayCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "countryCode" TEXT NOT NULL,
    "subtotalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shippingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "handlingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pricingRuleId" TEXT,
    "shippingMethodId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "lastMergedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "supplierCost" DECIMAL(10,2) NOT NULL,
    "customerPaid" DECIMAL(10,2) NOT NULL,
    "profitAmount" DECIMAL(10,2) NOT NULL,
    "snapshotTitle" TEXT NOT NULL,
    "snapshotBrand" TEXT,
    "snapshotImageUrl" TEXT,
    "snapshotSourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cartId" TEXT,
    "customerAddressId" TEXT,
    "billingAddressId" TEXT,
    "pricingRuleId" TEXT,
    "shippingMethodId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT,
    "customerEmail" TEXT NOT NULL,
    "supplierSubtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "shippingAmount" DECIMAL(10,2) NOT NULL,
    "handlingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(10,2) NOT NULL,
    "profitAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "customerPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "displayCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "shippingAddress" JSONB NOT NULL,
    "billingAddress" JSONB,
    "businessSettingsSnapshot" JSONB,
    "pricingSnapshot" JSONB,
    "exchangeRateSnapshot" JSONB,
    "paymentProvider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "paymentMethodLabel" TEXT,
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "trackingUrl" TEXT,
    "estimatedDeliveryDate" TIMESTAMP(3),
    "shipmentNotes" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalWeightKg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "purchasedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "brandName" TEXT,
    "size" TEXT,
    "color" TEXT,
    "quantity" INTEGER NOT NULL,
    "supplierCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "customerPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "profitAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "sourceUrl" TEXT,
    "sourceStore" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementTask" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT,
    "brandSourceId" TEXT,
    "status" "ProcurementStatus" NOT NULL DEFAULT 'PURCHASE_REQUIRED',
    "supplierName" TEXT,
    "sourceWebsite" TEXT,
    "productUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "supplierPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shippingToPortugal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "customsCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalProcurementCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expectedProfit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "realProfit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "actualMarginPercent" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "receivedAtWarehouseAt" TIMESTAMP(3),
    "readyToShipAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "providerConfigurationId" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "kind" "PaymentKind" NOT NULL DEFAULT 'CHARGE',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "displayCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "amount" DECIMAL(10,2) NOT NULL,
    "exchangeRate" DECIMAL(18,6),
    "paymentReference" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripeChargeId" TEXT,
    "stripeRefundId" TEXT,
    "receiptUrl" TEXT,
    "receiptPublicId" TEXT,
    "receiptFileName" TEXT,
    "receiptMimeType" TEXT,
    "receiptUploadedAt" TIMESTAMP(3),
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "reviewRequestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderConfig" (
    "id" TEXT NOT NULL,
    "code" "PaymentProvider" NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "supportsReceipts" BOOLEAN NOT NULL DEFAULT false,
    "supportsRefunds" BOOLEAN NOT NULL DEFAULT false,
    "supportsWebhooks" BOOLEAN NOT NULL DEFAULT false,
    "supportedCurrencies" JSONB,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT,
    "providerConfigurationId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "kind" "PaymentKind" NOT NULL DEFAULT 'CHARGE',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "amount" DECIMAL(10,2) NOT NULL,
    "exchangeRate" DECIMAL(18,6),
    "externalReference" TEXT,
    "externalTransactionId" TEXT,
    "providerResponse" JSONB,
    "metadata" JSONB,
    "authorizedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhook" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "orderId" TEXT,
    "providerConfigurationId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalEventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT,
    "transactionId" TEXT,
    "providerConfigurationId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "amount" DECIMAL(10,2) NOT NULL,
    "externalRefundId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAuditLog" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" "PaymentStatus",
    "toStatus" "PaymentStatus",
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "iban" TEXT,
    "accountNumber" TEXT,
    "cardNumber" TEXT,
    "swift" TEXT,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetPrice" DECIMAL(10,2) NOT NULL,
    "lastKnownPrice" DECIMAL(10,2),
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "triggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetType" "PricingTargetType" NOT NULL DEFAULT 'GLOBAL',
    "brandId" TEXT,
    "categoryId" TEXT,
    "countryCode" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "marginPercent" DECIMAL(5,2),
    "localShippingFee" DECIMAL(10,2),
    "minimumProfitAmount" DECIMAL(10,2),
    "fixedFee" DECIMAL(10,2),
    "shippingFee" DECIMAL(10,2),
    "handlingFee" DECIMAL(10,2),
    "paymentFee" DECIMAL(10,2),
    "taxPercent" DECIMAL(5,2),
    "freeShippingThreshold" DECIMAL(10,2),
    "minimumOrderValue" DECIMAL(10,2),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "supportEmail" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "defaultCountryCode" TEXT NOT NULL,
    "defaultMarginPercent" DECIMAL(5,2) NOT NULL,
    "minimumProfitAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "portugalShippingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "spainShippingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "iranShippingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fixedProfitAmount" DECIMAL(10,2) NOT NULL,
    "handlingFee" DECIMAL(10,2) NOT NULL,
    "paymentFee" DECIMAL(10,2) NOT NULL,
    "vatPercent" DECIMAL(5,2) NOT NULL,
    "freeShippingThreshold" DECIMAL(10,2) NOT NULL,
    "minimumOrderValue" DECIMAL(10,2) NOT NULL,
    "returnPeriodDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Currency" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "TaxSettings" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxPercent" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "originCountryCode" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "minWeightKg" DECIMAL(10,2),
    "maxWeightKg" DECIMAL(10,2),
    "minDeliveryDays" INTEGER NOT NULL,
    "maxDeliveryDays" INTEGER NOT NULL,
    "baseFee" DECIMAL(10,2) NOT NULL,
    "freeShippingThreshold" DECIMAL(10,2),
    "deliveryEstimate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSource" (
    "id" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "countryCode" TEXT,
    "currencyCode" TEXT,
    "region" TEXT,
    "sourceType" "BrandSourceType" NOT NULL,
    "status" "BrandSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "pricingRuleId" TEXT,
    "shippingMethodId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "BrandSourceType" NOT NULL,
    "description" TEXT,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorConfiguration" (
    "id" TEXT NOT NULL,
    "brandSourceId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "scraperSourceId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "feedUrl" TEXT,
    "recordPath" TEXT,
    "importApprovedAt" TIMESTAMP(3),
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorFieldMapping" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "externalField" TEXT NOT NULL,
    "internalField" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorExecutionProfile" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "listingUrl" TEXT,
    "headless" BOOLEAN NOT NULL DEFAULT true,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "retryAttempts" INTEGER NOT NULL DEFAULT 2,
    "userAgent" TEXT,
    "maxRequestsPerMinute" INTEGER,
    "maxConcurrentPages" INTEGER,
    "pageLimit" INTEGER NOT NULL DEFAULT 1,
    "sampleSize" INTEGER NOT NULL DEFAULT 6,
    "productCardSelector" TEXT,
    "productNameSelector" TEXT,
    "productPriceSelector" TEXT,
    "productOldPriceSelector" TEXT,
    "productImageSelector" TEXT,
    "productUrlSelector" TEXT,
    "paginationSelector" TEXT,
    "nextPageSelector" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorExecutionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateIntegration" (
    "id" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "name" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "publisherId" TEXT,
    "websiteId" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "syncFrequency" "SyncFrequency" NOT NULL DEFAULT 'DAILY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandName" TEXT,
    "website" TEXT,
    "countryCode" TEXT,
    "currencyCode" TEXT,
    "sourceType" "ImportSourceType" NOT NULL,
    "status" "ImportSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "syncFrequency" "SyncFrequency" NOT NULL DEFAULT 'DAILY',
    "pricingRuleId" TEXT,
    "shippingMethodId" TEXT,
    "notes" TEXT,
    "configuration" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "scraperRunId" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "triggerMode" TEXT,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "normalizedCount" INTEGER NOT NULL DEFAULT 0,
    "validatedCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorPayload" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" "ImportLogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportSnapshot" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "productCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minDiscount" INTEGER NOT NULL DEFAULT 0,
    "allowedBrands" TEXT[],
    "allowedCategories" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "status" "ScraperStatus" NOT NULL DEFAULT 'ACTIVE',
    "scraperType" "ScraperType" NOT NULL,
    "connectorKey" TEXT NOT NULL,
    "countryCode" TEXT,
    "currencyCode" TEXT,
    "region" TEXT,
    "syncFrequency" "SyncFrequency" NOT NULL DEFAULT 'MANUAL',
    "lastRunAt" TIMESTAMP(3),
    "configuration" JSONB,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "ScraperRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "productsFound" INTEGER NOT NULL DEFAULT 0,
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "normalizedCount" INTEGER NOT NULL DEFAULT 0,
    "validatedCount" INTEGER NOT NULL DEFAULT 0,
    "productsImported" INTEGER NOT NULL DEFAULT 0,
    "productsUpdated" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperArtifact" (
    "id" TEXT NOT NULL,
    "scraperRunId" TEXT NOT NULL,
    "type" "ScraperArtifactType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScraperArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorRun" (
    "id" TEXT NOT NULL,
    "connectorConfigurationId" TEXT NOT NULL,
    "brandSourceId" TEXT NOT NULL,
    "scraperSourceId" TEXT,
    "scraperRunId" TEXT,
    "importJobId" TEXT,
    "status" "ConnectorRunStatus" NOT NULL DEFAULT 'PENDING',
    "triggerMode" TEXT,
    "strategyUsed" TEXT,
    "httpStatus" INTEGER,
    "protectionType" TEXT,
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "normalizedCount" INTEGER NOT NULL DEFAULT 0,
    "validatedCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "urlsDiscovered" INTEGER NOT NULL DEFAULT 0,
    "urlsProcessed" INTEGER NOT NULL DEFAULT 0,
    "duplicateUrlsRemoved" INTEGER NOT NULL DEFAULT 0,
    "urlsSkipped" INTEGER NOT NULL DEFAULT 0,
    "rawRecordCount" INTEGER NOT NULL DEFAULT 0,
    "validationFailureCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "diagnosticsPayload" JSONB,
    "discoveryPayload" JSONB,
    "normalizationPayload" JSONB,
    "upsertPayload" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportProductResult" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT,
    "scraperRunId" TEXT,
    "connectorRunId" TEXT,
    "productId" TEXT,
    "status" "ImportProductResultStatus" NOT NULL,
    "failureReason" "ImportFailureReason",
    "stage" TEXT,
    "productName" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "sourceUrl" TEXT,
    "imageUrl" TEXT,
    "currentPrice" DECIMAL(10,2),
    "oldPrice" DECIMAL(10,2),
    "existingContentHash" TEXT,
    "newContentHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportProductResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "SyncRunStatus" NOT NULL DEFAULT 'PENDING',
    "productsChecked" INTEGER NOT NULL DEFAULT 0,
    "productsChanged" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT NOT NULL,
    "reviewerName" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "orderId" TEXT,
    "paymentId" TEXT,
    "priceAlertId" TEXT,
    "channelCode" "NotificationChannelCode" NOT NULL DEFAULT 'IN_APP',
    "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderNotifications" BOOLEAN NOT NULL DEFAULT true,
    "paymentNotifications" BOOLEAN NOT NULL DEFAULT true,
    "shippingNotifications" BOOLEAN NOT NULL DEFAULT true,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "systemNotifications" BOOLEAN NOT NULL DEFAULT true,
    "channelSettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationChannel" (
    "code" "NotificationChannelCode" NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "queueName" TEXT NOT NULL,
    "supportsOpenTracking" BOOLEAN NOT NULL DEFAULT false,
    "supportsRetries" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationChannel_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventSource" "NotificationEventSource" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "orderId" TEXT,
    "paymentId" TEXT,
    "procurementTaskId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "title" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelCode" "NotificationChannelCode" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "subjectTemplate" TEXT NOT NULL,
    "htmlTemplate" TEXT NOT NULL,
    "textTemplate" TEXT NOT NULL,
    "variablesSchema" JSONB,
    "samplePayload" JSONB,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "subjectTemplate" TEXT NOT NULL,
    "htmlTemplate" TEXT NOT NULL,
    "textTemplate" TEXT NOT NULL,
    "samplePayload" JSONB,
    "variablesSchema" JSONB,
    "createdByUserId" TEXT,
    "changeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "notificationId" TEXT,
    "channelCode" "NotificationChannelCode" NOT NULL,
    "state" "NotificationDeliveryState" NOT NULL DEFAULT 'PENDING',
    "recipient" TEXT,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "renderedSubject" TEXT,
    "renderedBody" TEXT,
    "providerResponse" JSONB,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "openTimestamp" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationAudit" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "notificationId" TEXT,
    "deliveryId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "eventSource" "NotificationEventSource",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "importJobId" TEXT,
    "scraperRunId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Brand_isActive_idx" ON "Brand"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_parentId_key" ON "Category"("name", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_importSourceId_idx" ON "Product"("importSourceId");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_slug_idx" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_dealLevel_idx" ON "Product"("dealLevel");

-- CreateIndex
CREATE INDEX "Product_contentHash_idx" ON "Product"("contentHash");

-- CreateIndex
CREATE INDEX "Product_isFeatured_idx" ON "Product"("isFeatured");

-- CreateIndex
CREATE INDEX "Product_isTrending_idx" ON "Product"("isTrending");

-- CreateIndex
CREATE INDEX "Product_useCustomPricing_idx" ON "Product"("useCustomPricing");

-- CreateIndex
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");

-- CreateIndex
CREATE INDEX "Product_stockStatus_idx" ON "Product"("stockStatus");

-- CreateIndex
CREATE INDEX "Product_lastSyncedAt_idx" ON "Product"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "PriceChange_productId_idx" ON "PriceChange"("productId");

-- CreateIndex
CREATE INDEX "PriceChange_detectedAt_idx" ON "PriceChange"("detectedAt");

-- CreateIndex
CREATE INDEX "StockChange_productId_idx" ON "StockChange"("productId");

-- CreateIndex
CREATE INDEX "StockChange_detectedAt_idx" ON "StockChange"("detectedAt");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_productId_position_key" ON "ProductImage"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_size_color_key" ON "ProductVariant"("productId", "size", "color");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_capturedAt_idx" ON "PriceHistory"("productId", "capturedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_importJobId_idx" ON "PriceHistory"("importJobId");

-- CreateIndex
CREATE INDEX "Wishlist_userId_idx" ON "Wishlist"("userId");

-- CreateIndex
CREATE INDEX "Wishlist_productId_idx" ON "Wishlist"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON "Wishlist"("userId", "productId");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE INDEX "CustomerAddress_userId_idx" ON "CustomerAddress"("userId");

-- CreateIndex
CREATE INDEX "CustomerAddress_countryCode_idx" ON "CustomerAddress"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_guestToken_key" ON "Cart"("guestToken");

-- CreateIndex
CREATE INDEX "Cart_userId_idx" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "Cart_countryCode_idx" ON "Cart"("countryCode");

-- CreateIndex
CREATE INDEX "Cart_pricingRuleId_idx" ON "Cart"("pricingRuleId");

-- CreateIndex
CREATE INDEX "Cart_shippingMethodId_idx" ON "Cart"("shippingMethodId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantId_key" ON "CartItem"("cartId", "productId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeCheckoutSessionId_key" ON "Order"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripePaymentIntentId_key" ON "Order"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_cartId_idx" ON "Order"("cartId");

-- CreateIndex
CREATE INDEX "Order_customerAddressId_idx" ON "Order"("customerAddressId");

-- CreateIndex
CREATE INDEX "Order_billingAddressId_idx" ON "Order"("billingAddressId");

-- CreateIndex
CREATE INDEX "Order_pricingRuleId_idx" ON "Order"("pricingRuleId");

-- CreateIndex
CREATE INDEX "Order_shippingMethodId_idx" ON "Order"("shippingMethodId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementTask_orderItemId_key" ON "ProcurementTask"("orderItemId");

-- CreateIndex
CREATE INDEX "ProcurementTask_orderId_idx" ON "ProcurementTask"("orderId");

-- CreateIndex
CREATE INDEX "ProcurementTask_productId_idx" ON "ProcurementTask"("productId");

-- CreateIndex
CREATE INDEX "ProcurementTask_brandSourceId_idx" ON "ProcurementTask"("brandSourceId");

-- CreateIndex
CREATE INDEX "ProcurementTask_status_idx" ON "ProcurementTask"("status");

-- CreateIndex
CREATE INDEX "ProcurementTask_createdAt_idx" ON "ProcurementTask"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_providerConfigurationId_idx" ON "Payment"("providerConfigurationId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_kind_idx" ON "Payment"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderConfig_code_key" ON "PaymentProviderConfig"("code");

-- CreateIndex
CREATE INDEX "PaymentProviderConfig_isActive_priority_idx" ON "PaymentProviderConfig"("isActive", "priority");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentId_idx" ON "PaymentTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_providerConfigurationId_idx" ON "PaymentTransaction"("providerConfigurationId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_provider_status_idx" ON "PaymentTransaction"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhook_externalEventId_key" ON "PaymentWebhook"("externalEventId");

-- CreateIndex
CREATE INDEX "PaymentWebhook_paymentId_idx" ON "PaymentWebhook"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentWebhook_orderId_idx" ON "PaymentWebhook"("orderId");

-- CreateIndex
CREATE INDEX "PaymentWebhook_providerConfigurationId_idx" ON "PaymentWebhook"("providerConfigurationId");

-- CreateIndex
CREATE INDEX "PaymentWebhook_provider_status_idx" ON "PaymentWebhook"("provider", "status");

-- CreateIndex
CREATE INDEX "PaymentRefund_paymentId_idx" ON "PaymentRefund"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentRefund_orderId_idx" ON "PaymentRefund"("orderId");

-- CreateIndex
CREATE INDEX "PaymentRefund_transactionId_idx" ON "PaymentRefund"("transactionId");

-- CreateIndex
CREATE INDEX "PaymentRefund_providerConfigurationId_idx" ON "PaymentRefund"("providerConfigurationId");

-- CreateIndex
CREATE INDEX "PaymentRefund_provider_status_idx" ON "PaymentRefund"("provider", "status");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_paymentId_idx" ON "PaymentAuditLog"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_actorUserId_idx" ON "PaymentAuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_createdAt_idx" ON "PaymentAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "BankAccount_isActive_currency_idx" ON "BankAccount"("isActive", "currency");

-- CreateIndex
CREATE INDEX "ExchangeRate_isActive_idx" ON "ExchangeRate"("isActive");

-- CreateIndex
CREATE INDEX "ExchangeRate_updatedByUserId_idx" ON "ExchangeRate"("updatedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_baseCurrency_quoteCurrency_key" ON "ExchangeRate"("baseCurrency", "quoteCurrency");

-- CreateIndex
CREATE INDEX "PriceAlert_status_idx" ON "PriceAlert"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PriceAlert_userId_productId_key" ON "PriceAlert"("userId", "productId");

-- CreateIndex
CREATE INDEX "PricingRule_brandId_idx" ON "PricingRule"("brandId");

-- CreateIndex
CREATE INDEX "PricingRule_categoryId_idx" ON "PricingRule"("categoryId");

-- CreateIndex
CREATE INDEX "PricingRule_countryCode_idx" ON "PricingRule"("countryCode");

-- CreateIndex
CREATE INDEX "PricingRule_isActive_priority_idx" ON "PricingRule"("isActive", "priority");

-- CreateIndex
CREATE INDEX "BusinessSettings_defaultCountryCode_idx" ON "BusinessSettings"("defaultCountryCode");

-- CreateIndex
CREATE INDEX "TaxSettings_countryCode_idx" ON "TaxSettings"("countryCode");

-- CreateIndex
CREATE INDEX "TaxSettings_isActive_idx" ON "TaxSettings"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaxSettings_countryCode_name_key" ON "TaxSettings"("countryCode", "name");

-- CreateIndex
CREATE INDEX "ShippingMethod_countryCode_idx" ON "ShippingMethod"("countryCode");

-- CreateIndex
CREATE INDEX "ShippingMethod_originCountryCode_idx" ON "ShippingMethod"("originCountryCode");

-- CreateIndex
CREATE INDEX "ShippingMethod_isActive_idx" ON "ShippingMethod"("isActive");

-- CreateIndex
CREATE INDEX "BrandSource_countryCode_idx" ON "BrandSource"("countryCode");

-- CreateIndex
CREATE INDEX "BrandSource_currencyCode_idx" ON "BrandSource"("currencyCode");

-- CreateIndex
CREATE INDEX "BrandSource_status_idx" ON "BrandSource"("status");

-- CreateIndex
CREATE INDEX "BrandSource_sourceType_idx" ON "BrandSource"("sourceType");

-- CreateIndex
CREATE INDEX "BrandSource_pricingRuleId_idx" ON "BrandSource"("pricingRuleId");

-- CreateIndex
CREATE INDEX "BrandSource_shippingMethodId_idx" ON "BrandSource"("shippingMethodId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandSource_brandName_website_key" ON "BrandSource"("brandName", "website");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorTemplate_key_key" ON "ConnectorTemplate"("key");

-- CreateIndex
CREATE INDEX "ConnectorTemplate_sourceType_idx" ON "ConnectorTemplate"("sourceType");

-- CreateIndex
CREATE INDEX "ConnectorTemplate_isSystemTemplate_idx" ON "ConnectorTemplate"("isSystemTemplate");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorConfiguration_brandSourceId_key" ON "ConnectorConfiguration"("brandSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorConfiguration_scraperSourceId_key" ON "ConnectorConfiguration"("scraperSourceId");

-- CreateIndex
CREATE INDEX "ConnectorConfiguration_templateId_idx" ON "ConnectorConfiguration"("templateId");

-- CreateIndex
CREATE INDEX "ConnectorConfiguration_scraperSourceId_idx" ON "ConnectorConfiguration"("scraperSourceId");

-- CreateIndex
CREATE INDEX "ConnectorConfiguration_isEnabled_idx" ON "ConnectorConfiguration"("isEnabled");

-- CreateIndex
CREATE INDEX "ConnectorFieldMapping_configurationId_idx" ON "ConnectorFieldMapping"("configurationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorFieldMapping_configurationId_internalField_key" ON "ConnectorFieldMapping"("configurationId", "internalField");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorExecutionProfile_configurationId_key" ON "ConnectorExecutionProfile"("configurationId");

-- CreateIndex
CREATE INDEX "AffiliateIntegration_status_idx" ON "AffiliateIntegration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateIntegration_type_name_key" ON "AffiliateIntegration"("type", "name");

-- CreateIndex
CREATE INDEX "ImportSource_status_idx" ON "ImportSource"("status");

-- CreateIndex
CREATE INDEX "ImportSource_sourceType_idx" ON "ImportSource"("sourceType");

-- CreateIndex
CREATE INDEX "ImportSource_countryCode_idx" ON "ImportSource"("countryCode");

-- CreateIndex
CREATE INDEX "ImportSource_currencyCode_idx" ON "ImportSource"("currencyCode");

-- CreateIndex
CREATE INDEX "ImportSource_pricingRuleId_idx" ON "ImportSource"("pricingRuleId");

-- CreateIndex
CREATE INDEX "ImportSource_shippingMethodId_idx" ON "ImportSource"("shippingMethodId");

-- CreateIndex
CREATE INDEX "ImportJob_sourceId_idx" ON "ImportJob"("sourceId");

-- CreateIndex
CREATE INDEX "ImportJob_scraperRunId_idx" ON "ImportJob"("scraperRunId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ImportLog_jobId_idx" ON "ImportLog"("jobId");

-- CreateIndex
CREATE INDEX "ImportLog_level_idx" ON "ImportLog"("level");

-- CreateIndex
CREATE INDEX "ImportLog_createdAt_idx" ON "ImportLog"("createdAt");

-- CreateIndex
CREATE INDEX "ImportSnapshot_jobId_idx" ON "ImportSnapshot"("jobId");

-- CreateIndex
CREATE INDEX "ImportSnapshot_createdAt_idx" ON "ImportSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "ImportRule_isActive_idx" ON "ImportRule"("isActive");

-- CreateIndex
CREATE INDEX "ScraperSource_status_idx" ON "ScraperSource"("status");

-- CreateIndex
CREATE INDEX "ScraperSource_scraperType_idx" ON "ScraperSource"("scraperType");

-- CreateIndex
CREATE INDEX "ScraperSource_connectorKey_idx" ON "ScraperSource"("connectorKey");

-- CreateIndex
CREATE INDEX "ScraperSource_syncFrequency_idx" ON "ScraperSource"("syncFrequency");

-- CreateIndex
CREATE INDEX "ScraperSource_countryCode_idx" ON "ScraperSource"("countryCode");

-- CreateIndex
CREATE INDEX "ScraperSource_currencyCode_idx" ON "ScraperSource"("currencyCode");

-- CreateIndex
CREATE INDEX "ScraperRun_sourceId_idx" ON "ScraperRun"("sourceId");

-- CreateIndex
CREATE INDEX "ScraperRun_status_idx" ON "ScraperRun"("status");

-- CreateIndex
CREATE INDEX "ScraperRun_createdAt_idx" ON "ScraperRun"("createdAt");

-- CreateIndex
CREATE INDEX "ScraperArtifact_scraperRunId_idx" ON "ScraperArtifact"("scraperRunId");

-- CreateIndex
CREATE INDEX "ScraperArtifact_type_idx" ON "ScraperArtifact"("type");

-- CreateIndex
CREATE INDEX "ScraperArtifact_createdAt_idx" ON "ScraperArtifact"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorRun_scraperRunId_key" ON "ConnectorRun"("scraperRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorRun_importJobId_key" ON "ConnectorRun"("importJobId");

-- CreateIndex
CREATE INDEX "ConnectorRun_connectorConfigurationId_idx" ON "ConnectorRun"("connectorConfigurationId");

-- CreateIndex
CREATE INDEX "ConnectorRun_brandSourceId_idx" ON "ConnectorRun"("brandSourceId");

-- CreateIndex
CREATE INDEX "ConnectorRun_scraperSourceId_idx" ON "ConnectorRun"("scraperSourceId");

-- CreateIndex
CREATE INDEX "ConnectorRun_status_idx" ON "ConnectorRun"("status");

-- CreateIndex
CREATE INDEX "ConnectorRun_createdAt_idx" ON "ConnectorRun"("createdAt");

-- CreateIndex
CREATE INDEX "ImportProductResult_importJobId_idx" ON "ImportProductResult"("importJobId");

-- CreateIndex
CREATE INDEX "ImportProductResult_scraperRunId_idx" ON "ImportProductResult"("scraperRunId");

-- CreateIndex
CREATE INDEX "ImportProductResult_connectorRunId_idx" ON "ImportProductResult"("connectorRunId");

-- CreateIndex
CREATE INDEX "ImportProductResult_productId_idx" ON "ImportProductResult"("productId");

-- CreateIndex
CREATE INDEX "ImportProductResult_status_idx" ON "ImportProductResult"("status");

-- CreateIndex
CREATE INDEX "ImportProductResult_failureReason_idx" ON "ImportProductResult"("failureReason");

-- CreateIndex
CREATE INDEX "ImportProductResult_createdAt_idx" ON "ImportProductResult"("createdAt");

-- CreateIndex
CREATE INDEX "SyncRun_sourceId_idx" ON "SyncRun"("sourceId");

-- CreateIndex
CREATE INDEX "SyncRun_status_idx" ON "SyncRun"("status");

-- CreateIndex
CREATE INDEX "SyncRun_createdAt_idx" ON "SyncRun"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_type_idx" ON "Alert"("type");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX "Alert_isRead_idx" ON "Alert"("isRead");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "Review_productId_idx" ON "Review"("productId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_status_idx" ON "Notification"("userId", "status");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_eventId_idx" ON "Notification"("eventId");

-- CreateIndex
CREATE INDEX "Notification_category_createdAt_idx" ON "Notification"("category", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_eventKey_key" ON "NotificationEvent"("eventKey");

-- CreateIndex
CREATE INDEX "NotificationEvent_targetUserId_occurredAt_idx" ON "NotificationEvent"("targetUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "NotificationEvent_eventSource_occurredAt_idx" ON "NotificationEvent"("eventSource", "occurredAt");

-- CreateIndex
CREATE INDEX "NotificationEvent_category_occurredAt_idx" ON "NotificationEvent"("category", "occurredAt");

-- CreateIndex
CREATE INDEX "NotificationEvent_orderId_idx" ON "NotificationEvent"("orderId");

-- CreateIndex
CREATE INDEX "NotificationEvent_paymentId_idx" ON "NotificationEvent"("paymentId");

-- CreateIndex
CREATE INDEX "NotificationEvent_procurementTaskId_idx" ON "NotificationEvent"("procurementTaskId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_category_isActive_idx" ON "NotificationTemplate"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_key_channelCode_key" ON "NotificationTemplate"("key", "channelCode");

-- CreateIndex
CREATE INDEX "NotificationTemplateVersion_templateId_createdAt_idx" ON "NotificationTemplateVersion"("templateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplateVersion_templateId_version_key" ON "NotificationTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "NotificationDelivery_eventId_channelCode_idx" ON "NotificationDelivery"("eventId", "channelCode");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_state_createdAt_idx" ON "NotificationDelivery"("state", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationAudit_eventId_idx" ON "NotificationAudit"("eventId");

-- CreateIndex
CREATE INDEX "NotificationAudit_notificationId_idx" ON "NotificationAudit"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationAudit_deliveryId_idx" ON "NotificationAudit"("deliveryId");

-- CreateIndex
CREATE INDEX "NotificationAudit_actorUserId_idx" ON "NotificationAudit"("actorUserId");

-- CreateIndex
CREATE INDEX "NotificationAudit_action_createdAt_idx" ON "NotificationAudit"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_scraperRunId_idx" ON "AuditLog"("scraperRunId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_importSourceId_fkey" FOREIGN KEY ("importSourceId") REFERENCES "ImportSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceChange" ADD CONSTRAINT "PriceChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockChange" ADD CONSTRAINT "StockChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerAddressId_fkey" FOREIGN KEY ("customerAddressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_billingAddressId_fkey" FOREIGN KEY ("billingAddressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementTask" ADD CONSTRAINT "ProcurementTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementTask" ADD CONSTRAINT "ProcurementTask_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementTask" ADD CONSTRAINT "ProcurementTask_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementTask" ADD CONSTRAINT "ProcurementTask_brandSourceId_fkey" FOREIGN KEY ("brandSourceId") REFERENCES "BrandSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_providerConfigurationId_fkey" FOREIGN KEY ("providerConfigurationId") REFERENCES "PaymentProviderConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_providerConfigurationId_fkey" FOREIGN KEY ("providerConfigurationId") REFERENCES "PaymentProviderConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhook" ADD CONSTRAINT "PaymentWebhook_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhook" ADD CONSTRAINT "PaymentWebhook_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhook" ADD CONSTRAINT "PaymentWebhook_providerConfigurationId_fkey" FOREIGN KEY ("providerConfigurationId") REFERENCES "PaymentProviderConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_providerConfigurationId_fkey" FOREIGN KEY ("providerConfigurationId") REFERENCES "PaymentProviderConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAuditLog" ADD CONSTRAINT "PaymentAuditLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAuditLog" ADD CONSTRAINT "PaymentAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_defaultCountryCode_fkey" FOREIGN KEY ("defaultCountryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxSettings" ADD CONSTRAINT "TaxSettings_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingMethod" ADD CONSTRAINT "ShippingMethod_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSource" ADD CONSTRAINT "BrandSource_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSource" ADD CONSTRAINT "BrandSource_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSource" ADD CONSTRAINT "BrandSource_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorConfiguration" ADD CONSTRAINT "ConnectorConfiguration_brandSourceId_fkey" FOREIGN KEY ("brandSourceId") REFERENCES "BrandSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorConfiguration" ADD CONSTRAINT "ConnectorConfiguration_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ConnectorTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorConfiguration" ADD CONSTRAINT "ConnectorConfiguration_scraperSourceId_fkey" FOREIGN KEY ("scraperSourceId") REFERENCES "ScraperSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorFieldMapping" ADD CONSTRAINT "ConnectorFieldMapping_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ConnectorConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorExecutionProfile" ADD CONSTRAINT "ConnectorExecutionProfile_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ConnectorConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSource" ADD CONSTRAINT "ImportSource_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSource" ADD CONSTRAINT "ImportSource_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ImportSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_scraperRunId_fkey" FOREIGN KEY ("scraperRunId") REFERENCES "ScraperRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSnapshot" ADD CONSTRAINT "ImportSnapshot_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperRun" ADD CONSTRAINT "ScraperRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ScraperSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperArtifact" ADD CONSTRAINT "ScraperArtifact_scraperRunId_fkey" FOREIGN KEY ("scraperRunId") REFERENCES "ScraperRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorRun" ADD CONSTRAINT "ConnectorRun_connectorConfigurationId_fkey" FOREIGN KEY ("connectorConfigurationId") REFERENCES "ConnectorConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorRun" ADD CONSTRAINT "ConnectorRun_brandSourceId_fkey" FOREIGN KEY ("brandSourceId") REFERENCES "BrandSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorRun" ADD CONSTRAINT "ConnectorRun_scraperSourceId_fkey" FOREIGN KEY ("scraperSourceId") REFERENCES "ScraperSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorRun" ADD CONSTRAINT "ConnectorRun_scraperRunId_fkey" FOREIGN KEY ("scraperRunId") REFERENCES "ScraperRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorRun" ADD CONSTRAINT "ConnectorRun_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportProductResult" ADD CONSTRAINT "ImportProductResult_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportProductResult" ADD CONSTRAINT "ImportProductResult_scraperRunId_fkey" FOREIGN KEY ("scraperRunId") REFERENCES "ScraperRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportProductResult" ADD CONSTRAINT "ImportProductResult_connectorRunId_fkey" FOREIGN KEY ("connectorRunId") REFERENCES "ConnectorRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportProductResult" ADD CONSTRAINT "ImportProductResult_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ScraperSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_priceAlertId_fkey" FOREIGN KEY ("priceAlertId") REFERENCES "PriceAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_procurementTaskId_fkey" FOREIGN KEY ("procurementTaskId") REFERENCES "ProcurementTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_channelCode_fkey" FOREIGN KEY ("channelCode") REFERENCES "NotificationChannel"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplateVersion" ADD CONSTRAINT "NotificationTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplateVersion" ADD CONSTRAINT "NotificationTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_channelCode_fkey" FOREIGN KEY ("channelCode") REFERENCES "NotificationChannel"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationAudit" ADD CONSTRAINT "NotificationAudit_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationAudit" ADD CONSTRAINT "NotificationAudit_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationAudit" ADD CONSTRAINT "NotificationAudit_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "NotificationDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationAudit" ADD CONSTRAINT "NotificationAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_scraperRunId_fkey" FOREIGN KEY ("scraperRunId") REFERENCES "ScraperRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

