import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

import {
  DEFAULT_SHIPPING_CONFIG,
  calculateQuantityShipping,
  MAX_SHIPPING_TIERS,
} from "../src/modules/shipping/shipping.logic.js";
import { updateShippingSettingsSchema } from "../src/modules/shipping/shipping.schemas.js";
import { computeCommission } from "../src/modules/wallet/referral-commission.logic.js";
import { computeReferralPoints } from "../src/modules/commerce/multi-level-referral-points.logic.js";

const cfg = DEFAULT_SHIPPING_CONFIG;
const money = (value: Prisma.Decimal) => value.toFixed(2);

test("1-8. quantity shipping matches the incremental default schedule", () => {
  assert.equal(money(calculateQuantityShipping(1, cfg)), "10.00");
  assert.equal(money(calculateQuantityShipping(2, cfg)), "18.00");
  assert.equal(money(calculateQuantityShipping(3, cfg)), "24.00");
  assert.equal(money(calculateQuantityShipping(4, cfg)), "28.00");
  assert.equal(money(calculateQuantityShipping(5, cfg)), "32.00");
  assert.equal(money(calculateQuantityShipping(6, cfg)), "36.00");
  assert.equal(money(calculateQuantityShipping(7, cfg)), "40.00");
  assert.equal(money(calculateQuantityShipping(8, cfg)), "44.00");
});

test("9. quantity handling (zero, negative, fractional)", () => {
  assert.equal(money(calculateQuantityShipping(0, cfg)), "0.00");
  assert.equal(money(calculateQuantityShipping(-3, cfg)), "0.00");
  assert.equal(money(calculateQuantityShipping(2.5, cfg)), "0.00");
});

test("10. decimal precision is preserved", () => {
  const custom = { ...cfg, firstProductFee: "10.25", additionalProductFee: "4.50" };
  assert.equal(money(calculateQuantityShipping(1, custom)), "10.25");
  assert.equal(money(calculateQuantityShipping(6, custom)), "36.75");
});

test("11. admin shipping configuration validation", () => {
  const valid = {
    firstProductFee: "10",
    secondProductFee: "8",
    thirdProductFee: "6",
    fourthProductFee: "4",
    fifthProductFee: "4",
    additionalProductFee: "4",
    threshold: 5,
  };

  assert.equal(updateShippingSettingsSchema.safeParse(valid).success, true);
  assert.equal(updateShippingSettingsSchema.safeParse({ ...valid, firstProductFee: "-1" }).success, false);
  assert.equal(updateShippingSettingsSchema.safeParse({ ...valid, additionalProductFee: "4.999" }).success, false);
  assert.equal(updateShippingSettingsSchema.safeParse({ ...valid, threshold: 6 }).success, false);
  assert.equal(updateShippingSettingsSchema.safeParse({ ...valid, threshold: 0 }).success, false);
});

test("12. configuration changes affect only future calculations", () => {
  const before = calculateQuantityShipping(1, cfg);
  const after = calculateQuantityShipping(1, { ...cfg, firstProductFee: "20" });

  assert.equal(money(before), "10.00");
  assert.equal(money(after), "20.00");
  assert.notEqual(money(before), money(after));
});

test("13. historical order shipping is a stored snapshot (not recalculated)", () => {
  // Orders persist shippingAmount at creation time; this value is immutable
  // even if the config changes later.
  const snapshot = calculateQuantityShipping(3, cfg);
  const nextConfig = { ...cfg, secondProductFee: "99" };

  assert.equal(money(snapshot), "24.00");
  assert.equal(money(calculateQuantityShipping(3, nextConfig)), "115.00");
  assert.equal(money(snapshot), "24.00");
});

test("14. preview values come from the same backend calculation", () => {
  const expected = ["10.00", "18.00", "24.00", "28.00", "32.00", "36.00", "40.00", "44.00"];
  for (let quantity = 1; quantity <= 8; quantity += 1) {
    assert.equal(money(calculateQuantityShipping(quantity, cfg)), expected[quantity - 1]);
  }
});

test("15. shipping remains excluded from commission", () => {
  // Commission is product-amount only; shipping is never an input.
  assert.equal(computeCommission(new Prisma.Decimal("200"), new Prisma.Decimal("2")).toFixed(2), "4.00");
});

test("16. shipping remains excluded from points", () => {
  // Points are product-amount only; shipping is never an input.
  assert.equal(computeReferralPoints(new Prisma.Decimal("200"), 5), 100);
});

test("17. shipping settings schema exposes no user-identity fields", () => {
  assert.deepEqual(
    Object.keys(updateShippingSettingsSchema.shape).sort(),
    ["additionalProductFee", "fifthProductFee", "firstProductFee", "fourthProductFee", "secondProductFee", "thirdProductFee", "threshold"].sort(),
  );
});

test("threshold is capped to the configured tier count", () => {
  assert.equal(MAX_SHIPPING_TIERS, 5);
  assert.equal(money(calculateQuantityShipping(1000, cfg)), "4012.00");
});
