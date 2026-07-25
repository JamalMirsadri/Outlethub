import { existsSync } from "node:fs";

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

function resolveClientDistDir() {
  const candidates = [
    resolve(currentDir, "../../../client/dist"),
    resolve(currentDir, "../../client/dist"),
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

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      },
      credentials: true,
    }),
  );
  app.use(helmet());
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
