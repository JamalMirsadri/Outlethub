import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { notificationsController } from "./notifications.controller.js";
import {
  adminEmailNotificationRecipientParamsSchema,
  createAdminEmailNotificationRecipientSchema,
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  previewEmailTemplateSchema,
  rollbackTemplateSchema,
  sendTestEmailSchema,
  updateAdminEmailNotificationRecipientSchema,
  updateAdminEmailNotificationSettingsSchema,
  updateEmailTemplateSchema,
  updateNotificationPreferencesSchema,
} from "./notifications.schemas.js";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/notifications",
  requireAuth,
  validateQuery(listNotificationsQuerySchema),
  asyncHandler(notificationsController.listCustomerNotifications.bind(notificationsController)),
);

notificationsRouter.patch(
  "/notifications/:id/read",
  requireAuth,
  validateParams(notificationIdParamsSchema),
  asyncHandler(notificationsController.markNotificationRead.bind(notificationsController)),
);

notificationsRouter.post(
  "/notifications/read-all",
  requireAuth,
  asyncHandler(notificationsController.markAllNotificationsRead.bind(notificationsController)),
);

notificationsRouter.get(
  "/notification-preferences",
  requireAuth,
  asyncHandler(notificationsController.getNotificationPreferences.bind(notificationsController)),
);

notificationsRouter.put(
  "/notification-preferences",
  requireAuth,
  validateBody(updateNotificationPreferencesSchema),
  asyncHandler(notificationsController.updateNotificationPreferences.bind(notificationsController)),
);

notificationsRouter.use(
  ["/admin/notifications", "/admin/email-templates", "/admin/customer-email-templates", "/admin/customer-email-history", "/admin/email-notifications"],
  requireAuth,
  requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN),
);

notificationsRouter.get(
  "/admin/notifications",
  validateQuery(listNotificationsQuerySchema),
  asyncHandler(notificationsController.listAdminNotifications.bind(notificationsController)),
);

notificationsRouter.get(
  "/admin/email-templates",
  asyncHandler(notificationsController.listEmailTemplates.bind(notificationsController)),
);

notificationsRouter.get(
  "/admin/customer-email-templates",
  asyncHandler(notificationsController.listCustomerEmailTemplates.bind(notificationsController)),
);

notificationsRouter.get(
  "/admin/customer-email-history",
  asyncHandler(notificationsController.listCustomerEmailHistory.bind(notificationsController)),
);

notificationsRouter.get(
  "/admin/email-notifications",
  asyncHandler(notificationsController.getAdminEmailNotificationSettings.bind(notificationsController)),
);

notificationsRouter.patch(
  "/admin/email-notifications",
  validateBody(updateAdminEmailNotificationSettingsSchema),
  asyncHandler(notificationsController.updateAdminEmailNotificationSettings.bind(notificationsController)),
);

notificationsRouter.post(
  "/admin/email-notifications/recipients",
  validateBody(createAdminEmailNotificationRecipientSchema),
  asyncHandler(notificationsController.createAdminEmailNotificationRecipient.bind(notificationsController)),
);

notificationsRouter.patch(
  "/admin/email-notifications/recipients/:id",
  validateParams(adminEmailNotificationRecipientParamsSchema),
  validateBody(updateAdminEmailNotificationRecipientSchema),
  asyncHandler(notificationsController.updateAdminEmailNotificationRecipient.bind(notificationsController)),
);

notificationsRouter.delete(
  "/admin/email-notifications/recipients/:id",
  validateParams(adminEmailNotificationRecipientParamsSchema),
  asyncHandler(notificationsController.deleteAdminEmailNotificationRecipient.bind(notificationsController)),
);

notificationsRouter.post(
  "/admin/email-notifications/test",
  asyncHandler(notificationsController.sendAdminEmailNotificationTestEmail.bind(notificationsController)),
);

notificationsRouter.patch(
  "/admin/email-templates/:id",
  validateParams(notificationIdParamsSchema),
  validateBody(updateEmailTemplateSchema),
  asyncHandler(notificationsController.updateEmailTemplate.bind(notificationsController)),
);

notificationsRouter.post(
  "/admin/email-templates/:id/preview",
  validateParams(notificationIdParamsSchema),
  validateBody(previewEmailTemplateSchema),
  asyncHandler(notificationsController.previewEmailTemplate.bind(notificationsController)),
);

notificationsRouter.post(
  "/admin/email-templates/:id/rollback",
  validateParams(notificationIdParamsSchema),
  validateBody(rollbackTemplateSchema),
  asyncHandler(notificationsController.rollbackEmailTemplate.bind(notificationsController)),
);

notificationsRouter.post(
  "/admin/email-templates/:id/test",
  validateParams(notificationIdParamsSchema),
  validateBody(sendTestEmailSchema),
  asyncHandler(notificationsController.sendTestEmail.bind(notificationsController)),
);
