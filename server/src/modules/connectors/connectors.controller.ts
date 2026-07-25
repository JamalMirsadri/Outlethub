import type { Request, Response } from "express";

import { connectorsService } from "./connectors.service.js";

function getParam(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || !value.length) {
    throw new Error(`Missing route param: ${key}`);
  }

  return value;
}

export class ConnectorsController {
  public async getDashboard(_request: Request, response: Response) {
    const payload = await connectorsService.getDashboard();
    response.status(200).json(payload);
  }

  public async getHealthDashboard(_request: Request, response: Response) {
    const payload = await connectorsService.getHealthDashboard();
    response.status(200).json(payload);
  }

  public async analyzeWebsite(request: Request, response: Response) {
    const payload = await connectorsService.analyzeWebsite(request.body);
    response.status(200).json(payload);
  }

  public async listTemplates(_request: Request, response: Response) {
    const items = await connectorsService.listTemplates();
    response.status(200).json({ items });
  }

  public async getConnectorDetail(request: Request, response: Response) {
    const connector = await connectorsService.getConnectorDetail(getParam(request, "brandSourceId"));
    response.status(200).json(connector);
  }

  public async upsertConnectorConfiguration(request: Request, response: Response) {
    const connector = await connectorsService.upsertConnectorConfiguration(getParam(request, "brandSourceId"), request.body);
    response.status(200).json(connector);
  }

  public async testConnection(request: Request, response: Response) {
    const result = await connectorsService.testConnection(getParam(request, "brandSourceId"));
    response.status(200).json(result);
  }

  public async previewImport(request: Request, response: Response) {
    const result = await connectorsService.previewImport(getParam(request, "brandSourceId"));
    response.status(200).json(result);
  }

  public async getDiagnostics(request: Request, response: Response) {
    const result = await connectorsService.getConnectorDiagnostics(getParam(request, "brandSourceId"));
    response.status(200).json(result);
  }

  public async autoRepair(request: Request, response: Response) {
    const result = await connectorsService.autoRepairSelectors(getParam(request, "brandSourceId"));
    response.status(200).json(result);
  }

  public async runImport(request: Request, response: Response) {
    const result = await connectorsService.runImport(getParam(request, "brandSourceId"));
    response.status(202).json({
      ...result,
      trigger: request.body.trigger ?? "manual",
    });
  }

  public async listImportHistory(request: Request, response: Response) {
    const items = await connectorsService.getImportHistory(getParam(request, "brandSourceId"));
    response.status(200).json({ items });
  }
}

export const connectorsController = new ConnectorsController();
