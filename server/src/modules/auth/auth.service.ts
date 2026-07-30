import { PaymentStatus, Prisma, RoleCode, UserStatus } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { createNumericCode, createRandomToken, hashToken } from "../../utils/crypto.js";
import { comparePassword, hashPassword } from "../../services/password.service.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../services/jwt.service.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { referralService } from "../commerce/referral.service.js";
import type {
  AdminResetUserPasswordInput,
  AdminUsersQueryInput,
  AdminUserStatusInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "./auth.schemas.js";
import type { AuthResponse, AuthTokens, AuthUser } from "./auth.types.js";

// #region debug-point A:auth-register
const DEBUG_SESSION_ID = "payment-runtime-blockers";

function resolveDebugServerUrl() {
  if (process.env.DEBUG_SERVER_URL) {
    return process.env.DEBUG_SERVER_URL;
  }

  const debugEnvPath = resolve(process.cwd(), ".dbg", `${DEBUG_SESSION_ID}.env`);
  if (!existsSync(debugEnvPath)) {
    return "http://127.0.0.1:7777/event";
  }

  const debugEnvContent = readFileSync(debugEnvPath, "utf8");
  const debugUrl = debugEnvContent
    .split(/\r?\n/)
    .find((line) => line.startsWith("DEBUG_SERVER_URL="))
    ?.slice("DEBUG_SERVER_URL=".length)
    .trim();

  return debugUrl || "http://127.0.0.1:7777/event";
}

function reportDebugEvent(payload: Record<string, unknown>) {
  void fetch(resolveDebugServerUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
      source: "server:auth-service",
      ...payload,
    }),
  }).catch(() => undefined);
}
// #endregion debug-point A:auth-register

function parseDurationToDate(duration: string): Date {
  const match = duration.match(/^(\d+)([mhd])$/i);
  if (!match) {
    throw new Error(`Unsupported duration format: ${duration}`);
  }

  const [, rawValue, rawUnit] = match;
  if (!rawUnit) {
    throw new Error(`Unsupported duration format: ${duration}`);
  }
  const value = Number(rawValue);
  const unit = rawUnit.toLowerCase();
  const now = Date.now();
  const multiplier =
    unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;

  return new Date(now + value * multiplier);
}

function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string | null;
  emailVerified: boolean;
  role: { code: RoleCode };
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    emailVerified: user.emailVerified,
    role: user.role.code,
  };
}

const adminUserDetailArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
  include: {
    role: true,
    customerAddresses: {
      orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
    },
    orders: {
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    },
    payments: {
      orderBy: { createdAt: "desc" },
      take: 10,
    },
    refreshTokens: {
      where: {
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    },
  },
});

type AdminUserDetailPayload = Prisma.UserGetPayload<typeof adminUserDetailArgs>;

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  return value ? Number(value) : 0;
}

function getLatestPaymentStatus(order: AdminUserDetailPayload["orders"][number]): PaymentStatus | null {
  return order.payments[0]?.status ?? null;
}

function isWaitingForPayment(order: AdminUserDetailPayload["orders"][number]) {
  if (order.status === "CANCELLED" || order.status === "REFUNDED" || order.status === "DELIVERED") {
    return false;
  }

  const latestPaymentStatus = getLatestPaymentStatus(order);
  return (
    order.status === "PENDING" &&
    latestPaymentStatus !== "PAYMENT_PENDING_REVIEW" &&
    latestPaymentStatus !== "PAYMENT_APPROVED" &&
    latestPaymentStatus !== "PAID"
  );
}

function isWaitingForApproval(order: AdminUserDetailPayload["orders"][number]) {
  return getLatestPaymentStatus(order) === "PAYMENT_PENDING_REVIEW";
}

function isWaitingForReceive(order: AdminUserDetailPayload["orders"][number]) {
  return ["PAID", "PROCESSING", "PURCHASED_FROM_SUPPLIER", "SHIPPED"].includes(order.status);
}

