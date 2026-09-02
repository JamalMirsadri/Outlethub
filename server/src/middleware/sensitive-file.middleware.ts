import type { NextFunction, Request, Response } from "express";

import { hasTraversalAttempt, isSensitiveFilePath, safeDecode } from "../modules/system-logs/security-detection.js";

/**
 * Blocks requests that attempt to read or download sensitive files (dotfiles,
 * credentials, private keys, backups, databases) or that use path-traversal
 * to escape the intended static roots. Runs before static serving and routes.
 *
 * A blocked request is still recorded by the security inspection middleware,
 * which runs earlier in the pipeline and logs it as SENSITIVE_FILE_PROBE or
 * PATH_TRAVERSAL on response finish.
 */
export function sensitiveFileGuardMiddleware(request: Request, response: Response, next: NextFunction): void {
  try {
    const rawUrl = request.originalUrl || request.url || "/";
    const decoded = safeDecode(rawUrl);
    const decodedPath = decoded.split("?")[0]?.split("#")[0] ?? "/";

    if (hasTraversalAttempt(rawUrl) || hasTraversalAttempt(decoded) || isSensitiveFilePath(decodedPath)) {
      response.status(404).type("text/plain").send("Not Found");
      return;
    }
  } catch {
    // Guard must never break the request lifecycle; fall through to next.
  }

  next();
}
