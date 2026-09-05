import { Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import {
  calculateQuantityShipping,
  DEFAULT_SHIPPING_CONFIG,
  SHIPPING_CONFIG_ID,
  type QuantityShippingConfig,
} from "./shipping.logic.js";

function money(value: Prisma.Decimal | string | number | null | undefined): string {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

type ShippingConfigRow = {
  id: string;
  firstProductFee: Prisma.Decimal;
  secondProductFee: Prisma.Decimal;
  thirdProductFee: Prisma.Decimal;
  fourthProductFee: Prisma.Decimal;
  fifthProductFee: Prisma.Decimal;
  additionalProductFee: Prisma.Decimal;
  threshold: number;
  updatedByUserId: string | null;
  updatedAt: Date;
};

export class ShippingService {
  private async ensureConfigRow(tx: Prisma.TransactionClient): Promise<ShippingConfigRow> {
    await tx.shippingConfig.upsert({
      where: { id: SHIPPING_CONFIG_ID },
      update: {},
      create: {
        id: SHIPPING_CONFIG_ID,
        firstProductFee: new Prisma.Decimal(DEFAULT_SHIPPING_CONFIG.firstProductFee),
        secondProductFee: new Prisma.Decimal(DEFAULT_SHIPPING_CONFIG.secondProductFee),
        thirdProductFee: new Prisma.Decimal(DEFAULT_SHIPPING_CONFIG.thirdProductFee),
        fourthProductFee: new Prisma.Decimal(DEFAULT_SHIPPING_CONFIG.fourthProductFee),
        fifthProductFee: new Prisma.Decimal(DEFAULT_SHIPPING_CONFIG.fifthProductFee),
        additionalProductFee: new Prisma.Decimal(DEFAULT_SHIPPING_CONFIG.additionalProductFee),
        threshold: DEFAULT_SHIPPING_CONFIG.threshold,
      },
    });

    return tx.shippingConfig.findUniqueOrThrow({ where: { id: SHIPPING_CONFIG_ID } });
  }

  public async calculateShipping(quantity: number): Promise<Prisma.Decimal> {
    const config = await prisma.$transaction(async (tx) => this.ensureConfigRow(tx));
    return calculateQuantityShipping(quantity, config);
  }

  public async getShippingConfig() {
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
      additionalProductFee: money(config.additionalProductFee),
      threshold: config.threshold,
      updatedByUserId: config.updatedByUserId,
      updatedByEmail: updatedByUser?.email ?? null,
      updatedAt: config.updatedAt,
      preview: [1, 2, 3, 4, 5, 6, 7, 8].map((quantity) => ({
        quantity,
        amount: money(calculateQuantityShipping(quantity, config)),
      })),
    };
  }

  public async updateShippingConfig(
    actorUserId: string,
    input: {
      firstProductFee: string;
      secondProductFee: string;
      thirdProductFee: string;
      fourthProductFee: string;
      fifthProductFee: string;
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
      ["additionalProductFee", input.additionalProductFee],
    ];

    for (const [label, value] of amountFields) {
      const parsed = new Prisma.Decimal(value);
      if (!parsed.isFinite() || parsed.isNegative()) {
        throw new ApiError(400, `${label} must be a non-negative amount.`);
      }
    }

    if (!Number.isInteger(input.threshold) || input.threshold < 1 || input.threshold > 5) {
      throw new ApiError(400, "Threshold must be an integer between 1 and 5.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await this.ensureConfigRow(tx);

      const result = await tx.shippingConfig.update({
        where: { id: SHIPPING_CONFIG_ID },
        data: {
          firstProductFee: new Prisma.Decimal(input.firstProductFee),
          secondProductFee: new Prisma.Decimal(input.secondProductFee),
          thirdProductFee: new Prisma.Decimal(input.thirdProductFee),
          fourthProductFee: new Prisma.Decimal(input.fourthProductFee),
          fifthProductFee: new Prisma.Decimal(input.fifthProductFee),
          additionalProductFee: new Prisma.Decimal(input.additionalProductFee),
          threshold: input.threshold,
          updatedByUserId: actorUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          actorType: "USER",
          action: "SHIPPING_CONFIG_UPDATED",
          entityType: "shipping_config",
          entityId: SHIPPING_CONFIG_ID,
          metadata: {
            firstProductFee: money(result.firstProductFee),
            secondProductFee: money(result.secondProductFee),
            thirdProductFee: money(result.thirdProductFee),
            fourthProductFee: money(result.fourthProductFee),
            fifthProductFee: money(result.fifthProductFee),
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
      additionalProductFee: money(updated.additionalProductFee),
      threshold: updated.threshold,
      updatedByUserId: updated.updatedByUserId,
      updatedAt: updated.updatedAt,
    };
  }
}

export const shippingService = new ShippingService();
