import bcrypt from "bcryptjs";
import { Prisma, PricingTargetType, ProductSource, ProductStatus, RoleCode, ScraperStatus, ScraperType, StockStatus, SyncFrequency, UserStatus } from "@prisma/client";

import { prisma as appPrisma } from "../src/config/prisma.js";
import { commerceAdminService } from "../src/modules/commerce/commerce-admin.service.js";
import { pricingService } from "../src/modules/commerce/pricing.service.js";
import { closeImportQueueInfrastructure } from "../src/modules/imports/import-queue.js";
import { closeMonitoringQueueInfrastructure } from "../src/modules/monitoring/monitoring-queue.js";
import { closeNotificationQueueInfrastructure } from "../src/modules/notifications/notification-queue.js";
import { notificationsService } from "../src/modules/notifications/notifications.service.js";
import { closeScraperQueueInfrastructure } from "../src/modules/scrapers/scraper-queue.js";
import { upsertUserWithReferralCode } from "../src/utils/referral-code.js";

const prisma = appPrisma;
const DEMO_ADMIN_EMAIL = "admin@outlethub.local";
const DEMO_ADMIN_PASSWORD = "Admin12345!";
const DEMO_ADMIN_NAME = "Demo Admin";

async function seedRoles(): Promise<void> {
  const roles = [
    {
      code: RoleCode.SUPER_ADMIN,
      name: "Super Admin",
      description: "Full platform access.",
    },
    {
      code: RoleCode.ADMIN,
      name: "Admin",
      description: "Operational admin access.",
    },
    {
      code: RoleCode.CUSTOMER,
      name: "Customer",
      description: "Marketplace customer access.",
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: role,
      create: role,
    });
  }
}

