# 🐳 FanFever Backend Dockerfile
# Optimized for Performance and Security (Phase 11 Hardening)

FROM node:24-slim

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy application source
COPY . .

# Fix 10: Security Hardening (Non-root user)
RUN chown -R node:node /app
USER node

# Set production environment
ENV NODE_ENV=production

# Expose the API port
EXPOSE 4000

# Start the application
CMD ["node", "server.js"]
