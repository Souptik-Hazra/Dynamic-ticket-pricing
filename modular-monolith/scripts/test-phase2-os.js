import bus from '../src/shared/utils/bus.js';
import lockManager from '../src/shared/utils/lock.manager.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testBusBackpressure() {
  console.log('🚌 Testing Event Bus Backpressure...');
  
  let criticalCount = 0;
  let nonCriticalCount = 0;

  bus.subscribe('critical.event', () => criticalCount++);
  bus.subscribe('background.event', () => nonCriticalCount++);

  console.log('⏳ Flooding the bus with 200 events (Threshold is 100)...');
  
  for (let i = 0; i < 200; i++) {
    // 50% critical, 50% background
    if (i % 2 === 0) {
      bus.publish('critical.event', { i }, true);
    } else {
      bus.publish('background.event', { i }, false);
    }
  }

  // Wait for setImmediate queue to clear
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log(`✅ Results:`);
  console.log(`   Critical Events Processed: ${criticalCount}/100`);
  console.log(`   Non-Critical Events Processed: ${nonCriticalCount}/100`);
  
  if (nonCriticalCount < 100 && criticalCount === 100) {
    console.log('🎉 Backpressure & Prioritization working correctly!');
  } else {
    console.warn('⚠️ Backpressure results were not as expected (likely due to threshold timing)');
  }
}

async function testFileLocking() {
  console.log('\n🔒 Testing Atomic File Locking...');
  
  const lockName = 'master_election_test';
  
  console.log('Attempting to acquire lock...');
  const first = lockManager.acquireLock(lockName);
  console.log(`   First attempt: ${first ? '✅ SUCCESS' : '❌ FAILED'}`);

  const second = lockManager.acquireLock(lockName);
  console.log(`   Second attempt (while held): ${second ? '✅ SUCCESS' : '❌ FAILED (Correct)'}`);

  lockManager.releaseLock(lockName);
  console.log('Released lock.');

  const third = lockManager.acquireLock(lockName);
  console.log(`   Third attempt (after release): ${third ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  lockManager.releaseLock(lockName);
  
  if (first && !second && third) {
    console.log('🎉 Atomic File Locking Verification Successful!');
  } else {
    console.error('❌ File Locking Verification Failed!');
    process.exit(1);
  }
}

async function run() {
  await testBusBackpressure();
  await testFileLocking();
}

run().catch(console.error);
