import type { Request, Response } from "express";
import { MultiLevelReferralPointStatus } from "@prisma/client";

import { referralAdminService } from "./referral-admin.service.js";

function getAuthUserId(request: Request): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new Error("Authentication is required.");
  }

  return userId;
}

export class ReferralAdminController {
  public async getPointSettings(_request: Request, response: Response) {
    response.status(200).json(await referralAdminService.getPointSettings());
  }

  public async updatePointSettings(request: Request, response: Response) {
    response.status(200).json(
      await referralAdminService.updatePointSettings(getAuthUserId(request), request.body),
    );
  }

  public async listPointRewards(request: Request, response: Response) {
    const query = request.query as unknown as {
      page?: number;
      pageSize?: number;
      purchaserUserId?: string;
      beneficiaryUserId?: string;
      level?: number;
      status?: MultiLevelReferralPointStatus;
      from?: string;
      to?: string;
    };

    response.status(200).json(
      await referralAdminService.listPointRewards({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        purchaserUserId: query.purchaserUserId,
        beneficiaryUserId: query.beneficiaryUserId,
        level: query.level,
        status: query.status,
        from: query.from,
        to: query.to,
      }),
    );
  }

  public async getAdminReferralOverview(_request: Request, response: Response) {
    response.status(200).json(await referralAdminService.getAdminReferralOverview());
  }
}

export const referralAdminController = new ReferralAdminController();
