# 🎭 Stage 1: Build Frontend (Cyber-Luxe UI)
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 🚀 Stage 2: Production Monolith (Node.js + Python Sidecar)
FROM node:20-slim
WORKDIR /app

# 1. Install System Dependencies (Python, Build Tools)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 2. Setup Backend (Node.js)
COPY modular-monolith/package*.json ./
RUN npm install --production

# 3. Setup AI Sidecar (Python)
COPY modular-monolith/ml-model/requirements.txt ./ml-model/
RUN pip3 install --no-cache-dir -r ml-model/requirements.txt --break-system-packages

# 4. Copy Backend Source Code
COPY modular-monolith/ .

# 5. Copy Built Frontend Assets from Stage 1
COPY --from=frontend-builder /app/dist /dist

# 6. Environment & Ports
ENV NODE_ENV=production
EXPOSE 4000
EXPOSE 5000

# 7. Launch Unified Monolith
CMD ["npm", "start"]
