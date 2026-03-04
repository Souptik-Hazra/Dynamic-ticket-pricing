# 🎫 Dynamic Ticket Pricing System

A full-stack event ticketing platform with intelligent, ML-powered dynamic pricing. Built using MongoDB, Express.js, React, Node.js, and Python (Flask) for machine learning.

## ✨ Features

### 🔐 Authentication & Security
- JWT authentication, bcrypt password hashing
- Role-based access (Admin/User)
- Protected routes, secure API endpoints

### 🎭 Event Management
- Multiple ticket categories (Standard, VIP, Premium, Balcony, Economy)
- Category-specific pricing, seat allocation
- Real-time availability, event status management

### 💰 Dynamic Pricing
- ML-powered price predictions (Random Forest)
- Real-time price adjustments, historical price tracking
- 8 key factors: demand, capacity, days until event, popularity, competitor prices, historical sales, seasonality, day of week

### 👥 User Experience
- Modern, responsive UI
- Event browsing, search, filtering
- Seamless ticket booking, order summary

### 📊 Admin Dashboard
- Event management, analytics, revenue tracking
- User management, ticket monitoring

### 🏗️ Microservices Architecture
- Redis caching, RabbitMQ queuing
- Distributed/optimistic locking for concurrency
- Graceful degradation for unavailable services

## 🏛️ Architecture & Stack

**Frontend:** React 19.2, Vite, Context API, Axios, React Router, custom CSS
**Backend:** Node.js, Express.js, MongoDB (Mongoose), JWT, Redis, RabbitMQ
**ML Model:** Python 3.13, Flask, scikit-learn, pandas, numpy, joblib
**Database:** MongoDB (users, events, tickets, pricehistories, mlmodels, predictionlogs)

## 📁 Project Structure

```
Dynamic-Ticket-Pricing/
├── ml-model/         # Python ML Service
│   ├── train_model_enhanced.py
│   ├── app.py
│   ├── requirements.txt
│   ├── model.pkl
│   └── scaler.pkl
│
├── backend/         # Node.js Backend
│   ├── server.js
│   ├── package.json
│   ├── models/
│   ├── middleware/
│   ├── routes/
│   └── services/
│
└── Dynamic-ticket-pricing/ # React Frontend
    ├── src/
    │   ├── App.jsx
    │   ├── context/
    │   ├── components/
    │   └── App.css
    └── package.json
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- MongoDB 4.4+
- Redis, RabbitMQ (optional)

### 1. Setup Python ML Model
```bash
cd ml-model
pip install -r requirements.txt
python train_model_enhanced.py
```

### 2. Start ML API Server
```bash
python app.py
# Runs on http://localhost:5000
```

### 3. Setup Backend Server
```bash
cd backend
npm install
npm start
# Runs on http://localhost:3001
```

### 4. Setup Frontend
```bash
cd Dynamic-ticket-pricing
npm install
npm run dev
# Runs on http://localhost:5173
```

### 5. Create Admin Account
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/auth/create-admin" -Method POST -ContentType "application/json" -Body '{"name":"Admin","email":"admin@example.com","password":"admin123"}'
```
Default Admin: admin@example.com / admin123

## 📖 User Guide

### Admin Workflow
1. Login as admin
2. Go to Admin Panel
3. Create events, add ticket categories
4. View stats, manage events

### User Workflow
1. Sign up, login
2. Browse events, filter/search
3. Book tickets, view analytics

## 🔌 API Reference

### Authentication
POST /api/auth/signup
POST /api/auth/signin
GET  /api/auth/me
POST /api/auth/create-admin

### Events
GET    /api/events
GET    /api/events/:id
POST   /api/events
PUT    /api/events/:id
DELETE /api/events/:id
GET    /api/events/:id/price

### Admin
GET    /api/admin/events
POST   /api/admin/events
PUT    /api/admin/events/:id
DELETE /api/admin/events/:id
GET    /api/admin/stats

### Tickets
POST   /api/tickets
GET    /api/tickets/user

### ML API (Port 5000)
POST   /predict
POST   /batch-predict
GET    /health

## 🧠 ML Model Details

**Features:** demand, capacity, days_until_event, event_popularity, competitor_price, historical_sales, season, day_of_week
**Algorithm:** Random Forest Regressor
**Training R²:** ~0.99, **Test R²:** ~0.93

**Sample Request:**
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

**Backend:** Node.js, Express.js, MongoDB, JWT, Redis, RabbitMQ, Axios
**Frontend:** React, Vite, React Router, Axios, Context API, CSS
**ML Service:** Python, Flask, scikit-learn, pandas, numpy, joblib

## ⚠️ Security Note
Do not commit real secrets or production credentials. Use example .env files for sharing.

## 💡 Key Features Explained

### Multiple Ticket Categories
Standard, VIP, Premium, Balcony, Economy

### Concurrency Control
Distributed/optimistic locking, Redis caching, RabbitMQ queuing

### Dynamic Pricing
Real-time ML predictions, historical/competitor data

### Authentication Flow
JWT tokens, bcrypt hashing, role-based access

## 📱 Application Flow

**Admin:** Login → Dashboard → Stats → Create Event → Add Categories → Set Prices → Publish → Monitor Sales → Revenue
**User:** Sign Up → Login → Browse → Filter/Search → Details → Select Tickets → Info → Review → Purchase → Confirmation

## 🔧 Configuration

### Backend .env
```env
MONGODB_URI=mongodb://localhost:27017/dynamic-ticket-pricing
PORT=3001
ML_API_URL=http://localhost:5000
JWT_SECRET=your-256-bit-secret-key-change-in-production
JWT_EXPIRE=7d
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost
```

### ML Model
model.pkl, scaler.pkl, 1000 samples, 8 features, RandomForestRegressor

## 🚀 Deployment

**Production Checklist:**
- Change JWT_SECRET
- Enable HTTPS/SSL
- Use managed DB (MongoDB Atlas)
- Configure Redis, RabbitMQ
- Use environment configs
- Enable rate limiting
- Monitoring/logging
- Backups
- CORS whitelist

**Recommended Hosting:**
- Frontend: Vercel, Netlify
- Backend: Heroku, AWS EC2, DigitalOcean
- Database: MongoDB Atlas
- ML API: AWS Lambda, Google Cloud Run
- Caching: Redis Cloud
- Queue: CloudAMQP

## 📊 Architecture Diagram
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
1. Fork repo
2. Create feature branch
3. Commit changes
4. Push branch
5. Open PR

## 📄 License
MIT License

## 👨‍💻 Author
Built for dynamic ticket pricing in India 🇮🇳

## 🙏 Acknowledgments
- scikit-learn, MERN Stack, MongoDB, React

## 📞 Support
- Create an issue
- Check docs
- Review API endpoints

---

**Note:** MongoDB must be running before backend, and ML model must be trained before ML API server starts.

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
│   │   └── auth.js            # JWT authentication
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
- JWT tokens with 7-day expiry
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
JWT_SECRET=your-256-bit-secret-key-change-in-production
JWT_EXPIRE=7d
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
- [ ] Change JWT_SECRET to secure random string
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
