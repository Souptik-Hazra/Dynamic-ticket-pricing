import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import adminRepo from '../src/modules/admin/repository/admin.repo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

async function testRepo() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');
    
    console.log('Fetching security logs...');
    const logs = await adminRepo.listSecurityLogs();
    console.log(`Fetched ${logs.length} logs.`);
    process.exit(0);
  } catch (err) {
    console.error('FAIL:', err);
    process.exit(1);
  }
}

testRepo();
