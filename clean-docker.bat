@echo off
echo ===========================================
echo Docker Global Clean-Up Script
echo ===========================================
echo.
echo This will delete UNUSED images, containers, and volumes.
echo Only use this if you want to free up significiant disk space.
echo.
set /p confirm="Are you sure you want to proceed? (y/n): "
if /i "%confirm%" neq "y" (
    echo Clean-up cancelled.
    exit /b
)

echo.
echo [1/3] Removing all stopped containers...
docker container prune -f

echo [2/3] Removing all unused images (including old versions)...
docker image prune -a -f

echo [3/3] Removing unused networks...
docker network prune -f

echo.
echo ===========================================
echo DONE! Your Docker environment is clean.
echo ===========================================
pause
