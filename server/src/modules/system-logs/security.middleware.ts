import type { NextFunction, Request, Response } from "express";

import { detectBodyThreat, detectThreat } from "./security-detection.js";
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
          blockId: request.securityBlockId ?? null,
        });
      });
    }
  } catch {
    // Security inspection must never break the request lifecycle.
  }

  next();
}

/**
 * Second detection pass for parsed request bodies. Runs after body parsing and
 * before application routes. It never logs the body, only a generic
 * classification. URL/query/UA detection takes precedence when present.
 */
export function securityBodyInspectionMiddleware(request: Request, response: Response, next: NextFunction): void {
  if (request.securityDetection) {
    next();
    return;
  }

  try {
    if (request.body == null) {
      next();
      return;
    }

    const detection = detectBodyThreat(request.body);
    if (!detection) {
      next();
      return;
    }

    request.securityDetection = detection;
    const context = buildRequestContext(request);
    const url = request.originalUrl || request.url || "/";
    const userAgent = typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null;

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
        message: `Detected ${detection.attackType} in request body: ${request.method} ${url}`,
        blockId: request.securityBlockId ?? null,
      });
    });
  } catch {
    // Body inspection must never break the request lifecycle.
  }

  next();
}
