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
  entityIdParamsSchema,
  exportErrorLogsQuerySchema,
  listErrorLogsQuerySchema,
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
  ["/admin/system-logs", "/admin/system-logs/summary", "/admin/system-logs/export"],
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
