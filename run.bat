@echo off
title GenAI-Chatbot Runner
echo ===================================================
echo   GenAI-Chatbot: Starting Backend and Frontend
echo ===================================================
echo.

:: Get directory where run.bat is located
set "ROOT_DIR=%~dp0"

echo [1/2] Starting Backend (FastAPI on http://127.0.0.1:8000)...
start "GenAI Chatbot - Backend" cmd /k "cd /d %ROOT_DIR%backend && python -m uvicorn main:app --reload --port 8000"

echo [2/2] Starting Frontend (Next.js on http://localhost:3000)...
start "GenAI Chatbot - Frontend" cmd /k "cd /d %ROOT_DIR%frontend && npm run dev"

echo.
echo ===================================================
echo   Both servers launched in separate windows!
echo   - Backend:  http://127.0.0.1:8000 (API docs: /docs)
echo   - Frontend: http://localhost:3000
echo ===================================================
echo.
pause
