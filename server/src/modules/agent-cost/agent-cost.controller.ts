import type { Request, Response } from "express";

import { agentCostService } from "./agent-cost.service.js";

function getAuthUserId(request: Request): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new Error("Authentication is required.");
  }

  return userId;
}

export class AgentCostController {
  public async getAgentCostConfig(_request: Request, response: Response) {
    response.status(200).json(await agentCostService.getAgentCostConfig());
  }

  public async updateAgentCostConfig(request: Request, response: Response) {
    response.status(200).json(
      await agentCostService.updateAgentCostConfig(getAuthUserId(request), request.body),
    );
  }
}

export const agentCostController = new AgentCostController();
