import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Event from '../src/modules/catalog/model/event.model.js';
import config from '../src/shared/config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load unified root .env (one canonical env for the whole workspace)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || config.mongodb?.uri || 'mongodb://localhost:27017/dynamic-ticket-pricing';

async function checkSystem() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('--- SYSTEM CHECK STARTED ---');

    // 1. Check Users
    const userCount = await mongoose.connection.db.collection('users').countDocuments();
    console.log(`\n[Users] Total Users: ${userCount}`);
    const users = await mongoose.connection.db.collection('users').find({}).limit(5).toArray();
    console.log('[Users] Sample Users:', users.map(u => ({ email: u.email, role: u.role })));

    // 2. Check Security Logs
    const securityLogs = await mongoose.connection.db.collection('systemlogs')
      .find({ level: 'WARN' })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    console.log(`\n[Security] Found ${securityLogs.length} security (WARN) events.`);
    if (securityLogs.length > 0) console.log(JSON.stringify(securityLogs, null, 2));

    // 3. Dump Error Logs
    const errorLogs = await mongoose.connection.db.collection('systemlogs')
      .find({ level: 'ERROR' })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();
    console.log(`\n[Logs] Found ${errorLogs.length} ERROR logs.`);
    if (errorLogs.length > 0) console.log(JSON.stringify(errorLogs, null, 2));

    // 4. ROI Report
    console.log('\n[ROI] Generating ROI Report...');
    const events = await Event.find({});
    let totalAiSurplus = 0;
    let totalBaseRevenue = 0;

    events.forEach(e => {
      totalAiSurplus += (e.profitAmount || 0);
      totalBaseRevenue += (e.baseRevenue || 0);
      if (e.profitAmount > 0) {
        console.log(`✅ ${e.name.padEnd(40)} | AI Surplus: ₹${String(e.profitAmount).padEnd(10)} | Gain: ${(e.profitPercentage || 0).toFixed(2)}%`);
      }
    });

    console.log('\n--- GLOBAL FINANCIAL SUMMARY ---');
    console.log(`💰 Total Base Revenue:  ₹${totalBaseRevenue.toLocaleString()}`);
    console.log(`💎 Total AI Surplus:   ₹${totalAiSurplus.toLocaleString()}`);
    console.log(`📈 Platform Efficiency: ${((totalAiSurplus / (totalBaseRevenue || 1)) * 100).toFixed(2)}%`);
    console.log('--------------------------------\n');

    console.log('--- SYSTEM CHECK COMPLETE ---');
    process.exit(0);
  } catch (err) {
    console.error('Error during system check:', err);
    process.exit(1);
  }
}

checkSystem();
