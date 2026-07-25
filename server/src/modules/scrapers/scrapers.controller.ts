import type { Request, Response } from "express";

import { enqueueScraperRun } from "./scraper-queue.js";
import { scraperManager } from "./scraper-manager.js";
import { scrapersService } from "./scrapers.service.js";

function getParam(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || !value.length) {
    throw new Error(`Missing route param: ${key}`);
  }

  return value;
}

export class ScrapersController {
  public async getDashboardSummary(_request: Request, response: Response) {
    const summary = await scrapersService.getDashboardSummary();
    const sources = await scrapersService.listSources();
    response.status(200).json({ summary, sources });
  }

  public async listSources(_request: Request, response: Response) {
    const sources = await scrapersService.listSources();
    response.status(200).json({ items: sources });
  }

  public async createSource(request: Request, response: Response) {
    const source = await scrapersService.createSource(request.body);
    response.status(201).json(source);
  }

  public async updateSource(request: Request, response: Response) {
    const source = await scrapersService.updateSource(getParam(request, "id"), request.body);
    response.status(200).json(source);
  }

  public async deleteSource(request: Request, response: Response) {
    await scrapersService.deleteSource(getParam(request, "id"));
    response.status(204).send();
  }

  public async runScraper(request: Request, response: Response) {
    const run = await scraperManager.createRun({
      sourceId: request.body.sourceId,
    });

    await enqueueScraperRun({
      runId: run.id,
    });

    response.status(202).json({
      runId: run.id,
      status: run.status,
    });
  }

  public async listRuns(request: Request, response: Response) {
    const runs = await scrapersService.listRuns(request.query as unknown as Parameters<ScrapersService["listRuns"]>[0]);
    response.status(200).json({ items: runs });
  }
}

type ScrapersService = typeof scrapersService;

export const scrapersController = new ScrapersController();
