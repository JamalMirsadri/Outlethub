import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { importsController } from "./imports.controller.js";
import {
  createImportRuleSchema,
  createImportSourceSchema,
  entityIdParamsSchema,
  listImportJobsQuerySchema,
  listImportLogsQuerySchema,
  runImportJobSchema,
  updateImportRuleSchema,
  updateImportSourceSchema,
  uploadImportSchema,
} from "./imports.schemas.js";

export const importsRouter = Router();

importsRouter.use("/admin/imports", requireAuth, requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN));

importsRouter.get(
  "/admin/imports",
  asyncHandler(importsController.getDashboardSummary.bind(importsController)),
);

importsRouter.get(
  "/admin/import-observability",
  asyncHandler(importsController.getObservabilityDashboard.bind(importsController)),
);

importsRouter.get(
  "/admin/imports/sources",
  asyncHandler(importsController.listSources.bind(importsController)),
);

importsRouter.post(
  "/admin/imports/sources",
  validateBody(createImportSourceSchema),
  asyncHandler(importsController.createSource.bind(importsController)),
);

importsRouter.patch(
  "/admin/imports/sources/:id",
  validateParams(entityIdParamsSchema),
  validateBody(updateImportSourceSchema),
  asyncHandler(importsController.updateSource.bind(importsController)),
);

importsRouter.delete(
  "/admin/imports/sources/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(importsController.deleteSource.bind(importsController)),
);

importsRouter.get(
  "/admin/imports/rules",
  asyncHandler(importsController.listRules.bind(importsController)),
);

importsRouter.post(
  "/admin/imports/rules",
  validateBody(createImportRuleSchema),
  asyncHandler(importsController.createRule.bind(importsController)),
);

importsRouter.patch(
  "/admin/imports/rules/:id",
  validateParams(entityIdParamsSchema),
  validateBody(updateImportRuleSchema),
  asyncHandler(importsController.updateRule.bind(importsController)),
);

importsRouter.delete(
  "/admin/imports/rules/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(importsController.deleteRule.bind(importsController)),
);

importsRouter.post(
  "/admin/imports/run",
  validateBody(runImportJobSchema),
  asyncHandler(importsController.runImport.bind(importsController)),
);

importsRouter.post(
  "/admin/imports/upload",
  validateBody(uploadImportSchema),
  asyncHandler(importsController.uploadImport.bind(importsController)),
);

importsRouter.get(
  "/admin/imports/jobs",
  validateQuery(listImportJobsQuerySchema),
  asyncHandler(importsController.listJobs.bind(importsController)),
);

importsRouter.get(
  "/admin/imports/jobs/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(importsController.getJobDetail.bind(importsController)),
);

importsRouter.get(
  "/admin/imports/logs",
  validateQuery(listImportLogsQuerySchema),
  asyncHandler(importsController.listLogs.bind(importsController)),
);
