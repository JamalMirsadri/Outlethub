import type { NextFunction, Request, Response } from "express";

import { redis } from "../config/redis.js";
import { ApiError } from "../utils/api-error.js";

export function rateLimit(prefix: string, limit: number, windowSeconds: number) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      if (!redis) {
        next();
        return;
      }

      const ipAddress = request.ip || "unknown";
      const key = `${prefix}:${ipAddress}`;
      const hits = await redis.incr(key);

      if (hits === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (hits > limit) {
        next(new ApiError(429, "Too many requests. Please try again later."));
        return;
      }

      next();
    } catch (error: unknown) {
      next(error);
    }
  };
}
