import { writeDurableLog } from '../src/shared/utils/durability.js';
import fs from 'fs';
import path from 'path';

async function testDurability() {
  console.log('💾 Testing File System Synchronization (fdatasync)...');
  
  const testData = { test: 'Durable Log', value: Math.random() };
  
  console.log('⏳ Writing durable log...');
  const start = Date.now();
  await writeDurableLog(testData);
  const end = Date.now();
  
  console.log(`✅ Durable log written and flushed in ${end - start}ms`);
  
  const logPath = path.join(process.cwd(), 'logs', 'transactions.audit.log');
  if (fs.existsSync(logPath)) {
    const content = fs.readFileSync(logPath, 'utf8');
    if (content.includes(JSON.stringify(testData))) {
      console.log('🎉 fdatasync Verification Successful! Data is on disk.');
    } else {
      throw new Error('Data not found in log file');
    }
  } else {
    throw new Error('Log file not created');
  }
}

testDurability().catch(console.error);
