import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));
const DEBUG_SESSION_ID = "render-env-missing";
const runtimeNodeEnv = process.env.NODE_ENV ?? "development";
const shouldLoadDotenv = runtimeNodeEnv !== "production";

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
      source: "server:env-config",
      ...payload,
    }),
  }).catch(() => undefined);
}

const envCandidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../.env"),
  resolve(currentDir, "../../../.env"),
  resolve(currentDir, "../../../../.env"),
];

const dotenvCandidatesChecked = shouldLoadDotenv ? envCandidates : [];

if (shouldLoadDotenv) {
  for (const candidate of envCandidates) {
    dotenv.config({ path: candidate });
  }

  dotenv.config();
}

const requiredEnvKeys = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const;
const missingRequiredEnvKeys = requiredEnvKeys.filter((key) => !process.env[key]);

// #region debug-point A:env-loader-snapshot
reportDebugEvent({
  hypothesisId: "A",
  msg: "[DEBUG] env loader snapshot",
  data: {
    nodeEnv: runtimeNodeEnv,
    cwd: process.cwd(),
    serviceMode: process.env.SERVICE_MODE ?? null,
    dotenvEnabled: shouldLoadDotenv,
    requiredEnvPresence: Object.fromEntries(requiredEnvKeys.map((key) => [key, Boolean(process.env[key])])),
    missingRequiredEnvKeys,
    envCandidatesChecked: dotenvCandidatesChecked,
  },
});
// #endregion

if (missingRequiredEnvKeys.length > 0) {
  const message = `Missing required environment variables: ${missingRequiredEnvKeys.join(", ")}`;

  // #region debug-point C:env-missing-required
  reportDebugEvent({
    hypothesisId: "B",
    msg: "[DEBUG] required env variables missing",
    data: {
      nodeEnv: runtimeNodeEnv,
      dotenvEnabled: shouldLoadDotenv,
      missingRequiredEnvKeys,
    },
  });
  // #endregion

  console.error(message);
  throw new Error(message);
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVICE_MODE: z.enum(["web", "worker", "all"]).optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:5174"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("24h"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  AUTH_INACTIVITY_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(1440),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default("outlethub_refresh_token"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(14).default(12),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => (typeof value === "boolean" ? value : value === "true")),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default("no-reply@outlethub.local"),
  REDIS_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

let parsedEnv: z.infer<typeof envSchema>;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  // #region debug-point B:env-parse-failure
  reportDebugEvent({
    hypothesisId: "D",
    msg: "[DEBUG] env parse failure",
    data: {
      missingRequiredEnvKeys,
      nodeEnv: runtimeNodeEnv,
      dotenvEnabled: shouldLoadDotenv,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : { value: String(error) },
    },
  });
  // #endregion
  throw error;
}

export const env = {
  ...parsedEnv,
  SERVICE_MODE: parsedEnv.SERVICE_MODE ?? (parsedEnv.NODE_ENV === "production" ? "web" : "all"),
  REDIS_URL: parsedEnv.REDIS_URL ?? (parsedEnv.NODE_ENV === "production" ? undefined : "redis://127.0.0.1:6379"),
};
export type Env = typeof env;
