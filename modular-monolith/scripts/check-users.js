import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

async function checkUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    const count = await mongoose.connection.db.collection('users').countDocuments();
    console.log(`Total Users: ${count}`);
    const users = await mongoose.connection.db.collection('users').find({}).limit(5).toArray();
    console.log('Sample Users:', users.map(u => ({ email: u.email, role: u.role })));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkUsers();
