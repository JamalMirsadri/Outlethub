import { UserStatus } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
    fullName: z.string().min(2).max(100).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  sort: z.enum(["newest", "oldest", "lastLogin"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const adminUserIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const adminUpdateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus).refine((status) => status !== "PENDING", {
    message: "Admin status updates must use ACTIVE, SUSPENDED, or DELETED.",
  }),
});

export const adminResetUserPasswordSchema = z
  .object({
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type AdminUsersQueryInput = z.infer<typeof adminUsersQuerySchema>;
export type AdminUserStatusInput = z.infer<typeof adminUpdateUserStatusSchema>;
export type AdminResetUserPasswordInput = z.infer<typeof adminResetUserPasswordSchema>;
