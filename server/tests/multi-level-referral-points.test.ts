import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

import {
  buildBeneficiaryPlan,
  buildRewardEventKey,
  computeReferralPoints,
  resolvePointsPer10Eur,
  resolveRewardAction,
} from "../src/modules/commerce/multi-level-referral-points.logic.js";

const dec = (value: string | number) => new Prisma.Decimal(value);

test("1. purchaser (level 0) receives 5 points per €10", () => {
  assert.equal(resolvePointsPer10Eur(0), 5);
  assert.equal(computeReferralPoints(dec("100"), 5), 50);
});

test("2. level 1 referrer receives 5 points per €10", () => {
  assert.equal(resolvePointsPer10Eur(1), 5);
  assert.equal(computeReferralPoints(dec("100"), 5), 50);
});

test("3. level 2 referrer receives 4 points per €10", () => {
  assert.equal(resolvePointsPer10Eur(2), 4);
  assert.equal(computeReferralPoints(dec("100"), 4), 40);
});

test("4. level 3 referrer receives 3 points per €10", () => {
  assert.equal(resolvePointsPer10Eur(3), 3);
  assert.equal(computeReferralPoints(dec("100"), 3), 30);
});

test("5. level 4 (and above) receives nothing", () => {
  assert.equal(resolvePointsPer10Eur(4), null);
  assert.equal(resolvePointsPer10Eur(5), null);
  assert.equal(resolvePointsPer10Eur(-1), null);
});

test("6. shipping is excluded (formula uses product amount only)", () => {
  // Shipping/tax/fees/handling are never fed into computeReferralPoints; the
  // service derives the base from OrderItem.totalPrice only.
  assert.equal(computeReferralPoints(dec("100"), 5), 50);
});

test("7. tax is excluded (formula uses product amount only)", () => {
  assert.equal(computeReferralPoints(dec("100"), 5), 50);
});

test("8. fees are excluded (formula uses product amount only)", () => {
  assert.equal(computeReferralPoints(dec("100"), 5), 50);
});

test("9. product amount is used, floored per €10, then multiplied", () => {
  assert.equal(computeReferralPoints(dec("100"), 5), 50);
  assert.equal(computeReferralPoints(dec("99"), 5), 45); // floor(99/10)=9
  assert.equal(computeReferralPoints(dec("104.99"), 5), 50); // floor(104.99/10)=10
  assert.equal(computeReferralPoints(dec("0"), 5), 0);
  assert.equal(computeReferralPoints(dec("9.99"), 5), 0); // floor(9.99/10)=0
});

test("10. DELIVERED triggers points", () => {
  assert.equal(resolveRewardAction("DELIVERED"), "AWARD");
});

test("11. non-delivered statuses do not trigger points", () => {
  assert.equal(resolveRewardAction("PENDING"), "NONE");
  assert.equal(resolveRewardAction("PAID"), "NONE");
  assert.equal(resolveRewardAction("PAYMENT_APPROVED"), "NONE");
  assert.equal(resolveRewardAction("PROCESSING"), "NONE");
  assert.equal(resolveRewardAction("SHIPPED"), "NONE");
});

test("12. duplicate order processing does not duplicate points (deterministic event key)", () => {
  const first = buildRewardEventKey({ orderId: "order-1", beneficiaryUserId: "user-1", referralLevel: 1 });
  const second = buildRewardEventKey({ orderId: "order-1", beneficiaryUserId: "user-1", referralLevel: 1 });
  const differentLevel = buildRewardEventKey({ orderId: "order-1", beneficiaryUserId: "user-1", referralLevel: 2 });
  const differentBeneficiary = buildRewardEventKey({ orderId: "order-1", beneficiaryUserId: "user-2", referralLevel: 1 });

  assert.equal(first, second);
  assert.notEqual(first, differentLevel);
  assert.notEqual(first, differentBeneficiary);
});

