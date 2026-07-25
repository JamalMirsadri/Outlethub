import { Worker } from "bullmq";

import { authQueue, bullmqConnection, productImportQueue, productImportQueueEvents, scraperRunnerQueue, scraperRunnerQueueEvents } from "../../config/bullmq.js";
import { ApiError } from "../../utils/api-error.js";
import { scraperManager } from "./scraper-manager.js";

export interface QueuedScraperPayload {
  runId: string;
}

let scraperWorker: Worker<QueuedScraperPayload> | null = null;

export async function enqueueScraperRun(payload: QueuedScraperPayload) {
  return scraperRunnerQueue.add("run-scraper", payload);
}

export function startScraperWorker(): Worker<QueuedScraperPayload> {
  if (scraperWorker) {
    return scraperWorker;
  }

  scraperWorker = new Worker<QueuedScraperPayload>(
    "scraper-runner",
    async (job) => {
      try {
        await scraperManager.executeRun(job.data.runId);
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404 && error.message === "Scraper run not found.") {
          return;
        }

        throw error;
      }
    },
    {
      connection: bullmqConnection,
      concurrency: 1,
    },
  );

  scraperWorker.on("failed", (job, error) => {
    console.error("Scraper queue job failed", job?.id, error);
  });

  return scraperWorker;
}

export async function stopScraperWorker(): Promise<void> {
  if (!scraperWorker) {
    return;
  }

  await scraperWorker.close();
  scraperWorker = null;
}

export async function closeScraperQueueInfrastructure(): Promise<void> {
  await stopScraperWorker();
  await scraperRunnerQueueEvents.close();
  await scraperRunnerQueue.close();
  await productImportQueueEvents.close();
  await productImportQueue.close();
  await authQueue.close();
}
