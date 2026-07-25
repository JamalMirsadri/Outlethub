import { Worker } from "bullmq";

import {
  bullmqConnection,
  notificationAdminOperationalQueue,
  notificationAdminOperationalQueueEvents,
  notificationEmailQueue,
  notificationEmailQueueEvents,
  notificationInAppQueue,
  notificationInAppQueueEvents,
} from "../../config/bullmq.js";
import { notificationsService } from "./notifications.service.js";

interface NotificationDeliveryJobPayload {
  deliveryId: string;
}

let emailWorker: Worker<NotificationDeliveryJobPayload> | null = null;
let inAppWorker: Worker<NotificationDeliveryJobPayload> | null = null;
let adminOperationalWorker: Worker<NotificationDeliveryJobPayload> | null = null;

function buildWorker(queueName: string): Worker<NotificationDeliveryJobPayload> {
  return new Worker<NotificationDeliveryJobPayload>(
    queueName,
    async (job) => {
      await notificationsService.processDelivery(job.data.deliveryId);
    },
    {
      connection: bullmqConnection,
      concurrency: 2,
    },
  );
}

export function startNotificationWorkers() {
  if (!emailWorker) {
    emailWorker = buildWorker("notification-deliveries-email");
    emailWorker.on("failed", async (job, error) => {
      console.error("Notification email delivery failed", job?.id, error);
      if (job?.data.deliveryId) {
        await notificationsService.failDelivery(job.data.deliveryId, null, error.message);
      }
    });
  }

  if (!inAppWorker) {
    inAppWorker = buildWorker("notification-deliveries-inapp");
    inAppWorker.on("failed", async (job, error) => {
      console.error("Notification in-app delivery failed", job?.id, error);
      if (job?.data.deliveryId) {
        await notificationsService.failDelivery(job.data.deliveryId, null, error.message);
      }
    });
  }

  if (!adminOperationalWorker) {
    adminOperationalWorker = buildWorker("notification-deliveries-admin-operational");
    adminOperationalWorker.on("failed", async (job, error) => {
      console.error("Notification admin operational delivery failed", job?.id, error);
      if (job?.data.deliveryId) {
        await notificationsService.failDelivery(job.data.deliveryId, null, error.message);
      }
    });
  }

  return {
    emailWorker,
    inAppWorker,
    adminOperationalWorker,
  };
}

export async function stopNotificationWorkers(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
  }

  if (inAppWorker) {
    await inAppWorker.close();
    inAppWorker = null;
  }

  if (adminOperationalWorker) {
    await adminOperationalWorker.close();
    adminOperationalWorker = null;
  }
}

export async function closeNotificationQueueInfrastructure(): Promise<void> {
  await stopNotificationWorkers();
  await notificationEmailQueueEvents.close();
  await notificationInAppQueueEvents.close();
  await notificationAdminOperationalQueueEvents.close();
  await notificationEmailQueue.close();
  await notificationInAppQueue.close();
  await notificationAdminOperationalQueue.close();
}
