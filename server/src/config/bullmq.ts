import { Queue, QueueEvents } from "bullmq";

import { env } from "./env.js";

export const bullmqConnection = {
  url: env.REDIS_URL,
};

export const authQueue = new Queue("auth", {
  connection: bullmqConnection,
});

export const productImportQueue = new Queue("product-import", {
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
});

export const productImportQueueEvents = new QueueEvents("product-import", {
  connection: bullmqConnection,
});

export const scraperRunnerQueue = new Queue("scraper-runner", {
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
});

export const scraperRunnerQueueEvents = new QueueEvents("scraper-runner", {
  connection: bullmqConnection,
});

export const priceMonitorQueue = new Queue("price-monitor", {
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
});

export const priceMonitorQueueEvents = new QueueEvents("price-monitor", {
  connection: bullmqConnection,
});

export const syncSchedulerQueue = new Queue("sync-scheduler", {
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
});

export const syncSchedulerQueueEvents = new QueueEvents("sync-scheduler", {
  connection: bullmqConnection,
});

export const notificationEmailQueue = new Queue("notification-deliveries-email", {
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
});

export const notificationEmailQueueEvents = new QueueEvents("notification-deliveries-email", {
  connection: bullmqConnection,
});

export const notificationInAppQueue = new Queue("notification-deliveries-inapp", {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export const notificationInAppQueueEvents = new QueueEvents("notification-deliveries-inapp", {
  connection: bullmqConnection,
});

export const notificationAdminOperationalQueue = new Queue("notification-deliveries-admin-operational", {
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
});

export const notificationAdminOperationalQueueEvents = new QueueEvents(
  "notification-deliveries-admin-operational",
  {
    connection: bullmqConnection,
  },
);
