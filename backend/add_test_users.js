// Script to add test users with city and subscription plan for group testing
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = 'mongodb://localhost:27017/your_db_name'; // Change to your DB name

async function addTestUsers() {
  await mongoose.connect(MONGO_URI);

  const users = [
    {
      name: 'Test User 1',
      email: 'testuser1@example.com',
      password: 'password123',
      city: 'Mumbai',
      role: 'user',
      subscription: { plan: '7_days', isActive: true }
    },
    {
      name: 'Test User 2',
      email: 'testuser2@example.com',
      password: 'password123',
      city: 'Delhi',
      role: 'user',
      subscription: { plan: '30_days', isActive: true }
    },
    {
      name: 'Test User 3',
      email: 'testuser3@example.com',
      password: 'password123',
      city: 'Bangalore',
      role: 'user',
      subscription: { plan: 'none', isActive: false }
    }
  ];

  for (const user of users) {
    const exists = await User.findOne({ email: user.email });
    if (!exists) {
      await User.create(user);
      console.log('Added:', user.email);
    } else {
      console.log('Exists:', user.email);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

addTestUsers();
