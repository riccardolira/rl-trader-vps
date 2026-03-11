@echo off
echo ==================================================
echo RL TRADER - VPS Update Script
echo ==================================================
echo.

echo [1/3] Fetching latest updates from GitHub...

:: Config files are now untracked (.gitignore). No need to backup and restore them here.
:: The backend automatically generates them from defaults if missing.

git fetch origin
git reset --hard origin/main

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Git pull failed! Please check your connection or resolve conflicts.
    pause
    exit /b %errorlevel%
)

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
