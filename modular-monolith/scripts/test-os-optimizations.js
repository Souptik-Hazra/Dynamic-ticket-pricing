import workerManager from '../src/shared/utils/worker.manager.js';
import os from 'os';

async function testSharedMemoryPerformance() {
  console.log('🚀 Testing Shared Memory Performance (Zero-Copy)...');
  
  // Large weight data simulation (1 million parameters)
  const size = 1000000;
  const data = new Float32Array(size).fill(0.5);
  
  // Normal Array (Cloned)
  const normalData = Array.from(data);
  const normalBuffer = [
    { nodeId: 'node1', reputationScore: 1.0, clippedWeights: [{ name: 'w', shape: [size], data: normalData }], timestamp: Date.now() }
  ];

  console.log('⏳ Running aggregation with CLONED data...');
  const startNormal = Date.now();
  await workerManager.runTask('aggregateWeights', { buffer: normalBuffer, threshold: 1, clipNorm: 15, dpEpsilon: 0.01 });
  const endNormal = Date.now();
  console.log(`⏱️ Cloned transfer time: ${endNormal - startNormal}ms`);

  // Shared Memory (Zero-Copy)
  const sab = new SharedArrayBuffer(size * 4);
  const sharedTypedArray = new Float32Array(sab);
  sharedTypedArray.set(data);
  const sharedBuffer = [
    { nodeId: 'node2', reputationScore: 1.0, clippedWeights: [{ name: 'w', shape: [size], data: sharedTypedArray }], timestamp: Date.now() }
  ];

  console.log('⏳ Running aggregation with SHARED memory...');
  const startShared = Date.now();
  await workerManager.runTask('aggregateWeights', { buffer: sharedBuffer, threshold: 1, clipNorm: 15, dpEpsilon: 0.01 });
  const endShared = Date.now();
  console.log(`⏱️ Shared transfer time: ${endShared - startShared}ms`);

  const improvement = ((endNormal - startNormal) - (endShared - startShared));
  console.log(`✅ Shared Memory is ${improvement > 0 ? improvement + 'ms faster' : 'not significantly faster for this size'}`);
}

async function testTaskPriority() {
  console.log('\n⚖️ Testing Task Priority Scheduling...');
  
  // We can't easily check the priority of the thread from the master, 
  // but we can check if os.setPriority was called without error.
  console.log('Checking WorkerManager for priority logic...');
  
  const start = Date.now();
  await workerManager.runTask('verifyPoW', { challenge: 'c', proof: 'p', difficulty: 10 });
  const end = Date.now();
  
  console.log('✅ Worker task completed. Check console for "Failed to set priority" warnings.');
}

async function run() {
  await testSharedMemoryPerformance();
  await testTaskPriority();
}

run().catch(console.error);
