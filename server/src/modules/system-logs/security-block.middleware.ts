import type { NextFunction, Request, Response } from "express";
import { ErrorLogSeverity, ErrorLogType, SecurityMitigationAction } from "@prisma/client";

import { securityResponseService } from "./security-response.service.js";
import { errorLogger } from "./system-logs.service.js";

function logEnforced(request: Request, blockId: string | undefined, statusCode: 403 | 429): void {
  const detection = request.securityDetection;
  errorLogger.capture({
    type: ErrorLogType.SECURITY_SCAN,
    severity: detection?.severity ?? ErrorLogSeverity.HIGH,
    message: `Rejected request from ${request.clientIp?.ip ?? "unknown"} (${blockId ?? "security mitigation"})`,
    source: "Security response",
    attackType: detection?.attackType ?? "SECURITY_BLOCK",
    confidence: detection?.confidence ?? null,
    securityAction:
      statusCode === 403 ? SecurityMitigationAction.BLOCK_ENFORCED : SecurityMitigationAction.RATE_LIMITED,
    blockId: blockId ?? null,
    endpoint: request.originalUrl || request.url,
    method: request.method,
    statusCode,
    ip: request.clientIp?.ip ?? null,
    requestId: request.id ?? null,
    userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null,
  });
}

/**
 * Rejects requests from actively blocked IPs before static serving and routes.
 * Runs for every request; the block lookup is a single fast Redis read.
 */
export function securityBlockEnforcementMiddleware(request: Request, response: Response, next: NextFunction): void {
  const ip = request.clientIp?.ip;
  if (!ip) {
    next();
    return;
  }

  securityResponseService
    .isBlocked(ip)
    .then(({ blocked, blockId }) => {
      if (blocked) {
        logEnforced(request, blockId, 403);
        response.status(403).type("text/plain").send("Forbidden");
        return;
      }

      next();
    })
    .catch(() => next());
}

/**
 * Evaluates a detected attack against the graduated mitigation policy and
 * applies RATE_LIMIT (429) or TEMP_BLOCK (403). Only runs when a detection is
 * present, so normal traffic is never impacted beyond the block lookup.
 */
export function securityMitigationMiddleware(request: Request, response: Response, next: NextFunction): void {
  const detection = request.securityDetection;
  const ip = request.clientIp?.ip;

  if (!detection || !ip) {
    next();
    return;
  }

  securityResponseService
    .evaluate(
      {
        attackType: detection.attackType,
        confidence: detection.confidence,
        severity: detection.severity,
        source: detection.source,
      },
      {
        ip,
        ipVersion: request.clientIp?.version ?? "IPv4",
        path: request.originalUrl || request.url || "/",
        method: request.method,
        userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null,
        requestId: request.id ?? null,
      },
    )
    .then((result) => {
      if (result.decision === "TEMP_BLOCK") {
        request.securityBlockId = result.blockId;
        logEnforced(request, result.blockId, 403);
        response.status(403).type("text/plain").send("Forbidden");
        return;
      }

      if (result.decision === "RATE_LIMIT") {
        logEnforced(request, undefined, 429);
        response.status(429).type("text/plain").send("Too Many Requests");
        return;
      }

      next();
    })
    .catch(() => next());
}
