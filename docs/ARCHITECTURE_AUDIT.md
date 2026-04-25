# Microservices Architecture Audit & QR Migration Plan

This document provides a technical blueprint for streamlining the platform's 15-service mesh and migrating QR generation responsibility to the dedicated `qr-service`.

## 1. QR Service Migration (CRITICAL)
**Goal:** Shift QR generation from `organizer-service` (local) to `qr-service` (remote) to enable branded tickets and better separation of concerns.

### Step 1.1: Refactor Organizer Service
- **File:** `microservices/organizer-service/index.js`
- **Current Logic (Delete Lines 45-51):** Remove the local `createTicketQrCode` function that uses the `qrcode` library.
- **New Implementation (Insert at Line 45):**
```javascript
const createTicketQrCode = async (token) => {
  try {
    const { data } = await axios.post(`${SERVICES.qr}/api/qr/generate`, { 
      text: token,
      position: 'center' // Future: can pass organizer logo path here
    }, { timeout: 3000 });
    return data.qrCode;
  } catch (err) {
    console.error('[OrganizerService] QR Service call failed, falling back to local generation', err.message);
    // Fallback logic using local qrcode library (keep as safety)
    return QRCode.toDataURL(token); 
  }
};
```
- **Note:** Line 325 `await createTicketQrCode(qrToken)` remains the same but now executes the remote call.

### Step 1.2: Activate QR Service in Production
- **File:** `docker-compose.yml`
- **Action:** Add the QR service definition to ensure it starts with the cluster.
```yaml
  qr-service:
    build: { context: ./microservices, dockerfile: Dockerfile.node, args: { SERVICE_PATH: qr-service, PORT: 4014 } }
    container_name: cyber_qr
    env_file: .env
    depends_on: [api-gateway]
```

---

## 2. Orphaned Infrastructure (Docker Drift)
**Status:** 🔴 Missing from Orchestration
**Problem:** `email-service` is active in code but orphaned in Docker.

**Remediation:**
Add the following block to `docker-compose.yml`:
```yaml
  email-service:
    build: { context: ./microservices, dockerfile: Dockerfile.node, args: { SERVICE_PATH: email-service, PORT: 4007 } }
    container_name: cyber_email
    env_file: .env
```

---

## 3. Dead Code Cleanup
**Status:** 🔴 Safe to Delete

- **Delete File:** `microservices/organizer-service/routes.js` (unused).
- **Delete File:** `microservices/shared/Ticket.js` (duplicate).

---

## 4. Cross-Service Dependency Map
- **`subscription-service` → `email-service`**: Relies on `sendEmailTemplate` in `interservice.js`.
- **`organizer-service` → `ml-model`**: Relies on `POST :5000/predict`.
- **`scanner-service` → `Shared Models`**: Directly reads `Ticket` status from DB.

---

## 5. Security & Gateway Integrity
**CRITICAL:** When refactoring, do NOT reset the security headers in the API Gateway.
- **File:** `microservices/api-gateway/index.js`
- **Line 55:** Must retain the explicit CSP: `connectSrc: ["'self'", "ws:", "wss:", "http://localhost:5173"]`.
- **Line 146 (Approx):** Verify the proxy route `app.use(proxy(v1('/api/qr'), SERVICES.qr));` is active.
