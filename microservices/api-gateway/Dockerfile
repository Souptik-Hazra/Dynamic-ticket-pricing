# Use a specific Node version
FROM node:20-alpine AS build

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies 
# Using npm ci for a more reproducible build
RUN npm install

# Copy source code
COPY . .

# Final stage: production
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy only the necessary files from build stage
COPY --from=build /app /app

# Expose the port (dynamically set via ENV if needed)
EXPOSE 3000

# Set user to non-root
USER node

# Health check (standard for all microservices)
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "index.js"]
