import type { Request, Response } from "express";

import { env } from "../../config/env.js";
import { authService } from "./auth.service.js";

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api/v1/auth",
};

function setRefreshTokenCookie(response: Response, refreshToken: string): void {
  response.cookie(env.REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...refreshCookieOptions,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

function clearRefreshTokenCookie(response: Response): void {
  response.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, refreshCookieOptions);
}

export class AuthController {
  public async register(request: Request, response: Response): Promise<void> {
    const result = await authService.register(request.body);
    setRefreshTokenCookie(response, result.refreshToken);

    response.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  }

  public async login(request: Request, response: Response): Promise<void> {
    const result = await authService.login(request.body);
    setRefreshTokenCookie(response, result.refreshToken);

    response.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  }

  public async refresh(request: Request, response: Response): Promise<void> {
    const refreshToken = request.cookies[env.REFRESH_TOKEN_COOKIE_NAME] as string | undefined;
    const result = await authService.refresh(refreshToken ?? "");
    setRefreshTokenCookie(response, result.refreshToken);

    response.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  }

  public async logout(request: Request, response: Response): Promise<void> {
    const refreshToken = request.cookies[env.REFRESH_TOKEN_COOKIE_NAME] as string | undefined;
    await authService.logout(refreshToken);
    clearRefreshTokenCookie(response);
    response.status(204).send();
  }

  public async forgotPassword(request: Request, response: Response): Promise<void> {
    await authService.forgotPassword(request.body);
    response.status(202).json({
      message: "If an account exists for that email, a reset link will be sent shortly.",
    });
  }

  public async resetPassword(request: Request, response: Response): Promise<void> {
    await authService.resetPassword(request.body);
    response.status(200).json({
      message: "Password has been reset successfully.",
    });
  }

  public async verifyEmail(request: Request, response: Response): Promise<void> {
    await authService.verifyEmail(request.body);
    response.status(200).json({
      message: "Email verified successfully.",
    });
  }

  public async resendVerification(request: Request, response: Response): Promise<void> {
    await authService.resendVerification(request.body);
    response.status(202).json({
      message: "If the account needs verification, a new email has been sent.",
    });
  }

  public async me(request: Request, response: Response): Promise<void> {
    const user = await authService.getCurrentUser(request.auth!.userId);
    response.status(200).json({ user });
  }

  public async listAdminUsers(request: Request, response: Response): Promise<void> {
    const result = await authService.listAdminUsers(request.query as never);
    response.status(200).json(result);
  }

  public async getAdminUserDetail(request: Request, response: Response): Promise<void> {
    const result = await authService.getAdminUserDetail(String(request.params.id));
    response.status(200).json(result);
  }

  public async updateAdminUserStatus(request: Request, response: Response): Promise<void> {
    const result = await authService.updateAdminUserStatus(
      request.auth!.userId,
      String(request.params.id),
      request.body,
    );
    response.status(200).json(result);
  }

  public async resetAdminUserPassword(request: Request, response: Response): Promise<void> {
    await authService.adminResetUserPassword(request.auth!.userId, String(request.params.id), request.body);
    response.status(200).json({
      message: "User password updated successfully.",
    });
  }

  public async revokeAdminUserSessions(request: Request, response: Response): Promise<void> {
    await authService.revokeAdminUserSessions(request.auth!.userId, String(request.params.id));
    response.status(200).json({
      message: "User sessions revoked successfully.",
    });
  }

  public async deleteAdminUser(request: Request, response: Response): Promise<void> {
    const result = await authService.deleteAdminUser(request.auth!.userId, String(request.params.id));
    response.status(200).json(result);
  }
}

export const authController = new AuthController();
