import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

async function checkSecurityLogs() {
  try {
    await mongoose.connect(MONGODB_URI);
    const logs = await mongoose.connection.db.collection('systemlogs')
      .find({ level: 'WARN' })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    
    console.log(`Found ${logs.length} security events.`);
    console.log(JSON.stringify(logs, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkSecurityLogs();
