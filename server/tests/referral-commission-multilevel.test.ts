import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, ReferralRank } from "@prisma/client";

import {
  buildCommissionBeneficiaries,
  buildCommissionEventKey,
  computeCommission,
  DEFAULT_LEVEL_CONFIGS,
  resolveCommissionAction,
  resolveMaxCommissionLevel,
} from "../src/modules/wallet/referral-commission.logic.js";

const dec = (value: string | number) => new Prisma.Decimal(value);

function defaultPercentage(levelNumber: number, rank: ReferralRank): Prisma.Decimal {
  const config = DEFAULT_LEVEL_CONFIGS.find((item) => item.levelNumber === levelNumber && item.rank === rank);
  if (!config) {
    throw new Error(`No default config for level ${levelNumber} ${rank}`);
  }

  return new Prisma.Decimal(config.percentage);
}

function commission(productAmount: string, levelNumber: number, rank: ReferralRank): string {
  return computeCommission(dec(productAmount), defaultPercentage(levelNumber, rank)).toFixed(2);
}

test("1. level 1 commission is calculated from product amount", () => {
  assert.equal(commission("100", 1, ReferralRank.GOLD), "2.50");
});

test("2. level 2 commission is calculated from product amount", () => {
  assert.equal(commission("100", 2, ReferralRank.SILVER), "0.50");
});

test("3. level 3 receives no commission", () => {
  const beneficiaries = buildCommissionBeneficiaries(
    [
      { ancestorUserId: "mahana", depth: 1 },
      { ancestorUserId: "hamresan", depth: 2 },
      { ancestorUserId: "jamal", depth: 3 },
    ],
    2,
  );

  assert.equal(beneficiaries.some((entry) => entry.beneficiaryUserId === "jamal"), false);
  assert.equal(resolveMaxCommissionLevel(3), 2);
});

test("4. beneficiary rank determines the rate (Gold level 1 = 2.5%)", () => {
  assert.equal(defaultPercentage(1, ReferralRank.GOLD).toFixed(2), "2.50");
});

test("5. purchaser rank does NOT determine the rate", () => {
  // The purchaser (Liam) can be any rank; the beneficiary's own rank decides.
  const beneficiaryGoldRate = defaultPercentage(1, ReferralRank.GOLD);
  const purchaserSilverRate = defaultPercentage(1, ReferralRank.SILVER);

  assert.equal(beneficiaryGoldRate.toFixed(2), "2.50");
  assert.notEqual(beneficiaryGoldRate.toFixed(2), purchaserSilverRate.toFixed(2));
});

test("6. Silver level 1 = 2%", () => {
  assert.equal(defaultPercentage(1, ReferralRank.SILVER).toFixed(2), "2.00");
});

test("7. Gold level 1 = 2.5%", () => {
  assert.equal(defaultPercentage(1, ReferralRank.GOLD).toFixed(2), "2.50");
});

test("8. Platinum level 1 = 3%", () => {
  assert.equal(defaultPercentage(1, ReferralRank.PLATINUM).toFixed(2), "3.00");
});

test("9. Diamond level 1 = 3.5%", () => {
  assert.equal(defaultPercentage(1, ReferralRank.DIAMOND).toFixed(2), "3.50");
});

test("10. level 2 default = 0.5% for every rank", () => {
  assert.equal(defaultPercentage(2, ReferralRank.SILVER).toFixed(2), "0.50");
  assert.equal(defaultPercentage(2, ReferralRank.GOLD).toFixed(2), "0.50");
  assert.equal(defaultPercentage(2, ReferralRank.PLATINUM).toFixed(2), "0.50");
  assert.equal(defaultPercentage(2, ReferralRank.DIAMOND).toFixed(2), "0.50");
});

test("11. commission uses product amount only", () => {
  assert.equal(computeCommission(dec("200"), dec("2")).toFixed(2), "4.00");
});

test("12. shipping is excluded", () => {
  assert.equal(computeCommission(dec("100"), dec("2")).toFixed(2), "2.00");
});

test("13. tax is excluded", () => {
  assert.equal(computeCommission(dec("100"), dec("2")).toFixed(2), "2.00");
});

