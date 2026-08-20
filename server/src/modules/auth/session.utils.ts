import type { Request } from "express";

import { env } from "../../config/env.js";

export const SESSION_INACTIVITY_TIMEOUT_HOURS = 12;
export const SESSION_INACTIVITY_TIMEOUT_MS = SESSION_INACTIVITY_TIMEOUT_HOURS * 60 * 60_000;

export function isSessionInactive(lastActivityAt: Date, referenceDate = new Date()): boolean {
  return lastActivityAt.getTime() + SESSION_INACTIVITY_TIMEOUT_MS <= referenceDate.getTime();
}

export function getSessionContext(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwardedFor = request.headers["x-forwarded-for"];
  const ipAddress =
    typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0]?.trim() ?? null
      : request.ip ?? null;
  const userAgent = request.get("user-agent")?.trim() ?? null;

  return {
    ipAddress,
    userAgent,
  };
}
