import type { Request, Response } from "express";

import { notificationsService } from "./notifications.service.js";

function requireUserId(request: Request): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new Error("Authentication is required.");
  }

  return userId;
}

function getParam(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing route param: ${key}`);
  }

  return value;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export class NotificationsController {
  public async listCustomerNotifications(request: Request, response: Response) {
    response.status(200).json(
      await notificationsService.listCustomerNotifications(requireUserId(request), {
        category: request.query.category as Parameters<typeof notificationsService.listCustomerNotifications>[1]["category"],
        unreadOnly: String(request.query.unreadOnly ?? "false") === "true",
        dateFrom: parseDate(request.query.dateFrom),
        dateTo: parseDate(request.query.dateTo),
      }),
    );
  }

  public async markNotificationRead(request: Request, response: Response) {
    response
      .status(200)
      .json(await notificationsService.markNotificationRead(requireUserId(request), getParam(request, "id")));
  }

  public async markAllNotificationsRead(request: Request, response: Response) {
    response.status(200).json(await notificationsService.markAllNotificationsRead(requireUserId(request)));
  }

  public async getNotificationPreferences(request: Request, response: Response) {
    response.status(200).json(await notificationsService.getNotificationPreferences(requireUserId(request)));
  }

  public async updateNotificationPreferences(request: Request, response: Response) {
    response
      .status(200)
      .json(await notificationsService.updateNotificationPreferences(requireUserId(request), request.body));
  }

  public async listAdminNotifications(request: Request, response: Response) {
    response.status(200).json(
      await notificationsService.listAdminNotifications(requireUserId(request), {
        category: request.query.category as Parameters<typeof notificationsService.listAdminNotifications>[1]["category"],
        unreadOnly: String(request.query.unreadOnly ?? "false") === "true",
        dateFrom: parseDate(request.query.dateFrom),
        dateTo: parseDate(request.query.dateTo),
      }),
    );
  }

  public async listEmailTemplates(_request: Request, response: Response) {
    response.status(200).json({ items: await notificationsService.listEmailTemplates() });
  }

  public async getAdminEmailNotificationSettings(_request: Request, response: Response) {
    response.status(200).json(await notificationsService.getAdminEmailNotificationSettings());
  }

  public async updateAdminEmailNotificationSettings(request: Request, response: Response) {
    response
      .status(200)
      .json(await notificationsService.updateAdminEmailNotificationSettings(request.body.enabled));
  }

  public async createAdminEmailNotificationRecipient(request: Request, response: Response) {
    response.status(201).json(await notificationsService.createAdminEmailNotificationRecipient(request.body));
  }

  public async updateAdminEmailNotificationRecipient(request: Request, response: Response) {
    response
      .status(200)
      .json(await notificationsService.updateAdminEmailNotificationRecipient(getParam(request, "id"), request.body));
  }

  public async deleteAdminEmailNotificationRecipient(request: Request, response: Response) {
    await notificationsService.deleteAdminEmailNotificationRecipient(getParam(request, "id"));
    response.status(204).send();
  }

  public async sendAdminEmailNotificationTestEmail(request: Request, response: Response) {
    response
      .status(202)
      .json(await notificationsService.sendAdminEmailNotificationTestEmail(requireUserId(request)));
  }

  public async updateEmailTemplate(request: Request, response: Response) {
    response
      .status(200)
      .json(await notificationsService.updateEmailTemplate(requireUserId(request), getParam(request, "id"), request.body));
  }

  public async previewEmailTemplate(request: Request, response: Response) {
    response
      .status(200)
      .json(await notificationsService.previewEmailTemplate(getParam(request, "id"), request.body.variables));
  }

  public async rollbackEmailTemplate(request: Request, response: Response) {
    response
      .status(200)
      .json(
        await notificationsService.rollbackEmailTemplate(
          requireUserId(request),
          getParam(request, "id"),
          request.body.version,
        ),
      );
  }

  public async sendTestEmail(request: Request, response: Response) {
    response
      .status(202)
      .json(
        await notificationsService.sendTestEmail(
          requireUserId(request),
          getParam(request, "id"),
          request.body.targetEmail,
          request.body.variables,
        ),
      );
  }
}

export const notificationsController = new NotificationsController();
