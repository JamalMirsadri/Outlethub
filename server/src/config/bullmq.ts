import { Queue, QueueEvents } from "bullmq";

import { env } from "./env.js";

export const bullmqEnabled = Boolean(env.REDIS_URL);

export const bullmqConnection = bullmqEnabled
  ? {
      url: env.REDIS_URL,
    }
  : ({
      url: "redis://disabled.invalid:6379",
    } as const);

function createDisabledQueue(name: string) {
  return {
    add: async () => null,
    close: async () => undefined,
    getJobCounts: async () => ({
      active: 0,
      completed: 0,
      delayed: 0,
      failed: 0,
      waiting: 0,
      paused: 0,
    }),
    getRepeatableJobs: async () => [],
    removeRepeatableByKey: async () => undefined,
    name,
  } as unknown as Queue;
}

function createDisabledQueueEvents(name: string) {
  return {
    close: async () => undefined,
    name,
  } as unknown as QueueEvents;
}

export const authQueue = bullmqEnabled
  ? new Queue("auth", {
      connection: bullmqConnection,
    })
  : createDisabledQueue("auth");

export const productImportQueue = bullmqEnabled
  ? new Queue("product-import", {
      connection: bullmqConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    })
  : createDisabledQueue("product-import");

export const productImportQueueEvents = bullmqEnabled
  ? new QueueEvents("product-import", {
      connection: bullmqConnection,
    })
  : createDisabledQueueEvents("product-import");

export const scraperRunnerQueue = bullmqEnabled
  ? new Queue("scraper-runner", {
      connection: bullmqConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    })
  : createDisabledQueue("scraper-runner");

export const scraperRunnerQueueEvents = bullmqEnabled
  ? new QueueEvents("scraper-runner", {
      connection: bullmqConnection,
    })
  : createDisabledQueueEvents("scraper-runner");

export const priceMonitorQueue = bullmqEnabled
  ? new Queue("price-monitor", {
      connection: bullmqConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    })
  : createDisabledQueue("price-monitor");

export const priceMonitorQueueEvents = bullmqEnabled
  ? new QueueEvents("price-monitor", {
      connection: bullmqConnection,
    })
  : createDisabledQueueEvents("price-monitor");

export const syncSchedulerQueue = bullmqEnabled
  ? new Queue("sync-scheduler", {
      connection: bullmqConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    })
  : createDisabledQueue("sync-scheduler");

export const syncSchedulerQueueEvents = bullmqEnabled
  ? new QueueEvents("sync-scheduler", {
      connection: bullmqConnection,
    })
  : createDisabledQueueEvents("sync-scheduler");

export const notificationEmailQueue = bullmqEnabled
  ? new Queue("notification-deliveries-email", {
      connection: bullmqConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    })
  : createDisabledQueue("notification-deliveries-email");

export const notificationEmailQueueEvents = bullmqEnabled
  ? new QueueEvents("notification-deliveries-email", {
      connection: bullmqConnection,
    })
  : createDisabledQueueEvents("notification-deliveries-email");

export const notificationInAppQueue = bullmqEnabled
  ? new Queue("notification-deliveries-inapp", {
      connection: bullmqConnection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    })
  : createDisabledQueue("notification-deliveries-inapp");

export const notificationInAppQueueEvents = bullmqEnabled
  ? new QueueEvents("notification-deliveries-inapp", {
      connection: bullmqConnection,
    })
  : createDisabledQueueEvents("notification-deliveries-inapp");

export const notificationAdminOperationalQueue = bullmqEnabled
  ? new Queue("notification-deliveries-admin-operational", {
      connection: bullmqConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 3000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    })
  : createDisabledQueue("notification-deliveries-admin-operational");

export const notificationAdminOperationalQueueEvents = bullmqEnabled
  ? new QueueEvents("notification-deliveries-admin-operational", {
      connection: bullmqConnection,
    })
  : createDisabledQueueEvents("notification-deliveries-admin-operational");
