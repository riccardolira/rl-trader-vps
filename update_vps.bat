@echo off
echo ==================================================
echo RL TRADER - VPS Update Script
echo ==================================================
echo.

echo [1/3] Fetching latest updates from GitHub...

:: Backup Custom Configs
if exist universe_config.json copy /Y universe_config.json universe_config.json.bak
if exist risk_config.json copy /Y risk_config.json risk_config.json.bak
if exist strategy_config.json copy /Y strategy_config.json strategy_config.json.bak

git fetch origin
git reset --hard origin/main

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Git pull failed! Please check your connection or resolve conflicts.
    pause
    exit /b %errorlevel%
)

:: Restore Custom Configs
if exist universe_config.json.bak copy /Y universe_config.json.bak universe_config.json
if exist risk_config.json.bak copy /Y risk_config.json.bak risk_config.json
if exist strategy_config.json.bak copy /Y strategy_config.json.bak strategy_config.json

echo [OK] Update downloaded successfully.
echo.

echo [2/3] Installing/Updating Python Dependencies...
pip install -r requirements.txt
echo [OK] Dependencies updated.
echo.

echo [3/3] Restarting Services...
echo Please ensure that any running instances of start_v3.bat are closed.
echo You can now run start_v3.bat to launch the updated system.
echo.
echo ==================================================
echo UPDATE COMPLETE
echo ==================================================
pause
