import type { NextFunction, Request, Response } from "express";
import { RoleCode } from "@prisma/client";

import { prisma } from "../config/prisma.js";
import { verifyAccessToken } from "../services/jwt.service.js";
import { ApiError } from "../utils/api-error.js";
import { isSessionInactive } from "../modules/auth/session.utils.js";

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.authorization;
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
}

function applyAuthFromToken(request: Request, accessToken: string): void {
  const payload = verifyAccessToken(accessToken);
  request.auth = {
    userId: payload.sub,
    sessionId: payload.sid,
    email: payload.email,
    role: payload.role as RoleCode,
  };
}

async function validateSession(request: Request, touchActivity: boolean): Promise<void> {
  if (!request.auth?.sessionId) {
    throw new ApiError(401, "Access token is invalid or expired.");
  }

  const session = await prisma.refreshToken.findUnique({
    where: { id: request.auth.sessionId },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      lastActivityAt: true,
      user: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!session || session.userId !== request.auth.userId) {
    throw new ApiError(401, "Authentication session is invalid.");
  }

  if (session.revokedAt || session.expiresAt <= new Date()) {
    throw new ApiError(401, "Authentication session is invalid or expired.");
  }

  if (!session.user || session.user.status !== "ACTIVE") {
    throw new ApiError(403, "Your account is not active.");
  }

  if (isSessionInactive(session.lastActivityAt)) {
    await prisma.refreshToken.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
      },
    });
    throw new ApiError(401, "Authentication session expired due to inactivity.");
  }

  if (touchActivity) {
    await prisma.refreshToken.update({
      where: { id: session.id },
      data: {
        lastActivityAt: new Date(),
      },
    });
  }
}

export function requireAuth(request: Request, _response: Response, next: NextFunction): void {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    next(new ApiError(401, "Authentication is required."));
    return;
  }

  try {
    applyAuthFromToken(request, accessToken);
    void validateSession(request, true)
      .then(() => {
        next();
      })
      .catch((error: unknown) => {
        next(error instanceof ApiError ? error : new ApiError(401, "Access token is invalid or expired.", error));
      });
  } catch (error: unknown) {
    next(new ApiError(401, "Access token is invalid or expired.", error));
  }
}

export function attachOptionalAuth(request: Request, _response: Response, next: NextFunction): void {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    next();
    return;
  }

  try {
    applyAuthFromToken(request, accessToken);
    void validateSession(request, true)
      .then(() => {
        next();
      })
      .catch(() => {
        request.auth = undefined;
        next();
      });
  } catch {
    request.auth = undefined;
    next();
  }
}
