import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';
import config from '../config/index.js';

let neo4jDriver;

export const connectMongoDB = async () => {
  try {
    await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    console.log('✅ [Database] MongoDB connected');
  } catch (err) {
    console.error('❌ [Database] MongoDB connection failed:', err.message);
    throw err;
  }
};

export const connectNeo4j = () => {
  try {
    neo4jDriver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
    );
    console.log('✅ [Database] Neo4j driver initialized');
  } catch (err) {
    console.error('❌ [Database] Neo4j initialization failed:', err.message);
    throw err;
  }
};

export const getNeo4jSession = () => {
  if (!neo4jDriver) return null;
  return neo4jDriver.session();
};

export const requireDB = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not available' });
  }
  next();
};

export const withTransaction = async (operation) => {
  if (mongoose.connection.readyState !== 1) throw new Error('DATABASE_NOT_AVAILABLE');
  
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export default { 
  connectMongoDB, 
  connectNeo4j, 
  getNeo4jSession, 
  requireDB, 
  withTransaction 
};
