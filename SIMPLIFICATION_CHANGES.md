# Code Simplification Changes

## Summary
Removed redundant database fields and dead code to streamline the application architecture.

## Changes Made

### 1. **Deleted EventLog Model**
- **File:** `backend/models/EventLog.js` ❌ REMOVED
- **Reason:** EventLog was created but never actually used. Messages go directly to RabbitMQ or Redis without DB logging.
- **Updated:** Removed from `backend/server.js` model initialization list

### 2. **Simplified Ticket Model** (`backend/models/Ticket.js`)
- **Removed Fields:**
  - `customerName` → Now sourced from `userId.name` via populate
  - `customerEmail` → Now sourced from `userId.email` via populate
  - `ticketType` → Redundant with `categoryName`
  - `paymentId` → Not used anywhere

- **Kept Fields:**
  - `purchaseDate` - Explicit date tracking
  - `fraudScore`, `fraudDetected`, `fraudReasons` - Fraud detection
  - `bookingReference` - Unique ticket identifier
  - All core fields: `eventId`, `userId`, `quantity`, `price`, `totalAmount`, `status`

### 3. **Updated Backend Routes** (`backend/routes/admin.js`)
- **Changes:**
  - Line 278: `ticket.customerName || ticket.userId?.name` → `ticket.userId?.name`
  - Line 323: `ticket.customerEmail || ticket.userId?.email` → `ticket.userId?.email`
  - Line 357: Removed fallback to `ticket.customerName` and `ticket.customerEmail`
  
- **Logic:** Admin endpoints now source customer data directly from User model via populated userId relationship instead of storing duplicates in Ticket

### 4. **Simplified Message Queue Service** (`backend/services/messageQueueService.js`)
- **Previous:** Saved every event to EventLog collection in MongoDB before publishing to RabbitMQ
- **Now:** Directly publishes to RabbitMQ/Redis without unnecessary database writes
- **Benefit:** Faster event processing, less database overhead

### 5. **Simplified Auth Middleware** (`backend/middleware/auth.js`)
- Made session checking more concise using optional chaining (`?.`)
- Cleaned up error messages

## Frontend Compatibility

Frontend components already have fallbacks:
- `TicketPurchase.jsx`: Uses `customerName || user?.name`
- `AdminDashboard.jsx`: Can still display customer info via User lookup
- `UserProfile.jsx`: Has fallbacks built in

**No frontend changes needed** - the API responses are backward compatible.

## Benefits

✅ **Reduced Database Overhead:** No duplicate storage of user info
✅ **Simpler Data Model:** Single source of truth for user details
✅ **Faster Message Processing:** No extra DB writes for queued events
✅ **Easier Maintenance:** Less redundant code to maintain
✅ **Better Performance:** Fewer document fields to process

## Database Migration Note

If your database has existing Tickets with `customerName`, `customerEmail`, and `ticketType` fields, they will simply be ignored by the new model. The documents will still exist but won't be accessed by the application.
