import type { ErrorLogSeverity, RoleCode } from "@prisma/client";

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
      securityDetection?: {
        attackType: string;
        confidence: string;
        severity: ErrorLogSeverity;
        source: string;
      };
    }
  }
}

export {};
