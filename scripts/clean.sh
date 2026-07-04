#!/bin/bash
docker compose down -v --remove-orphans
docker system prune -af
docker volume prune -f
