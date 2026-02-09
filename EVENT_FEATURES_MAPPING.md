# 🎫 Event Features Complete Mapping - Admin to ML Model

## ✅ All Features Aligned (14 Features)

### 📥 Admin Input Fields
Admin creates/updates events with these fields:

```javascript
POST /api/admin/events {
  name: string,                    // Event name
  description: string,             // Event description
  venue: string,                   // Venue name
  category: string,                // concert|sports|theater|conference|festival|other
  startDate: Date,                 // Event start date/time ⭐
  endDate: Date,                   // Event end date/time ⭐
  eventPopularity: number,         // 0-1 (popularity score)
  ticketCategories: array,         // Ticket categories with prices
  
  // NEW FIELDS (v2.1) - For accurate pricing
  hourOfDay: number,               // 0-23 (start time hour)
  isHoliday: boolean,              // Is event on national holiday?
  venueTier: number,               // 1 (Small) | 2 (Medium) | 3 (Large/Stadium)
  artistTier: number               // 1-5 (1=Local, 5=International Superstar)
}
```

---

### 🔄 Backend Processing (backend/routes/events.js)

When requesting dynamic price prediction, backend:

1. **Extracts from Database:**
   - ✅ `capacity` - Calculated from ticketCategories.seats
   - ✅ `ticketsSold` - Current sales count
   - ✅ `eventPopularity` - From event record
   - ✅ `basePrice` - Minimum category price
   - ✅ `startDate` / `endDate` - Event date range
   - ✅ `hourOfDay` - From event record
   - ✅ `isHoliday` - From event record
   - ✅ `venueTier` - From event record
   - ✅ `artistTier` - From event record

2. **Calculates at Runtime:**
   - ✅ `demand` - `capacity * occupancyRate * 2`
   - ✅ `daysUntilEvent` - Now - startDate
   - ✅ `eventDuration` - endDate - startDate in days
   - ✅ `season` - From startDate month (1-4)
   - ✅ `dayOfWeek` - From startDate day (1-7)
   - ✅ `isWeekend` - If dayOfWeek >= 6
   - ✅ `competitorPrice` - basePrice * 1.2
   - ✅ `historicalSales` - ticketsSold count

3. **Sends to ML Model:**
```javascript
POST http://localhost:5000/predict {
  demand: number,              // ✅ Calculated
  capacity: number,            // ✅ From DB
  days_until_event: number,    // ✅ Calculated
  event_duration_days: number, // ✅ Calculated
  event_popularity: number,    // ✅ From DB
  competitor_price: number,    // ✅ Calculated
  historical_sales: number,    // ✅ Calculated
  season: number,              // ✅ Calculated
  day_of_week: number,         // ✅ Calculated
  hour_of_day: number,         // ✅ From DB (NEW)
  is_weekend: number,          // ✅ Calculated
  is_holiday: number,          // ✅ From DB (NEW)
  venue_tier: number,          // ✅ From DB (NEW)
  artist_tier: number          // ✅ From DB (NEW)
}
```

---

### 🤖 ML Model Features (14 Total)

The trained ensemble model expects exactly 14 features in this order:

| # | Feature | Type | Range | Source | Importance |
|---|---------|------|-------|--------|------------|
| 1 | demand | float | 0-100000 | Calculated | 7.87% |
| 2 | capacity | float | 1-100000 | From DB | 17.98% |
| 3 | days_until_event | float | 0-365 | Calculated | 7.46% |
| 4 | event_duration_days | float | 1-365 | Calculated | 4.01% |
| 5 | event_popularity | float | 0-1 | From DB | 8.24% |
| 6 | competitor_price | float | 0-50000 | Calculated | 4.03% |
| 7 | historical_sales | float | 0-100000 | From DB | 2.72% |
| 8 | season | int | 1-4 | Calculated | 1.72% |
| 9 | day_of_week | int | 1-7 | Calculated | 1.72% |
| 10 | hour_of_day | int | 0-23 | From DB | Not shown (< 2%) |
| 11 | is_weekend | int | 0-1 | Calculated | 0.83% |
| 12 | is_holiday | int | 0-1 | From DB | 4.09% |
| 13 | venue_tier | int | 1-3 | From DB | 2.61% |
| 14 | artist_tier | int | 1-5 | From DB | 34.85% ⭐ |

---

## 🚀 Complete Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ ADMIN INPUTS EVENT                                          │
│ (name, venue, startDate, endDate, hourOfDay, ...)          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ DATABASE (Event Model)                                      │
│ - Stores all admin inputs                                   │
│ - Tracks ticketsSold, currentPrice                         │
│ - Supports: hourOfDay, isHoliday, venueTier, artistTier   │
└────────────────┬────────────────────────────────────────────┘
                 │
        When Price Prediction Requested:
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND PROCESSING (events.js /price route)                │
│ ✅ Extracts data from DB (8 fields)                        │
│ ✅ Calculates derivatives (6 fields)                       │
│ ✅ Assembles 14-feature array                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ ML MODEL API (Flask /predict)                              │
│ ✅ Receives 14 features                                    │
│ ✅ Scales features with trained scaler                     │
│ ✅ Predicts price (Ensemble: RF+GB+ET+Ridge+XGB)          │
│ ✅ Returns predicted_price + price_range                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ RESPONSE TO CLIENT                                          │
│ {                                                           │
│   "predicted_price": 2847.50,                              │
│   "price_range": {                                         │
│     "min": 2358.45,                                        │
│     "max": 3336.55                                         │
│   },                                                        │
│   "confidence": 0.95                                       │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Model Performance

- **Accuracy (R²):** 91.65% ✅
- **Mean Absolute Error:** ±₹99.60
- **Cross-Validation R²:** 92.08% (±0.78%)
- **Training Samples:** 15,000
- **Ensemble Models:** RF + GradientBoosting + ExtraTrees + Ridge + XGBoost

---

## 🔧 Recent Updates (Feb 9, 2026)

### Added to Event Model:
```javascript
hourOfDay: { type: Number, min: 0, max: 23, default: 12 }
isHoliday: { type: Boolean, default: false }
venueTier: { type: Number, enum: [1,2,3], default: 2 }
artistTier: { type: Number, enum: [1,2,3,4,5], default: 3 }
```

### Validation in Admin Routes:
- ✅ hourOfDay: 0-23 validation
- ✅ venueTier: 1-3 (Small/Medium/Large)
- ✅ artistTier: 1-5 (Local-Superstar)
- ✅ isHoliday: boolean flag

### Backend Processing:
- ✅ Auto-extracts hourOfDay from startDate if not explicitly set
- ✅ Properly converts isHoliday boolean to 0/1 for ML model
- ✅ Validates all tier values before ML prediction

---

## 📝 API Documentation

### Create Event
```bash
POST /api/admin/events
{
  "name": "Concert XYZ",
  "startDate": "2026-04-15T19:00:00Z",
  "endDate": "2026-04-16T23:00:00Z",
  "hourOfDay": 19,           # NEW: Event start hour
  "venueTier": 3,            # NEW: Stadium (Large)
  "artistTier": 5,           # NEW: International Superstar
  "isHoliday": false,        # NEW: Not a holiday
  ... other fields
}
```

### Get Dynamic Price
```bash
GET /api/events/{id}/price
```

Response includes all 14 features used for prediction.

---

## ✨ Summary

**All 14 ML features are now properly mapped:**
- ✅ **4 new fields** added to Event model
- ✅ **Backend validation** for all inputs
- ✅ **Automatic calculations** for derived features
- ✅ **Model accuracy** improved with complete feature set
