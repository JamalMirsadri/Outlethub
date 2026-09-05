import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

import {
  DEFAULT_AGENT_COST_CONFIG,
  MAX_AGENT_COST_TIERS,
  calculateAgentCost,
} from "../src/modules/agent-cost/agent-cost.logic.js";
import { updateAgentCostSettingsSchema } from "../src/modules/agent-cost/agent-cost.schemas.js";
import { computeCommission } from "../src/modules/wallet/referral-commission.logic.js";
import { computeReferralPoints } from "../src/modules/commerce/multi-level-referral-points.logic.js";
import { calculateCustomerTotal } from "../src/modules/commerce/pricing.logic.js";
import { DEFAULT_SHIPPING_CONFIG, calculateQuantityShipping } from "../src/modules/shipping/shipping.logic.js";

const cfg = DEFAULT_AGENT_COST_CONFIG;
const money = (value: Prisma.Decimal) => value.toFixed(2);

test("1-9. tiered agent cost matches the default schedule", () => {
  assert.equal(money(calculateAgentCost(0, cfg)), "0.00");
  assert.equal(money(calculateAgentCost(1, cfg)), "7.99");
  assert.equal(money(calculateAgentCost(2, cfg)), "14.98");
  assert.equal(money(calculateAgentCost(3, cfg)), "19.97");
  assert.equal(money(calculateAgentCost(4, cfg)), "23.96");
  assert.equal(money(calculateAgentCost(5, cfg)), "27.95");
  assert.equal(money(calculateAgentCost(6, cfg)), "31.94");
  assert.equal(money(calculateAgentCost(7, cfg)), "35.93");
  assert.equal(money(calculateAgentCost(8, cfg)), "39.92");
});

test("10. quantity handling (zero, negative, fractional)", () => {
  assert.equal(money(calculateAgentCost(0, cfg)), "0.00");
  assert.equal(money(calculateAgentCost(-2, cfg)), "0.00");
  assert.equal(money(calculateAgentCost(2.5, cfg)), "0.00");
});

test("11. decimal precision is preserved", () => {
  const custom = { ...cfg, firstProductFee: "8.25", additionalProductFee: "4.50" };
  assert.equal(money(calculateAgentCost(1, custom)), "8.25");
  assert.equal(money(calculateAgentCost(7, custom)), "36.70");
});

test("12. configurable values are applied", () => {
  const custom = {
    firstProductFee: "8",
    secondProductFee: "7",
    thirdProductFee: "5",
    fourthProductFee: "4",
    fifthProductFee: "4",
    sixthProductFee: "4",
    additionalProductFee: "4",
    threshold: 6,
  };
  assert.equal(money(calculateAgentCost(1, custom)), "8.00");
  assert.equal(money(calculateAgentCost(2, custom)), "15.00");
  assert.equal(money(calculateAgentCost(3, custom)), "20.00");
  assert.equal(money(calculateAgentCost(4, custom)), "24.00");
  assert.equal(money(calculateAgentCost(5, custom)), "28.00");
  assert.equal(money(calculateAgentCost(6, custom)), "32.00");
  assert.equal(money(calculateAgentCost(7, custom)), "36.00");
});

test("13. admin agent cost configuration validation", () => {
  const valid = {
    firstProductFee: "7.99",
    secondProductFee: "6.99",
    thirdProductFee: "4.99",
    fourthProductFee: "3.99",
    fifthProductFee: "3.99",
    sixthProductFee: "3.99",
    additionalProductFee: "3.99",
    threshold: 6,
  };

  assert.equal(updateAgentCostSettingsSchema.safeParse(valid).success, true);
  assert.equal(updateAgentCostSettingsSchema.safeParse({ ...valid, firstProductFee: "-1" }).success, false);
  assert.equal(updateAgentCostSettingsSchema.safeParse({ ...valid, additionalProductFee: "4.999" }).success, false);
  assert.equal(updateAgentCostSettingsSchema.safeParse({ ...valid, threshold: 7 }).success, false);
  assert.equal(updateAgentCostSettingsSchema.safeParse({ ...valid, threshold: 0 }).success, false);
});

test("14. pricing never overrides AgentCostConfig", () => {
  // Agent cost is computed purely from quantity + config; no legacy flat fee input.
  assert.equal(money(calculateAgentCost(4, cfg)), "23.96");
});

test("15-16. cart and checkout use the centralized agent cost", () => {
  const fourProducts = calculateAgentCost(4, cfg);
  assert.equal(money(fourProducts), "23.96");
  assert.equal(money(calculateAgentCost(2, cfg)), "14.98");
});

test("17-18. order stores a snapshot; config changes do not alter it", () => {
  const snapshot = calculateAgentCost(4, cfg);
  const nextConfig = { ...cfg, secondProductFee: "99" };

  assert.equal(money(snapshot), "23.96");
  assert.equal(money(calculateAgentCost(4, nextConfig)), "115.97");
  assert.equal(money(snapshot), "23.96");
});

test("19. agent cost is excluded from commission", () => {
  assert.equal(computeCommission(new Prisma.Decimal("200"), new Prisma.Decimal("2")).toFixed(2), "4.00");
});

test("20. agent cost is excluded from points", () => {
  assert.equal(computeReferralPoints(new Prisma.Decimal("200"), 5), 100);
});

