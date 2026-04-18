# User Service

Handles user profile management.

## Endpoints
- `POST /api/users/` — Create user profile
- `GET /api/users/:email` — Get user profile
- `PUT /api/users/:email` — Update user profile
- `DELETE /api/users/:email` — Delete user profile

## Setup
1. Install dependencies:
   ```bash
   npm install express mongoose dotenv
   ```
2. Start MongoDB locally or update `.env` with your MongoDB URI.
3. Run the service:
   ```bash
   npm start
   ```

## .env Example
```
MONGODB_URI=mongodb://localhost:27017/user_service
PORT=3002
```
