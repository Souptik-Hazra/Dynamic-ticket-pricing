# Production Deployment Guide (Oracle Cloud / VPS)

This guide explains how to deploy your full 17-service stack to a VPS (like Oracle Cloud) for free.

## 1. Local Preparation
Before you start, ensure your code is pushed to a private GitHub repository.
1. Commit all your changes (Dockerfiles, `docker-compose.yml`, `deploy.sh`).
2. Push to GitHub: `git push origin main`.

## 2. Server Setup (Oracle Cloud / VPS)
1. **Create an Instance:**
   - Choose **Oracle Linux 8** or **Ubuntu 22.04**.
   - Select **Ampere (ARM)** shapes for the 24GB RAM free tier.
2. **Install Docker & Git:**
   ```bash
   sudo yum install -y git docker
   sudo systemctl start docker
   sudo systemctl enable docker
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```
3. **Open Ports:** In your Oracle Cloud Security List, open port **80** (HTTP) and **443** (HTTPS).

## 3. Clone and Initialize
On your server, clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git project
cd project
```

## 4. Run the Deployment
We have provided a one-click deployment script. Just run:
```bash
chmod +x deploy.sh
./deploy.sh
```
This script will:
- Pull the latest code.
- Build all 17 microservices using the unified Dockerfile.
- Start the infrastructure (MongoDB, Redis, RabbitMQ).
- Start the Frontend and API Gateway.

## 5. Reverse Proxy Setup (Optional but Recommended)
I have provided a production NGINX config in `production/nginx.conf`. You can run this as a separate container or install NGINX directly on the host to manage SSL certificates via Certbot (Let's Encrypt).

---

## Troubleshooting
- **Memory Errors:** If the server runs out of memory during build, increase the "Swap" space on your Linux instance.
- **Port Collisions:** Ensure no other web servers (like Apache) are running on the server.
- **Health Checks:** You can check the status of all services by visiting `http://<your-server-ip>/api/health-all`.
