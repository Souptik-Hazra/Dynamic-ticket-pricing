# 🎫 Dynamic Ticket Pricing System - MERN Stack with ML

A comprehensive full-stack event ticketing platform with intelligent dynamic pricing powered by Machine Learning. Built with MongoDB, Express.js, React, Node.js, and Python for ML capabilities.

## ✨ Key Features

### 🔐 Authentication & Security
- Session-based authentication with bcrypt password hashing
- Role-based access control (Admin/User)
- Protected routes with middleware
- Persistent sessions using HTTP cookies
- Secure API endpoints

### 🎭 Event Management
- Multiple ticket categories per event (Standard, VIP, Premium, Balcony, Economy)
- Category-specific pricing and seat allocation
- Real-time availability tracking
- Event creation with detailed information
- Status management (Upcoming, Ongoing, Completed, Cancelled)

### 💰 Dynamic Pricing
- ML-powered price predictions using Random Forest
- Real-time price adjustments based on demand
- Historical price tracking and analytics
- Considers 8 key factors: demand, capacity, days until event, popularity, competitor prices, historical sales, seasonality, and day of week

### 👥 User Experience
- Modern, responsive UI with beautiful design
- Intuitive event browsing and search
- Category-based filtering
- Seamless ticket booking process
- Order summary and confirmation

### 📊 Admin Dashboard
- Comprehensive event management interface
- Real-time statistics and analytics
- Revenue tracking per event and category
- User management
- Recent ticket purchase monitoring

### 🏗️ Microservices Architecture
- Redis distributed caching for performance
- RabbitMQ message queuing for async operations
- Distributed locking for concurrency control
- Optimistic locking for ticket purchases
- Graceful degradation when services unavailable

## 🏛️ System Architecture

### Technology Stack

**Frontend:**
- React 19.2.0 with Vite
- Context API for state management
- Axios for API communication
- React Router for navigation
- Custom CSS with responsive design (no Tailwind)

**Backend:**
- Node.js with Express.js
- MongoDB with Mongoose ODM
- Session-based authentication with bcryptjs
- Redis for caching
- RabbitMQ for message queuing
- Concurrency control services

**ML Model:**
- Python 3.13 with Flask
- scikit-learn for Random Forest model
- pandas & numpy for data processing
- joblib for model persistence

**Database:**
- MongoDB with 6 collections:
  - users (authentication)
  - events (ticket categories, availability)
  - tickets (purchase history)
  - pricehistories (price tracking)
  - mlmodels (model metadata)
  - predictionlogs (prediction tracking)

## 📁 Project Structure

```
Dynamic-Ticket-Pricing/
├── ml-model/                    # Python ML Service
│   ├── train_model_enhanced.py # Enhanced ensemble model training
│   ├── app.py                  # Flask API server
│   ├── requirements.txt        # Python dependencies
│   ├── model.pkl              # Trained Ensemble model 
│   └── scaler.pkl             # Feature scaler
│
├── backend/                    # Node.js Backend
│   ├── server.js              # Express server setup
│   ├── package.json           # Dependencies
│   ├── models/
│   │   ├── User.js            # User schema (auth, roles)
│   │   ├── Event.js           # Event with ticket categories
│   │   ├── Ticket.js          # Ticket purchase records
│   │   ├── PriceHistory.js    # Price change logs
│   │   ├── MLModel.js         # ML model metadata
│   │   └── PredictionLog.js   # Prediction tracking
│   ├── middleware/
│   │   └── auth.js            # Session-based authentication
│   ├── routes/
│   │   ├── auth.js            # Login, signup, profile
│   │   ├── admin.js           # Event management
│   │   ├── events.js          # Event CRUD
│   │   └── tickets.js         # Ticket purchase
│   └── services/
│       ├── cacheService.js    # Redis caching
│       ├── messageQueueService.js  # RabbitMQ
│       ├── messageConsumers.js     # Queue processors
│       └── concurrencyService.js   # Locking mechanisms
│
└── Dynamic-ticket-pricing/     # React Frontend
  ├── src/
  │   ├── App.jsx            # Main application
  │   ├── context/
  │   │   └── AuthContext.jsx # Auth state
  │   ├── components/
  │   │   ├── HomePage.jsx   # Landing page
  │   │   ├── Login.jsx      # User login
  │   │   ├── Signup.jsx     # User registration
  │   │   ├── AdminDashboard.jsx  # Admin panel
  │   │   ├── AdminEventForm.jsx  # Event creation/edit
  │   │   ├── EventList.jsx  # Event browsing
  │   │   ├── TicketPurchase.jsx  # Booking flow
  │   │   ├── Analytics.jsx  # Stats dashboard
  │   │   └── PriceHistoryChart.jsx # Price visualization
  │   └── App.css            # Global styles
  └── package.json
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+ with pip
- Node.js 16+ with npm
- MongoDB 4.4+
- Redis (optional, graceful degradation)
- RabbitMQ (optional, graceful degradation)

### 1. Setup Python ML Model

```bash
cd ml-model

