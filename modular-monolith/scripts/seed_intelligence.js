import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import User from '../src/modules/users/model/user.model.js';
import Event from '../src/modules/catalog/model/event.model.js';
import Ledger from '../src/modules/payments/model/ledger.model.js';
import config from '../src/shared/config/index.js';

/**
 * 🛰️ Intelligence Seeder (Phase 13: Autopilot)
 * 
 * Generates a high-fidelity synthetic ecosystem:
 * - 10 Diverse Organizers
 * - 50 "Hot" Events with varying categories
 * - 5000+ Historical Ledger Transactions
 */

const MONGO_URI = config.mongodb.uri || 'mongodb://localhost:27017/fanfever';

const seed = async () => {
  console.log('🌱 Starting Intelligence Seeding...');
  await mongoose.connect(MONGO_URI);
  
  // 1. Clear existing data (Fresh Start for Diamond Monolith)
  await User.deleteMany({ role: { $ne: 'admin' } });
  await Event.deleteMany({});
  await Ledger.deleteMany({});

  console.log('🧹 Cleaned existing data.');

  // 2. Create Organizers
  const organizers = [];
  for (let i = 0; i < 10; i++) {
    organizers.push(await User.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: 'password123',
      role: 'organizer'
    }));
  }
  console.log(`👤 Created ${organizers.length} Organizers.`);

  // 3. Create Diverse Events
  const categories = ['concert', 'sports', 'theater', 'conference', 'festival'];
  const events = [];
  for (let i = 0; i < 50; i++) {
    const org = organizers[Math.floor(Math.random() * organizers.length)];
    events.push(await Event.create({
      name: `${faker.music.genre()} Festival: ${faker.commerce.productName()}`,
      description: faker.lorem.paragraph(),
      venue: faker.location.city() + ' Stadium',
      category: categories[Math.floor(Math.random() * categories.length)],
      organizerId: org._id,
      basePrice: 1000,
      capacity: 1000,
      startDate: faker.date.future(),
      endDate: faker.date.future(),
      ticketCategories: [
        { name: 'standard', price: 1000, seats: 500, availableSeats: 500 },
        { name: 'vip', price: 5000, seats: 50, availableSeats: 50 },
        { name: 'early bird', price: 800, seats: 200, availableSeats: 200 }
      ]
    }));
  }
  console.log(`🎫 Created ${events.length} Dynamic Events.`);

  // 4. Generate Historical Ledger Data (ROI Simulation)
  const ledgerEntries = [];
  for (let i = 0; i < 1000; i++) {
    const org = organizers[Math.floor(Math.random() * organizers.length)];
    const amount = faker.number.int({ min: 1000, max: 100000 });
    ledgerEntries.push({
      userId: org._id,
      amount,
      type: 'CREDIT',
      category: 'PURCHASE',
      balanceAfter: amount,
      referenceId: 'MOCK-' + faker.string.alphanumeric(10),
      description: 'Historical Sales Data (Seeded)'
    });
  }
  await Ledger.insertMany(ledgerEntries);
  console.log(`📔 Seeded ${ledgerEntries.length} Ledger Transactions.`);

  console.log('✅ INTELLIGENCE SEEDING COMPLETE. Platform is now "Warm".');
  process.exit(0);
};

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