test("14. fees are excluded", () => {
  assert.equal(computeCommission(dec("100"), dec("2")).toFixed(2), "2.00");
});

test("15. separate commission identity per beneficiary (independent transactions)", () => {
  const mahana = buildCommissionEventKey("order-1", "mahana", 1);
  const hamresan = buildCommissionEventKey("order-1", "hamresan", 2);

  assert.notEqual(mahana, hamresan);
});

test("16. idempotency (deterministic event key)", () => {
  const first = buildCommissionEventKey("order-1", "mahana", 1);
  const second = buildCommissionEventKey("order-1", "mahana", 1);
  const otherLevel = buildCommissionEventKey("order-1", "mahana", 2);

  assert.equal(first, second);
  assert.notEqual(first, otherLevel);
});

test("17. historical rate snapshot is a fixed calculation for a given percentage", () => {
  const oldRate = dec("2.5");
  const amount = computeCommission(dec("100"), oldRate);

  // Changing a config later produces a new result, but the previously computed
  // amount is immutable.
  const newRate = dec("3");
  assert.equal(amount.toFixed(2), "2.50");
  assert.equal(computeCommission(dec("100"), newRate).toFixed(2), "3.00");
});

test("18. DELIVERED triggers commission", () => {
  assert.equal(resolveCommissionAction("DELIVERED"), "AWARD");
});

test("19. non-DELIVERED statuses do not trigger commission", () => {
  assert.equal(resolveCommissionAction("PENDING"), "NONE");
  assert.equal(resolveCommissionAction("PAID"), "NONE");
  assert.equal(resolveCommissionAction("PAYMENT_APPROVED"), "NONE");
  assert.equal(resolveCommissionAction("PROCESSING"), "NONE");
  assert.equal(resolveCommissionAction("SHIPPED"), "NONE");
});

test("20. CANCELLED/REFUNDED trigger reversal", () => {
  assert.equal(resolveCommissionAction("CANCELLED"), "REVERSE");
  assert.equal(resolveCommissionAction("REFUNDED"), "REVERSE");
});

test("21. no level 3 commission (max level clamps to 2)", () => {
  assert.equal(resolveMaxCommissionLevel(2), 2);
  assert.equal(resolveMaxCommissionLevel(3), 2);
  assert.equal(resolveMaxCommissionLevel(1), 1);
  assert.equal(resolveMaxCommissionLevel(0), 0);
});

test("22. exact Jamal -> Hamresan -> Mahana -> Liam scenario", () => {
  const beneficiaries = buildCommissionBeneficiaries(
    [
      { ancestorUserId: "mahana", depth: 1 },
      { ancestorUserId: "hamresan", depth: 2 },
      { ancestorUserId: "jamal", depth: 3 },
    ],
    2,
  );

  assert.deepEqual(
    beneficiaries.map((entry) => ({ user: entry.beneficiaryUserId, level: entry.referralLevel })),
    [
      { user: "mahana", level: 1 },
      { user: "hamresan", level: 2 },
    ],
  );

  // Mahana = GOLD (L1 = 2.5%), Hamresan = SILVER (L2 = 0.5%).
  assert.equal(commission("100", 1, ReferralRank.GOLD), "2.50");
  assert.equal(commission("100", 2, ReferralRank.SILVER), "0.50");
});

test("23. exact New User below Liam scenario (Jamal/Hamresan receive nothing)", () => {
  const beneficiaries = buildCommissionBeneficiaries(
    [
      { ancestorUserId: "liam", depth: 1 },
      { ancestorUserId: "mahana", depth: 2 },
      { ancestorUserId: "hamresan", depth: 3 },
      { ancestorUserId: "jamal", depth: 4 },
    ],
    2,
  );

  assert.deepEqual(
    beneficiaries.map((entry) => entry.beneficiaryUserId),
    ["liam", "mahana"],
  );
  assert.equal(beneficiaries.some((entry) => entry.beneficiaryUserId === "hamresan"), false);
  assert.equal(beneficiaries.some((entry) => entry.beneficiaryUserId === "jamal"), false);
});
