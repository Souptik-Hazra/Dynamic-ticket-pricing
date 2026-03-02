const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

const createTestUser = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const testUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123',
      role: 'user'
    };

    // Check if user exists
    const existingUser = await User.findOne({ email: testUser.email });
    if (existingUser) {
      console.log('Test user already exists');
      console.log(`Email: ${testUser.email}`);
      console.log(`Password: ${testUser.password}`);
      process.exit(0);
    }

    // Create user
    // The User model pre-save hook will hash the password
    const user = await User.create(testUser);
    
    console.log('✅ Test user created successfully');
    console.log(`Name: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${testUser.password}`);
    
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

createTestUser();
