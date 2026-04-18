# Organizer Service

This microservice manages organizers and their events.

## Features
- Organizer registration and login
- CRUD operations for events

## REST API Endpoints

### Organizer
- `POST /api/organizers/register` — Register organizer
- `POST /api/organizers/login` — Login organizer

### Events
- `POST /api/events` — Create event
- `GET /api/organizers/:organizerId/events` — List events for organizer
- `PUT /api/events/:eventId` — Update event
- `DELETE /api/events/:eventId` — Delete event

## Setup
1. Install dependencies:
   ```bash
   npm install express mongoose dotenv bcryptjs
   ```
2. Start MongoDB locally or update `.env` with your MongoDB URI.
3. Run the service:
   ```bash
   npm start
   ```

## .env Example
```
MONGODB_URI=mongodb://localhost:27017/organizer_service
PORT=3003
```
