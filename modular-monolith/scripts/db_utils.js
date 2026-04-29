import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';
import crypto from 'crypto';

import User from '../src/modules/users/model/user.model.js';
import Event from '../src/modules/catalog/model/event.model.js';
import Ledger from '../src/modules/payments/model/ledger.model.js';
import PriceLog from '../src/modules/ai/model/priceLog.model.js';
import config from '../src/shared/config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load unified root .env (one canonical env for the whole workspace)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || config.mongodb?.uri || 'mongodb://localhost:27017/dynamic-ticket-pricing';
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASS = process.env.NEO4J_PASSWORD || 'password';

async function clearDbs() {
  console.log('🧹 Clearing MongoDB...');
  try {
    await mongoose.connect(MONGO_URI);
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
    console.log('✅ MongoDB Cleared.');
  } catch (err) {
    console.error('❌ MongoDB Clear Failed:', err.message);
  }

  console.log('🧹 Clearing Neo4j...');
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASS));
  const session = driver.session();
  try {
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('✅ Neo4j Cleared.');
  } catch (err) {
    console.error('❌ Neo4j Clear Failed:', err.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

async function seedAdmin() {
  console.log('🌱 Seeding Admin User...');
  try {
    await mongoose.connect(MONGO_URI);
    const adminEmail = 'admin@fanfever.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('Admin user already exists.');
    } else {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({ name: 'System Admin', email: adminEmail, password: hashedPassword, role: 'admin', city: 'Metropolis' });
      console.log('✅ Admin user seeded successfully. (admin@fanfever.com / admin123)');
    }
  } catch (err) {
    console.error('❌ Admin Seed Failed:', err.message);
  }
}

async function seedData() {
  console.log('🌱 Starting Data Seeding (Intelligence & Audit)...');
  try {
    await mongoose.connect(MONGO_URI);
    
    await User.deleteMany({ role: { $ne: 'admin' } });
    await Event.deleteMany({});
    await Ledger.deleteMany({});
    
    const organizers = [];
    for (let i = 0; i < 10; i++) organizers.push(await User.create({ name: faker.person.fullName(), email: faker.internet.email(), password: 'password123', role: 'organizer' }));
    
    const categories = ['concert', 'sports', 'theater', 'conference', 'festival'];
    const events = [];
    for (let i = 0; i < 50; i++) {
      const org = organizers[Math.floor(Math.random() * organizers.length)];
      events.push(await Event.create({
        name: `${faker.music.genre()} Festival: ${faker.commerce.productName()}`,
        description: faker.lorem.paragraph(),
        venue: faker.location.city() + ' Stadium',
        category: categories[Math.floor(Math.random() * categories.length)],
        organizerId: org._id, basePrice: 1000, capacity: 1000, startDate: faker.date.future(), endDate: faker.date.future(),
        ticketCategories: [
          { name: 'standard', price: 1000, seats: 500, availableSeats: 500 },
          { name: 'vip', price: 5000, seats: 50, availableSeats: 50 }
        ]
      }));
    }
    
    const ledgerEntries = [];
    for (let i = 0; i < 1000; i++) {
      const org = organizers[Math.floor(Math.random() * organizers.length)];
      const amount = faker.number.int({ min: 1000, max: 100000 });
      ledgerEntries.push({ userId: org._id, amount, type: 'CREDIT', category: 'PURCHASE', balanceAfter: amount, referenceId: 'MOCK-' + faker.string.alphanumeric(10), description: 'Seeded' });
    }
    await Ledger.insertMany(ledgerEntries);
    
    const decisionTypes = ['Occupancy Spike', 'Velocity Adjustment', 'Base Recalibration', 'Competitor Match'];
    const logs = [];
    for (let i = 0; i < 20; i++) {
      const event = events[Math.floor(Math.random() * events.length)];
      logs.push({
        eventId: event._id, timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        features: { capacity: event.capacity, ticketsSold: Math.floor(Math.random() * event.capacity), basePrice: event.basePrice, occupancyRate: Math.random() },
        predictedPrice: event.basePrice * (1 + Math.random() * 0.5), actualPrice: event.basePrice * (1 + Math.random() * 0.5),
        isAudit: true, auditHash: '0x' + crypto.randomBytes(20).toString('hex'), behavioralSignature: decisionTypes[Math.floor(Math.random() * decisionTypes.length)]
      });
    }
    await PriceLog.insertMany(logs);
    console.log(`✅ Seeded ${events.length} Events, ${organizers.length} Organizers, ${ledgerEntries.length} Ledger entries, ${logs.length} Audit logs.`);
  } catch (err) {
    console.error('❌ Data Seeding Failed:', err.message);
  }
}

async function run() {
  const mode = process.argv[2];
  if (mode === 'clear') await clearDbs();
  else if (mode === 'seed_admin') await seedAdmin();
  else if (mode === 'seed_data') await seedData();
  else if (mode === 'seed_all') { await seedAdmin(); await seedData(); }
  else {
    console.log(`
Usage: node db_utils.js <command>
Commands:
  clear       - Clear all databases (MongoDB & Neo4j)
  seed_admin  - Seed only the admin user
  seed_data   - Seed events, users, logs
  seed_all    - Seed admin + data
    `);
  }
  process.exit(0);
}

run();
