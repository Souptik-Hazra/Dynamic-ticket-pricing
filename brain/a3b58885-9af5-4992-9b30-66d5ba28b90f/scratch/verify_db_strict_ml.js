import axios from 'axios';

async function verifyDBStrictML() {
  const url = 'http://localhost:5000/predict';
  
  // Test Cases aligned with DB fields
  const cases = [
    {
      name: 'Concert - Half Sold',
      payload: {
        capacity: 1000,
        tickets_sold: 500,
        base_price: 1200,
        days_until_event: 10,
        event_duration: 1,
        event_popularity: 0.8,
        venue_tier: 2,
        artist_tier: 4,
        is_holiday: 0,
        category: 'concert'
      }
    },
    {
      name: 'Conference - Early Bird',
      payload: {
        capacity: 200,
        tickets_sold: 10,
        base_price: 5000,
        days_until_event: 60,
        event_duration: 3,
        event_popularity: 0.2,
        venue_tier: 1,
        artist_tier: 1,
        is_holiday: 0,
        category: 'conference'
      }
    }
  ];

  for (const tc of cases) {
    try {
      console.log(`Testing: ${tc.name}...`);
      const response = await axios.post(url, tc.payload);
      console.log(`Predicted Price: INR ${response.data.predicted_price}`);
      console.log(`Features used summary:`, response.data.features_used);
    } catch (err) {
      console.error(`Failed ${tc.name}:`, err.response?.data || err.message);
    }
  }
}

verifyDBStrictML();
