import { createServer } from "node:http";

import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { createApp } from "./app.js";
import { notificationsService } from "./modules/notifications/notifications.service.js";

let redisClient: { ping: () => Promise<unknown>; quit: () => Promise<unknown> } | null = null;
let closeQueueInfrastructure: (() => Promise<void>) | null = null;

async function bootstrap(): Promise<void> {
  const runWebServer = env.SERVICE_MODE !== "worker";
  const runBackgroundWorkers = env.SERVICE_MODE !== "web";

  await prisma.$connect();
  await notificationsService.ensureCatalog();
  await notificationsService.ensurePreferencesForExistingUsers();

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

    await redisClient.ping();
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
  console.error("Server failed to start", error);
  await prisma.$disconnect();
  await redisClient?.quit().catch(() => undefined);
  await closeQueueInfrastructure?.().catch(() => undefined);
  process.exit(1);
});
