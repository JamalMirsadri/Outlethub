import type { RoleCode } from "@prisma/client";

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
    }
  }
}

export {};
