import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { agentCostController } from "./agent-cost.controller.js";
import { updateAgentCostSettingsSchema } from "./agent-cost.schemas.js";

export const agentCostRouter = Router();

agentCostRouter.get(
  "/admin/agent-cost-settings",
  requireAuth,
  requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN),
  asyncHandler(agentCostController.getAgentCostConfig.bind(agentCostController)),
);

agentCostRouter.patch(
  "/admin/agent-cost-settings",
  requireAuth,
  requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN),
  validateBody(updateAgentCostSettingsSchema),
  asyncHandler(agentCostController.updateAgentCostConfig.bind(agentCostController)),
);
