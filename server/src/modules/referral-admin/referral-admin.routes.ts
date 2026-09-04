import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody, validateQuery } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { referralAdminController } from "./referral-admin.controller.js";
import { listPointRewardsQuerySchema, updatePointSettingsSchema } from "./referral-admin.schemas.js";

export const referralAdminRouter = Router();

referralAdminRouter.use(
  "/admin",
  requireAuth,
  requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN),
);

referralAdminRouter.get(
  "/admin/referral-overview",
  asyncHandler(referralAdminController.getAdminReferralOverview.bind(referralAdminController)),
);

referralAdminRouter.get(
  "/admin/referral-point-settings",
  asyncHandler(referralAdminController.getPointSettings.bind(referralAdminController)),
);

referralAdminRouter.patch(
  "/admin/referral-point-settings",
  validateBody(updatePointSettingsSchema),
  asyncHandler(referralAdminController.updatePointSettings.bind(referralAdminController)),
);

referralAdminRouter.get(
  "/admin/referral-points",
  validateQuery(listPointRewardsQuerySchema),
  asyncHandler(referralAdminController.listPointRewards.bind(referralAdminController)),
);
