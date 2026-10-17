@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22 or later from https://nodejs.org/
  pause
  exit /b 1
)
node bridge/server.mjs
pause
