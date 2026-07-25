import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody, validateParams } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { connectorsController } from "./connectors.controller.js";
import {
  analyzeConnectorWebsiteSchema,
  connectorEntityParamsSchema,
  runConnectorSchema,
  upsertConnectorConfigurationSchema,
} from "./connectors.schemas.js";

export const connectorsRouter = Router();

connectorsRouter.use("/admin/connectors", requireAuth, requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN));

connectorsRouter.get("/admin/connectors", asyncHandler(connectorsController.getDashboard.bind(connectorsController)));
connectorsRouter.get("/admin/connectors/health", asyncHandler(connectorsController.getHealthDashboard.bind(connectorsController)));
connectorsRouter.get("/admin/connectors/templates", asyncHandler(connectorsController.listTemplates.bind(connectorsController)));
connectorsRouter.post(
  "/admin/connectors/analyze",
  validateBody(analyzeConnectorWebsiteSchema),
  asyncHandler(connectorsController.analyzeWebsite.bind(connectorsController)),
);
connectorsRouter.get(
  "/admin/connectors/:brandSourceId",
  validateParams(connectorEntityParamsSchema),
  asyncHandler(connectorsController.getConnectorDetail.bind(connectorsController)),
);
connectorsRouter.put(
  "/admin/connectors/:brandSourceId",
  validateParams(connectorEntityParamsSchema),
  validateBody(upsertConnectorConfigurationSchema),
  asyncHandler(connectorsController.upsertConnectorConfiguration.bind(connectorsController)),
);
connectorsRouter.post(
  "/admin/connectors/:brandSourceId/test",
  validateParams(connectorEntityParamsSchema),
  asyncHandler(connectorsController.testConnection.bind(connectorsController)),
);
connectorsRouter.post(
  "/admin/connectors/:brandSourceId/preview",
  validateParams(connectorEntityParamsSchema),
  asyncHandler(connectorsController.previewImport.bind(connectorsController)),
);
connectorsRouter.get(
  "/admin/connectors/:brandSourceId/diagnostics",
  validateParams(connectorEntityParamsSchema),
  asyncHandler(connectorsController.getDiagnostics.bind(connectorsController)),
);
connectorsRouter.post(
  "/admin/connectors/:brandSourceId/auto-repair",
  validateParams(connectorEntityParamsSchema),
  asyncHandler(connectorsController.autoRepair.bind(connectorsController)),
);
connectorsRouter.post(
  "/admin/connectors/:brandSourceId/run",
  validateParams(connectorEntityParamsSchema),
  validateBody(runConnectorSchema),
  asyncHandler(connectorsController.runImport.bind(connectorsController)),
);
connectorsRouter.get(
  "/admin/connectors/:brandSourceId/history",
  validateParams(connectorEntityParamsSchema),
  asyncHandler(connectorsController.listImportHistory.bind(connectorsController)),
);
