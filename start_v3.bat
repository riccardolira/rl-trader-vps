@echo off
echo Starting RL Trader V3 System...
echo --------------------------------
echo --------------------------------

:: Install Dependencies (check)
echo Checking dependencies...
pip install -r requirements.txt

:: Start Backend in a new window
echo Starting Backend on port 8001...
start "RL Trader V3 Backend" cmd /k "cd /d %~dp0 && python -m src.main || pause"

:: Small delay to let backend initialize
timeout /t 5

:: Start Frontend in a new window
echo Starting Frontend (Vite)...
start "RL Trader V3 Dashboard" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo System starting... Check the new windows.
echo Dashboard URL: http://localhost:5173 (usually)
pause
