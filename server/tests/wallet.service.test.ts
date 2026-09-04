import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

import { createWithdrawalSchema, creditWalletSchema, debitWalletSchema, moneyAmountSchema } from "../src/modules/wallet/wallet.schemas.js";

test("money amount schema rejects zero, negative and invalid precision", () => {
  assert.equal(moneyAmountSchema.safeParse("0").success, false);
  assert.equal(moneyAmountSchema.safeParse("0.00").success, false);
  assert.equal(moneyAmountSchema.safeParse("-5").success, false);
  assert.equal(moneyAmountSchema.safeParse("abc").success, false);
  assert.equal(moneyAmountSchema.safeParse("1.234").success, false);
  assert.equal(moneyAmountSchema.safeParse("").success, false);
});

test("money amount schema accepts valid positive EUR amounts", () => {
  assert.equal(moneyAmountSchema.safeParse("1").success, true);
  assert.equal(moneyAmountSchema.safeParse("1.5").success, true);
  assert.equal(moneyAmountSchema.safeParse("100.00").success, true);
});

test("withdrawal requires a positive amount", () => {
  assert.equal(createWithdrawalSchema.safeParse({ amount: "0" }).success, false);
  assert.equal(createWithdrawalSchema.safeParse({ amount: "-10" }).success, false);
  assert.equal(createWithdrawalSchema.safeParse({ amount: "10.00" }).success, true);
});

test("admin credit/debit require amount and reason", () => {
  assert.equal(creditWalletSchema.safeParse({ amount: "25.00" }).success, false);
  assert.equal(creditWalletSchema.safeParse({ amount: "25.00", reason: "bonus" }).success, true);
  assert.equal(debitWalletSchema.safeParse({ amount: "25.00" }).success, false);
  assert.equal(debitWalletSchema.safeParse({ amount: "25.00", reason: "adjustment" }).success, true);
});

test("decimal arithmetic avoids floating point errors", () => {
  const credit = new Prisma.Decimal("100.00").add(new Prisma.Decimal("25.00")).toFixed(2);
  assert.equal(credit, "125.00");

  const debit = new Prisma.Decimal("100.00").sub(new Prisma.Decimal("30.00")).toFixed(2);
  assert.equal(debit, "70.00");

  assert.equal(new Prisma.Decimal("70.00").sub(new Prisma.Decimal("100.00")).isNegative(), true);
});
