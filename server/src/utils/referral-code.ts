import { Prisma } from "@prisma/client";
import crypto from "node:crypto";

export type ReferralCodeExecutor = {
  user: {
    findUnique(args: {
      where: { referralCode: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
};

type UserCreateExecutor = ReferralCodeExecutor & {
  user: ReferralCodeExecutor["user"] & {
    create(args: Prisma.UserCreateArgs): Promise<unknown>;
  };
};

type UserUpsertExecutor = ReferralCodeExecutor & {
  user: ReferralCodeExecutor["user"] & {
    upsert(args: Prisma.UserUpsertArgs): Promise<unknown>;
  };
};

type ReferralCodeIdentity = {
  userId?: string | null;
  email?: string | null;
  fullName?: string | null;
};

const MAX_REFERRAL_CODE_ATTEMPTS = 25;

export function normalizeReferralCode(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
}

function buildReferralCodeSeed(input: ReferralCodeIdentity) {
  const rawSeed = input.fullName || input.email?.split("@")[0] || input.userId || "OUTLET";
  const normalized = normalizeReferralCode(rawSeed).slice(0, 8);
  return normalized || "OUTLET";
}

function randomReferralSuffix(length = 6) {
  return crypto
    .randomBytes(length)
    .toString("hex")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, length);
}

export async function generateUniqueReferralCode(
  executor: ReferralCodeExecutor,
  input: ReferralCodeIdentity,
) {
  const baseSeed = buildReferralCodeSeed(input);

  for (let attempt = 0; attempt < MAX_REFERRAL_CODE_ATTEMPTS; attempt += 1) {
    const suffix = randomReferralSuffix(6);
    const code = `${baseSeed}${attempt === 0 ? "" : attempt}${suffix}`.slice(0, 14);
    const existing = await executor.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });

    if (!existing || (input.userId && existing.id === input.userId)) {
      return code;
    }
  }

  return normalizeReferralCode(
    `${input.userId ?? input.email ?? "OUTLET"}${Date.now().toString(36)}${randomReferralSuffix(4)}`,
  ).slice(0, 18);
}

export function hasExplicitReferralCode(data: { referralCode?: string | null } | undefined | null) {
  return Boolean(data?.referralCode);
}

export async function withGeneratedReferralCode<T extends { referralCode?: string | null }>(
  executor: ReferralCodeExecutor,
  data: T,
) {
  if (hasExplicitReferralCode(data)) {
    return data;
  }

  const referralCode = await generateUniqueReferralCode(executor, {
    userId: "id" in data && typeof data.id === "string" ? data.id : null,
    email: "email" in data && typeof data.email === "string" ? data.email : null,
    fullName: "fullName" in data && typeof data.fullName === "string" ? data.fullName : null,
  });

  return {
    ...data,
    referralCode,
  };
}

export function isReferralCodeUniqueConstraintError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("referralCode");
  }

  return typeof target === "string" && target.includes("referralCode");
}

const USER_REFERRAL_RETRY_LIMIT = 5;

export async function createUserWithReferralCode<T extends Prisma.UserCreateArgs>(
  executor: UserCreateExecutor,
  args: T,
) {
  const shouldGenerate = !hasExplicitReferralCode(args.data);

  for (let attempt = 0; attempt < USER_REFERRAL_RETRY_LIMIT; attempt += 1) {
    const nextArgs = shouldGenerate
      ? ({
          ...args,
          data: await withGeneratedReferralCode(executor, args.data),
        } satisfies Prisma.UserCreateArgs)
      : args;

    try {
      return (await executor.user.create(nextArgs)) as Prisma.UserGetPayload<T>;
    } catch (error) {
      if (!shouldGenerate || !isReferralCodeUniqueConstraintError(error) || attempt === USER_REFERRAL_RETRY_LIMIT - 1) {
        throw error;
      }
    }
  }

  throw new Error("Unable to generate a unique referral code for the user create operation.");
}

export async function upsertUserWithReferralCode<T extends Prisma.UserUpsertArgs>(
  executor: UserUpsertExecutor,
  args: T,
) {
  const shouldGenerate = !hasExplicitReferralCode(args.create);

  for (let attempt = 0; attempt < USER_REFERRAL_RETRY_LIMIT; attempt += 1) {
    const nextArgs = shouldGenerate
      ? ({
          ...args,
          create: await withGeneratedReferralCode(executor, args.create),
        } satisfies Prisma.UserUpsertArgs)
      : args;

    try {
      return (await executor.user.upsert(nextArgs)) as Prisma.UserGetPayload<T>;
    } catch (error) {
      if (!shouldGenerate || !isReferralCodeUniqueConstraintError(error) || attempt === USER_REFERRAL_RETRY_LIMIT - 1) {
        throw error;
      }
    }
  }

  throw new Error("Unable to generate a unique referral code for the user upsert operation.");
}
