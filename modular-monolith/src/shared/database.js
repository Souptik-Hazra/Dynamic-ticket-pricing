import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

// ── MongoDB ────────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

export const connectMongoDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 50,
      minPoolSize: 5,
    });
    console.log('✅ [Database] MongoDB connected');
  } catch (err) {
    console.error('❌ [Database] MongoDB connection failed:', err.message);
  }
};

export const requireDB = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not available' });
  }
  next();
};

export const startSessionWithFallback = async () => {
  if (mongoose.connection.readyState !== 1) return { session: null, usingTransactions: false };
  try {
    const admin = mongoose.connection.db.admin();
    const info = await admin.command({ hello: 1 }).catch(() => null);
    if (!info?.logicalSessionTimeoutMinutes) return { session: null, usingTransactions: false };
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      return { session, usingTransactions: true };
    } catch {
      await session.endSession();
      return { session: null, usingTransactions: false };
    }
  } catch { return { session: null, usingTransactions: false }; }
};

// ── Neo4j ──────────────────────────────────────────────────────────────────

let neo4jDriver;

export const connectNeo4j = () => {
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const pass = process.env.NEO4J_PASSWORD || 'password';

  try {
    neo4jDriver = neo4j.driver(uri, neo4j.auth.basic(user, pass));
    console.log('✅ [Database] Neo4j driver initialized');
  } catch (err) {
    console.error('❌ [Database] Neo4j initialization failed:', err.message);
  }
};

export const getNeo4jSession = () => {
  if (!neo4jDriver) return null;
  return neo4jDriver.session();
};

export default { connectMongoDB, connectNeo4j, requireDB, getNeo4jSession, startSessionWithFallback };
