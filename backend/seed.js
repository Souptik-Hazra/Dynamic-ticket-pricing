// Dynamic Ticket Pricing System v2.0
const mongoose = require('mongoose');
const path = require('path');
const { faker } = require('@faker-js/faker');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('./models/User');
const Event = require('./models/Event');
const Ticket = require('./models/Ticket');
const PriceHistory = require('./models/PriceHistory');
const PredictionLog = require('./models/PredictionLog');
const MLModel = require('./models/MLModel');
const ChatMessage = require('./models/ChatMessage');
const cacheService = require('./services/cacheService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

const INDIAN_CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Kolkata', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Goa'];

const EVENT_IMAGES = {
  concert: [
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80'
  ],
  sports: [
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517649763962-0c623266010b?auto=format&fit=crop&w=800&q=80'
  ],
  theater: [
    'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=800&q=80'
  ],
  festival: [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80'
  ],
  comedy: [
    'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'
  ],
  conference: [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=800&q=80'
  ]
};

const INDIAN_EVENT_TEMPLATES = [
  { name: 'A.R. Rahman Live Symphonic India Tour', category: 'concert', venue: 'Narendra Modi Stadium, Ahmedabad', venueTier: 3, artistTier: 5, keywords: ['arrahman', 'concert', 'ahmedabad', 'rahmanmagic'] },
  { name: 'IPL T20 Final Championship 2026', category: 'sports', venue: 'Wankhede Stadium, Mumbai', venueTier: 3, artistTier: 5, keywords: ['ipl', 'wankhede', 'cricket', 'mumbai'] },
  { name: 'Sunburn Goa EDM Festival 2026', category: 'festival', venue: 'Vagator Beach Grounds, Goa', venueTier: 3, artistTier: 4, keywords: ['sunburn', 'goa', 'edm', 'beachparty'] },
  { name: 'Diljit Dosanjh Dil-Luminati India Tour', category: 'concert', venue: 'Jawaharlal Nehru Stadium, New Delhi', venueTier: 3, artistTier: 5, keywords: ['diljit', 'dilluminati', 'delhi', 'punjabi'] },
  { name: 'Zakir Khan Live Comedy Special', category: 'comedy', venue: 'Kalamandir Auditorium, Kolkata', venueTier: 2, artistTier: 4, keywords: ['zakirkhan', 'sakhtlounda', 'kolkata', 'standup'] },
  { name: 'India AI & Tech Innovation Summit 2026', category: 'conference', venue: 'BIEC Convention Centre, Bengaluru', venueTier: 2, artistTier: 3, keywords: ['indai', 'bengaluru', 'techsummit', 'ai'] },
  { name: 'Kolkata International Theatre & Drama Fest', category: 'theater', venue: 'Nandan Cultural Complex, Kolkata', venueTier: 2, artistTier: 3, keywords: ['nandan', 'theatre', 'drama', 'kolkata'] },
  { name: 'Arijit Singh Soulful Acoustic Night', category: 'concert', venue: 'Palace Grounds, Bengaluru', venueTier: 3, artistTier: 5, keywords: ['arijitsingh', 'bengaluru', 'livemusic', 'bollywood'] },
  { name: 'Pro Kabaddi Grand Final Match', category: 'sports', venue: 'Gachibowli Indoor Stadium, Hyderabad', venueTier: 2, artistTier: 4, keywords: ['pkl', 'kabaddi', 'hyderabad', 'finals'] },
  { name: 'NH7 Weekender Music Festival', category: 'festival', venue: 'Mahalaxmi Lawns, Pune', venueTier: 2, artistTier: 4, keywords: ['nh7', 'pune', 'indie', 'weekender'] }
];

