import type { Request, Response } from "express";
import { ReferralCommissionStatus, ReferralRank } from "@prisma/client";

import { referralCommissionService } from "./referral-commission.service.js";

function getAuthUserId(request: Request): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new Error("Authentication is required.");
  }

  return userId;
}

export class ReferralCommissionController {
  public async getUserReferralSummary(request: Request, response: Response) {
    response.status(200).json(await referralCommissionService.getUserReferralSummary(getAuthUserId(request)));
  }

  public async listOwnCommissions(request: Request, response: Response) {
    const page = Number(request.query.page ?? 1);
    const pageSize = Number(request.query.pageSize ?? 20);
    response.status(200).json(
      await referralCommissionService.listCommissions({
        page,
        pageSize,
        referrerUserId: getAuthUserId(request),
      }),
    );
  }

  public async getAdminOverview(_request: Request, response: Response) {
    response.status(200).json(await referralCommissionService.getAdminOverview());
  }

  public async listCommissions(request: Request, response: Response) {
    const query = request.query as unknown as {
      page?: number;
      pageSize?: number;
      referrerUserId?: string;
      rank?: ReferralRank;
      orderId?: string;
      status?: ReferralCommissionStatus;
      from?: string;
      to?: string;
    };
    response.status(200).json(
      await referralCommissionService.listCommissions({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        referrerUserId: query.referrerUserId,
        rank: query.rank,
        orderId: query.orderId,
        status: query.status,
        from: query.from,
        to: query.to,
      }),
    );
  }

  public async getCommissionConfig(_request: Request, response: Response) {
    response.status(200).json({ items: await referralCommissionService.getConfigs() });
  }

  public async updateCommissionConfig(request: Request, response: Response) {
    response.status(200).json(
      await referralCommissionService.updateConfig(getAuthUserId(request), request.body),
    );
  }
}

export const referralCommissionController = new ReferralCommissionController();
