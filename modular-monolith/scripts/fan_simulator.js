import axios from 'axios';
import { faker } from '@faker-js/faker';

/**
 * 👥 Fan Simulator (Phase 13: Autopilot)
 * 
 * Simulates a continuous stream of human-like behavior:
 * - Browsing the catalog
 * - Viewing event details
 * - Checking dynamic prices (Feeding the AI)
 * - Occasional purchase intent
 */

const API_URL = 'http://localhost:4000/api/v1';

const simulate = async () => {
  console.log('👥 Starting Fan Simulator (Autopilot active)...');

  while (true) {
    try {
      // 1. Browse Catalog
      const catalogRes = await axios.get(`${API_URL}/catalog`);
      const events = catalogRes.data.data;
      
      if (events.length > 0) {
        // Pick 3 random events to "Interst"
        for (let i = 0; i < 3; i++) {
          const event = events[Math.floor(Math.random() * events.length)];
          
          console.log(`👀 Fan is viewing event: ${event.name}`);
          
          // 2. View Pricing (Triggers Behavioral Logging)
          const cognitiveScore = (Math.random() * 0.5 + 0.5).toFixed(2);
          await axios.get(`${API_URL}/catalog/${event._id}/dynamic-prices?cognitive_score=${cognitiveScore}`);
          
          // 3. Human "Thinking" Time
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }
      }

      console.log('💤 Fan is taking a break...');
      await new Promise(r => setTimeout(r, 5000));
    } catch (err) {
      console.warn('⚠️ Simulator Hiccup:', err.message);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
};

simulate();
