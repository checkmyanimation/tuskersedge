@echo off
setlocal

cd /d "%~dp0"
echo Starting TuskersEdge server on http://localhost:3000
echo Press Ctrl+C to stop.

node server.js
