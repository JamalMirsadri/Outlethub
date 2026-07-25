import { Worker } from "bullmq";
import { ImportSourceStatus, SyncFrequency } from "@prisma/client";

import { authQueue, bullmqConnection, productImportQueue, productImportQueueEvents } from "../../config/bullmq.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { importManager, type QueuedImportPayload } from "./import-manager.js";

let importWorker: Worker<QueuedImportPayload> | null = null;

function getRepeatEvery(syncFrequency: SyncFrequency): number | null {
  switch (syncFrequency) {
    case SyncFrequency.HOURLY:
      return 60 * 60 * 1000;
    case SyncFrequency.EVERY_6_HOURS:
      return 6 * 60 * 60 * 1000;
    case SyncFrequency.DAILY:
      return 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export async function enqueueImportJob(payload: QueuedImportPayload) {
  return productImportQueue.add("run-import", payload);
}

export async function syncImportSchedules(): Promise<void> {
  const repeatableJobs = await productImportQueue.getRepeatableJobs();
  await Promise.all(repeatableJobs.map((job) => productImportQueue.removeRepeatableByKey(job.key)));

  const scheduledSources = await prisma.importSource.findMany({
    where: {
      status: ImportSourceStatus.ACTIVE,
    },
    select: {
      id: true,
      syncFrequency: true,
    },
  });

  for (const source of scheduledSources) {
    const every = getRepeatEvery(source.syncFrequency);
    if (!every) {
      continue;
    }

    await productImportQueue.add(
      "run-import",
      {
        jobId: `scheduled-${source.id}`,
        mode: "source",
        sourceId: source.id,
        triggerMode: "schedule",
      },
      {
        jobId: `scheduled-import-${source.id}`,
        repeat: {
          every,
        },
      },
    );
  }
}

export function startImportWorker(): Worker<QueuedImportPayload> {
  if (importWorker) {
    return importWorker;
  }

  importWorker = new Worker<QueuedImportPayload>(
    "product-import",
    async (job) => {
      const payload = job.data;
      try {
        if (payload.triggerMode === "schedule" && payload.sourceId) {
          const importJob = await importManager.createJob({
            sourceId: payload.sourceId,
            triggerMode: "schedule",
          });

          await importManager.runJob({
            ...payload,
            jobId: importJob.id,
          });
          return;
        }

        await importManager.runJob(payload);
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404 && error.message === "Import job not found.") {
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

  importWorker.on("failed", (job, error) => {
    console.error("Import queue job failed", job?.id, error);
  });

  return importWorker;
}

export async function stopImportWorker(): Promise<void> {
  if (!importWorker) {
    return;
  }

  await importWorker.close();
  importWorker = null;
}

export async function closeImportQueueInfrastructure(): Promise<void> {
  await stopImportWorker();
  await productImportQueueEvents.close();
  await productImportQueue.close();
  await authQueue.close();
}
