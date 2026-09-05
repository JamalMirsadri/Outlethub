import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { shippingController } from "./shipping.controller.js";
import { updateShippingSettingsSchema } from "./shipping.schemas.js";

export const shippingRouter = Router();

shippingRouter.get(
  "/admin/shipping-settings",
  requireAuth,
  requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN),
  asyncHandler(shippingController.getShippingConfig.bind(shippingController)),
);

shippingRouter.patch(
  "/admin/shipping-settings",
  requireAuth,
  requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN),
  validateBody(updateShippingSettingsSchema),
  asyncHandler(shippingController.updateShippingConfig.bind(shippingController)),
);