function buildAdminUserStats(user: AdminUserDetailPayload) {
  const totals = user.orders.reduce(
    (accumulator, order) => {
      accumulator.ordersCount += 1;
      accumulator.totalSpent += decimalToNumber(order.totalAmount);
      accumulator.totalRefunded += decimalToNumber(order.refundedAmount);
      accumulator.waitingPaymentCount += isWaitingForPayment(order) ? 1 : 0;
      accumulator.waitingApprovalCount += isWaitingForApproval(order) ? 1 : 0;
      accumulator.waitingReceiveCount += isWaitingForReceive(order) ? 1 : 0;
      accumulator.deliveredCount += order.status === "DELIVERED" ? 1 : 0;
      accumulator.cancelledCount += order.status === "CANCELLED" ? 1 : 0;
      return accumulator;
    },
    {
      ordersCount: 0,
      totalSpent: 0,
      totalRefunded: 0,
      waitingPaymentCount: 0,
      waitingApprovalCount: 0,
      waitingReceiveCount: 0,
      deliveredCount: 0,
      cancelledCount: 0,
    },
  );

  return {
    ...totals,
    activeSessionCount: user.refreshTokens.length,
    defaultShippingAddressId: user.customerAddresses.find((address) => address.isDefaultShipping)?.id ?? null,
    defaultBillingAddressId: user.customerAddresses.find((address) => address.isDefaultBilling)?.id ?? null,
  };
}

function mapAdminUserSummary(user: AdminUserDetailPayload) {
  const stats = buildAdminUserStats(user);

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    preferredCurrency: user.preferredCurrency,
    status: user.status,
    role: user.role.code,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    stats,
  };
}

function mapAdminUserDetail(user: AdminUserDetailPayload) {
  const stats = buildAdminUserStats(user);

  return {
    ...mapAdminUserSummary(user),
    addresses: user.customerAddresses.map((address) => ({
      id: address.id,
      fullName: address.fullName,
      phone: address.phone,
      countryCode: address.countryCode,
      city: address.city,
      postalCode: address.postalCode,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      isDefaultShipping: address.isDefaultShipping,
      isDefaultBilling: address.isDefaultBilling,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    })),
    orders: user.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: decimalToNumber(order.totalAmount),
      refundedAmount: decimalToNumber(order.refundedAmount),
      currency: order.currency,
      paymentProvider: order.paymentProvider,
      paymentStatus: getLatestPaymentStatus(order),
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      itemCount: order.items.length,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        title: item.title,
        brandName: item.brandName,
        quantity: item.quantity,
        imageUrl: item.imageUrl,
        unitPrice: decimalToNumber(item.unitPrice),
        totalPrice: decimalToNumber(item.totalPrice),
      })),
      waitingPayment: isWaitingForPayment(order),
      waitingApproval: isWaitingForApproval(order),
      waitingReceive: isWaitingForReceive(order),
    })),
    recentPayments: user.payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      kind: payment.kind,
      status: payment.status,
      currency: payment.currency,
      amount: decimalToNumber(payment.amount),
      paymentReference: payment.paymentReference,
      reviewRequestedAt: payment.reviewRequestedAt,
      approvedAt: payment.approvedAt,
      processedAt: payment.processedAt,
      createdAt: payment.createdAt,
      orderId: payment.orderId,
    })),
    sessionCount: stats.activeSessionCount,
  };
}