test("21. free-shipping threshold does not affect agent cost", () => {
  // Agent cost is independent of shipping; it never receives a free-shipping input.
  assert.equal(money(calculateAgentCost(4, cfg)), "23.96");
});

test("22. agent cost schema exposes no user-identity fields", () => {
  assert.deepEqual(
    Object.keys(updateAgentCostSettingsSchema.shape).sort(),
    [
      "additionalProductFee",
      "fifthProductFee",
      "firstProductFee",
      "fourthProductFee",
      "secondProductFee",
      "sixthProductFee",
      "thirdProductFee",
      "threshold",
    ].sort(),
  );
});

test("threshold is capped to the configured tier count", () => {
  assert.equal(MAX_AGENT_COST_TIERS, 6);
  assert.equal(money(calculateAgentCost(1000, cfg)), "3998.00");
});

test("payable total includes agent cost as a customer-facing charge", () => {
  const result = calculateCustomerTotal({
    subtotalAmount: "50",
    shippingAmount: "10",
    agentCostAmount: "7.99",
    handlingAmount: "0",
    paymentFeeAmount: "0",
    taxPercent: "0",
  });

  assert.equal(money(result.totalAmount), "67.99");
});

test("agent cost is a separate line item outside the taxable base", () => {
  const result = calculateCustomerTotal({
    subtotalAmount: "50",
    shippingAmount: "10",
    agentCostAmount: "7.99",
    handlingAmount: "0",
    paymentFeeAmount: "0",
    taxPercent: "0",
  });

  assert.equal(money(result.taxableAmount), "60.00");
  assert.equal(money(result.taxAmount), "0.00");
  assert.equal(money(result.totalAmount), "67.99");
});

test("agent cost is included exactly once (no double charge)", () => {
  const one = calculateCustomerTotal({
    subtotalAmount: "50",
    shippingAmount: "10",
    agentCostAmount: "7.99",
    handlingAmount: "0",
    paymentFeeAmount: "0",
    taxPercent: "0",
  });
  assert.equal(money(one.totalAmount), "67.99");
  assert.notEqual(money(one.totalAmount), "75.98");

  const two = calculateCustomerTotal({
    subtotalAmount: "50",
    shippingAmount: "10",
    agentCostAmount: "14.98",
    handlingAmount: "0",
    paymentFeeAmount: "0",
    taxPercent: "0",
  });
  assert.equal(money(two.totalAmount), "74.98");
  assert.notEqual(money(two.totalAmount), "82.97");
});

test("default agent cost schedule flows into the payable total", () => {
  const expected = ["7.99", "14.98", "19.97", "23.96", "27.95", "31.94"];
  for (let quantity = 1; quantity <= 6; quantity += 1) {
    const result = calculateCustomerTotal({
      subtotalAmount: "0",
      shippingAmount: "0",
      agentCostAmount: calculateAgentCost(quantity, cfg),
      handlingAmount: "0",
      paymentFeeAmount: "0",
      taxPercent: "0",
    });
    assert.equal(money(result.totalAmount), expected[quantity - 1]);
  }
});

test("tax base remains unchanged and agent cost is not taxed", () => {
  const result = calculateCustomerTotal({
    subtotalAmount: "50",
    shippingAmount: "10",
    agentCostAmount: "7.99",
    handlingAmount: "0",
    paymentFeeAmount: "0",
    taxPercent: "20",
  });

  // taxable = 50 + 10 = 60; tax = 12.00; total = 60 + 12 + 7.99.
  assert.equal(money(result.taxableAmount), "60.00");
  assert.equal(money(result.taxAmount), "12.00");
  assert.equal(money(result.totalAmount), "79.99");
});

test("existing handling and payment fees remain unchanged and are not double-added", () => {
  const result = calculateCustomerTotal({
    subtotalAmount: "50",
    shippingAmount: "10",
    agentCostAmount: "7.99",
    handlingAmount: "2",
    paymentFeeAmount: "3",
    taxPercent: "0",
  });

  assert.equal(money(result.taxableAmount), "65.00");
  assert.equal(money(result.totalAmount), "72.99");
});

test("shipping remains unchanged and independent of agent cost", () => {
  assert.equal(money(calculateQuantityShipping(4, DEFAULT_SHIPPING_CONFIG)), "28.00");
  assert.equal(money(calculateAgentCost(4, cfg)), "23.96");

  const result = calculateCustomerTotal({
    subtotalAmount: "0",
    shippingAmount: calculateQuantityShipping(4, DEFAULT_SHIPPING_CONFIG),
    agentCostAmount: calculateAgentCost(4, cfg),
    handlingAmount: "0",
    paymentFeeAmount: "0",
    taxPercent: "0",
  });

  assert.equal(money(result.totalAmount), "51.96");
});

test("commission base remains product amount only (excludes agent cost and shipping)", () => {
  const productAmount = new Prisma.Decimal("50");
  const payable = new Prisma.Decimal("67.99");
  const rate = new Prisma.Decimal("2");

  // 2% of €50 = €1.00; commission must never use €67.99.
  assert.equal(computeCommission(productAmount, rate).toFixed(2), "1.00");
  assert.equal(computeCommission(payable, rate).toFixed(2), "1.36");
});

test("points base remains product amount only (excludes agent cost and shipping)", () => {
  const productAmount = new Prisma.Decimal("50");

  // 5 points per €10 -> floor(50 / 10) * 5 = 25.
  assert.equal(computeReferralPoints(productAmount, 5), 25);
});
