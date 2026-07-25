import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { createApp } from "./app.js";
import { notificationsService } from "./modules/notifications/notifications.service.js";

// #region debug-point A:startup-debug-bootstrap
const DEBUG_SESSION_ID = "render-redis-prisma";

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
// #endregion

let redisClient: { ping: () => Promise<unknown>; quit: () => Promise<unknown> } | null = null;
let closeQueueInfrastructure: (() => Promise<void>) | null = null;

async function bootstrap(): Promise<void> {
  const runWebServer = env.SERVICE_MODE !== "worker";
  const redisEnabled = Boolean(env.REDIS_URL);
  const runBackgroundWorkers = env.SERVICE_MODE !== "web" && redisEnabled;

  // #region debug-point B:startup-snapshot
  reportDebugEvent({
    hypothesisId: "A",
    msg: "[DEBUG] startup snapshot",
    data: {
      nodeEnv: process.env.NODE_ENV ?? null,
      serviceMode: env.SERVICE_MODE,
      runWebServer,
      runBackgroundWorkers,
      redisEnabled,
      redisUrlConfigured: Boolean(env.REDIS_URL),
      redisUrlLooksLocalhost:
        (env.REDIS_URL?.includes("127.0.0.1:6379") ?? false) || (env.REDIS_URL?.includes("localhost:6379") ?? false),
      databaseUrlConfigured: Boolean(env.DATABASE_URL),
    },
  });
  // #endregion

  await prisma.$connect();
  // #region debug-point C:prisma-connected
  reportDebugEvent({
    hypothesisId: "E",
    msg: "[DEBUG] prisma connected",
    data: {
      serviceMode: env.SERVICE_MODE,
    },
  });
  // #endregion

  await notificationsService.ensureCatalog();
  // #region debug-point D:notification-catalog-ready
  reportDebugEvent({
    hypothesisId: "E",
    msg: "[DEBUG] notification catalog ensured",
    data: {
      serviceMode: env.SERVICE_MODE,
    },
  });
  // #endregion

  await notificationsService.ensurePreferencesForExistingUsers();
  // #region debug-point E:notification-preferences-ready
  reportDebugEvent({
    hypothesisId: "E",
    msg: "[DEBUG] notification preferences ensured",
    data: {
      serviceMode: env.SERVICE_MODE,
    },
  });
  // #endregion

  if (!redisEnabled) {
    console.warn("REDIS_URL is not configured. Redis-dependent workers and queues are disabled for this process.");
  }

  if (runBackgroundWorkers) {
    const [
      redisModule,
      importsQueueModule,
      monitoringQueueModule,
      syncSchedulerModule,
      notificationQueueModule,
      scrapersQueueModule,
    ] = await Promise.all([
      import("./config/redis.js"),
      import("./modules/imports/import-queue.js"),
      import("./modules/monitoring/monitoring-queue.js"),
      import("./modules/monitoring/sync-scheduler.js"),
      import("./modules/notifications/notification-queue.js"),
      import("./modules/scrapers/scraper-queue.js"),
    ]);

    redisClient = redisModule.redis;
    closeQueueInfrastructure = notificationQueueModule.closeNotificationQueueInfrastructure;

    // #region debug-point F:redis-before-ping
    reportDebugEvent({
      hypothesisId: "A",
      msg: "[DEBUG] redis before ping",
      data: {
        serviceMode: env.SERVICE_MODE,
        redisUrlLooksLocalhost:
          (env.REDIS_URL?.includes("127.0.0.1:6379") ?? false) || (env.REDIS_URL?.includes("localhost:6379") ?? false),
      },
    });
    // #endregion

    if (!redisClient) {
      throw new Error("Redis client is unavailable after startup selected Redis-enabled worker mode.");
    }

    await redisClient.ping();
    // #region debug-point G:redis-ping-success
    reportDebugEvent({
      hypothesisId: "A",
      msg: "[DEBUG] redis ping success",
      data: {
        serviceMode: env.SERVICE_MODE,
      },
    });
    // #endregion
    importsQueueModule.startImportWorker();
    scrapersQueueModule.startScraperWorker();
    monitoringQueueModule.startSyncSchedulerWorker();
    monitoringQueueModule.startPriceMonitorWorker();
    notificationQueueModule.startNotificationWorkers();
    await importsQueueModule.syncImportSchedules();
    await syncSchedulerModule.syncScheduler.syncSchedules();

    console.info("Background workers started.");
  }

  if (!runWebServer) {
    console.info("Worker process started.");
    return;
  }

  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    console.info(`Server listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch(async (error: unknown) => {
  // #region debug-point H:startup-failed
  reportDebugEvent({
    hypothesisId: "A",
    msg: "[DEBUG] startup failed",
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
  // #endregion
  console.error("Server failed to start", error);
  await prisma.$disconnect();
  await redisClient?.quit().catch(() => undefined);
  await closeQueueInfrastructure?.().catch(() => undefined);
  process.exit(1);
});
