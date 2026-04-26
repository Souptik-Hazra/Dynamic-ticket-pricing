import { verifyTemporalProof } from '../src/shared/utils/helpers.js';
import crypto from 'crypto';

async function testPoW() {
  console.log('🧪 Testing Proof-of-Work in Worker Thread...');
  
  const challenge = 'test-challenge';
  const difficulty = 5000; // High enough to trigger worker
  
  // Calculate proof manually to verify
  let expectedProof = challenge;
  for (let i = 0; i < difficulty; i++) {
    expectedProof = crypto.createHash('sha256').update(expectedProof + i).digest('hex');
  }

  console.log('⏳ Running async verification (Worker)...');
  const start = Date.now();
  const isValid = await verifyTemporalProof(challenge, expectedProof, difficulty);
  const end = Date.now();

  console.log(`✅ Result: ${isValid}`);
  console.log(`⏱️ Time taken: ${end - start}ms`);

  if (isValid) {
    console.log('🎉 Worker Thread POW Verification Successful!');
  } else {
    console.error('❌ Worker Thread POW Verification Failed!');
    process.exit(1);
  }
}

import workerManager from '../src/shared/utils/worker.manager.js';

async function testAggregation() {
  console.log('\n🧠 Testing Federated Aggregation in Worker Thread...');
  
  // Mock some weight data
  const mockWeights = [
    { name: 'layer1', shape: [2, 2], data: [0.1, 0.2, 0.3, 0.4] },
    { name: 'layer2', shape: [1], data: [0.5] }
  ];

  const mockBuffer = [
    { nodeId: 'node1', reputationScore: 1.0, clippedWeights: mockWeights, timestamp: Date.now() },
    { nodeId: 'node2', reputationScore: 0.8, clippedWeights: mockWeights, timestamp: Date.now() },
    { nodeId: 'node3', reputationScore: 0.9, clippedWeights: mockWeights, timestamp: Date.now() }
  ];

  console.log(`⏳ Offloading aggregation for ${mockBuffer.length} participants to worker...`);
  try {
    const start = Date.now();
    const result = await workerManager.runTask('aggregateWeights', {
      buffer: mockBuffer,
      threshold: 3,
      clipNorm: 15.0,
      dpEpsilon: 0.05
    });
    const end = Date.now();

    console.log('✅ Worker returned result:', {
      hasWeights: !!result.finalWeights,
      rejectedCount: result.rejectedCount,
      validCount: result.validParticipantsCount,
      weightsCount: result.finalWeights.length
    });
    console.log(`⏱️ Time taken: ${end - start}ms`);
    
    if (result.finalWeights && result.finalWeights.length > 0) {
      console.log('🎉 Worker Thread AI Aggregation Logic Successful!');
    } else {
      throw new Error('Aggregation returned empty weights');
    }
  } catch (err) {
    console.error('❌ Aggregation Test Failed:', err);
    throw err;
  }
}


async function runAllTests() {
  await testPoW();
  await testAggregation();
}

runAllTests().catch(err => {
  console.error('💥 Test Error:', err);
  process.exit(1);
});

