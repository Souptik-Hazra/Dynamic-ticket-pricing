# 🚀 FanFever Modular Monolith (Node.js + Python Sidecar)
FROM node:20-slim

# 1. Install System Dependencies (Python, Build Tools)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Setup Backend (Node.js)
COPY package*.json ./
RUN npm install --production

# 3. Setup AI Sidecar (Python)
COPY ml-model/requirements.txt ./ml-model/
RUN pip3 install --no-cache-dir -r ml-model/requirements.txt --break-system-packages

# 4. Copy Source Code
COPY . .

# 5. Environment & Ports
ENV NODE_ENV=production
EXPOSE 4000
EXPOSE 5000

# 6. Launch Monolith (Handles its own sidecar lifecycle)
CMD ["npm", "start"]
