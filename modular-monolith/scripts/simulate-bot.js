import axios from 'axios';

async function simulateBot() {
  const url = 'http://localhost:4000/api/tickets/purchase'; // Sensitive path
  const headers = {
    'User-Agent': 'Puppeteer-Bot-Simulated',
    'Accept': 'application/json'
  };

  console.log(`🤖 Simulating bot request to ${url}...`);
  try {
    const res = await axios.post(url, { eventId: 'mock-id' }, { headers, validateStatus: false });
    console.log(`Response Status: ${res.status}`);
    console.log(`Response Body:`, res.data);
    
    if (res.status === 403) {
      console.log('✅ BotShield correctly blocked the request!');
    } else {
      console.log('❌ BotShield failed to block the request.');
    }
  } catch (err) {
    console.error('Error during simulation:', err.message);
  }
}

simulateBot();
