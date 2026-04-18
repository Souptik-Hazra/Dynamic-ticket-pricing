# Email Service

Handles sending emails using SMTP.

## Endpoints
- `POST /api/email/send` — Send email (body: to, subject, text?, html?)

## Setup
1. Install dependencies:
   ```bash
   npm install express nodemailer dotenv
   ```
2. Update `.env` with your SMTP credentials.
3. Run the service:
   ```bash
   npm start
   ```

## .env Example
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@email.com
SMTP_PASS=yourpassword
PORT=3008
```
