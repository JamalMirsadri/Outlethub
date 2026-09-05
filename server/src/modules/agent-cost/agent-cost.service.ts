import { Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import {
  AGENT_COST_CONFIG_ID,
  DEFAULT_AGENT_COST_CONFIG,
  calculateAgentCost,
  type AgentCostConfig,
} from "./agent-cost.logic.js";

function money(value: Prisma.Decimal | string | number | null | undefined): string {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

type AgentCostConfigRow = {
  id: string;
  firstProductFee: Prisma.Decimal;
  secondProductFee: Prisma.Decimal;
  thirdProductFee: Prisma.Decimal;
  fourthProductFee: Prisma.Decimal;
  fifthProductFee: Prisma.Decimal;
  sixthProductFee: Prisma.Decimal;
  additionalProductFee: Prisma.Decimal;
  threshold: number;
  updatedByUserId: string | null;
  updatedAt: Date;
};

export class AgentCostService {
  private async ensureConfigRow(tx: Prisma.TransactionClient): Promise<AgentCostConfigRow> {
    await tx.agentCostConfig.upsert({
      where: { id: AGENT_COST_CONFIG_ID },
      update: {},
      create: {
        id: AGENT_COST_CONFIG_ID,
        firstProductFee: new Prisma.Decimal(DEFAULT_AGENT_COST_CONFIG.firstProductFee),
        secondProductFee: new Prisma.Decimal(DEFAULT_AGENT_COST_CONFIG.secondProductFee),
        thirdProductFee: new Prisma.Decimal(DEFAULT_AGENT_COST_CONFIG.thirdProductFee),
        fourthProductFee: new Prisma.Decimal(DEFAULT_AGENT_COST_CONFIG.fourthProductFee),
        fifthProductFee: new Prisma.Decimal(DEFAULT_AGENT_COST_CONFIG.fifthProductFee),
        sixthProductFee: new Prisma.Decimal(DEFAULT_AGENT_COST_CONFIG.sixthProductFee),
        additionalProductFee: new Prisma.Decimal(DEFAULT_AGENT_COST_CONFIG.additionalProductFee),
        threshold: DEFAULT_AGENT_COST_CONFIG.threshold,
      },
    });

    return tx.agentCostConfig.findUniqueOrThrow({ where: { id: AGENT_COST_CONFIG_ID } });
  }

  public async calculateAgentCost(quantity: number): Promise<Prisma.Decimal> {
    const config = await prisma.$transaction(async (tx) => this.ensureConfigRow(tx));
    return calculateAgentCost(quantity, config);
  }

  public async getAgentCostConfig() {
    const config = await prisma.$transaction(async (tx) => this.ensureConfigRow(tx));

    const updatedByUser = config.updatedByUserId
      ? await prisma.user.findUnique({
          where: { id: config.updatedByUserId },
          select: { id: true, email: true },
        })
      : null;

    return {
      id: config.id,
      firstProductFee: money(config.firstProductFee),
      secondProductFee: money(config.secondProductFee),
      thirdProductFee: money(config.thirdProductFee),
      fourthProductFee: money(config.fourthProductFee),
      fifthProductFee: money(config.fifthProductFee),
      sixthProductFee: money(config.sixthProductFee),
      additionalProductFee: money(config.additionalProductFee),
      threshold: config.threshold,
      updatedByUserId: config.updatedByUserId,
      updatedByEmail: updatedByUser?.email ?? null,
      updatedAt: config.updatedAt,
      preview: [1, 2, 3, 4, 5, 6, 7, 8].map((quantity) => ({
        quantity,
        amount: money(calculateAgentCost(quantity, config)),
      })),
    };
  }

  public async updateAgentCostConfig(
    actorUserId: string,
    input: {
      firstProductFee: string;
      secondProductFee: string;
      thirdProductFee: string;
      fourthProductFee: string;
      fifthProductFee: string;
      sixthProductFee: string;
      additionalProductFee: string;
      threshold: number;
    },
  ) {
    const amountFields: Array<[string, string]> = [
      ["firstProductFee", input.firstProductFee],
      ["secondProductFee", input.secondProductFee],
      ["thirdProductFee", input.thirdProductFee],
      ["fourthProductFee", input.fourthProductFee],
      ["fifthProductFee", input.fifthProductFee],
      ["sixthProductFee", input.sixthProductFee],
      ["additionalProductFee", input.additionalProductFee],
    ];

    for (const [label, value] of amountFields) {
      const parsed = new Prisma.Decimal(value);
      if (!parsed.isFinite() || parsed.isNegative()) {
        throw new ApiError(400, `${label} must be a non-negative amount.`);
      }
    }

    if (!Number.isInteger(input.threshold) || input.threshold < 1 || input.threshold > 6) {
      throw new ApiError(400, "Threshold must be an integer between 1 and 6.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await this.ensureConfigRow(tx);

      const result = await tx.agentCostConfig.update({
        where: { id: AGENT_COST_CONFIG_ID },
        data: {
          firstProductFee: new Prisma.Decimal(input.firstProductFee),
          secondProductFee: new Prisma.Decimal(input.secondProductFee),
          thirdProductFee: new Prisma.Decimal(input.thirdProductFee),
          fourthProductFee: new Prisma.Decimal(input.fourthProductFee),
          fifthProductFee: new Prisma.Decimal(input.fifthProductFee),
          sixthProductFee: new Prisma.Decimal(input.sixthProductFee),
          additionalProductFee: new Prisma.Decimal(input.additionalProductFee),
          threshold: input.threshold,
          updatedByUserId: actorUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          actorType: "USER",
          action: "AGENT_COST_CONFIG_UPDATED",
          entityType: "agent_cost_config",
          entityId: AGENT_COST_CONFIG_ID,
          metadata: {
            firstProductFee: money(result.firstProductFee),
            secondProductFee: money(result.secondProductFee),
            thirdProductFee: money(result.thirdProductFee),
            fourthProductFee: money(result.fourthProductFee),
            fifthProductFee: money(result.fifthProductFee),
            sixthProductFee: money(result.sixthProductFee),
            additionalProductFee: money(result.additionalProductFee),
            threshold: result.threshold,
          },
        },
      });

      return result;
    });

    return {
      id: updated.id,
      firstProductFee: money(updated.firstProductFee),
      secondProductFee: money(updated.secondProductFee),
      thirdProductFee: money(updated.thirdProductFee),
      fourthProductFee: money(updated.fourthProductFee),
      fifthProductFee: money(updated.fifthProductFee),
      sixthProductFee: money(updated.sixthProductFee),
      additionalProductFee: money(updated.additionalProductFee),
      threshold: updated.threshold,
      updatedByUserId: updated.updatedByUserId,
      updatedAt: updated.updatedAt,
    };
  }
}

export const agentCostService = new AgentCostService();