async function seedDemoAdmin(): Promise<void> {
  const adminRole = await prisma.role.findUnique({
    where: { code: RoleCode.SUPER_ADMIN },
  });

  if (!adminRole) {
    throw new Error("Super admin role is missing. Run role seeding before demo admin seeding.");
  }

  const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);

  await upsertUserWithReferralCode(
    prisma,
    {
      where: { email: DEMO_ADMIN_EMAIL },
      update: {
        fullName: DEMO_ADMIN_NAME,
        passwordHash,
        roleId: adminRole.id,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      create: {
        email: DEMO_ADMIN_EMAIL,
        fullName: DEMO_ADMIN_NAME,
        passwordHash,
        roleId: adminRole.id,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    } as Prisma.UserUpsertArgs,
  );
}

async function seedDemoCatalog(): Promise<void> {
  const [brandNike, brandCoach] = await Promise.all([
    prisma.brand.upsert({
      where: { slug: "nike" },
      update: {
        name: "Nike",
        isActive: true,
        isFeatured: true,
        isLuxury: false,
      },
      create: {
        name: "Nike",
        slug: "nike",
        isActive: true,
        isFeatured: true,
        isLuxury: false,
      },
    }),
    prisma.brand.upsert({
      where: { slug: "coach" },
      update: {
        name: "Coach",
        isActive: true,
        isFeatured: true,
        isLuxury: true,
      },
      create: {
        name: "Coach",
        slug: "coach",
        isActive: true,
        isFeatured: true,
        isLuxury: true,
      },
    }),
  ]);

  const clothingCategory = await prisma.category.upsert({
    where: { slug: "clothing" },
    update: {
      name: "Clothing",
    },
    create: {
      name: "Clothing",
      slug: "clothing",
      sortOrder: 0,
    },
  });

  const bagsCategory = await prisma.category.upsert({
    where: { slug: "bags" },
    update: {
      name: "Bags",
    },
    create: {
      name: "Bags",
      slug: "bags",
      sortOrder: 1,
    },
  });

  const products = [
    {
      sku: "DEMO-NIKE-TEE",
      name: "Nike Outlet Logo Tee",
      slug: "nike-outlet-logo-tee",
      brandId: brandNike.id,
      categoryId: clothingCategory.id,
      price: 39,
      oldPrice: 65,
      discountPercent: 40,
      stock: 24,
      stockStatus: StockStatus.IN_STOCK,
      isFeatured: true,
      isTrending: true,
      status: ProductStatus.ACTIVE,
      sourceType: ProductSource.MANUAL,
      sourceStore: "OutletHub Demo",
      description: "Premium cotton logo tee with outlet pricing.",
      sizes: ["S", "M", "L", "XL"],
      colors: ["Black", "White"],
      imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "DEMO-COACH-TOTE",
      name: "Coach Signature Tote",
      slug: "coach-signature-tote",
      brandId: brandCoach.id,
      categoryId: bagsCategory.id,
      price: 199,
      oldPrice: 420,
      discountPercent: 53,
      stock: 8,
      stockStatus: StockStatus.LOW_STOCK,
      isFeatured: true,
      isTrending: false,
      status: ProductStatus.ACTIVE,
      sourceType: ProductSource.MANUAL,
      sourceStore: "OutletHub Demo",
      description: "Signature coated canvas tote with polished leather trim.",
      sizes: [],
      colors: ["Brown"],
      imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "DEMO-NIKE-HOODIE",
      name: "Nike Fleece Hoodie",
      slug: "nike-fleece-hoodie",
      brandId: brandNike.id,
      categoryId: clothingCategory.id,
      price: 79,
      oldPrice: 120,
      discountPercent: 34,
      stock: 16,
      stockStatus: StockStatus.IN_STOCK,
      isFeatured: false,
      isTrending: true,
      status: ProductStatus.ACTIVE,
      sourceType: ProductSource.MANUAL,
      sourceStore: "OutletHub Demo",
      description: "Soft brushed fleece hoodie for everyday wear.",
      sizes: ["M", "L", "XL"],
      colors: ["Grey", "Black"],
      imageUrl: "https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=900&q=80",
    },
  ];

  for (const product of products) {
    const createdProduct = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        slug: product.slug,
        brandId: product.brandId,
        categoryId: product.categoryId,
        price: product.price,
        oldPrice: product.oldPrice,
        discountPercent: product.discountPercent,
        stock: product.stock,
        stockStatus: product.stockStatus,
        isFeatured: product.isFeatured,
        isTrending: product.isTrending,
        status: product.status,
        sourceType: product.sourceType,
        sourceStore: product.sourceStore,
        description: product.description,
        sizes: product.sizes,
        colors: product.colors,
      },
      create: {
        sku: product.sku,
        name: product.name,
        slug: product.slug,
        brandId: product.brandId,
        categoryId: product.categoryId,
        price: product.price,
        oldPrice: product.oldPrice,
        discountPercent: product.discountPercent,
        stock: product.stock,
        stockStatus: product.stockStatus,
        isFeatured: product.isFeatured,
        isTrending: product.isTrending,
        status: product.status,
        sourceType: product.sourceType,
        sourceStore: product.sourceStore,
        description: product.description,
        sizes: product.sizes,
        colors: product.colors,
      },
    });

    await prisma.productImage.upsert({
      where: {
        productId_sortOrder: {
          productId: createdProduct.id,
          sortOrder: 0,
        },
      },
      update: {
        imageUrl: product.imageUrl,
        altText: product.name,
      },
      create: {
        productId: createdProduct.id,
        imageUrl: product.imageUrl,
        altText: product.name,
        sortOrder: 0,
      },
    });

    await prisma.priceHistory.deleteMany({
      where: {
        productId: createdProduct.id,
      },
    });

    await prisma.priceHistory.create({
      data: {
        productId: createdProduct.id,
        oldPrice: product.oldPrice,
        newPrice: product.price,
        discountPercent: product.discountPercent,
      },
    });
  }
}