# Install Python dependencies
pip install -r requirements.txt

# Train the ML model (generates model.pkl and scaler.pkl)
python train_model_enhanced.py
```

### 2. Start ML API Server

```bash
# In ml-model directory
python app.py
# ML API runs on http://localhost:5000
```

### 3. Setup Backend Server

```bash
cd backend

# Install Node.js dependencies
npm install

# Start MongoDB (if not running as service)
# mongod

# Start backend server
npm start
# Backend API runs on http://localhost:3001
```

### 4. Setup Frontend

```bash
cd Dynamic-ticket-pricing

# Install dependencies
npm install

# Start development server
npm run dev
# Frontend runs on http://localhost:5173
```

### 5. Create Admin Account

Use this one-time setup to create an admin user:

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/auth/create-admin" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"name":"Admin","email":"admin@example.com","password":"admin123"}'
```

**Default Admin Credentials:**
- Email: `admin@example.com`
- Password: `admin123`

## 📖 User Guide

### Admin Workflow:
1. **Login** with admin credentials
2. **Navigate to Admin Panel** (Admin button in navigation)
3. **Create Events**:
   - Click "Create New Event"
   - Fill in event details (name, venue, date, category)
   - Add ticket categories:
     - Standard: ₹50 - 100 seats
     - VIP: ₹200 - 20 seats
     - Premium: ₹125 - 50 seats
   - Click "Create Event"
4. **View Statistics**: Monitor total events, users, tickets sold, and revenue
5. **Manage Events**: Edit or delete events as needed

### User Workflow:
1. **Sign Up**: Create account with name, email, password
2. **Login**: Access your account
3. **Browse Events**: 
   - View all upcoming events on home page
   - Filter by category (concert, sports, theater, etc.)
   - Search by name or description
4. **Book Tickets**:
   - Click on event card
   - Select quantity
   - Fill customer details
   - Review order summary
   - Complete purchase
5. **View Analytics**: Check system-wide stats

## 🔌 API Reference

### Authentication Endpoints
```
POST /api/auth/signup          # Create new user account
POST /api/auth/signin          # Login user
GET  /api/auth/me             # Get current user profile
POST /api/auth/create-admin   # Create admin user (setup only)
```

### Event Endpoints
```
GET    /api/events            # Get all events
GET    /api/events/:id        # Get single event details
POST   /api/events            # Create new event (protected)
PUT    /api/events/:id        # Update event (protected)
DELETE /api/events/:id        # Delete event (protected)
GET    /api/events/:id/price  # Get ML price prediction
```

### Admin Endpoints (Protected)
```
GET    /api/admin/events      # Get all events with full details
POST   /api/admin/events      # Create event with categories
PUT    /api/admin/events/:id  # Update event
DELETE /api/admin/events/:id  # Delete event
GET    /api/admin/stats       # Get system statistics
```

### Ticket Endpoints
```
POST   /api/tickets           # Purchase tickets (protected)
GET    /api/tickets/user      # Get user's tickets (protected)
```

### ML API Endpoints (Port 5000)
```
POST   /predict               # Get price prediction
POST   /batch-predict         # Batch predictions
GET    /health                # API health check
```

## 🧠 ML Model Details

### Features Used for Price Prediction:
1. **demand** - Current ticket demand/inquiries
2. **capacity** - Venue total capacity
3. **days_until_event** - Time remaining before event
4. **event_popularity** - Popularity score (0-1)
5. **competitor_price** - Market pricing data
6. **historical_sales** - Past sales performance
7. **season** - Seasonal factors (1-4: Spring/Summer/Fall/Winter)
8. **day_of_week** - Day-specific patterns (1-7)

### Model Performance:
- **Algorithm**: Random Forest Regressor
- **Training R² Score**: ~0.99
- **Test R² Score**: ~0.93
- **Features**: 8 input variables
- **Samples**: 1000 training data points

### Price Prediction Request:
```json
{
  "demand": 150,
  "capacity": 500,
  "days_until_event": 30,
  "event_popularity": 0.8,
  "competitor_price": 150,
  "historical_sales": 80,
  "season": 2,
  "day_of_week": 5
}
```

## 🛠️ Tech Stack

### Backend Technologies
- **Runtime**: Node.js 16+
- **Framework**: Express.js 4.18+
- **Database**: MongoDB 4.4+ with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken) + bcryptjs
- **Caching**: Redis 4.6+ (optional)
- **Message Queue**: RabbitMQ (amqplib) (optional)
- **HTTP Client**: Axios
- **Middleware**: CORS, express.json()

