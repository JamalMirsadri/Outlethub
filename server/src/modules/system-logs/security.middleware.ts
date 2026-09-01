import type { NextFunction, Request, Response } from "express";

import { detectThreat } from "./security-detection.js";
import { securityService } from "./security.service.js";
import { buildRequestContext } from "./system-logs.context.js";

/**
 * Runs on every request and logs obvious attack signatures through the
 * existing System Logs pipeline. Detection is conservative and stateless, so
 * normal application traffic is never flagged.
 */
export function securityInspectionMiddleware(request: Request, response: Response, next: NextFunction): void {
  try {
    const url = request.originalUrl || request.url || "/";
    const queryIndex = url.indexOf("?");
    const path = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
    const query = queryIndex >= 0 ? url.slice(queryIndex + 1) : "";
    const userAgent = typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null;

    const detection = detectThreat({ path, query, method: request.method, userAgent });

    if (detection) {
      request.securityDetection = detection;
      const context = buildRequestContext(request);

      response.on("finish", () => {
        securityService.logThreat({
          attackType: detection.attackType,
          confidence: detection.confidence,
          severity: detection.severity,
          source: detection.source,
          ip: context.ip,
          method: request.method,
          path: url,
          statusCode: response.statusCode,
          userAgent,
          requestId: context.requestId,
        });
      });
    }
  } catch {
    // Security inspection must never break the request lifecycle.
  }

  next();
}
