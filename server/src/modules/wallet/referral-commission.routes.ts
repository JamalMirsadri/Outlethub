import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody, validateQuery } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { referralCommissionController } from "./referral-commission.controller.js";
import { listCommissionsQuerySchema, updateCommissionConfigSchema, updateCommissionSettingsSchema } from "./referral-commission.schemas.js";

export const referralCommissionRouter = Router();

// Customer endpoints (own commissions only).
referralCommissionRouter.get(
  "/referral-commissions",
  requireAuth,
  asyncHandler(referralCommissionController.getUserReferralSummary.bind(referralCommissionController)),
);

referralCommissionRouter.get(
  "/referral-commissions/transactions",
  requireAuth,
  asyncHandler(referralCommissionController.listOwnCommissions.bind(referralCommissionController)),
);

// Admin endpoints.
referralCommissionRouter.use(
  "/admin/commissions",
  requireAuth,
  requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN),
);

referralCommissionRouter.get(
  "/admin/commissions/overview",
  asyncHandler(referralCommissionController.getAdminOverview.bind(referralCommissionController)),
);

referralCommissionRouter.get(
  "/admin/commissions",
  validateQuery(listCommissionsQuerySchema),
  asyncHandler(referralCommissionController.listCommissions.bind(referralCommissionController)),
);

referralCommissionRouter.get(
  "/admin/commission-config",
  asyncHandler(referralCommissionController.getCommissionConfig.bind(referralCommissionController)),
);

referralCommissionRouter.patch(
  "/admin/commission-config",
  validateBody(updateCommissionConfigSchema),
  asyncHandler(referralCommissionController.updateCommissionConfig.bind(referralCommissionController)),
);

referralCommissionRouter.patch(
  "/admin/commission-settings",
  validateBody(updateCommissionSettingsSchema),
  asyncHandler(referralCommissionController.updateCommissionSettings.bind(referralCommissionController)),
);
