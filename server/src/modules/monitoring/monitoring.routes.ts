import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { monitoringController } from "./monitoring.controller.js";
import {
  entityIdParamsSchema,
  listAlertsQuerySchema,
  monitoringDashboardQuerySchema,
  listSyncHistoryQuerySchema,
  productMonitoringLogsQuerySchema,
  runSyncSchema,
  runProductMonitoringSchema,
  updateGlobalProductMonitoringSettingsSchema,
  updateProductMonitoringSettingsSchema,
  updateSourceSettingsSchema,
} from "./monitoring.schemas.js";

export const monitoringRouter = Router();

monitoringRouter.use(
  ["/admin/monitoring", "/admin/alerts", "/admin/sync-history"],
  requireAuth,
  requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN),
);

monitoringRouter.get(
  "/admin/monitoring",
  validateQuery(monitoringDashboardQuerySchema),
  asyncHandler(monitoringController.getDashboard.bind(monitoringController)),
);

monitoringRouter.post(
  "/admin/monitoring/run",
  validateBody(runSyncSchema),
  asyncHandler(monitoringController.runSync.bind(monitoringController)),
);

monitoringRouter.patch(
  "/admin/monitoring/settings",
  validateBody(updateSourceSettingsSchema),
  asyncHandler(monitoringController.updateSourceSettings.bind(monitoringController)),
);

monitoringRouter.get(
  "/admin/monitoring/product-settings",
  asyncHandler(monitoringController.getGlobalProductMonitoringSettings.bind(monitoringController)),
);

monitoringRouter.patch(
  "/admin/monitoring/product-settings",
  validateBody(updateGlobalProductMonitoringSettingsSchema),
  asyncHandler(monitoringController.updateGlobalProductMonitoringSettings.bind(monitoringController)),
);

monitoringRouter.get(
  "/admin/monitoring/products/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(monitoringController.getProductMonitoringSettings.bind(monitoringController)),
);

monitoringRouter.patch(
  "/admin/monitoring/products/:id/settings",
  validateParams(entityIdParamsSchema),
  validateBody(updateProductMonitoringSettingsSchema),
  asyncHandler(monitoringController.updateProductMonitoringSettings.bind(monitoringController)),
);

monitoringRouter.get(
  "/admin/monitoring/products/:id/logs",
  validateParams(entityIdParamsSchema),
  validateQuery(productMonitoringLogsQuerySchema),
  asyncHandler(monitoringController.listProductMonitoringLogs.bind(monitoringController)),
);

monitoringRouter.post(
  "/admin/monitoring/products/:id/run",
  validateParams(entityIdParamsSchema),
  validateBody(runProductMonitoringSchema),
  asyncHandler(monitoringController.runProductMonitoring.bind(monitoringController)),
);

monitoringRouter.get(
  "/admin/alerts",
  validateQuery(listAlertsQuerySchema),
  asyncHandler(monitoringController.listAlerts.bind(monitoringController)),
);

monitoringRouter.patch(
  "/admin/alerts/:id/read",
  validateParams(entityIdParamsSchema),
  asyncHandler(monitoringController.markAlertRead.bind(monitoringController)),
);

monitoringRouter.get(
  "/admin/sync-history",
  validateQuery(listSyncHistoryQuerySchema),
  asyncHandler(monitoringController.listSyncHistory.bind(monitoringController)),
);