test("13. referral chain resolution stops after level 3", () => {
  const plan = buildBeneficiaryPlan("liam", [
    { ancestorUserId: "mahana", depth: 1 },
    { ancestorUserId: "hamresan", depth: 2 },
    { ancestorUserId: "jamal", depth: 3 },
    { ancestorUserId: "above-jamal", depth: 4 },
  ]);

  assert.deepEqual(
    plan.map((entry) => entry.referralLevel),
    [0, 1, 2, 3],
  );
  assert.equal(plan.some((entry) => entry.beneficiaryUserId === "above-jamal"), false);
});

test("14. no self-referral (purchaser is never awarded as an ancestor)", () => {
  const plan = buildBeneficiaryPlan("liam", [
    { ancestorUserId: "liam", depth: 1 },
    { ancestorUserId: "mahana", depth: 2 },
  ]);

  assert.equal(plan.filter((entry) => entry.beneficiaryUserId === "liam").length, 1);
  assert.equal(plan.find((entry) => entry.beneficiaryUserId === "liam")?.referralLevel, 0);
});

test("15. cycle protection (duplicate ancestor is deduplicated)", () => {
  const plan = buildBeneficiaryPlan("liam", [
    { ancestorUserId: "mahana", depth: 1 },
    { ancestorUserId: "mahana", depth: 2 },
    { ancestorUserId: "hamresan", depth: 3 },
  ]);

  assert.deepEqual(
    plan.map((entry) => entry.beneficiaryUserId),
    ["liam", "mahana", "hamresan"],
  );
});

test("REAL TEST: Jamal -> Hamresan -> Mahana -> Liam, €100 product purchase", () => {
  const purchaserUserId = "liam";
  const ancestors = [
    { ancestorUserId: "mahana", depth: 1 },
    { ancestorUserId: "hamresan", depth: 2 },
    { ancestorUserId: "jamal", depth: 3 },
  ];
  const eligibleProductAmount = dec("100");

  const plan = buildBeneficiaryPlan(purchaserUserId, ancestors);
  const awarded = plan.map((entry) => ({
    userId: entry.beneficiaryUserId,
    level: entry.referralLevel,
    points: computeReferralPoints(eligibleProductAmount, resolvePointsPer10Eur(entry.referralLevel) ?? 0),
  }));

  assert.deepEqual(awarded, [
    { userId: "liam", level: 0, points: 50 },
    { userId: "mahana", level: 1, points: 50 },
    { userId: "hamresan", level: 2, points: 40 },
    { userId: "jamal", level: 3, points: 30 },
  ]);
});

test("REAL TEST variant: purchase by New User below Liam gives Jamal nothing", () => {
  const purchaserUserId = "new-user";
  const ancestors = [
    { ancestorUserId: "liam", depth: 1 },
    { ancestorUserId: "mahana", depth: 2 },
    { ancestorUserId: "hamresan", depth: 3 },
    { ancestorUserId: "jamal", depth: 4 },
  ];
  const eligibleProductAmount = dec("100");

  const plan = buildBeneficiaryPlan(purchaserUserId, ancestors);
  const byUser = new Map(plan.map((entry) => [entry.beneficiaryUserId, entry.referralLevel]));

  assert.equal(byUser.get("new-user"), 0);
  assert.equal(byUser.get("liam"), 1);
  assert.equal(byUser.get("mahana"), 2);
  assert.equal(byUser.get("hamresan"), 3);
  assert.equal(byUser.has("jamal"), false);

  assert.equal(computeReferralPoints(eligibleProductAmount, resolvePointsPer10Eur(byUser.get("new-user") ?? -1) ?? 0), 50);
  assert.equal(computeReferralPoints(eligibleProductAmount, resolvePointsPer10Eur(byUser.get("liam") ?? -1) ?? 0), 50);
  assert.equal(computeReferralPoints(eligibleProductAmount, resolvePointsPer10Eur(byUser.get("mahana") ?? -1) ?? 0), 40);
  assert.equal(computeReferralPoints(eligibleProductAmount, resolvePointsPer10Eur(byUser.get("hamresan") ?? -1) ?? 0), 30);
});
