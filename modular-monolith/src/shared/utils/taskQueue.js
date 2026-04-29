import { createLogger, logEvent } from './logger.js';
import bus from './bus.js';
import { sleep } from './helpers.js';

/**
 * 🚜 Platinum Task Queue (Internal Pattern)
 * 
 * Provides a structured way to handle background jobs with:
 * - Error tracking
 * - Success/Failure logging
 * - Concurrency control (via worker limit)
 * 
 * DESIGN NOTE: In a multi-server setup, this should be replaced with BullMQ.
 * In this single-runtime monolith, it provides an abstraction for reliable jobs.
 */

class TaskQueue {
  constructor(name, concurrency = 5) {
    this.name = name;
    this.queue = [];
    this.processing = 0;
    this.concurrency = concurrency;
    this.logger = createLogger(`TaskQueue:${name}`);
  }

  async add(taskName, fn, payload = {}) {
    this.logger.info(`Job Added: ${taskName}`, { payload });
    this.queue.push({ taskName, fn, payload, retries: 0 });
    bus.publish('task.status', { taskName, status: 'queued', payload });
    this.process();
  }

  async process() {
    if (this.processing >= this.concurrency || this.queue.length === 0) return;

    const job = this.queue.shift();
    this.processing++;
    bus.publish('task.status', { taskName: job.taskName, status: 'processing', userId: job.payload?.userId });

    try {
      this.logger.info(`Processing: ${job.taskName}`, { payload: job.payload });
      await job.fn(job.payload);
      
      bus.publish('task.status', { taskName: job.taskName, status: 'completed', userId: job.payload?.userId });
      await logEvent('TaskQueue', 'JOB_SUCCESS', `Job ${job.taskName} completed.`, { queue: this.name }, 'INFO');
    } catch (err) {
      this.logger.error(`Job Failed: ${job.taskName}`, err, { retries: job.retries, queue: this.name });
      
      if (job.retries < 3) {
        job.retries++;
        const backoffMs = 1000 * job.retries;
        bus.publish('task.status', { taskName: job.taskName, status: 'retrying', retry: job.retries, backoffMs, userId: job.payload?.userId });
        (async () => {
          await sleep(backoffMs);
          this.queue.push(job);
          this.process();
        })();
      } else {
        bus.publish('task.status', { taskName: job.taskName, status: 'failed', error: err.message, userId: job.payload?.userId });
        await logEvent('TaskQueue', 'JOB_FATAL', `Job ${job.taskName} failed after 3 retries.`, { error: err.message, queue: this.name }, 'ERROR');
      }
    } finally {
      this.processing--;
      this.process(); // Continue with next job
    }
  }
}

export const generalQueue = new TaskQueue('General');
export const emailQueue = new TaskQueue('Email', 10);
export const analyticsQueue = new TaskQueue('Analytics', 2);

export default { generalQueue, emailQueue, analyticsQueue };
