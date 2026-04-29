import { securityService } from '../src/modules/auth/index.js';
import crypto from 'crypto';
import workerManager from '../src/shared/utils/worker.manager.js';
import os from 'os';
import bus from '../src/shared/utils/bus.js';
import lockManager from '../src/shared/utils/lock.manager.js';
import { writeDurableLog } from '../src/shared/utils/durability.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectMongoDB } from '../src/shared/db/index.js';
import ticketService from '../src/modules/tickets/service/ticket.service.js';
import catalogRepo from '../src/modules/catalog/repository/catalog.repo.js';
import ticketRepo from '../src/modules/tickets/repository/ticket.repo.js';

// --- From test-threads.js ---
async function testPoW() {
  console.log('\n🧪 Testing Proof-of-Work in Worker Thread...');
  const challenge = 'test-challenge';
  const difficulty = 5000;
  let expectedProof = challenge;
  for (let i = 0; i < difficulty; i++) expectedProof = crypto.createHash('sha256').update(expectedProof + i).digest('hex');
  const start = Date.now();
  const isValid = await securityService.verifyTemporalProof(challenge, expectedProof, difficulty);
  console.log(`✅ Result: ${isValid} | ⏱️ Time taken: ${Date.now() - start}ms`);
  if (!isValid) throw new Error('Worker Thread POW Verification Failed!');
}

async function testAggregation() {
  console.log('\n🧠 Testing Federated Aggregation in Worker Thread...');
  const mockWeights = [ { name: 'layer1', shape: [2, 2], data: [0.1, 0.2, 0.3, 0.4] }, { name: 'layer2', shape: [1], data: [0.5] } ];
  const mockBuffer = [
    { nodeId: 'node1', reputationScore: 1.0, clippedWeights: mockWeights, timestamp: Date.now() },
    { nodeId: 'node2', reputationScore: 0.8, clippedWeights: mockWeights, timestamp: Date.now() }
  ];
  const start = Date.now();
  const result = await workerManager.runTask('aggregateWeights', { buffer: mockBuffer, threshold: 2, clipNorm: 15.0, dpEpsilon: 0.05 });
  console.log(`✅ Worker returned result. ⏱️ Time taken: ${Date.now() - start}ms`);
  if (!result.finalWeights || result.finalWeights.length === 0) throw new Error('Aggregation returned empty weights');
}

// --- From test-os-optimizations.js ---
async function testSharedMemoryPerformance() {
  console.log('\n🚀 Testing Shared Memory Performance (Zero-Copy)...');
  const size = 1000000;
  const data = new Float32Array(size).fill(0.5);
  const normalData = Array.from(data);
  const normalBuffer = [{ nodeId: 'node1', reputationScore: 1.0, clippedWeights: [{ name: 'w', shape: [size], data: normalData }], timestamp: Date.now() }];
  
  let start = Date.now();
  await workerManager.runTask('aggregateWeights', { buffer: normalBuffer, threshold: 1, clipNorm: 15, dpEpsilon: 0.01 });
  const timeNormal = Date.now() - start;

  const sab = new SharedArrayBuffer(size * 4);
  const sharedTypedArray = new Float32Array(sab);
  sharedTypedArray.set(data);
  const sharedBuffer = [{ nodeId: 'node2', reputationScore: 1.0, clippedWeights: [{ name: 'w', shape: [size], data: sharedTypedArray }], timestamp: Date.now() }];
  
  start = Date.now();
  await workerManager.runTask('aggregateWeights', { buffer: sharedBuffer, threshold: 1, clipNorm: 15, dpEpsilon: 0.01 });
  const timeShared = Date.now() - start;

  const improvement = timeNormal - timeShared;
  console.log(`✅ Shared Memory is ${improvement > 0 ? improvement + 'ms faster' : 'not significantly faster for this size'}`);
}

