import type { Request, Response } from "express";

import { buildRequestContext } from "./system-logs.context.js";
import { serializeLogsToCsv, serializeLogsToTxt } from "./system-logs.export.js";
import { securityService } from "./security.service.js";
import { systemLogsService, type ListErrorLogsQuery } from "./system-logs.service.js";

function getParam(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || !value.length) {
    throw new Error(`Missing route param: ${key}`);
  }

  return value;
}

export class SystemLogsController {
  public async report(request: Request, response: Response) {
    const context = buildRequestContext(request);
    const body = request.body;

    await systemLogsService.log({
      type: body.type,
      severity: body.severity,
      message: body.message,
      stack: body.stack ?? null,
      source: body.source ?? null,
      page: body.page ?? null,
      endpoint: body.endpoint ?? null,
      method: body.method ?? null,
      statusCode: body.statusCode ?? null,
      durationMs: body.durationMs ?? null,
      userId: body.userId ?? context.userId,
      userEmail: body.userEmail ?? context.userEmail,
      userRole: body.userRole ?? context.userRole,
      browser: body.browser ?? context.browser,
      os: body.os ?? context.os,
      device: body.device ?? context.device,
      ip: context.ip,
      requestId: body.requestId ?? context.requestId,
    });

    response.status(202).json({ accepted: true });
  }

  public async list(request: Request, response: Response) {
    const query = request.query as unknown as ListErrorLogsQuery;
    const result = await systemLogsService.list(query);

    response.status(200).json(result);
  }

  public async summary(_request: Request, response: Response) {
    response.status(200).json(await systemLogsService.summary());
  }

  public async exportLogs(request: Request, response: Response) {
    const query = request.query as unknown as ListErrorLogsQuery & { format?: "csv" | "txt" };
    const items = await systemLogsService.exportLogs(query);
    const format = query.format === "txt" ? "txt" : "csv";

    if (format === "csv") {
      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader("Content-Disposition", 'attachment; filename="system-logs.csv"');
      response.status(200).send(serializeLogsToCsv(items));
      return;
    }

    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="system-logs.txt"');
    response.status(200).send(serializeLogsToTxt(items));
  }

  public async get(request: Request, response: Response) {
    response.status(200).json(await systemLogsService.get(getParam(request, "id")));
  }

  public async resolve(request: Request, response: Response) {
    response.status(200).json(await systemLogsService.resolve(getParam(request, "id")));
  }

  public async addNote(request: Request, response: Response) {
    response.status(200).json(await systemLogsService.addNote(getParam(request, "id"), request.body.note));
  }

  public async remove(request: Request, response: Response) {
    response.status(200).json(await systemLogsService.remove(getParam(request, "id")));
  }

  public async securityOverview(_request: Request, response: Response) {
    response.status(200).json(await securityService.getOverview());
  }

  public async getSecurityAlertsConfig(_request: Request, response: Response) {
    response.status(200).json(await securityService.getAlertsConfig());
  }

  public async updateSecurityAlertsConfig(request: Request, response: Response) {
    response.status(200).json(await securityService.updateAlertsConfig(request.body));
  }

  public async listSecurityAlerts(_request: Request, response: Response) {
    response.status(200).json({ items: await securityService.listAlerts() });
  }

  public async evaluateSecurityAlerts(_request: Request, response: Response) {
    response.status(200).json({ items: await securityService.evaluateAlerts() });
  }
}

export const systemLogsController = new SystemLogsController();
