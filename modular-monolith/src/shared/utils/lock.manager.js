import fs from 'fs';
import path from 'path';
import os from 'os';
import { logWarn } from './logger.js';

const LOCK_DIR = path.join(os.tmpdir(), 'fanfever-locks');

// Ensure lock directory exists
if (!fs.existsSync(LOCK_DIR)) {
  try {
    fs.mkdirSync(LOCK_DIR, { recursive: true });
  } catch (err) {
    // Ignore if another process created it simultaneously
  }
}

/**
 * LockManager
 * OS Concept: Advisory File Locking
 * Uses the filesystem to coordinate between multiple Node.js processes.
 */
class LockManager {
  /**
   * Tries to acquire a lock
   * @param {string} lockName 
   * @returns {boolean} True if lock acquired, false if already held
   */
  acquireLock(lockName) {
    const lockPath = path.join(LOCK_DIR, `${lockName}.lock`);
    try {
      // Use 'wx' flag: Open for writing. 
      // Fails if the file exists (Atomic operation at OS level)
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      
      // Auto-release on process exit
      process.on('exit', () => this.releaseLock(lockName));
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Check if the holding process is still alive (Stale lock detection)
        try {
          const pid = parseInt(fs.readFileSync(lockPath, 'utf8'));
          if (pid && !this._isProcessRunning(pid)) {
            logWarn('LockManager', `Stale lock detected for ${lockName} (PID ${pid}). Reclaiming...`, { lockName, pid });
            this.releaseLock(lockName);
            return this.acquireLock(lockName);
          }
        } catch (readErr) {
          // Ignore read errors
        }
        return false;
      }
      throw err;
    }
  }

  /**
   * Releases a lock
   * @param {string} lockName 
   */
  releaseLock(lockName) {
    const lockPath = path.join(LOCK_DIR, `${lockName}.lock`);
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    } catch (err) {
      // Ignore errors during release
    }
  }

  _isProcessRunning(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return false;
    }
  }
}

export default new LockManager();
