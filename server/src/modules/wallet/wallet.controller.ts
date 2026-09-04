import type { Request, Response } from "express";
import { WalletStatus, WithdrawalStatus } from "@prisma/client";

import { walletService } from "./wallet.service.js";

function getAuthUserId(request: Request): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new Error("Authentication is required.");
  }

  return userId;
}

function getParam(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || !value.length) {
    throw new Error(`Missing route param: ${key}`);
  }

  return value;
}

export class WalletController {
  public async getOwnWallet(request: Request, response: Response) {
    response.status(200).json(await walletService.getOwnWallet(getAuthUserId(request)));
  }

  public async listOwnTransactions(request: Request, response: Response) {
    const page = Number(request.query.page ?? 1);
    const pageSize = Number(request.query.pageSize ?? 20);
    response.status(200).json(await walletService.listOwnTransactions(getAuthUserId(request), page, pageSize));
  }

  public async requestWithdrawal(request: Request, response: Response) {
    const withdrawal = await walletService.requestWithdrawal(getAuthUserId(request), String(request.body.amount));
    response.status(201).json(withdrawal);
  }

  public async listWallets(request: Request, response: Response) {
    const query = request.query as unknown as {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: WalletStatus;
    };
    response.status(200).json(
      await walletService.listWallets({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        search: query.search,
        status: query.status,
      }),
    );
  }

  public async getWallet(request: Request, response: Response) {
    response.status(200).json(await walletService.getWalletByPublicId(getParam(request, "walletId")));
  }

  public async creditWallet(request: Request, response: Response) {
    const result = await walletService.adminCredit({
      walletId: getParam(request, "walletId"),
      amount: String(request.body.amount),
      reason: request.body.reason,
      reference: request.body.reference ?? null,
      actorUserId: getAuthUserId(request),
    });
    response.status(200).json(result);
  }

  public async debitWallet(request: Request, response: Response) {
    const result = await walletService.adminDebit({
      walletId: getParam(request, "walletId"),
      amount: String(request.body.amount),
      reason: request.body.reason,
      reference: request.body.reference ?? null,
      actorUserId: getAuthUserId(request),
    });
    response.status(200).json(result);
  }

  public async suspendWallet(request: Request, response: Response) {
    const wallet = await walletService.setWalletStatus(
      getParam(request, "walletId"),
      WalletStatus.SUSPENDED,
      getAuthUserId(request),
      request.body.reason ?? null,
    );
    response.status(200).json(wallet);
  }

  public async activateWallet(request: Request, response: Response) {
    const wallet = await walletService.setWalletStatus(
      getParam(request, "walletId"),
      WalletStatus.ACTIVE,
      getAuthUserId(request),
      request.body.reason ?? null,
    );
    response.status(200).json(wallet);
  }

  public async adminOverview(_request: Request, response: Response) {
    response.status(200).json(await walletService.adminOverview());
  }

  public async listWithdrawals(request: Request, response: Response) {
    const query = request.query as unknown as {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: WithdrawalStatus;
    };
    response.status(200).json(
      await walletService.listWithdrawals({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        search: query.search,
        status: query.status,
      }),
    );
  }

  public async approveWithdrawal(request: Request, response: Response) {
    const result = await walletService.approveWithdrawal(
      getParam(request, "id"),
      getAuthUserId(request),
      request.body.adminNote ?? null,
    );
    response.status(200).json(result);
  }

  public async rejectWithdrawal(request: Request, response: Response) {
    const result = await walletService.rejectWithdrawal(
      getParam(request, "id"),
      getAuthUserId(request),
      request.body.adminNote ?? null,
    );
    response.status(200).json(result);
  }

  public async cancelWithdrawal(request: Request, response: Response) {
    const result = await walletService.cancelWithdrawal(
      getParam(request, "id"),
      getAuthUserId(request),
      request.body.adminNote ?? null,
    );
    response.status(200).json(result);
  }

  public async completeWithdrawal(request: Request, response: Response) {
    const result = await walletService.completeWithdrawal(
      getParam(request, "id"),
      getAuthUserId(request),
      request.body.adminNote ?? null,
    );
    response.status(200).json(result);
  }
}

export const walletController = new WalletController();
