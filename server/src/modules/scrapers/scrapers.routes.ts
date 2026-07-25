import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { scrapersController } from "./scrapers.controller.js";
import {
  createScraperSourceSchema,
  entityIdParamsSchema,
  listScraperRunsQuerySchema,
  runScraperSchema,
  updateScraperSourceSchema,
} from "./scrapers.schemas.js";

export const scrapersRouter = Router();

scrapersRouter.use("/admin/scrapers", requireAuth, requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN));

scrapersRouter.get(
  "/admin/scrapers",
  asyncHandler(scrapersController.getDashboardSummary.bind(scrapersController)),
);

scrapersRouter.get(
  "/admin/scrapers/sources",
  asyncHandler(scrapersController.listSources.bind(scrapersController)),
);

scrapersRouter.post(
  "/admin/scrapers/sources",
  validateBody(createScraperSourceSchema),
  asyncHandler(scrapersController.createSource.bind(scrapersController)),
);

scrapersRouter.patch(
  "/admin/scrapers/sources/:id",
  validateParams(entityIdParamsSchema),
  validateBody(updateScraperSourceSchema),
  asyncHandler(scrapersController.updateSource.bind(scrapersController)),
);

scrapersRouter.delete(
  "/admin/scrapers/sources/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(scrapersController.deleteSource.bind(scrapersController)),
);

scrapersRouter.post(
  "/admin/scrapers/run",
  validateBody(runScraperSchema),
  asyncHandler(scrapersController.runScraper.bind(scrapersController)),
);

scrapersRouter.get(
  "/admin/scrapers/runs",
  validateQuery(listScraperRunsQuerySchema),
  asyncHandler(scrapersController.listRuns.bind(scrapersController)),
);
