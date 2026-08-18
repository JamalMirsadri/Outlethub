export type AppRole = "SUPER_ADMIN" | "ADMIN" | "CUSTOMER";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  emailVerified: boolean;
}

export interface AuthErrorState {
  type: "auth_required" | "forbidden" | "unknown";
  message: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  sessionInactivityTimeoutMs: number;
}

export interface RegisterPayload {
  email: string;
  password: string;
  confirmPassword: string;
  fullName?: string;
  referralCode?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}
