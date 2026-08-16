import { Router } from "express";

import { asyncHandler } from "../../utils/async-handler.js";
import { attachOptionalAuth, requireAuth } from "../../middleware/auth.middleware.js";
import { rateLimit } from "../../middleware/rate-limit.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { authController } from "./auth.controller.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  rateLimit("auth:register", 10, 60),
  validateBody(registerSchema),
  asyncHandler(authController.register.bind(authController)),
);

authRouter.post(
  "/login",
  rateLimit("auth:login", 10, 60),
  validateBody(loginSchema),
  asyncHandler(authController.login.bind(authController)),
);

authRouter.post(
  "/refresh",
  rateLimit("auth:refresh", 30, 60),
  asyncHandler(authController.refresh.bind(authController)),
);

authRouter.post(
  "/logout",
  attachOptionalAuth,
  asyncHandler(authController.logout.bind(authController)),
);

authRouter.post(
  "/activity",
  rateLimit("auth:activity", 120, 60),
  requireAuth,
  asyncHandler(authController.activity.bind(authController)),
);

authRouter.post(
  "/forgot-password",
  rateLimit("auth:forgot-password", 5, 60),
  validateBody(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword.bind(authController)),
);

authRouter.post(
  "/reset-password",
  rateLimit("auth:reset-password", 5, 60),
  validateBody(resetPasswordSchema),
  asyncHandler(authController.resetPassword.bind(authController)),
);

authRouter.post(
  "/verify-email",
  rateLimit("auth:verify-email", 10, 60),
  validateBody(verifyEmailSchema),
  asyncHandler(authController.verifyEmail.bind(authController)),
);

authRouter.post(
  "/resend-verification",
  rateLimit("auth:resend-verification", 5, 60),
  validateBody(resendVerificationSchema),
  asyncHandler(authController.resendVerification.bind(authController)),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(authController.me.bind(authController)),
);
