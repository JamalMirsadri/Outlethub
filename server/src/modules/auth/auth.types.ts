import type { RoleCode } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  role: RoleCode;
  emailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  sessionInactivityTimeoutMs: number;
}
