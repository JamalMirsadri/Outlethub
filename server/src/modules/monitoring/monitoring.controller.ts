import type { Request, Response } from "express";

import { monitoringService } from "./monitoring.service.js";

function getParam(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || !value.length) {
    throw new Error(`Missing route param: ${key}`);
  }

  return value;
}

export class MonitoringController {
  public async getDashboard(request: Request, response: Response) {
    const sourceId = typeof request.query.sourceId === "string" && request.query.sourceId.length > 0 ? request.query.sourceId : undefined;
    const dashboard = await monitoringService.getDashboard(sourceId);
    response.status(200).json(dashboard);
  }

  public async listAlerts(request: Request, response: Response) {
    const unreadOnly = String(request.query.unreadOnly ?? "false") === "true";
    const limit = Number(request.query.limit ?? 50);
    const items = await monitoringService.listAlerts(limit, unreadOnly);
    response.status(200).json({ items });
  }

  public async markAlertRead(request: Request, response: Response) {
    const alert = await monitoringService.markAlertRead(getParam(request, "id"));
    response.status(200).json(alert);
  }

  public async listSyncHistory(request: Request, response: Response) {
    const limit = Number(request.query.limit ?? 50);
    const status =
      typeof request.query.status === "string" && request.query.status.length > 0
        ? (request.query.status as Parameters<typeof monitoringService.listSyncHistory>[1])
        : undefined;
    const sourceId = typeof request.query.sourceId === "string" && request.query.sourceId.length > 0 ? request.query.sourceId : undefined;
    const items = await monitoringService.listSyncHistory(limit, status, sourceId);
    response.status(200).json({ items });
  }

  public async runSync(request: Request, response: Response) {
    const result = await monitoringService.runSync(request.body.sourceId, request.body.trigger);
    response.status(202).json(result);
  }

  public async getGlobalProductMonitoringSettings(_request: Request, response: Response) {
    response.status(200).json(await monitoringService.getGlobalProductMonitoringSettings());
  }

  public async updateGlobalProductMonitoringSettings(request: Request, response: Response) {
    response.status(200).json(await monitoringService.updateGlobalProductMonitoringSettings(request.body));
  }

  public async getProductMonitoringSettings(request: Request, response: Response) {
    response.status(200).json(await monitoringService.getProductMonitoringSettings(getParam(request, "id")));
  }

  public async updateProductMonitoringSettings(request: Request, response: Response) {
    response
      .status(200)
      .json(await monitoringService.updateProductMonitoringSettings(getParam(request, "id"), request.body));
  }

  public async listProductMonitoringLogs(request: Request, response: Response) {
    const limit = Number(request.query.limit ?? 50);
    response
      .status(200)
      .json({ items: await monitoringService.listProductMonitoringLogs(getParam(request, "id"), limit) });
  }

  public async runProductMonitoring(request: Request, response: Response) {
    response
      .status(202)
      .json(await monitoringService.queueProductMonitoringRun(getParam(request, "id"), request.body.trigger));
  }

  public async updateSourceSettings(request: Request, response: Response) {
    const result = await monitoringService.updateSourceSettings(request.body);
    response.status(200).json(result);
  }
}

export const monitoringController = new MonitoringController();
