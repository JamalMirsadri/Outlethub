import { existsSync, readFileSync } from "node:fs";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "./config/env.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";
import { apiRouter } from "./routes/index.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

// #region debug-point A:cors-origin
const DEBUG_SESSION_ID = "login-500-error";

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
      source: "server:app-cors",
      ...payload,
    }),
  }).catch(() => undefined);
}
// #endregion

function resolveClientDistDir() {
  const candidates = [
    resolve(currentDir, "../client"),
    resolve(currentDir, "../../client/dist"),
    resolve(currentDir, "../../../client/dist"),
    resolve(process.cwd(), "dist/client"),
    resolve(process.cwd(), "../client/dist"),
    resolve(process.cwd(), "client/dist"),
  ];

  const match = candidates.find((candidate) => existsSync(resolve(candidate, "index.html")));

  if (!match) {
    console.warn(`Client bundle not found. Checked: ${candidates.join(", ")}`);
    return null;
  }

  return match;
}

function buildAllowedOrigins() {
  const configuredOrigin = env.CLIENT_URL;
  const alternatives = new Set<string>([configuredOrigin]);

  try {
    const parsed = new URL(configuredOrigin);
    if (parsed.hostname === "localhost") {
      alternatives.add(`${parsed.protocol}//127.0.0.1${parsed.port ? `:${parsed.port}` : ""}`);
    }

    if (parsed.hostname === "127.0.0.1") {
      alternatives.add(`${parsed.protocol}//localhost${parsed.port ? `:${parsed.port}` : ""}`);
    }
  } catch {
    return [configuredOrigin];
  }

  if (env.NODE_ENV === "development") {
    const devPorts = ["5174", "5175", "5176"];
    for (const port of devPorts) {
      alternatives.add(`http://localhost:${port}`);
      alternatives.add(`http://127.0.0.1:${port}`);
    }
  }

  return Array.from(alternatives);
}

export function createApp() {
  const app = express();
  const allowedOrigins = buildAllowedOrigins();
  const clientDistDir = resolveClientDistDir();
  const clientIndexPath = clientDistDir ? resolve(clientDistDir, "index.html") : null;
  const hasClientBundle = Boolean(clientIndexPath);

  app.use((request, response, next) => {
    const forwardedProto = request.header("x-forwarded-proto");
    const requestOrigin = `${forwardedProto ?? request.protocol}://${request.get("host")}`;
    const normalizedRequestOrigin = requestOrigin.replace(/\/$/, "");

    return cors({
      origin: (origin, callback) => {
        const normalizedOrigin = origin?.replace(/\/$/, "");
        const isSameOrigin = Boolean(normalizedOrigin && normalizedOrigin === normalizedRequestOrigin);

        if (!origin || isSameOrigin || allowedOrigins.includes(origin)) {
          // #region debug-point A:cors-allow
          reportDebugEvent({
            hypothesisId: "A",
            location: "app.ts:cors-allow",
            msg: "[DEBUG] CORS origin allowed",
            data: {
              origin: origin ?? null,
              requestOrigin: normalizedRequestOrigin,
              isSameOrigin,
              allowedOrigins,
            },
          });
          // #endregion
          callback(null, true);
          return;
        }

        // #region debug-point A:cors-reject
        reportDebugEvent({
          hypothesisId: "A",
          location: "app.ts:cors-reject",
          msg: "[DEBUG] CORS origin rejected",
          data: {
            origin,
            requestOrigin: normalizedRequestOrigin,
            allowedOrigins,
            clientUrl: env.CLIENT_URL,
          },
        });
        // #endregion
        callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      },
      credentials: true,
    })(request, response, next);
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "img-src": ["'self'", "data:", "blob:", "https:"],
        },
      },
    }),
  );
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(cookieParser());
  app.use("/uploads", express.static(resolve(process.cwd(), "uploads")));

  app.use("/api/v1", apiRouter);

  if (hasClientBundle && clientDistDir && clientIndexPath) {
    app.use(express.static(clientDistDir));
    app.get("*", (request, response, next) => {
      if (
        request.path.startsWith("/api/") ||
        request.path.startsWith("/uploads/") ||
        request.path.includes(".") ||
        !request.accepts("html")
      ) {
        next();
        return;
      }

      response.sendFile(clientIndexPath);
    });
  }

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
