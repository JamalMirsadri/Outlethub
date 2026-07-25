import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { resolve } from "node:path";

import { env } from "./config/env.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";
import { apiRouter } from "./routes/index.js";

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
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
