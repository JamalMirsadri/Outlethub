import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { authController } from "./auth.controller.js";
import {
  adminResetUserPasswordSchema,
  adminUpdateUserStatusSchema,
  adminUserIdParamsSchema,
  adminUsersQuerySchema,
} from "./auth.schemas.js";

export const authAdminRouter = Router();

authAdminRouter.use(requireAuth, requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN));

authAdminRouter.get(
  "/admin/users",
  validateQuery(adminUsersQuerySchema),
  asyncHandler(authController.listAdminUsers.bind(authController)),
);

authAdminRouter.get(
  "/admin/users/:id",
  validateParams(adminUserIdParamsSchema),
  asyncHandler(authController.getAdminUserDetail.bind(authController)),
);

authAdminRouter.patch(
  "/admin/users/:id/status",
  validateParams(adminUserIdParamsSchema),
  validateBody(adminUpdateUserStatusSchema),
  asyncHandler(authController.updateAdminUserStatus.bind(authController)),
);

authAdminRouter.post(
  "/admin/users/:id/reset-password",
  validateParams(adminUserIdParamsSchema),
  validateBody(adminResetUserPasswordSchema),
  asyncHandler(authController.resetAdminUserPassword.bind(authController)),
);

authAdminRouter.post(
  "/admin/users/:id/revoke-sessions",
  validateParams(adminUserIdParamsSchema),
  asyncHandler(authController.revokeAdminUserSessions.bind(authController)),
);

authAdminRouter.delete(
  "/admin/users/:id",
  validateParams(adminUserIdParamsSchema),
  asyncHandler(authController.deleteAdminUser.bind(authController)),
);
