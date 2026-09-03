import type { ErrorLogSeverity, RoleCode } from "@prisma/client";

import type { ResolvedClientIp } from "../modules/system-logs/client-ip.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
        email: string;
        role: RoleCode;
      };
      id?: string;
      startTime?: number;
      clientIp?: ResolvedClientIp;
      securityDetection?: {
        attackType: string;
        confidence: string;
        severity: ErrorLogSeverity;
        source: string;
      };
      securityBlockId?: string;
    }
  }
}

export {};
