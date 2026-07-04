#!/bin/bash
echo "========== Containers =========="
docker compose ps

echo
echo "========== API =========="
curl -fsS http://localhost:3001/health || true

echo
echo "========== ML =========="
curl -fsS http://localhost:5000/health || true

echo
echo "========== Frontend =========="
curl -I http://localhost:5173 || true
