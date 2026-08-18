import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  role: string;
  email: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: "refresh";
}

export function parseDurationToMilliseconds(duration: string): number {
  const match = duration.match(/^(\d+)([mhd])$/i);
  if (!match) {
    throw new Error(`Unsupported duration format: ${duration}`);
  }

  const [, rawValue, rawUnit] = match;
  const value = Number(rawValue);
  const unit = rawUnit?.toLowerCase();

  if (!Number.isFinite(value) || !unit) {
    throw new Error(`Unsupported duration format: ${duration}`);
  }

  const multiplier =
    unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;

  return value * multiplier;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      ...payload,
      type: "access",
    },
    env.JWT_ACCESS_SECRET,
    options,
  );
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "type">): string {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      ...payload,
      type: "refresh",
    },
    env.JWT_REFRESH_SECRET,
    options,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
