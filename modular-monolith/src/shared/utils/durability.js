import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'logs', 'transactions.audit.log');

// Ensure log directory exists
const logDir = path.dirname(LOG_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * writeDurableLog
 * OS Concept: File System Synchronization (fdatasync)
 * Ensures data is physically written to the storage hardware before proceeding.
 * This provides "Durability" for critical financial transactions.
 */
export async function writeDurableLog(data) {
  const entry = `${new Date().toISOString()} | ${JSON.stringify(data)}\n`;
  
  return new Promise((resolve, reject) => {
    // 1. Open the file
    fs.open(LOG_PATH, 'a', (err, fd) => {
      if (err) return reject(err);

      // 2. Write to OS buffer
      fs.write(fd, entry, (writeErr) => {
        if (writeErr) {
          fs.close(fd, () => {});
          return reject(writeErr);
        }

        // 3. FORCE OS to flush buffer to physical media (The Concept)
        // Unlike fs.sync(), fdatasync() only flushes data, not metadata (like access time),
        // making it faster while still ensuring data safety.
        fs.fdatasync(fd, (syncErr) => {
          fs.close(fd, () => {});
          if (syncErr) return reject(syncErr);
          resolve(true);
        });
      });
    });
  });
}

export default { writeDurableLog };