### Frontend Technologies
- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.2+
- **Routing**: React Router DOM 6.20+
- **HTTP Client**: Axios 1.6+
- **State Management**: React Context API
- **Styling**: Custom CSS (no Tailwind)
## ⚠️ Security Note

This project now tracks .env and environment variable files in version control. **Do not commit real secrets or production credentials to public repositories.** Always use example or template environment files for sharing.

### ML Service Technologies
- **Language**: Python 3.13
- **Web Framework**: Flask 3.1+
- **ML Library**: scikit-learn 1.8+
- **Data Processing**: pandas 2.3+, numpy 2.4+
- **Model Persistence**: joblib 1.5+

### Database Schema
- **users**: Authentication, roles, profile
- **events**: Ticket categories, pricing, availability
- **tickets**: Purchase records, booking references
- **pricehistories**: Price change logs
- **mlmodels**: ML model metadata
- **predictionlogs**: Prediction tracking

## 💡 Key Features Explained

### 1. Multiple Ticket Categories
Each event can have multiple ticket types:
- **Standard**: Basic seating - ₹50, 100 seats
- **VIP**: Premium experience - ₹200, 20 seats
- **Premium**: Enhanced seating - ₹125, 50 seats
- **Balcony**: Upper level - ₹40, 80 seats
- **Economy**: Budget option - ₹30, 150 seats

### 2. Concurrency Control
- Distributed locks prevent overselling
- Optimistic locking on ticket purchases
- Redis-based distributed caching
- RabbitMQ message queuing for async operations

### 3. Dynamic Pricing
- Real-time ML predictions
- Considers demand, capacity, time factors
- Historical data analysis
- Competitor pricing integration

### 4. Authentication Flow
- Session-based authentication with 7-day expiry
- Bcrypt password hashing (10 rounds)
- Role-based access (admin/user)
- Protected routes with middleware

## 📱 Application Flow

### Admin Journey:
```
Login → Admin Dashboard → View Stats → Create Event → 
Add Ticket Categories → Set Prices → Publish Event → 
Monitor Sales → View Revenue
```

### User Journey:
```
Sign Up → Login → Browse Events → Filter/Search → 
View Event Details → Select Tickets → Enter Info → 
Review Order → Purchase → Confirmation
```

## 🔧 Configuration

### Backend Environment Variables
```env
MONGODB_URI=mongodb://localhost:27017/dynamic-ticket-pricing
PORT=3001
ML_API_URL=http://localhost:5000
SESSION_SECRET=your-256-bit-secret-key-change-in-production
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost
```

### ML Model Configuration
- Model file: `model.pkl`
- Scaler file: `scaler.pkl`
- Training samples: 1000
- Features: 8
- Algorithm: RandomForestRegressor

## 🚀 Deployment

### Production Checklist:
- [ ] Change SESSION_SECRET to secure random string
- [ ] Enable HTTPS/SSL
- [ ] Set up MongoDB Atlas or managed database
- [ ] Configure Redis for caching
- [ ] Set up RabbitMQ cluster
- [ ] Use environment-specific configs
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Enable CORS whitelist

### Recommended Hosting:
- **Frontend**: Vercel, Netlify
- **Backend**: Heroku, AWS EC2, DigitalOcean
- **Database**: MongoDB Atlas
- **ML API**: AWS Lambda, Google Cloud Run
- **Caching**: Redis Cloud
- **Message Queue**: CloudAMQP

## 📊 System Architecture Diagram

```
┌─────────────┐
│   React     │  (Port 5173)
│  Frontend   │
└──────┬──────┘
       │ HTTP/REST
       ▼
┌─────────────┐     ┌──────────┐
│   Express   │────→│ MongoDB  │
│   Backend   │     │ Database │
│ (Port 3001) │     └──────────┘
└──────┬──────┘
       │ HTTP
       ├────────────┐
       │            │
       ▼            ▼
┌─────────┐   ┌──────────┐
│  Redis  │   │ RabbitMQ │
│  Cache  │   │  Queue   │
└─────────┘   └──────────┘
       │
       │ HTTP/REST
       ▼
┌─────────────┐
│   Flask     │
│   ML API    │
│ (Port 5000) │
└─────────────┘
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

Built with ❤️ for dynamic ticket pricing in India

## 🙏 Acknowledgments

- scikit-learn for ML capabilities
- MERN Stack community
- MongoDB for flexible database
- React team for amazing frontend library

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check documentation files
- Review API endpoints

---

**Made for the Indian Market** 🇮🇳 - All prices in ₹ (Rupees)

### ML Model
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Backend
```bash
npm start
```

### Frontend
```bash
npm run build
npm run preview
```

## 🤝 Contributing

This is a demonstration project. Feel free to fork and modify!

## 📝 License

MIT License

## 👨‍💻 Author

Created as a demonstration of MERN stack with ML integration

---

**Note**: Make sure MongoDB is running before starting the backend server, and train the ML model before starting the ML API server.
