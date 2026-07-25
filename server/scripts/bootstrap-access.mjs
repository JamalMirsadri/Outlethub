import bcrypt from "bcryptjs";
import { PrismaClient, PricingTargetType, RoleCode, UserStatus } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"],
});

const DEFAULT_ADMIN_EMAIL = "admin@outlethub.local";
const DEFAULT_ADMIN_PASSWORD = "Admin12345!";
const DEFAULT_ADMIN_NAME = "Demo Admin";
const DEFAULT_BUSINESS_NAME = "OutletHub";
const DEFAULT_SUPPORT_EMAIL = "support@outlethub.local";

async function ensureCommerceConfiguration() {
  const currencies = [
    { code: "EUR", name: "Euro", symbol: "EUR", isDefault: true },
    { code: "IRR", name: "Iranian Rial", symbol: "IRR", isDefault: false },
    { code: "TOMAN", name: "Iranian Toman", symbol: "TOMAN", isDefault: false },
    { code: "GBP", name: "British Pound", symbol: "GBP", isDefault: false },
    { code: "USD", name: "US Dollar", symbol: "USD", isDefault: false },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: currency,
      create: currency,
    });
  }

  const countries = [
    { code: "PT", name: "Portugal", region: "EUROPE", isActive: true },
    { code: "ES", name: "Spain", region: "EUROPE", isActive: true },
    { code: "IR", name: "Iran", region: "MIDDLE_EAST", isActive: true },
  ];

  for (const country of countries) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: country,
      create: country,
    });
  }

  const taxes = [
    { countryCode: "PT", name: "Portugal VAT", taxPercent: 23, isActive: true },
    { countryCode: "ES", name: "Spain VAT", taxPercent: 21, isActive: true },
  ];

  for (const tax of taxes) {
    const existingTax = await prisma.taxSettings.findFirst({
      where: {
        countryCode: tax.countryCode,
        name: tax.name,
      },
    });

    if (existingTax) {
      await prisma.taxSettings.update({
        where: { id: existingTax.id },
        data: tax,
      });
      continue;
    }

    await prisma.taxSettings.create({
      data: tax,
    });
  }

  const shippingMethods = [
    {
      name: "Portugal Standard",
      countryCode: "PT",
      originCountryCode: null,
      currency: "EUR",
      minWeightKg: null,
      maxWeightKg: null,
      minDeliveryDays: 2,
      maxDeliveryDays: 4,
      baseFee: 5.99,
      freeShippingThreshold: 120,
      deliveryEstimate: null,
      isActive: true,
    },
    {
      name: "Spain Standard",
      countryCode: "ES",
      originCountryCode: null,
      currency: "EUR",
      minWeightKg: null,
      maxWeightKg: null,
      minDeliveryDays: 3,
      maxDeliveryDays: 5,
      baseFee: 8.99,
      freeShippingThreshold: 150,
      deliveryEstimate: null,
      isActive: true,
    },
    {
      name: "Portugal to Iran 0-1kg",
      countryCode: "IR",
      originCountryCode: "PT",
      currency: "EUR",
      minWeightKg: 0,
      maxWeightKg: 1,
      minDeliveryDays: 6,
      maxDeliveryDays: 10,
      baseFee: 25,
      freeShippingThreshold: null,
      deliveryEstimate: "International delivery to Iran",
      isActive: true,
    },
    {
      name: "Spain to Iran 0-1kg",
      countryCode: "IR",
      originCountryCode: "ES",
      currency: "EUR",
      minWeightKg: 0,
      maxWeightKg: 1,
      minDeliveryDays: 6,
      maxDeliveryDays: 10,
      baseFee: 27,
      freeShippingThreshold: null,
      deliveryEstimate: "International delivery to Iran",
      isActive: true,
    },
  ];

  for (const shippingMethod of shippingMethods) {
    const existingShippingMethod = await prisma.shippingMethod.findFirst({
      where: {
        name: shippingMethod.name,
        countryCode: shippingMethod.countryCode,
        originCountryCode: shippingMethod.originCountryCode,
      },
    });

    if (existingShippingMethod) {
      await prisma.shippingMethod.update({
        where: { id: existingShippingMethod.id },
        data: shippingMethod,
      });
      continue;
    }

    await prisma.shippingMethod.create({
      data: shippingMethod,
    });
  }

  const businessSettings = await prisma.businessSettings.findFirst({
    orderBy: { createdAt: "asc" },
  });

  const businessSettingsPayload = {
    businessName: DEFAULT_BUSINESS_NAME,
    supportEmail: DEFAULT_SUPPORT_EMAIL,
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
  };

  if (businessSettings) {
    await prisma.businessSettings.update({
      where: { id: businessSettings.id },
      data: businessSettingsPayload,
    });
  } else {
    await prisma.businessSettings.create({
      data: businessSettingsPayload,
    });
  }

  const globalPricingRule = await prisma.pricingRule.findFirst({
    where: {
      name: "Default Global Pricing",
    },
  });

  const globalPricingRulePayload = {
    name: "Default Global Pricing",
    targetType: PricingTargetType.GLOBAL,
    currency: "EUR",
    marginPercent: 18,
    localShippingFee: 5.99,
    minimumProfitAmount: 12,
    fixedFee: 4.99,
    shippingFee: 5.99,
    handlingFee: 1.99,
    paymentFee: 1.49,
    taxPercent: 23,
    freeShippingThreshold: 120,
    minimumOrderValue: 15,
    isDefault: true,
    isActive: true,
    priority: 0,
  };

  if (globalPricingRule) {
    await prisma.pricingRule.update({
      where: { id: globalPricingRule.id },
      data: globalPricingRulePayload,
    });
  } else {
    await prisma.pricingRule.create({
      data: globalPricingRulePayload,
    });
  }
}

async function ensureRoles() {
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

async function ensureDefaultAdmin() {
  const superAdminRole = await prisma.role.findUnique({
    where: { code: RoleCode.SUPER_ADMIN },
  });

  if (!superAdminRole) {
    throw new Error("Super admin role is missing after bootstrap role creation.");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {
      fullName: DEFAULT_ADMIN_NAME,
      passwordHash,
      roleId: superAdminRole.id,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: DEFAULT_ADMIN_EMAIL,
      fullName: DEFAULT_ADMIN_NAME,
      passwordHash,
      roleId: superAdminRole.id,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.info(`Default admin ready: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
}

async function main() {
  await ensureRoles();
  await ensureDefaultAdmin();
  await ensureCommerceConfiguration();
}

await main()
  .catch((error) => {
    console.error("Access bootstrap failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
