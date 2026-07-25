import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __outletHubPrisma__: PrismaClient | undefined;
}

const prismaClient =
  globalThis.__outletHubPrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__outletHubPrisma__ = prismaClient;
}

export const prisma = prismaClient;
