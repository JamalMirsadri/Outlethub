import type { Request, Response } from "express";

import { enqueueImportJob } from "./import-queue.js";
import { importManager } from "./import-manager.js";
import { importsService } from "./imports.service.js";

function getParam(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || !value.length) {
    throw new Error(`Missing route param: ${key}`);
  }

  return value;
}

export class ImportsController {
  public async getDashboardSummary(_request: Request, response: Response) {
    const summary = await importsService.getDashboardSummary();
    const sources = await importsService.listSources();
    response.status(200).json({ summary, sources });
  }

  public async getObservabilityDashboard(_request: Request, response: Response) {
    const dashboard = await importsService.getObservabilityDashboard();
    response.status(200).json(dashboard);
  }

  public async listSources(_request: Request, response: Response) {
    const sources = await importsService.listSources();
    response.status(200).json({ items: sources });
  }

  public async createSource(request: Request, response: Response) {
    const source = await importsService.createSource(request.body);
    response.status(201).json(source);
  }

  public async updateSource(request: Request, response: Response) {
    const source = await importsService.updateSource(getParam(request, "id"), request.body);
    response.status(200).json(source);
  }

  public async deleteSource(request: Request, response: Response) {
    await importsService.deleteSource(getParam(request, "id"));
    response.status(204).send();
  }

  public async listRules(_request: Request, response: Response) {
    const rules = await importsService.listRules();
    response.status(200).json({ items: rules });
  }

  public async createRule(request: Request, response: Response) {
    const rule = await importsService.createRule(request.body);
    response.status(201).json(rule);
  }

  public async updateRule(request: Request, response: Response) {
    const rule = await importsService.updateRule(getParam(request, "id"), request.body);
    response.status(200).json(rule);
  }

  public async deleteRule(request: Request, response: Response) {
    await importsService.deleteRule(getParam(request, "id"));
    response.status(204).send();
  }

  public async runImport(request: Request, response: Response) {
    const job = await importManager.createJob({
      sourceId: request.body.sourceId,
      triggerMode: "manual",
    });

    await enqueueImportJob({
      jobId: job.id,
      mode: "source",
      sourceId: request.body.sourceId,
      triggerMode: "manual",
    });

    response.status(202).json({
      jobId: job.id,
      status: job.status,
    });
  }

  public async uploadImport(request: Request, response: Response) {
    const job = await importManager.createJob({
      sourceId: request.body.sourceId,
      triggerMode: "upload",
    });

    await enqueueImportJob({
      jobId: job.id,
      mode: "upload",
      sourceId: request.body.sourceId,
      triggerMode: "upload",
      upload: request.body,
    });

    response.status(202).json({
      jobId: job.id,
      status: job.status,
    });
  }

  public async listJobs(request: Request, response: Response) {
    const jobs = await importsService.listJobs(request.query as unknown as Parameters<ImportsService["listJobs"]>[0]);
    response.status(200).json({ items: jobs });
  }

  public async getJobDetail(request: Request, response: Response) {
    const job = await importsService.getJobDetail(getParam(request, "id"));
    response.status(200).json(job);
  }

  public async listLogs(request: Request, response: Response) {
    const logs = await importsService.listLogs(request.query as unknown as Parameters<ImportsService["listLogs"]>[0]);
    response.status(200).json({ items: logs });
  }
}

type ImportsService = typeof importsService;

export const importsController = new ImportsController();
