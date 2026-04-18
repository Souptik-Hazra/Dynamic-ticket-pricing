# Admin Service

Handles admin registration, login, and management.

## Endpoints
- `POST /api/admins/register` — Register admin
- `POST /api/admins/login` — Login admin
- `GET /api/admins/` — List all admins

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
MONGODB_URI=mongodb://localhost:27017/admin_service
PORT=3004
```
