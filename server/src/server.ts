import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { redis } from "./config/redis.js";
import { createApp } from "./app.js";
import { startImportWorker, syncImportSchedules } from "./modules/imports/import-queue.js";
import { startPriceMonitorWorker, startSyncSchedulerWorker } from "./modules/monitoring/monitoring-queue.js";
import { syncScheduler } from "./modules/monitoring/sync-scheduler.js";
import { closeNotificationQueueInfrastructure, startNotificationWorkers } from "./modules/notifications/notification-queue.js";
import { notificationsService } from "./modules/notifications/notifications.service.js";
import { startScraperWorker } from "./modules/scrapers/scraper-queue.js";

// #region debug-point A:bootstrap-runtime
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
      source: "server:bootstrap",
      ...payload,
    }),
  }).catch(() => undefined);
}
// #endregion debug-point A:bootstrap-runtime

async function bootstrap(): Promise<void> {
  // #region debug-point A:bootstrap-start
  reportDebugEvent({
    hypothesisId: "A",
    message: "[DEBUG] Bootstrap start",
    data: {
      port: env.PORT,
      clientUrl: env.CLIENT_URL,
      databaseHostConfigured: env.DATABASE_URL.includes("127.0.0.1:5433"),
      redisUrl: env.REDIS_URL,
    },
  });
  // #endregion debug-point A:bootstrap-start

  await prisma.$connect();
  await redis.ping();
  startImportWorker();
  startScraperWorker();
  startSyncSchedulerWorker();
  startPriceMonitorWorker();
  startNotificationWorkers();
  await notificationsService.ensureCatalog();
  await notificationsService.ensurePreferencesForExistingUsers();
  await syncImportSchedules();
  await syncScheduler.syncSchedules();

  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    // #region debug-point A:bootstrap-listening
    reportDebugEvent({
      hypothesisId: "A",
      message: "[DEBUG] Bootstrap listening",
      data: {
        port: env.PORT,
      },
    });
    // #endregion debug-point A:bootstrap-listening
    console.info(`Server listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch(async (error: unknown) => {
  // #region debug-point A:bootstrap-failed
  reportDebugEvent({
    hypothesisId: "A",
    message: "[DEBUG] Bootstrap failed",
    data: {
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
  // #endregion debug-point A:bootstrap-failed
  console.error("Server failed to start", error);
  await prisma.$disconnect();
  await redis.quit();
  await closeNotificationQueueInfrastructure();
  process.exit(1);
});
