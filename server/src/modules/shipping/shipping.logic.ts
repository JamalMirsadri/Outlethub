import { Prisma } from "@prisma/client";

export const SHIPPING_CONFIG_ID = "default";
export const MAX_SHIPPING_TIERS = 5;

export const DEFAULT_SHIPPING_CONFIG = {
  firstProductFee: "10",
  secondProductFee: "8",
  thirdProductFee: "6",
  fourthProductFee: "4",
  fifthProductFee: "4",
  additionalProductFee: "4",
  threshold: 5,
} as const;

export type QuantityShippingConfig = {
  firstProductFee: Prisma.Decimal | string | number;
  secondProductFee: Prisma.Decimal | string | number;
  thirdProductFee: Prisma.Decimal | string | number;
  fourthProductFee: Prisma.Decimal | string | number;
  fifthProductFee: Prisma.Decimal | string | number;
  additionalProductFee: Prisma.Decimal | string | number;
  threshold: number;
};

function decimal(value: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }

  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/**
 * Incremental quantity-based shipping:
 *   1 = firstProductFee
 *   2 = firstProductFee + secondProductFee
 *   3 = firstProductFee + secondProductFee + thirdProductFee
 *   ...
 *   beyond the configured threshold, each additional product adds
 *   additionalProductFee.
 *
 * The tier loop is bounded by MAX_SHIPPING_TIERS (not by quantity), so very
 * large quantities are handled arithmetically without iterating per product.
 */
export function calculateQuantityShipping(quantity: number, config: QuantityShippingConfig): Prisma.Decimal {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return new Prisma.Decimal(0);
  }

  const threshold = Math.min(Math.max(0, Math.floor(config.threshold)), MAX_SHIPPING_TIERS);
  const tiers = [
    decimal(config.firstProductFee),
    decimal(config.secondProductFee),
    decimal(config.thirdProductFee),
    decimal(config.fourthProductFee),
    decimal(config.fifthProductFee),
  ];

  let total = new Prisma.Decimal(0);
  const tieredCount = Math.min(quantity, threshold);
  for (let index = 0; index < tieredCount; index += 1) {
    total = total.plus(tiers[index] ?? new Prisma.Decimal(0));
  }

  const additionalCount = Math.max(0, quantity - threshold);
  if (additionalCount > 0) {
    total = total.plus(decimal(config.additionalProductFee).mul(additionalCount));
  }

  return total.toDecimalPlaces(2);
}
