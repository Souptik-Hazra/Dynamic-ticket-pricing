// Script to create a new admin user in MongoDB
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

async function createAdmin(name, email, password) {
  await mongoose.connect(MONGODB_URI);
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('User already exists:', email);
    process.exit(1);
  }
  const user = new User({
    name,
    email,
    password,
    role: 'admin'
  });
  await user.save();
  console.log('Admin user created:', user);
  process.exit(0);
}

// Usage: node createAdmin.js "Admin Name" "admin@email.com" "Password123"
const [,, name, email, password] = process.argv;
if (!name || !email || !password) {
  console.log('Usage: node createAdmin.js "Admin 1" "admin@cf.com" "admin123"');
  process.exit(1);
}
createAdmin(name, email, password);