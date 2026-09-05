import { Prisma } from "@prisma/client";

function decimal(value: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }

  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export interface CustomerTotalInput {
  subtotalAmount: Prisma.Decimal | string | number;
  shippingAmount: Prisma.Decimal | string | number;
  agentCostAmount: Prisma.Decimal | string | number;
  handlingAmount: Prisma.Decimal | string | number;
  paymentFeeAmount: Prisma.Decimal | string | number;
  taxPercent: Prisma.Decimal | string | number;
}

export interface CustomerTotalResult {
  taxableAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

/**
 * Single source of truth for the customer payable total.
 *
 * Taxable base = subtotal + shipping + handling + payment fee (unchanged).
 * Tax = taxable base × taxPercent.
 * Total = taxable base + tax + agent cost.
 *
 * Agent Cost is added exactly once, after tax, so the existing tax base is
 * preserved and Agent Cost never affects the taxable amount.
 */
export function calculateCustomerTotal(input: CustomerTotalInput): CustomerTotalResult {
  const taxableAmount = decimal(input.subtotalAmount)
    .plus(decimal(input.shippingAmount))
    .plus(decimal(input.handlingAmount))
    .plus(decimal(input.paymentFeeAmount));

  const taxAmount = taxableAmount.mul(decimal(input.taxPercent)).div(100).toDecimalPlaces(2);
  const totalAmount = taxableAmount
    .plus(taxAmount)
    .plus(decimal(input.agentCostAmount))
    .toDecimalPlaces(2);

  return {
    taxableAmount: taxableAmount.toDecimalPlaces(2),
    taxAmount,
    totalAmount,
  };
}
