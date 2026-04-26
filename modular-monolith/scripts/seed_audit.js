import mongoose from 'mongoose';
import PriceLog from '../src/modules/ai/model/priceLog.model.js';
import Event from '../src/modules/catalog/model/event.model.js';
import config from '../src/shared/config/index.js';
import crypto from 'crypto';

const MONGO_URI = config.mongodb.uri || 'mongodb://localhost:27017/fanfever';

const seedAuditLogs = async () => {
  console.log('🌱 Seeding Audit Logs...');
  await mongoose.connect(MONGO_URI);

  const events = await Event.find().limit(5);
  if (events.length === 0) {
    console.error('❌ No events found to seed audit logs. Run seed_intelligence.js first.');
    process.exit(1);
  }

  const decisionTypes = ['Occupancy Spike', 'Velocity Adjustment', 'Base Recalibration', 'Competitor Match'];
  
  const logs = [];
  for (let i = 0; i < 20; i++) {
    const event = events[Math.floor(Math.random() * events.length)];
    const hash = '0x' + crypto.randomBytes(20).toString('hex');
    
    logs.push({
      eventId: event._id,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      features: {
        capacity: event.capacity,
        ticketsSold: Math.floor(Math.random() * event.capacity),
        basePrice: event.basePrice,
        occupancyRate: Math.random()
      },
      predictedPrice: event.basePrice * (1 + Math.random() * 0.5),
      actualPrice: event.basePrice * (1 + Math.random() * 0.5),
      isAudit: true,
      auditHash: hash,
      behavioralSignature: decisionTypes[Math.floor(Math.random() * decisionTypes.length)]
    });
  }

  await PriceLog.insertMany(logs);
  console.log(`✅ Seeded ${logs.length} Pricing Audit Logs.`);
  process.exit(0);
};

seedAuditLogs().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
