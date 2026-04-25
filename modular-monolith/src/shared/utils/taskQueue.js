import { logEvent } from './logger.js';
import bus from './bus.js';

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
  }

  async add(taskName, fn, payload = {}) {
    console.log(`🚜 [Queue:${this.name}] Job Added: ${taskName}`);
    
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
      console.log(`⚙️ [Queue:${this.name}] Processing: ${job.taskName}`);
      await job.fn(job.payload);
      
      bus.publish('task.status', { taskName: job.taskName, status: 'completed', userId: job.payload?.userId });
      await logEvent('TaskQueue', 'JOB_SUCCESS', `Job ${job.taskName} completed.`, { queue: this.name }, 'INFO');
    } catch (err) {
      console.error(`🚩 [Queue:${this.name}] Job Failed: ${job.taskName}`, err.message);
      
      if (job.retries < 3) {
        job.retries++;
        bus.publish('task.status', { taskName: job.taskName, status: 'retrying', userId: job.payload?.userId });
        this.queue.push(job);
      } else {
        bus.publish('task.status', { taskName: job.taskName, status: 'failed', error: err.message, userId: job.payload?.userId });
        await logEvent('TaskQueue', 'JOB_FATAL', `Job ${job.taskName} failed after 3 retries.`, { error: err.message }, 'ERROR');
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
