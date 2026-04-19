#!/bin/bash

# ==============================================================================
# Production Deployment Script - Dynamic Ticket Pricing
# ==============================================================================

# Exit on error
set -e

echo "🚀 Starting Production Deployment..."

# 1. Pull the latest code
echo "📥 Pulling latest code from main branch..."
git pull origin main

# 2. Rebuild and restart the stack
# We use 'full' profile by default on the server
echo "🏗️  Rebuilding and restarting Docker containers..."
docker compose --profile full up -d --build

# 3. Clean up old images to save space
echo "🧹 Cleaning up unused Docker images..."
docker image prune -f

echo "✅ Deployment Successful!"
echo "🌐 Your system is live at your server's IP address."