export class AuthService {
  public async register(input: RegisterInput): Promise<AuthResponse & { refreshToken: string }> {
    const normalizedEmail = input.email.toLowerCase();

    // #region debug-point A:register-start
    reportDebugEvent({
      hypothesisId: "A",
      message: "[DEBUG] Auth register start",
      data: {
        email: normalizedEmail,
      },
    });
    // #endregion debug-point A:register-start

    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      // #region debug-point A:register-existing-user
      reportDebugEvent({
        hypothesisId: "A",
        message: "[DEBUG] Auth register existing-user lookup complete",
        data: {
          email: normalizedEmail,
          existingUserFound: Boolean(existingUser),
        },
      });
      // #endregion debug-point A:register-existing-user

      if (existingUser) {
        throw new ApiError(409, "An account with this email already exists.");
      }

      const customerRole = await prisma.role.findUnique({
        where: { code: RoleCode.CUSTOMER },
      });

      // #region debug-point E:register-role
      reportDebugEvent({
        hypothesisId: "E",
        message: "[DEBUG] Auth register customer role lookup complete",
        data: {
          email: normalizedEmail,
          customerRoleFound: Boolean(customerRole),
        },
      });
      // #endregion debug-point E:register-role

      if (!customerRole) {
        throw new ApiError(500, "Default customer role is missing. Run the Prisma seed.");
      }

      const passwordHash = await hashPassword(input.password);

      const user = await prisma.$transaction(async (transaction) => {
        const fullName = input.fullName?.trim() || null;
        const referralCode = await referralService.createUniqueReferralCode(transaction, {
          email: normalizedEmail,
          fullName,
        });

        const createdUser = await transaction.user.create({
          data: {
            email: normalizedEmail,
            referralCode,
            passwordHash,
            fullName,
            status: "PENDING",
            roleId: customerRole.id,
          },
          include: {
            role: true,
          },
        });

        await referralService.registerReferralForNewUser(transaction, {
          userId: createdUser.id,
          referralCode: input.referralCode ?? null,
        });

        return createdUser;
      });

      // #region debug-point A:register-user-created
      reportDebugEvent({
        hypothesisId: "A",
        message: "[DEBUG] Auth register user created",
        data: {
          email: normalizedEmail,
          userId: user.id,
          role: user.role.code,
        },
      });
      // #endregion debug-point A:register-user-created

      await this.issueEmailVerification(user.id, user.email);
      try {
        await notificationsService.publishEvent({
          eventKey: `registration:${user.id}`,
          eventName: "REGISTRATION",
          eventSource: "AUTH",
          actorUserId: user.id,
          targetUserId: user.id,
          entityType: "user",
          entityId: user.id,
          title: "Registration completed",
          message: "Your OutletHub account is ready.",
          metadata: {
            customerName: user.fullName ?? user.email,
          },
        });
      } catch (notificationError) {
        // #region debug-point E:register-notification-error
        reportDebugEvent({
          hypothesisId: "E",
          message: "[DEBUG] Auth register registration notification failed but signup continues",
          data: {
            email: normalizedEmail,
            userId: user.id,
            error:
              notificationError instanceof Error
                ? {
                    name: notificationError.name,
                    message: notificationError.message,
                    stack: notificationError.stack,
                  }
                : { value: String(notificationError) },
          },
        });
        // #endregion debug-point E:register-notification-error
      }
      const tokens = await this.issueAuthTokens(user.id, user.email, user.role.code);

      // #region debug-point A:register-success
      reportDebugEvent({
        hypothesisId: "A",
        message: "[DEBUG] Auth register success",
        data: {
          email: normalizedEmail,
          userId: user.id,
        },
      });
      // #endregion debug-point A:register-success

      return {
        user: toAuthUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      // #region debug-point A:register-error
      reportDebugEvent({
        hypothesisId: "A",
        message: "[DEBUG] Auth register error",
        data: {
          email: normalizedEmail,
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : { value: String(error) },
        },
      });
      // #endregion debug-point A:register-error
      throw error;
    }
  }

