import type { NextFunction, Request, Response } from "express";

import { hasTraversalAttempt, isSensitiveFilePath, safeDecode } from "../modules/system-logs/security-detection.js";
import { securityResponseService } from "../modules/system-logs/security-response.service.js";

/**
 * Blocks requests that attempt to read or download sensitive files (dotfiles,
 * credentials, private keys, backups, databases) or that use path-traversal
 * to escape the intended static roots. Runs before static serving and routes.
 *
 * A blocked request is still recorded by the security inspection middleware,
 * which runs earlier in the pipeline and logs it as SENSITIVE_FILE_PROBE or
 * PATH_TRAVERSAL on response finish. In addition, escalation telemetry is
 * emitted so *repeated* malicious sensitive-file/traversal activity can
 * eventually participate in the graduated block policy — a single probe is
 * never auto-blocked.
 */
export function sensitiveFileGuardMiddleware(request: Request, response: Response, next: NextFunction): void {
  try {
    const rawUrl = request.originalUrl || request.url || "/";
    const decoded = safeDecode(rawUrl);
    const decodedPath = decoded.split("?")[0]?.split("#")[0] ?? "/";

    if (hasTraversalAttempt(rawUrl) || hasTraversalAttempt(decoded) || isSensitiveFilePath(decodedPath)) {
      const clientIp = request.clientIp;
      const detection = request.securityDetection;

      if (clientIp && detection) {
        void securityResponseService
          .recordProbeAndEscalate(
            {
              attackType: detection.attackType,
              confidence: detection.confidence,
              severity: detection.severity,
              source: detection.source,
            },
            {
              ip: clientIp.ip,
              ipVersion: clientIp.version,
              path: decodedPath,
              method: request.method,
              userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null,
              requestId: request.id ?? null,
            },
          )
          .catch(() => undefined);
      }

      response.status(404).type("text/plain").send("Not Found");
      return;
    }
  } catch {
    // Guard must never break the request lifecycle; fall through to next.
  }

  next();
}
