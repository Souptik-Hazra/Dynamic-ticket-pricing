import dotenv from 'dotenv';
dotenv.config();

/**
 * ⚙️ Central Configuration
 */
export default {
  port: process.env.PORT || 4000,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/fanfever'
  },
  redis: {
    uri: process.env.REDIS_URI || 'redis://localhost:6379'
  },
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-key',
    expiry: '24h'
  }
};
