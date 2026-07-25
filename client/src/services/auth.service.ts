import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
} from "@/types/auth";
import { http } from "@/services/http";

interface MessageResponse {
  message: string;
}

interface MeResponse {
  user: AuthResponse["user"];
}

const ACCESS_TOKEN_KEY = "outlethub_access_token";

export function getAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await http<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAccessToken(response.accessToken);
  return response;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await http<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAccessToken(response.accessToken);
  return response;
}

export async function refreshSession(): Promise<AuthResponse> {
  const response = await http<AuthResponse>("/auth/refresh", {
    method: "POST",
  });
  setAccessToken(response.accessToken);
  return response;
}

export async function logout(): Promise<void> {
  try {
    await http<void>("/auth/logout", {
      method: "POST",
      token: getAccessToken(),
    });
  } finally {
    setAccessToken(null);
  }
}

export async function getCurrentUser(): Promise<MeResponse["user"]> {
  const response = await http<MeResponse>("/auth/me", {
    token: getAccessToken(),
  });
  return response.user;
}

export async function forgotPassword(email: string): Promise<MessageResponse> {
  return http<MessageResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<MessageResponse> {
  return http<MessageResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyEmail(token: string): Promise<MessageResponse> {
  return http<MessageResponse>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(email: string): Promise<MessageResponse> {
  return http<MessageResponse>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
