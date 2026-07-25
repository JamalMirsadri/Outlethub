import type { NextFunction, Request, Response } from "express";
import { RoleCode } from "@prisma/client";

import { prisma } from "../config/prisma.js";
import { verifyAccessToken } from "../services/jwt.service.js";
import { ApiError } from "../utils/api-error.js";

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.authorization;
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
}

function applyAuthFromToken(request: Request, accessToken: string): void {
  const payload = verifyAccessToken(accessToken);
  request.auth = {
    userId: payload.sub,
    email: payload.email,
    role: payload.role as RoleCode,
  };
}

export function requireAuth(request: Request, _response: Response, next: NextFunction): void {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    next(new ApiError(401, "Authentication is required."));
    return;
  }

  try {
    applyAuthFromToken(request, accessToken);
    void prisma.user
      .findUnique({
        where: { id: request.auth!.userId },
        select: {
          status: true,
        },
      })
      .then((user) => {
        if (!user || user.status !== "ACTIVE") {
          next(new ApiError(403, "Your account is not active."));
          return;
        }

        next();
      })
      .catch((error: unknown) => {
        next(new ApiError(401, "Access token is invalid or expired.", error));
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
    void prisma.user
      .findUnique({
        where: { id: request.auth!.userId },
        select: {
          status: true,
        },
      })
      .then((user) => {
        if (!user || user.status !== "ACTIVE") {
          request.auth = undefined;
          next();
          return;
        }

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
