import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { rateLimit } from "../../middleware/rate-limit.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { walletController } from "./wallet.controller.js";
import {
  adminWithdrawalActionSchema,
  createWithdrawalSchema,
  creditWalletSchema,
  debitWalletSchema,
  listWalletsQuerySchema,
  listWalletTransactionsQuerySchema,
  listWithdrawalsQuerySchema,
  setWalletStatusSchema,
  walletIdParamsSchema,
  withdrawalParamsSchema,
} from "./wallet.schemas.js";

export const walletRouter = Router();

// Customer wallet endpoints (own wallet only, enforced by backend ownership).
walletRouter.get("/wallet", requireAuth, asyncHandler(walletController.getOwnWallet.bind(walletController)));

walletRouter.get(
  "/wallet/transactions",
  requireAuth,
  validateQuery(listWalletTransactionsQuerySchema),
  asyncHandler(walletController.listOwnTransactions.bind(walletController)),
);

walletRouter.post(
  "/wallet/withdrawals",
  requireAuth,
  rateLimit("wallet:withdrawal", 5, 60),
  validateBody(createWithdrawalSchema),
  asyncHandler(walletController.requestWithdrawal.bind(walletController)),
);

// Admin wallet management.
walletRouter.use("/admin/wallets", requireAuth, requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN));
walletRouter.use("/admin/wallet-withdrawals", requireAuth, requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN));

walletRouter.get("/admin/wallets/overview", asyncHandler(walletController.adminOverview.bind(walletController)));

walletRouter.get(
  "/admin/wallets",
  validateQuery(listWalletsQuerySchema),
  asyncHandler(walletController.listWallets.bind(walletController)),
);

walletRouter.get(
  "/admin/wallets/:walletId",
  validateParams(walletIdParamsSchema),
  asyncHandler(walletController.getWallet.bind(walletController)),
);

walletRouter.post(
  "/admin/wallets/:walletId/credit",
  rateLimit("wallet:admin-credit", 30, 60),
  validateParams(walletIdParamsSchema),
  validateBody(creditWalletSchema),
  asyncHandler(walletController.creditWallet.bind(walletController)),
);

walletRouter.post(
  "/admin/wallets/:walletId/debit",
  rateLimit("wallet:admin-debit", 30, 60),
  validateParams(walletIdParamsSchema),
  validateBody(debitWalletSchema),
  asyncHandler(walletController.debitWallet.bind(walletController)),
);

walletRouter.post(
  "/admin/wallets/:walletId/suspend",
  validateParams(walletIdParamsSchema),
  validateBody(setWalletStatusSchema),
  asyncHandler(walletController.suspendWallet.bind(walletController)),
);

walletRouter.post(
  "/admin/wallets/:walletId/activate",
  validateParams(walletIdParamsSchema),
  validateBody(setWalletStatusSchema),
  asyncHandler(walletController.activateWallet.bind(walletController)),
);

walletRouter.get(
  "/admin/wallet-withdrawals",
  validateQuery(listWithdrawalsQuerySchema),
  asyncHandler(walletController.listWithdrawals.bind(walletController)),
);

walletRouter.post(
  "/admin/wallet-withdrawals/:id/approve",
  validateParams(withdrawalParamsSchema),
  validateBody(adminWithdrawalActionSchema),
  asyncHandler(walletController.approveWithdrawal.bind(walletController)),
);

walletRouter.post(
  "/admin/wallet-withdrawals/:id/reject",
  validateParams(withdrawalParamsSchema),
  validateBody(adminWithdrawalActionSchema),
  asyncHandler(walletController.rejectWithdrawal.bind(walletController)),
);

walletRouter.post(
  "/admin/wallet-withdrawals/:id/cancel",
  validateParams(withdrawalParamsSchema),
  validateBody(adminWithdrawalActionSchema),
  asyncHandler(walletController.cancelWithdrawal.bind(walletController)),
);

walletRouter.post(
  "/admin/wallet-withdrawals/:id/complete",
  validateParams(withdrawalParamsSchema),
  validateBody(adminWithdrawalActionSchema),
  asyncHandler(walletController.completeWithdrawal.bind(walletController)),
);