const INDIAN_FIRST_NAMES = ['Aarav', 'Ananya', 'Rohan', 'Priya', 'Vikram', 'Sneha', 'Rahul', 'Aditi', 'Karan', 'Pooja', 'Amit', 'Neha', 'Rajesh', 'Kavita', 'Sanjay'];
const INDIAN_LAST_NAMES = ['Sharma', 'Verma', 'Patel', 'Sen', 'Chatterjee', 'Gupta', 'Singh', 'Reddy', 'Rao', 'Joshi', 'Mehta', 'Nair', 'Mukherjee', 'Deshmukh', 'Das'];

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Clean existing collections
    console.log('Clearing all existing database collections...');
    await User.deleteMany({});
    await Event.deleteMany({});
    await Ticket.deleteMany({});
    await PriceHistory.deleteMany({});
    await PredictionLog.deleteMany({});
    await MLModel.deleteMany({});
    await ChatMessage.deleteMany({});

    // 2. Seed ML Model Registries (XGBoost & BERT)
    console.log('Creating ML Model metadata records...');
    await MLModel.create({
      modelVersion: 'v2.0.20260827',
      modelType: 'XGBoostRegressor',
      features: ['demand', 'capacity', 'days_until_event', 'event_duration_days', 'event_popularity', 'competitor_price', 'historical_sales', 'season', 'day_of_week', 'hour_of_day', 'is_weekend', 'is_holiday', 'venue_tier', 'artist_tier'],
      trainScore: 0.9939,
      testScore: 0.9672,
      parameters: {
        n_estimators: 300,
        max_depth: 6,
        learning_rate: 0.05,
        subsample: 0.8,
        reg_alpha: 0.1,
        reg_lambda: 1.0,
        randomState: 42
      },
      isActive: true,
      metadata: { framework: 'xgboost', datasetSize: 15000, target: 'optimal_ticket_price_inr' }
    });

    await MLModel.create({
      modelVersion: 'BERT-Sentiment-Analyzer-v2.0',
      modelType: 'BERT_Sentiment_Analyzer',
      features: ['social_mentions', 'sentiment_polarity', 'hype_tokens'],
      trainScore: 0.962,
      testScore: 0.948,
      parameters: {
        maxDepth: 12,
        learningRate: 0.00002,
        nEstimators: 12
      },
      isActive: true,
      metadata: { baseModel: 'bert-base-uncased', domain: 'indian-event-hype' }
    });

    // 3. Create Demo Users & Indian Buyer Profiles
    console.log('Creating Admin & Indian buyer user accounts...');
    const adminTest = new User({
      name: 'System Admin',
      email: 'admin@test.com',
      password: 'admin123',
      role: 'admin',
      city: 'Delhi',
      subscription: { plan: '1_year', isActive: true, startDate: new Date(), endDate: new Date(Date.now() + 365*24*60*60*1000) }
    });
    await adminTest.save();

    const adminCF = new User({
      name: 'Souptik Hazra (Admin)',
      email: 'admin@cf.com',
      password: 'admin123',
      role: 'admin',
      city: 'Kolkata',
      subscription: { plan: '1_year', isActive: true, startDate: new Date(), endDate: new Date(Date.now() + 365*24*60*60*1000) }
    });
    await adminCF.save();

    const demoUser = new User({
      name: 'Demo User',
      email: 'user@test.com',
      password: 'user123',
      role: 'user',
      city: 'Mumbai',
      subscription: { plan: '30_days', isActive: true, startDate: new Date(), endDate: new Date(Date.now() + 30*24*60*60*1000) }
    });
    await demoUser.save();

    const users = [demoUser];
    for (let i = 0; i < 14; i++) {
      const firstName = INDIAN_FIRST_NAMES[i % INDIAN_FIRST_NAMES.length];
      const lastName = INDIAN_LAST_NAMES[i % INDIAN_LAST_NAMES.length];
      const user = new User({
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i+1}@gmail.com`,
        password: 'Password123',
        role: 'user',
        city: INDIAN_CITIES[i % INDIAN_CITIES.length],
        birthdate: faker.date.birthdate({ min: 18, max: 55, mode: 'age' }),
        subscription: {
          plan: faker.helpers.arrayElement(['none', '7_days', '30_days', '1_year']),
          isActive: faker.datatype.boolean()
        }
      });
      await user.save();
      users.push(user);
    }
    console.log(`Created Admins and ${users.length} Indian buyer accounts.`);

    // 4. Create Events with Indian Venues, BERT Sentiment & XGBoost Metadata
    console.log('Generating Indian events with BERT Sentiment & XGBoost metadata...');
    const events = [];

    for (let i = 0; i < INDIAN_EVENT_TEMPLATES.length; i++) {
      const tmpl = INDIAN_EVENT_TEMPLATES[i];
      const imagesList = EVENT_IMAGES[tmpl.category] || EVENT_IMAGES.concert;
      const image = imagesList[i % imagesList.length];

      let startDate, endDate;
      const now = new Date();
      if (i < 2) {
        startDate = new Date(now.getTime() - faker.number.int({ min: 1, max: 2 }) * 86400000);
        endDate = new Date(now.getTime() + faker.number.int({ min: 2, max: 4 }) * 86400000);
      } else if (i < 8) {
        const daysFromNow = faker.number.int({ min: 5, max: 45 });
        startDate = new Date(now.getTime() + daysFromNow * 86400000);
        endDate = new Date(startDate.getTime() + faker.number.int({ min: 1, max: 3 }) * 86400000);
      } else {
        const daysAgo = faker.number.int({ min: 5, max: 20 });
        startDate = new Date(now.getTime() - (daysAgo + 2) * 86400000);
        endDate = new Date(now.getTime() - daysAgo * 86400000);
      }

      const baseStdPrice = faker.number.int({ min: 499, max: 1999 });
      const ticketCategories = [
        { name: 'standard', price: baseStdPrice, maxPrice: baseStdPrice * 2, seats: 500, availableSeats: 500 },
        { name: 'vip', price: baseStdPrice * 3, maxPrice: baseStdPrice * 5, seats: 100, availableSeats: 100 },
        { name: 'premium', price: baseStdPrice * 2, maxPrice: baseStdPrice * 3.5, seats: 250, availableSeats: 250 }
      ];

      const isColdStart = i % 3 === 0;
      const hypeScore = faker.number.float({ min: 0.60, max: 0.98, fractionDigits: 2 });
      const sentScore = faker.number.float({ min: 0.40, max: 0.95, fractionDigits: 2 });

      const event = new Event({
        name: tmpl.name,
        description: `${tmpl.name} live in ${INDIAN_CITIES[i % INDIAN_CITIES.length]}! Featuring top artists, world-class production, and dynamic ticket pricing powered by XGBoost & BERT sentiment analysis.`,
        venue: tmpl.venue,
        startDate,
        endDate,
        ticketCategories,
        popularity: faker.number.int({ min: 7, max: 10 }),
        eventPopularity: faker.number.float({ min: 0.65, max: 0.98, fractionDigits: 2 }),
        historicalDemand: faker.number.float({ min: 0.55, max: 0.95, fractionDigits: 2 }),
        category: tmpl.category,
        image,
        venueTier: tmpl.venueTier,
        artistTier: tmpl.artistTier,
        isHoliday: faker.datatype.boolean(),
        isColdStart,
        bertSentiment: {
          sentimentScore: sentScore,
          hypeIndex: hypeScore,
          sentimentLabel: hypeScore > 0.85 ? 'viral_hype' : 'positive',
          socialMentionsCount: faker.number.int({ min: 5000, max: 150000 }),
          topKeywords: tmpl.keywords
        },
        xgboostConfig: {
          modelId: 'v2.0.20260827',
          targetPriceRatio: 1.25,
          minPriceFloor: Math.round(baseStdPrice * 0.8),
          maxPriceCap: Math.round(baseStdPrice * 3.5)
        },
        basePrice: baseStdPrice,
        currentPrice: Math.round(baseStdPrice * (1 + hypeScore * 0.3)),
        capacity: 850,
        availableTickets: 850,
        ticketsSold: 0,
        totalSales: 0,
        totalRevenue: 0,
        status: i < 2 ? 'ongoing' : i < 8 ? 'upcoming' : 'completed'
      });

      await event.save();
      events.push(event);
    }
    console.log(`Created ${events.length} Indian events with BERT sentiment metadata.`);

    // 5. Seed Ticket Purchases, Price Histories & Prediction Logs
    console.log('Generating ticket sales, XGBoost logs, and Gemini explanations...');
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const salesCount = faker.number.int({ min: 3, max: 7 });

      for (let s = 0; s < salesCount; s++) {
        const user = users[s % users.length];
        const categoryObj = faker.helpers.arrayElement(event.ticketCategories);
        const qty = faker.number.int({ min: 1, max: 4 });
        const price = categoryObj.price;
        const totalAmount = price * qty;

        const ticket = new Ticket({
          eventId: event._id,
          userId: user._id,
          customerName: user.name,
          customerEmail: user.email,
          quantity: qty,
          price,
          totalAmount,
          categoryName: categoryObj.name,
          ticketType: categoryObj.name,
          status: 'confirmed',
          purchaseDate: faker.date.between({ from: event.startDate, to: event.endDate || new Date() }),
          bookingReference: `TKT-IN-${Date.now()}-${s}${i}`
        });
        await ticket.save();

        // Decrement available tickets
        categoryObj.availableSeats = Math.max(0, categoryObj.availableSeats - qty);
        event.ticketsSold += qty;
        event.availableTickets = Math.max(0, event.availableTickets - qty);
        event.totalSales += totalAmount;
        event.totalRevenue += totalAmount;

        // Log Price History
        await PriceHistory.create({
          event: event._id,
          categoryName: categoryObj.name,
          price,
          demand: Math.round((event.ticketsSold / event.capacity) * 100),
          occupancyRate: parseFloat((event.ticketsSold / event.capacity).toFixed(2)),
          daysUntilEvent: Math.max(1, Math.round((new Date(event.startDate) - new Date()) / 86400000)),
          factors: {
            eventPopularity: event.eventPopularity,
            competitorPrice: Math.round(price * 0.95),
            historicalSales: event.ticketsSold,
            season: 2,
            dayOfWeek: 6
          }
        });

        // Log XGBoost Prediction Log
        await PredictionLog.create({
          event: event._id,
          inputFeatures: {
            demand: event.ticketsSold,
            capacity: event.capacity,
            ticketAvailabilityRatio: parseFloat((event.availableTickets / event.capacity).toFixed(2)),
            daysUntilEvent: Math.max(1, Math.round((new Date(event.startDate) - new Date()) / 86400000)),
            eventPopularity: event.eventPopularity,
            competitorPrice: Math.round(price * 0.95),
            historicalSales: event.ticketsSold,
            season: 2,
            dayOfWeek: 6,
            bertHypeIndex: event.bertSentiment.hypeIndex,
            bertSentimentScore: event.bertSentiment.sentimentScore,
            isColdStart: event.isColdStart
          },
          predictedPrice: Math.round(price * 1.05),
          priceRange: { min: Math.round(price * 0.9), max: Math.round(price * 1.25) },
          confidence: 0.96,
          modelVersion: 'v2.0.20260827',
          xgboostFeatureImportance: {
            demandWeight: 0.39,
            timeToEventWeight: 0.13,
            bertHypeWeight: 0.18,
            availabilityWeight: 0.30
          },
          geminiExplanation: `XGBoost model predicted ₹${Math.round(price * 1.05)} based on high demand (${event.ticketsSold} tickets sold) and BERT Hype score of ${(event.bertSentiment.hypeIndex * 100).toFixed(0)}%.`
        });
      }

      await event.save();
    }

    // 6. Seed Gemini GenAI Chatbot Messages
    console.log('Seeding Gemini GenAI Chatbot interaction logs...');
    await ChatMessage.create([
      {
        userId: demoUser._id,
        role: 'user',
        message: 'Why did the price for A.R. Rahman concert tickets increase?'
      },
      {
        userId: demoUser._id,
        role: 'model',
        message: 'The ticket price increased by 18% because high demand (78% occupancy) combined with a strong BERT Hype Index (92%) triggered the XGBoost dynamic pricing algorithm.',
        geminiMetadata: { modelUsed: 'gemini-1.5-pro', tokenCount: 42 }
      }
    ]);

    // Clear API cache
    console.log('Clearing API cache...');
    await cacheService.clear();

    console.log('✅ Indian Demographic Database Upgrade and Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedDatabase();
