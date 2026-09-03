import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { attachOptionalAuth, requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { systemLogsController } from "./system-logs.controller.js";
import {
  addNoteErrorLogSchema,
  createClientErrorSchema,
  createManualBlockSchema,
  entityIdParamsSchema,
  exportErrorLogsQuerySchema,
  extendSecurityBlockSchema,
  listErrorLogsQuerySchema,
  listSecurityBlocksQuerySchema,
  releaseSecurityBlockSchema,
  securityBlockParamsSchema,
  updateSecurityAlertsConfigSchema,
} from "./system-logs.schemas.js";

export const systemLogsRouter = Router();

// Public ingestion endpoint for frontend error reports. Optional auth is
// attached so authenticated users get accurate server-side context.
systemLogsRouter.post(
  "/system-logs/report",
  attachOptionalAuth,
  validateBody(createClientErrorSchema),
  asyncHandler(systemLogsController.report.bind(systemLogsController)),
);

// Admin endpoints.
systemLogsRouter.use(
  ["/admin/system-logs", "/admin/system-logs/summary", "/admin/system-logs/export", "/admin/security"],
  requireAuth,
  requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN),
);

systemLogsRouter.get(
  "/admin/system-logs",
  validateQuery(listErrorLogsQuerySchema),
  asyncHandler(systemLogsController.list.bind(systemLogsController)),
);

systemLogsRouter.get(
  "/admin/system-logs/summary",
  asyncHandler(systemLogsController.summary.bind(systemLogsController)),
);

systemLogsRouter.get(
  "/admin/system-logs/export",
  validateQuery(exportErrorLogsQuerySchema),
  asyncHandler(systemLogsController.exportLogs.bind(systemLogsController)),
);

systemLogsRouter.get(
  "/admin/system-logs/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(systemLogsController.get.bind(systemLogsController)),
);

systemLogsRouter.patch(
  "/admin/system-logs/:id/resolve",
  validateParams(entityIdParamsSchema),
  asyncHandler(systemLogsController.resolve.bind(systemLogsController)),
);

systemLogsRouter.patch(
  "/admin/system-logs/:id/note",
  validateParams(entityIdParamsSchema),
  validateBody(addNoteErrorLogSchema),
  asyncHandler(systemLogsController.addNote.bind(systemLogsController)),
);

systemLogsRouter.delete(
  "/admin/system-logs/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(systemLogsController.remove.bind(systemLogsController)),
);

// Security dashboard and alert endpoints.
systemLogsRouter.get(
  "/admin/security/overview",
  asyncHandler(systemLogsController.securityOverview.bind(systemLogsController)),
);

systemLogsRouter.get(
  "/admin/security/alerts",
  asyncHandler(systemLogsController.listSecurityAlerts.bind(systemLogsController)),
);

systemLogsRouter.post(
  "/admin/security/alerts/evaluate",
  asyncHandler(systemLogsController.evaluateSecurityAlerts.bind(systemLogsController)),
);

systemLogsRouter.get(
  "/admin/security/alerts/config",
  asyncHandler(systemLogsController.getSecurityAlertsConfig.bind(systemLogsController)),
);

systemLogsRouter.patch(
  "/admin/security/alerts/config",
  validateBody(updateSecurityAlertsConfigSchema),
  asyncHandler(systemLogsController.updateSecurityAlertsConfig.bind(systemLogsController)),
);

// Security blocking endpoints.
systemLogsRouter.get(
  "/admin/security/blocks/overview",
  asyncHandler(systemLogsController.securityBlockOverview.bind(systemLogsController)),
);

systemLogsRouter.get(
  "/admin/security/blocks",
  validateQuery(listSecurityBlocksQuerySchema),
  asyncHandler(systemLogsController.listSecurityBlocks.bind(systemLogsController)),
);

systemLogsRouter.post(
  "/admin/security/blocks",
  validateBody(createManualBlockSchema),
  asyncHandler(systemLogsController.createManualBlock.bind(systemLogsController)),
);

systemLogsRouter.post(
  "/admin/security/blocks/:id/release",
  validateParams(securityBlockParamsSchema),
  validateBody(releaseSecurityBlockSchema),
  asyncHandler(systemLogsController.releaseSecurityBlock.bind(systemLogsController)),
);

systemLogsRouter.post(
  "/admin/security/blocks/:id/extend",
  validateParams(securityBlockParamsSchema),
  validateBody(extendSecurityBlockSchema),
  asyncHandler(systemLogsController.extendSecurityBlock.bind(systemLogsController)),
);
