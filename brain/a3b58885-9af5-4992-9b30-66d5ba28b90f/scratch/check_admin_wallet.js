import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

async function checkAdminWallet() {
    try {
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection.db;
        
        const admin = await db.collection('users').findOne({ role: 'admin' });
        if (!admin) {
            console.log('No admin found');
            return;
        }
        
        const wallet = await db.collection('wallets').findOne({ userId: admin._id });
        console.log(`Admin ID: ${admin._id}, Name: ${admin.name}`);
        console.log(`Wallet Balance: ${wallet?.balance}`);
        console.log('Transactions:');
        wallet?.transactions?.forEach(t => {
            console.log(`[${t.type}] Amount: ${t.amount}, Desc: ${t.description}, Date: ${t.date || 'N/A'}`);
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkAdminWallet();