  public async login(
    input: LoginInput,
  ): Promise<AuthResponse & { refreshToken: string }> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        role: true,
      },
    });

    if (!user?.passwordHash) {
      throw new ApiError(401, "Invalid email or password.");
    }

    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email or password.");
    }

    if (user.status !== "ACTIVE") {
      throw new ApiError(403, "Your account is not active.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueAuthTokens(user.id, user.email, user.role.code);

    return {
      user: toAuthUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  public async refresh(refreshToken: string): Promise<AuthResponse & { refreshToken: string }> {
    if (!refreshToken) {
      throw new ApiError(401, "Refresh token is invalid or expired.");
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, "Refresh token is invalid or expired.");
    }

    const tokenHash = hashToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
      throw new ApiError(401, "Refresh token is invalid or expired.");
    }

    if (storedToken.userId !== payload.sub) {
      throw new ApiError(401, "Refresh token subject mismatch.");
    }

    if (storedToken.user.status !== "ACTIVE") {
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      throw new ApiError(403, "Your account is not active.");
    }

    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueAuthTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role.code,
    );

    return {
      user: toAuthUser(storedToken.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  public async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  public async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      return;
    }

    const rawToken = createNumericCode(6);
    const resetToken = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: parseDurationToDate("1d"),
      },
    });

    await notificationsService.publishEvent({
      eventKey: `password-reset:${resetToken.id}`,
      eventName: "PASSWORD_RESET",
      eventSource: "AUTH",
      targetUserId: user.id,
      entityType: "user",
      entityId: user.id,
      title: "Password reset requested",
      message: "Use the provided token to reset your password.",
      metadata: {
        customerName: user.fullName ?? user.email,
        resetToken: rawToken,
      },
    });
  }

  public async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = hashToken(input.token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new ApiError(400, "Password reset token is invalid or expired.");
    }

    const nextPasswordHash = await hashPassword(input.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: nextPasswordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  public async verifyEmail(input: VerifyEmailInput): Promise<void> {
    const tokenHash = hashToken(input.token);
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!verificationToken || verificationToken.verifiedAt || verificationToken.expiresAt <= new Date()) {
      throw new ApiError(400, "Email verification token is invalid or expired.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          status: verificationToken.user.status === "PENDING" ? "ACTIVE" : verificationToken.user.status,
        },
      }),
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { verifiedAt: new Date() },
      }),
    ]);
  }

  public async resendVerification(input: ResendVerificationInput): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user || user.emailVerified) {
      return;
    }

    await this.issueEmailVerification(user.id, user.email);
  }

  public async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    if (user.status !== "ACTIVE") {
      throw new ApiError(403, "Your account is not active.");
    }

    return toAuthUser(user);
  }

  public async listAdminUsers(input: AdminUsersQueryInput) {
    const search = input.search?.trim().toLowerCase();
    const users = await prisma.user.findMany({
      where: {
        role: {
          code: RoleCode.CUSTOMER,
        },
        status: input.status,
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { fullName: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      ...adminUserDetailArgs,
      orderBy:
        input.sort === "lastLogin"
          ? [{ lastLoginAt: "desc" }, { createdAt: "desc" }]
          : input.sort === "oldest"
            ? [{ createdAt: "asc" }]
            : [{ createdAt: "desc" }],
      take: input.pageSize,
      skip: (input.page - 1) * input.pageSize,
    });

    const total = await prisma.user.count({
      where: {
        role: {
          code: RoleCode.CUSTOMER,
        },
        status: input.status,
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { fullName: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    });

    const mappedUsers = users.map(mapAdminUserSummary);
    const summary = mappedUsers.reduce(
      (accumulator, user) => {
        accumulator.totalUsers += 1;
        accumulator.activeUsers += user.status === "ACTIVE" ? 1 : 0;
        accumulator.pendingUsers += user.status === "PENDING" ? 1 : 0;
        accumulator.suspendedUsers += user.status === "SUSPENDED" ? 1 : 0;
        accumulator.deletedUsers += user.status === "DELETED" ? 1 : 0;
        accumulator.waitingPaymentUsers += user.stats.waitingPaymentCount > 0 ? 1 : 0;
        accumulator.waitingApprovalUsers += user.stats.waitingApprovalCount > 0 ? 1 : 0;
        accumulator.waitingReceiveUsers += user.stats.waitingReceiveCount > 0 ? 1 : 0;
        return accumulator;
      },
      {
        totalUsers: 0,
        activeUsers: 0,
        pendingUsers: 0,
        suspendedUsers: 0,
        deletedUsers: 0,
        waitingPaymentUsers: 0,
        waitingApprovalUsers: 0,
        waitingReceiveUsers: 0,
      },
    );

    return {
      items: mappedUsers,
      summary,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      },
    };
  }

  public async getAdminUserDetail(userId: string) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        role: {
          code: RoleCode.CUSTOMER,
        },
      },
      ...adminUserDetailArgs,
    });

    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    return mapAdminUserDetail(user);
  }

  public async updateAdminUserStatus(actorUserId: string, userId: string, input: AdminUserStatusInput) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        role: {
          code: RoleCode.CUSTOMER,
        },
      },
      ...adminUserDetailArgs,
    });

    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        status: input.status,
      },
      ...adminUserDetailArgs,
    });

    if (input.status !== "ACTIVE") {
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: "ADMIN_USER_STATUS_UPDATED",
        entityType: "user",
        entityId: user.id,
        metadata: {
          previousStatus: user.status,
          nextStatus: input.status,
        } as Prisma.InputJsonValue,
      },
    });

    return mapAdminUserDetail(updated);
  }

  public async adminResetUserPassword(actorUserId: string, userId: string, input: AdminResetUserPasswordInput) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        role: {
          code: RoleCode.CUSTOMER,
        },
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    const nextPasswordHash = await hashPassword(input.newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: nextPasswordHash,
        },
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          actorUserId,
          action: "ADMIN_USER_PASSWORD_RESET",
          entityType: "user",
          entityId: user.id,
          metadata: {
            email: user.email,
          } as Prisma.InputJsonValue,
        },
      }),
    ]);
  }

  public async revokeAdminUserSessions(actorUserId: string, userId: string) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        role: {
          code: RoleCode.CUSTOMER,
        },
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          actorUserId,
          action: "ADMIN_USER_SESSIONS_REVOKED",
          entityType: "user",
          entityId: user.id,
        },
      }),
    ]);
  }

  public async deleteAdminUser(actorUserId: string, userId: string) {
    return this.updateAdminUserStatus(actorUserId, userId, {
      status: "DELETED",
    });
  }

  private async issueAuthTokens(userId: string, email: string, role: RoleCode): Promise<AuthTokens> {
    const accessToken = signAccessToken({
      sub: userId,
      email,
      role,
    });

    const refreshToken = signRefreshToken({
      sub: userId,
      jti: createRandomToken(16),
    });

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: parseDurationToDate("7d"),
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async issueEmailVerification(userId: string, email: string): Promise<void> {
    const rawToken = createNumericCode(6);
    // #region debug-point A:issue-email-verification-start
    reportDebugEvent({
      hypothesisId: "A",
      location: "auth.service.ts:issueEmailVerification",
      msg: "[DEBUG] issueEmailVerification start",
      data: {
        userId,
        email,
        tokenLength: rawToken.length,
      },
    });
    // #endregion
    const verificationToken = await prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: parseDurationToDate("1d"),
      },
    });

    await notificationsService.publishEvent({
      eventKey: `email-verification:${verificationToken.id}`,
      eventName: "EMAIL_VERIFICATION",
      eventSource: "AUTH",
      targetUserId: userId,
      entityType: "user",
      entityId: userId,
      title: "Verify your email",
      message: "Use the verification token sent in this message to verify your email.",
      metadata: {
        customerName: email,
        verificationToken: rawToken,
      },
    });
    // #region debug-point A:issue-email-verification-published
    reportDebugEvent({
      hypothesisId: "A",
      location: "auth.service.ts:issueEmailVerification",
      msg: "[DEBUG] issueEmailVerification event published",
      data: {
        userId,
        email,
        verificationTokenId: verificationToken.id,
      },
    });
    // #endregion
  }
}

export const authService = new AuthService();
