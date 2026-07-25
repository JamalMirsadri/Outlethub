import { PrismaClient } from "@prisma/client";
import { pricingService } from "./src/modules/commerce/pricing.service.js";

const prisma = new PrismaClient();

async function testPricing() {
  try {
    const pricing = await pricingService.calculateProductPricing({
      brandId: "cmqta85ui001uuotc5ngu70qj", // dummy
      categoryId: "cmqta85ui001uuotc5ngu70qj", // dummy
      supplierPrice: 197.97,
      currency: "USD",
      useCustomPricing: false,
      customPrice: null,
    });
    console.log("Pricing:", pricing);
  } catch (e) {
    console.error(e);
  }
}

testPricing().finally(() => prisma.$disconnect());