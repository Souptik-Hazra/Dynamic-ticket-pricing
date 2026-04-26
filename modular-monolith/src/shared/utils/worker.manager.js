import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, 'cpu.worker.js');

import os from 'os';

/**
 * WorkerManager
 * Offloads CPU-intensive tasks to background threads to keep the event loop free.
 */
class WorkerManager {
  /**
   * Runs a task in a background worker thread.
   * @param {string} taskName - The name of the task to run (e.g., 'verifyPoW')
   * @param {any} payload - The data needed for the task
   * @returns {Promise<any>}
   */
  async runTask(taskName, payload) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_PATH, {
        workerData: { taskName, payload }
      });



      worker.on('message', (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.data);
        }
      });

      worker.on('error', (err) => {
        reject(err);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }
}

export default new WorkerManager();
