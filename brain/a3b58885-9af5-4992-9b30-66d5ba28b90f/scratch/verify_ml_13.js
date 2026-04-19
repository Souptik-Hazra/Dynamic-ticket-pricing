import axios from 'axios';

async function verifyNewML() {
  const url = 'http://localhost:5000/predict';
  const payload = {
    demand: 600,
    capacity: 1000,
    days_until_event: 15,
    event_duration_days: 1,
    event_popularity: 0.8,
    // competitor_price REMOVED
    historical_sales: 100,
    season: 2,
    day_of_week: 6,
    hour_of_day: 19,
    is_weekend: 1,
    is_holiday: 0,
    venue_tier: 2,
    artist_tier: 4
  };

  try {
    console.log('Testing 13-feature prediction payload...');
    const response = await axios.post(url, payload);
    console.log('Success! Predicted Price:', response.data.predicted_price);
    console.log('Model Version:', response.data.model_version);
    
    if (response.data.features_used && response.data.features_used.includes('competitor_price')) {
      console.error('FAIL: Model still reports competitor_price usage!');
    } else {
      console.log('Verified: competitor_price is GONE.');
    }
  } catch (err) {
    console.error('Verification failed:', err.response?.data || err.message);
  }
}

verifyNewML();
