import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

async function checkEvents() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const events = await db.collection('events').find({}).toArray();

        console.log('Events in database:');
        events.forEach(ev => {
            console.log(`ID: ${ev._id}, Name: ${ev.name}, Status: ${ev.status}, OrganizerId: ${ev.organizerId}`);
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkEvents();