async function seedCommerceConfiguration(): Promise<void> {
  const currencies = [
    { code: "EUR", name: "Euro", symbol: "EUR", isDefault: true },
    { code: "IRR", name: "Iranian Rial", symbol: "IRR", isDefault: false },
    { code: "TOMAN", name: "Iranian Toman", symbol: "TOMAN", isDefault: false },
    { code: "GBP", name: "British Pound", symbol: "GBP", isDefault: false },
    { code: "USD", name: "US Dollar", symbol: "USD", isDefault: false },
  ] as const;

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {
        name: currency.name,
        symbol: currency.symbol,
        isDefault: currency.isDefault,
      },
      create: {
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        isDefault: currency.isDefault,
      },
    });
  }

  await prisma.country.upsert({
    where: { code: "PT" },
    update: {
      name: "Portugal",
      region: "EUROPE",
      isActive: true,
    },
    create: {
      code: "PT",
      name: "Portugal",
      region: "EUROPE",
      isActive: true,
    },
  });

  await prisma.country.upsert({
    where: { code: "ES" },
    update: {
      name: "Spain",
      region: "EUROPE",
      isActive: true,
    },
    create: {
      code: "ES",
      name: "Spain",
      region: "EUROPE",
      isActive: true,
    },
  });

  await prisma.country.upsert({
    where: { code: "IR" },
    update: {
      name: "Iran",
      region: "MIDDLE_EAST",
      isActive: true,
    },
    create: {
      code: "IR",
      name: "Iran",
      region: "MIDDLE_EAST",
      isActive: true,
    },
  });

  const portugalTax = await prisma.taxSettings.findFirst({
    where: {
      countryCode: "PT",
      name: "Portugal VAT",
    },
  });

  if (portugalTax) {
  } else {
    await prisma.taxSettings.create({
      data: {
        countryCode: "PT",
        name: "Portugal VAT",
        taxPercent: 23,
        isActive: true,
      },
    });
  }

  const spainTax = await prisma.taxSettings.findFirst({
    where: {
      countryCode: "ES",
      name: "Spain VAT",
    },
  });

  if (spainTax) {
  } else {
    await prisma.taxSettings.create({
      data: {
        countryCode: "ES",
        name: "Spain VAT",
        taxPercent: 21,
        isActive: true,
      },
    });
  }

  const portugalShipping = await prisma.shippingMethod.findFirst({
    where: {
      countryCode: "PT",
      name: "Portugal Standard",
    },
  });

  if (portugalShipping) {
  } else {
    await prisma.shippingMethod.create({
      data: {
        name: "Portugal Standard",
        countryCode: "PT",
        currency: "EUR",
        minDeliveryDays: 2,
        maxDeliveryDays: 4,
        baseFee: 5.99,
        freeShippingThreshold: 120,
        isActive: true,
      },
    });
  }

  const spainShipping = await prisma.shippingMethod.findFirst({
    where: {
      countryCode: "ES",
      name: "Spain Standard",
    },
  });

  if (spainShipping) {
  } else {
    await prisma.shippingMethod.create({
      data: {
        name: "Spain Standard",
        countryCode: "ES",
        currency: "EUR",
        minDeliveryDays: 3,
        maxDeliveryDays: 5,
        baseFee: 8.99,
        freeShippingThreshold: 150,
        isActive: true,
      },
    });
  }

  const iranShippingProfiles = [
    { name: "Portugal to Iran 0-1kg", originCountryCode: "PT", countryCode: "IR", minWeightKg: 0, maxWeightKg: 1, baseFee: 25, minDeliveryDays: 6, maxDeliveryDays: 10 },
    { name: "Portugal to Iran 1-2kg", originCountryCode: "PT", countryCode: "IR", minWeightKg: 1, maxWeightKg: 2, baseFee: 34, minDeliveryDays: 6, maxDeliveryDays: 10 },
    { name: "Portugal to Iran 2-5kg", originCountryCode: "PT", countryCode: "IR", minWeightKg: 2, maxWeightKg: 5, baseFee: 58, minDeliveryDays: 7, maxDeliveryDays: 12 },
    { name: "Portugal to Iran 5-10kg", originCountryCode: "PT", countryCode: "IR", minWeightKg: 5, maxWeightKg: 10, baseFee: 92, minDeliveryDays: 8, maxDeliveryDays: 14 },
    { name: "Spain to Iran 0-1kg", originCountryCode: "ES", countryCode: "IR", minWeightKg: 0, maxWeightKg: 1, baseFee: 27, minDeliveryDays: 6, maxDeliveryDays: 10 },
    { name: "Spain to Iran 1-2kg", originCountryCode: "ES", countryCode: "IR", minWeightKg: 1, maxWeightKg: 2, baseFee: 36, minDeliveryDays: 6, maxDeliveryDays: 10 },
    { name: "Spain to Iran 2-5kg", originCountryCode: "ES", countryCode: "IR", minWeightKg: 2, maxWeightKg: 5, baseFee: 61, minDeliveryDays: 7, maxDeliveryDays: 12 },
    { name: "Spain to Iran 5-10kg", originCountryCode: "ES", countryCode: "IR", minWeightKg: 5, maxWeightKg: 10, baseFee: 97, minDeliveryDays: 8, maxDeliveryDays: 14 },
  ];

  for (const profile of iranShippingProfiles) {
    const existingProfile = await prisma.shippingMethod.findFirst({
      where: {
        name: profile.name,
        originCountryCode: profile.originCountryCode,
        countryCode: profile.countryCode,
      },
    });

    const payload = {
      name: profile.name,
      originCountryCode: profile.originCountryCode,
      countryCode: profile.countryCode,
      currency: "EUR",
      minWeightKg: profile.minWeightKg,
      maxWeightKg: profile.maxWeightKg,
      minDeliveryDays: profile.minDeliveryDays,
      maxDeliveryDays: profile.maxDeliveryDays,
      baseFee: profile.baseFee,
      freeShippingThreshold: null,
      deliveryEstimate: "International delivery to Iran",
      isActive: true,
    };

    if (!existingProfile) {
      await prisma.shippingMethod.create({
        data: payload,
      });
    }
  }

  const businessSettings = await prisma.businessSettings.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!businessSettings) {
    await prisma.businessSettings.create({
      data: {
        businessName: "OutletHub",
        supportEmail: "support@outlethub.local",
        defaultCurrency: "EUR",
        defaultCountryCode: "PT",
        defaultMarginPercent: 18,
        minimumProfitAmount: 12,
        portugalShippingFee: 5.99,
        spainShippingFee: 8.99,
        iranShippingFee: 25,
        fixedProfitAmount: 4.99,
        handlingFee: 1.99,
        paymentFee: 1.49,
        vatPercent: 23,
        freeShippingThreshold: 120,
        minimumOrderValue: 15,
        returnPeriodDays: 30,
      },
    });
  }

  const globalPricingRule = await prisma.pricingRule.findFirst({
    where: {
      name: "Default Global Pricing",
    },
  });

  if (!globalPricingRule) {
    await prisma.pricingRule.create({
      data: {
        name: "Default Global Pricing",
        targetType: PricingTargetType.GLOBAL,
        currency: "EUR",
        marginPercent: 18,
        localShippingFee: 5.99,
        minimumProfitAmount: 12,
        shippingFee: 5.99,
        handlingFee: 1.99,
        paymentFee: 1.49,
        taxPercent: 23,
        freeShippingThreshold: 120,
        minimumOrderValue: 15,
        isDefault: true,
        isActive: true,
        priority: 0,
      },
    });
  }

  const defaultPricingRule = await prisma.pricingRule.findFirst({
    where: { name: "Default Global Pricing" },
  });
  const defaultShippingMethod = await prisma.shippingMethod.findFirst({
    where: { name: "Portugal Standard" },
  });
  const managedSources = [
    { brandName: "Zara", website: "https://www.zara.com", countryCode: "PT", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
    { brandName: "Bershka", website: "https://www.bershka.com", countryCode: "PT", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
    { brandName: "Pull&Bear", website: "https://www.pullandbear.com", countryCode: "ES", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
    { brandName: "Mango", website: "https://shop.mango.com", countryCode: "ES", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
    { brandName: "H&M", website: "https://www2.hm.com", countryCode: "PT", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
    { brandName: "Puma", website: "https://eu.puma.com", countryCode: "PT", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
    { brandName: "Adidas", website: "https://www.adidas.com", countryCode: "ES", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
    { brandName: "New Balance", website: "https://www.newbalance.eu", countryCode: "ES", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
    { brandName: "Vans", website: "https://www.vans.eu", countryCode: "ES", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
    { brandName: "Sport Zone", website: "https://www.sportzone.pt", countryCode: "PT", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
    { brandName: "Michael Kors", website: "https://www.michaelkors.eu", countryCode: "PT", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
    { brandName: "Louis Vuitton", website: "https://eu.louisvuitton.com", countryCode: "ES", region: "EUROPE", sourceType: "PLAYWRIGHT" as const },
  ];

  for (const source of managedSources) {
    const existingSource = await prisma.brandSource.findFirst({
      where: { brandName: source.brandName },
    });

    const payload = {
      brandName: source.brandName,
      website: source.website,
      countryCode: source.countryCode,
      currencyCode: "EUR",
      region: source.region,
      sourceType: source.sourceType,
      status: "ACTIVE" as const,
      pricingRuleId: defaultPricingRule?.id ?? null,
      shippingMethodId: defaultShippingMethod?.id ?? null,
      notes: "Managed through admin universal source management.",
    };

    if (!existingSource) {
      await commerceAdminService.upsertSource(payload);
    }
  }
}

async function seedDemoScraperSource(): Promise<void> {
  const existing = await prisma.scraperSource.findFirst({
    where: { name: "Demo Connector Source" },
  });

  const payload = {
    name: "Demo Connector Source",
    website: "https://demo.local",
    status: ScraperStatus.ACTIVE,
    scraperType: ScraperType.PLAYWRIGHT,
    connectorKey: "demo",
    countryCode: "PT",
    currencyCode: "EUR",
    region: "EUROPE",
    syncFrequency: SyncFrequency.MANUAL,
    configuration: {
      headless: true,
      timeoutMs: 30000,
      retryAttempts: 2,
      requestLimiter: {
        maxRequestsPerMinute: 60,
        maxConcurrentPages: 2,
      },
    },
  };

  if (!existing) {
    await prisma.scraperSource.create({
      data: payload,
    });
  }
}

async function seedNikeOutletScraperSource(): Promise<void> {
  const existing = await prisma.scraperSource.findFirst({
    where: { name: "Nike Outlet" },
  });

  const payload = {
    name: "Nike Outlet",
    website: "https://www.nike.com/w/sale-3yaep",
    status: ScraperStatus.ACTIVE,
    scraperType: ScraperType.PLAYWRIGHT,
    connectorKey: "nike-outlet",
    countryCode: "PT",
    currencyCode: "EUR",
    region: "EUROPE",
    syncFrequency: SyncFrequency.EVERY_6_HOURS,
    configuration: {
      headless: true,
      timeoutMs: 45000,
      retryAttempts: 2,
      requestLimiter: {
        maxRequestsPerMinute: 30,
        maxConcurrentPages: 1,
      },
    },
  };

  if (!existing) {
    await prisma.scraperSource.create({
      data: payload,
    });
  }
}

async function main(): Promise<void> {
  await seedRoles();
  await seedDemoAdmin();
  await notificationsService.ensureCatalog();
  await notificationsService.ensurePreferencesForExistingUsers();
  await seedCommerceConfiguration();
  await seedDemoCatalog();
  await seedDemoScraperSource();
  await seedNikeOutletScraperSource();
  await commerceAdminService.prepareSourceMetadata();
  await pricingService.repriceCatalogProducts();
  console.info(`Demo admin ready: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await closeImportQueueInfrastructure();
    await closeMonitoringQueueInfrastructure();
    await closeNotificationQueueInfrastructure();
    await closeScraperQueueInfrastructure();
  })
  .catch(async (error: unknown) => {
    console.error("Prisma seed failed", error);
    await prisma.$disconnect();
    await closeImportQueueInfrastructure();
    await closeMonitoringQueueInfrastructure();
    await closeNotificationQueueInfrastructure();
    await closeScraperQueueInfrastructure();
    process.exit(1);
  });
