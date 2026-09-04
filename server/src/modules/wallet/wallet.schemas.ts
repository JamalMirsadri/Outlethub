import { WalletStatus, WithdrawalStatus } from "@prisma/client";
import { z } from "zod";

/**
 * Financial amounts are accepted as strings (not floating point) and must be a
 * positive value with at most two decimal places.
 */
export const moneyAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number with up to 2 decimal places")
  .refine((value) => !/^0+(\.0+)?$/.test(value), "Amount must be greater than 0");

export const walletIdParamsSchema = z.object({
  walletId: z.string().min(1).max(100),
});

export const withdrawalParamsSchema = z.object({
  id: z.string().min(1).max(100),
});

export const listWalletTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createWithdrawalSchema = z.object({
  amount: moneyAmountSchema,
});

export const creditWalletSchema = z.object({
  amount: moneyAmountSchema,
  reason: z.string().min(1, "reason is required").max(1000),
  reference: z.string().max(500).nullish(),
});

export const debitWalletSchema = z.object({
  amount: moneyAmountSchema,
  reason: z.string().min(1, "reason is required").max(1000),
  reference: z.string().max(500).nullish(),
});

export const setWalletStatusSchema = z.object({
  reason: z.string().max(1000).nullish(),
});

export const listWalletsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  status: z.nativeEnum(WalletStatus).optional(),
});

export const listWithdrawalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  status: z.nativeEnum(WithdrawalStatus).optional(),
});

export const adminWithdrawalActionSchema = z.object({
  adminNote: z.string().max(1000).nullish(),
});
