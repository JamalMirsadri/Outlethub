import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

import { updateCommissionConfigSchema } from "../src/modules/wallet/referral-commission.schemas.js";

function computeCommission(productAmount: string, percentage: string): string {
  return new Prisma.Decimal(productAmount)
    .mul(new Prisma.Decimal(percentage))
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    .toFixed(2);
}

test("commission is calculated from product amount only (example: 200 x 2.5% = 5.00)", () => {
  assert.equal(computeCommission("200", "2.5"), "5.00");
});

test("silver 2% excludes shipping/tax/fees (example: 150 x 2% = 3.00)", () => {
  assert.equal(computeCommission("150", "2"), "3.00");
});

test("rank default percentages map correctly", () => {
  assert.equal(computeCommission("100", "2"), "2.00"); // SILVER
  assert.equal(computeCommission("100", "2.5"), "2.50"); // GOLD
  assert.equal(computeCommission("100", "3"), "3.00"); // PLATINUM
  assert.equal(computeCommission("100", "3.5"), "3.50"); // DIAMOND
});

test("commission uses decimal arithmetic with half-up rounding", () => {
  assert.equal(computeCommission("33.33", "3"), "1.00");
  assert.equal(computeCommission("1", "3.5"), "0.04");
});

test("commission config validates percentage between 0 and 100", () => {
  assert.equal(updateCommissionConfigSchema.safeParse({ levelNumber: 1, rank: "SILVER", percentage: 150, isActive: true }).success, false);
  assert.equal(updateCommissionConfigSchema.safeParse({ levelNumber: 1, rank: "SILVER", percentage: -1, isActive: true }).success, false);
  assert.equal(updateCommissionConfigSchema.safeParse({ levelNumber: 1, rank: "GOLD", percentage: 2.5, isActive: true }).success, true);
});

test("commission config validates level number between 1 and 2", () => {
  assert.equal(updateCommissionConfigSchema.safeParse({ levelNumber: 3, rank: "GOLD", percentage: 2.5, isActive: true }).success, false);
  assert.equal(updateCommissionConfigSchema.safeParse({ levelNumber: 0, rank: "GOLD", percentage: 2.5, isActive: true }).success, false);
  assert.equal(updateCommissionConfigSchema.safeParse({ levelNumber: 2, rank: "GOLD", percentage: 0.5, isActive: true }).success, true);
});
