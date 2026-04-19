import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

async function checkCommissions() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const commissions = await db.collection('commissions').find({}).toArray();

        console.log('Commissions in database:');
        for (const c of commissions) {
            const event = await db.collection('events').findOne({ _id: c.eventId });
            console.log(`Event: ${event?.name}, Revenue: ${c.totalRevenue}, Commission: ${c.commissionAmount}, Percentage: ${c.percentage}, Date: ${c.payoutDate}`);
        }

        const admin = await db.collection('users').findOne({ role: 'admin' });
        const wallet = await db.collection('wallets').findOne({ userId: admin._id });
        console.log(`Admin Wallet Balance: ${wallet?.balance}`);

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkCommissions();
