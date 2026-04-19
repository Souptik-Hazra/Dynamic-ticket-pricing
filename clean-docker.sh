#!/bin/bash

# Docker Global Clean-Up Script for Linux/macOS/WSL/Git Bash
echo "==========================================="
echo "Docker Global Clean-Up Script"
echo "==========================================="
echo ""
echo "This will delete UNUSED images, containers, and volumes."
echo "Only use this if you want to free up significant disk space."
echo ""

read -p "Are you sure you want to proceed? (y/n): " confirm
if [[ $confirm != [yY] ]]; then
    echo "Clean-up cancelled."
    exit 1
fi

echo ""
echo "[1/3] Removing all stopped containers..."
docker container prune -f

echo "[2/3] Removing all unused images (including old versions)..."
docker image prune -a -f

echo "[3/3] Removing unused networks..."
docker network prune -f

echo ""
echo "==========================================="
echo "DONE! Your Docker environment is clean."
echo "==========================================="