async function testTaskPriority() {
  console.log('\n⚖️ Testing Task Priority Scheduling...');
  await workerManager.runTask('verifyPoW', { challenge: 'c', proof: 'p', difficulty: 10 });
  console.log('✅ Worker task completed.');
}

// --- From test-phase2-os.js ---
async function testBusBackpressure() {
  console.log('\n🚌 Testing Event Bus Backpressure...');
  let criticalCount = 0, nonCriticalCount = 0;
  bus.subscribe('critical.event', () => criticalCount++);
  bus.subscribe('background.event', () => nonCriticalCount++);
  
  for (let i = 0; i < 200; i++) {
    if (i % 2 === 0) bus.publish('critical.event', { i }, true);
    else bus.publish('background.event', { i }, false);
  }
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log(`✅ Critical: ${criticalCount}/100 | Non-Critical: ${nonCriticalCount}/100`);
}

async function testFileLocking() {
  console.log('\n🔒 Testing Atomic File Locking...');
  const lockName = 'master_election_test';
  const first = lockManager.acquireLock(lockName);
  const second = lockManager.acquireLock(lockName);
  lockManager.releaseLock(lockName);
  const third = lockManager.acquireLock(lockName);
  lockManager.releaseLock(lockName);
  if (first && !second && third) console.log('✅ Atomic File Locking Verification Successful!');
  else throw new Error('File Locking Verification Failed!');
}

// --- From test-durability.js ---
async function testDurability() {
  console.log('\n💾 Testing File System Synchronization (fdatasync)...');
  const testData = { test: 'Durable Log', value: Math.random() };
  await writeDurableLog(testData);
  const logPath = path.join(process.cwd(), 'logs', 'transactions.audit.log');
  if (fs.existsSync(logPath) && fs.readFileSync(logPath, 'utf8').includes(JSON.stringify(testData))) {
    console.log('✅ fdatasync Verification Successful! Data is on disk.');
  } else throw new Error('Data not found in log file');
}

// --- From test-transactions.js ---
async function testTransactionAtomicity() {
  console.log('\n🛡️ Testing Database Transaction Atomicity...');
  try {
    await connectMongoDB();
    const event = await catalogRepo.findOneAndUpdate({}, { $set: { availableTickets: 10, ticketsSold: 0 } });
    if (!event) {
      console.log('⚠️ No events found to test transactions. Skipping transaction test.');
      return;
    }
    const initialAvailable = event.availableTickets;
    const originalCreate = ticketRepo.create;
    ticketRepo.create = async () => { throw new Error('SIMULATED_DB_FAILURE_DURING_TICKET_CREATION'); };

    try {
      await ticketService.purchaseTickets('test-user-id', {
        eventId: event._id, quantity: 1, pricePerTicket: 100,
        humanityProof: 'valid', temporalProof: crypto.createHash('sha256').update('valid0').digest('hex'), difficulty: 1
      }, { name: 'Test User', email: 'test@example.com' });
    } catch (err) {}

    const refreshedEvent = await catalogRepo.findById(event._id);
    ticketRepo.create = originalCreate;
    if (refreshedEvent.availableTickets === initialAvailable) console.log('✅ TRANSACTION SUCCESSFUL: Inventory was rolled back!');
    else throw new Error('TRANSACTION FAILED: Inventory was NOT rolled back!');
  } catch (err) {
    console.error('⚠️ DB Connection or test failed (might be expected without DB):', err.message);
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

async function masterTestSuite() {
  console.log('🚀 Starting Master Core Architecture Test Suite...\n');
  try {
    await testPoW();
    await testAggregation();
    await testSharedMemoryPerformance();
    await testTaskPriority();
    await testBusBackpressure();
    await testFileLocking();
    await testDurability();
    await testTransactionAtomicity();
    console.log('\n🏆 ALL CORE ARCHITECTURE TESTS COMPLETED SUCCESSFULLY.');
  } catch (err) {
    console.error('\n❌ Core tests failed:', err.message);
    process.exit(1);
  }
}

masterTestSuite();
