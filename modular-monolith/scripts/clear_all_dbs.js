import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
// Also load from organizer-service if present for Neo4j credentials
dotenv.config({ path: '../microservices/organizer-service/.env' });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASS = process.env.NEO4J_PASSWORD || 'password';

async function clearMongo() {
    console.log('🧹 Clearing MongoDB...');
    try {
        await mongoose.connect(MONGO_URI);
        const collections = await mongoose.connection.db.collections();
        for (let collection of collections) {
            await collection.deleteMany({});
            console.log(`   - Deleted all from ${collection.collectionName}`);
        }
        console.log('✅ MongoDB Cleared.');
        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ MongoDB Clear Failed:', err.message);
    }
}

async function clearNeo4j() {
    console.log('🧹 Clearing Neo4j...');
    const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASS));
    const session = driver.session();
    try {
        await session.run('MATCH (n) DETACH DELETE n');
        console.log('✅ Neo4j Cleared (All nodes and relationships deleted).');
    } catch (err) {
        console.error('❌ Neo4j Clear Failed:', err.message);
    } finally {
        await session.close();
        await driver.close();
    }
}

async function run() {
    console.log('🚀 Starting Database Purge...');
    await clearMongo();
    await clearNeo4j();
    console.log('✨ All Project Databases are now clean.');
    process.exit(0);
}

run();
