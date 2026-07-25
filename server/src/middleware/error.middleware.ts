import type { NextFunction, Request, Response } from "express";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ZodError } from "zod";

import { ApiError } from "../utils/api-error.js";

// #region debug-point A:global-error
const DEBUG_SESSION_ID = "payment-runtime-blockers";

function resolveDebugServerUrl() {
  if (process.env.DEBUG_SERVER_URL) {
    return process.env.DEBUG_SERVER_URL;
  }

  const debugEnvPath = resolve(process.cwd(), ".dbg", `${DEBUG_SESSION_ID}.env`);
  if (!existsSync(debugEnvPath)) {
    return "http://127.0.0.1:7777/event";
  }

  const debugEnvContent = readFileSync(debugEnvPath, "utf8");
  const debugUrl = debugEnvContent
    .split(/\r?\n/)
    .find((line) => line.startsWith("DEBUG_SERVER_URL="))
    ?.slice("DEBUG_SERVER_URL=".length)
    .trim();

  return debugUrl || "http://127.0.0.1:7777/event";
}

function reportDebugEvent(payload: Record<string, unknown>) {
  void fetch(resolveDebugServerUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
      source: "server:error-middleware",
      ...payload,
    }),
  }).catch(() => undefined);
}
// #endregion debug-point A:global-error

export function notFoundMiddleware(request: Request, _response: Response, next: NextFunction): void {
  next(new ApiError(404, `Route not found: ${request.method} ${request.originalUrl}`));
}

export function errorMiddleware(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    // #region debug-point A:error-zod
    reportDebugEvent({
      hypothesisId: "A",
      message: "[DEBUG] Zod error response",
      data: {
        method: _request.method,
        url: _request.originalUrl,
        issues: error.flatten(),
      },
    });
    // #endregion debug-point A:error-zod
    response.status(400).json({
      message: "Validation failed.",
      issues: error.flatten(),
    });
    return;
  }

  if (error instanceof ApiError) {
    // #region debug-point A:error-api
    reportDebugEvent({
      hypothesisId: error.statusCode === 503 ? "B" : "A",
      message: "[DEBUG] ApiError response",
      data: {
        method: _request.method,
        url: _request.originalUrl,
        statusCode: error.statusCode,
        message: error.message,
        details: error.details ?? null,
      },
    });
    // #endregion debug-point A:error-api
    response.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
    return;
  }

  // #region debug-point A:error-unknown
  reportDebugEvent({
    hypothesisId: "A",
    message: "[DEBUG] Unknown error response",
    data: {
      method: _request.method,
      url: _request.originalUrl,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : { value: String(error) },
    },
  });
  // #endregion debug-point A:error-unknown
  console.error(error);
  response.status(500).json({
    message: "Internal server error.",
  });
}
