# Authentication Service

Handles user registration, login, and JWT authentication.

## Endpoints
- `POST /api/auth/register` — Register user
- `POST /api/auth/login` — Login user
- `GET /api/auth/verify` — Verify JWT token

## Setup
1. Install dependencies:
   ```bash
   npm install express mongoose dotenv bcryptjs jsonwebtoken
   ```
2. Start MongoDB locally or update `.env` with your MongoDB URI.
3. Run the service:
   ```bash
   npm start
   ```

## .env Example
```
MONGODB_URI=mongodb://localhost:27017/authentication_service
PORT=3001
JWT_SECRET=your_jwt_secret
```
