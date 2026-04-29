import bus from '../../shared/utils/bus.js';
import { getNeo4jSession } from '../../shared/db/index.js';
import { createLogger, logError } from '../../shared/utils/logger.js';

/**
 * 🕸️ Neo4j Graph Sync Service
 * 
 * Synchronizes core entity changes from MongoDB to Neo4j Graph DB.
 * Used for social graph analysis and fraud detection.
 */

export const initGraphSync = () => {
  const logger = createLogger('GraphSync');
  logger.info('Initializing listeners...');

  // 1. Sync User Creation
  bus.subscribe('user.registered', async (payload) => {
    const session = getNeo4jSession();
    try {
      await session.run(
        'MERGE (u:User {id: $id}) SET u.name = $name, u.email = $email, u.city = $city',
        { id: String(payload._id), name: payload.name, email: payload.email, city: payload.city || '' }
      );
    } catch (err) {
      logError('GraphSync', 'User sync failed', err, { payload });
    } finally {
      await session.close();
    }
  });

  // 2. Sync Ticket Purchase (User -> BUYS -> Event)
  bus.subscribe('ticket.purchased', async (payload) => {
    const { userId, eventId, eventName, count } = payload;
    const session = getNeo4jSession();
    try {
      // Ensure Event exists in Graph
      await session.run(
        'MERGE (e:Event {id: $id}) SET e.name = $name',
        { id: String(eventId), name: eventName }
      );

      // Create Purchase Relationship
      await session.run(
        `MATCH (u:User {id: $uid}), (e:Event {id: $eid})
         MERGE (u)-[r:PURCHASED]->(e)
         SET r.count = coalesce(r.count, 0) + $count, r.lastPurchase = timestamp()`,
        { uid: String(userId), eid: String(eventId), count }
      );
    } catch (err) {
      logError('GraphSync', 'Ticket sync failed', err, { payload });
    } finally {
      await session.close();
    }
  });

  // 3. Sync Subscription Upgrade
  bus.subscribe('subscription.upgraded', async (payload) => {
    const session = getNeo4jSession();
    try {
      await session.run(
        'MATCH (u:User {id: $uid}) SET u.plan = $plan, u.premium = true',
        { uid: String(payload.userId), plan: payload.plan }
      );
    } catch (err) {
      logError('GraphSync', 'Subscription sync failed', err, { payload });
    } finally {
      await session.close();
    }
  });

  logger.info('Ready');
};

export default initGraphSync;
