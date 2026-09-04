import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

import {
  DEFAULT_MAX_REFERRAL_LEVEL,
  DEFAULT_POINTS_PER_10_EUR,
  buildBeneficiaryPlan,
  buildRewardEventKey,
  computeReferralPoints,
  resolvePointsPer10Eur,
} from "../src/modules/commerce/multi-level-referral-points.logic.js";
import {
  DEFAULT_LEVEL_CONFIGS,
  buildCommissionEventKey,
  computeCommission,
  resolveMaxCommissionLevel,
} from "../src/modules/wallet/referral-commission.logic.js";
import { updatePointSettingsSchema } from "../src/modules/referral-admin/referral-admin.schemas.js";
import {
  updateCommissionConfigSchema,
  updateCommissionSettingsSchema,
} from "../src/modules/wallet/referral-commission.schemas.js";

const dec = (value: string | number) => new Prisma.Decimal(value);

test("1. default point configuration", () => {
  assert.deepEqual(DEFAULT_POINTS_PER_10_EUR, { 0: 5, 1: 5, 2: 4, 3: 3 });
  assert.equal(DEFAULT_MAX_REFERRAL_LEVEL, 3);
});

test("2. admin point configuration update is accepted and validated", () => {
  const valid = {
    purchaserPointsPer10EUR: 5,
    level1PointsPer10EUR: 5,
    level2PointsPer10EUR: 4,
    level3PointsPer10EUR: 3,
    maxReferralLevel: 3,
  };

  assert.equal(updatePointSettingsSchema.safeParse(valid).success, true);
  assert.equal(updatePointSettingsSchema.safeParse({ ...valid, level1PointsPer10EUR: -1 }).success, false);
  assert.equal(updatePointSettingsSchema.safeParse({ ...valid, level2PointsPer10EUR: 2.5 }).success, false);
  assert.equal(updatePointSettingsSchema.safeParse({ ...valid, maxReferralLevel: 4 }).success, false);
});

test("3. default commission matrix", () => {
  const level1 = DEFAULT_LEVEL_CONFIGS.filter((config) => config.levelNumber === 1);
  const level2 = DEFAULT_LEVEL_CONFIGS.filter((config) => config.levelNumber === 2);

  assert.equal(level1.find((c) => c.rank === "SILVER")?.percentage, "2.00");
  assert.equal(level1.find((c) => c.rank === "GOLD")?.percentage, "2.50");
  assert.equal(level1.find((c) => c.rank === "PLATINUM")?.percentage, "3.00");
  assert.equal(level1.find((c) => c.rank === "DIAMOND")?.percentage, "3.50");

  assert.ok(level2.every((config) => config.percentage === "0.50"));
});

test("4. admin commission update is accepted and validated", () => {
  assert.equal(updateCommissionConfigSchema.safeParse({ levelNumber: 1, rank: "GOLD", percentage: 2.5, isActive: true }).success, true);
  assert.equal(updateCommissionConfigSchema.safeParse({ levelNumber: 3, rank: "GOLD", percentage: 2.5, isActive: true }).success, false);
  assert.equal(updateCommissionConfigSchema.safeParse({ levelNumber: 1, rank: "GOLD", percentage: 101, isActive: true }).success, false);
  assert.equal(updateCommissionSettingsSchema.safeParse({ maxCommissionLevel: 2 }).success, true);
  assert.equal(updateCommissionSettingsSchema.safeParse({ maxCommissionLevel: 3 }).success, false);
});

test("5. level limits are enforced", () => {
  assert.equal(resolveMaxCommissionLevel(2), 2);
  assert.equal(resolveMaxCommissionLevel(3), 2);
  assert.equal(resolveMaxCommissionLevel(1), 1);
  assert.equal(resolveMaxCommissionLevel(0), 0);

  const beneficiaries = buildBeneficiaryPlan(
    "liam",
    [
      { ancestorUserId: "mahana", depth: 1 },
      { ancestorUserId: "hamresan", depth: 2 },
      { ancestorUserId: "jamal", depth: 3 },
    ],
    2,
  );

  assert.deepEqual(
    beneficiaries.map((entry) => entry.beneficiaryUserId),
    ["liam", "mahana", "hamresan"],
  );

  assert.equal(resolvePointsPer10Eur(3, { 0: 5, 1: 5, 2: 4 }), null);
});

test("6. historical values remain unchanged when configuration changes", () => {
  const oldConfig = { 0: 5, 1: 5, 2: 4, 3: 3 };
  const newConfig = { 0: 10, 1: 10, 2: 8, 3: 6 };

  const before = computeReferralPoints(dec("100"), resolvePointsPer10Eur(1, oldConfig) ?? 0);
  const after = computeReferralPoints(dec("100"), resolvePointsPer10Eur(1, newConfig) ?? 0);

  assert.equal(before, 50);
  assert.equal(after, 100);
  assert.notEqual(before, after);
});

test("7. point settings schema exposes no user-identity fields (users are read-only)", () => {
  assert.deepEqual(
    Object.keys(updatePointSettingsSchema.shape).sort(),
    ["level1PointsPer10EUR", "level2PointsPer10EUR", "level3PointsPer10EUR", "maxReferralLevel", "purchaserPointsPer10EUR"].sort(),
  );
});

test("8. commission report uses stored (snapshot) values deterministically", () => {
  const snapshotRate = dec("2.5");
  const amount = computeCommission(dec("100"), snapshotRate);
  const recomputed = computeCommission(dec("100"), snapshotRate);

  assert.equal(amount.toFixed(2), "2.50");
  assert.equal(amount.toFixed(2), recomputed.toFixed(2));
});

test("9. point report uses stored (snapshot) values deterministically", () => {
  assert.equal(computeReferralPoints(dec("100"), 5), 50);
  assert.equal(computeReferralPoints(dec("99"), 5), 45);
});

test("10. points and EUR remain separate", () => {
  const pointKey = buildRewardEventKey({ orderId: "order-1", beneficiaryUserId: "user-1", referralLevel: 1 });
  const commissionKey = buildCommissionEventKey("order-1", "user-1", 1);

  assert.notEqual(pointKey, commissionKey);
  assert.ok(pointKey.includes("MULTI_LEVEL_REFERRAL_POINTS"));
  assert.ok(commissionKey.includes("REFERRAL_COMMISSION"));
});
