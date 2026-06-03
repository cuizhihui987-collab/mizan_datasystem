import { prisma } from "@mizan/database";
import { DataImporter } from "./data-importer";

function getMaxConcurrency(): number {
  const val = process.env.IMPORT_MAX_CONCURRENCY;
  if (!val) return 2;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

export class QueueProcessor {
  /**
   * Attempt to start a job immediately, or queue it if at capacity.
   * Returns `{ queued, position }` indicating whether the job was queued.
   */
  static async enqueue(jobId: string): Promise<{ queued: boolean; position: number }> {
    const maxConcurrency = getMaxConcurrency();

    // Count currently running imports
    const processingCount = await prisma.importJob.count({
      where: { status: "PROCESSING" },
    });

    if (processingCount >= maxConcurrency) {
      // At capacity — queue the job
      await prisma.importJob.update({
        where: { id: jobId },
        data: { status: "QUEUED" },
      });
      const position = await this.getQueuePosition(jobId);
      return { queued: true, position };
    }

    // Start immediately
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING", startedAt: new Date() },
    });
    return { queued: false, position: 0 };
  }

  /**
   * Drain the queue: start as many queued jobs as capacity allows.
   */
  static async drain(): Promise<void> {
    try {
      const maxConcurrency = getMaxConcurrency();

      for (;;) {
        const processingCount = await prisma.importJob.count({
          where: { status: "PROCESSING" },
        });
        if (processingCount >= maxConcurrency) break;

        // Pick the oldest queued job
        const next = await prisma.importJob.findFirst({
          where: { status: "QUEUED" },
          orderBy: { createdAt: "asc" },
        });
        if (!next) break;

        // Atomically claim it (handle race with other drains)
        const result = await prisma.importJob.updateMany({
          where: { id: next.id, status: "QUEUED" },
          data: { status: "PROCESSING", startedAt: new Date() },
        });

        if (result.count === 0) continue; // another drain already claimed it

        // Fire-and-forget the import (the catch ensures drain always completes)
        const importer = new DataImporter();
        importer.import(next.id).catch(() => {});
      }
    } catch (error) {
      console.error("QueueProcessor.drain error:", error);
    }
  }

  /**
   * Get the 1-based queue position of a job.
   * Returns 0 if the job is not QUEUED.
   */
  static async getQueuePosition(jobId: string): Promise<number> {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      select: { createdAt: true, status: true },
    });
    if (!job || job.status !== "QUEUED") return 0;

    const ahead = await prisma.importJob.count({
      where: {
        status: "QUEUED",
        createdAt: { lt: job.createdAt },
      },
    });
    return ahead + 1;
  }
}
