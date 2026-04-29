import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';
import config from '../config/index.js';
import { logInfo, logWarn, logError } from '../utils/logger.js';

let neo4jDriver;
let _mongoMemoryServer = null;

export const connectMongoDB = async () => {
  try {
    const options = {
      ...config.mongodb.options,
      maxPoolSize: 50,
      minPoolSize: 10,
      socketTimeoutMS: 45000,
      family: 4,
      // Diamond Step: Read Preference for Analytics (Phase 15)
      readPreference: 'secondaryPreferred' 
    };
    const uri = config.mongodb.uri;
    if (uri) {
      await mongoose.connect(uri, options);
      logInfo('Database', 'MongoDB connected (Optimized Pool)');
    } else {
      // No URI provided: in local dev, try an in-memory MongoDB to avoid
      // requiring Docker. This requires `mongodb-memory-server` installed.
      if (config.isProd) throw new Error('Missing MONGODB_URI in production');
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        _mongoMemoryServer = await MongoMemoryServer.create();
        const memUri = _mongoMemoryServer.getUri();
        await mongoose.connect(memUri, options);
        logInfo('Database', 'MongoDB (in-memory) connected for dev');
      } catch (memErr) {
        logError('Database', 'In-memory MongoDB not available. Please install mongodb-memory-server or provide MONGODB_URI', memErr);
        if (config.isProd) throw memErr;
        return false;
      }
    }
  } catch (err) {
    logError('Database', 'MongoDB connection failed', err);
    // In development allow the app to continue without MongoDB so tooling/dev flows
    // can run (local demo mode). In production we must fail fast.
    if (config.isProd) throw err;
    return false;
  }
};

export const closeMongo = async () => {
  try {
    await mongoose.disconnect();
    if (_mongoMemoryServer) {
      await _mongoMemoryServer.stop();
      _mongoMemoryServer = null;
      logInfo('Database', 'In-memory MongoDB stopped');
    }
  } catch (err) {
    logWarn('Database', 'Error closing MongoDB', { message: err && err.message ? err.message : err });
  }
};

export const connectNeo4j = () => {
  try {
    neo4jDriver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
    );
    logInfo('Database', 'Neo4j driver initialized');
  } catch (err) {
    logError('Database', 'Neo4j initialization failed', err);
    throw err;
  }
};

export const getNeo4jSession = () => {
  if (!neo4jDriver) return null;
  return neo4jDriver.session();
};

export const closeNeo4j = async () => {
  try {
    if (neo4jDriver) {
      await neo4jDriver.close();
      neo4jDriver = null;
      logInfo('Database', 'Neo4j driver closed');
    }
  } catch (err) {
    logWarn('Database', 'Error closing Neo4j driver', { message: err.message || err });
  }
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
    logInfo('Database', 'Starting MongoDB transaction');
    session.startTransaction();
    const result = await operation(session);
    await session.commitTransaction();
    logInfo('Database', 'MongoDB transaction committed successfully');
    return result;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
      logWarn('Database', 'MongoDB transaction aborted due to error', { message: error.message });
    }
    throw error;
  } finally {
    await session.endSession();
    logDebug('Database', 'MongoDB session ended');
  }
};

export default { 
  connectMongoDB, 
  connectNeo4j, 
  closeNeo4j,
  closeMongo,
  getNeo4jSession, 
  requireDB, 
  withTransaction 
};
