@echo off
chcp 65001 >nul 2>&1
setlocal

:: ================================================================
:: QACKER - Windows Launcher
:: Starts the Node server, then opens http://localhost:PORT
:: in your default browser once the server is ready.
:: ================================================================

title QACKER - CyberStrike Arsenal

:: ---- Optional env overrides (uncomment to enable) ---------------
:: set PORT=3000
:: set HOST=127.0.0.1
:: set USE_WSL=true
:: set WSL_DISTRO=OpenClawGateway
:: set WSL_TOOL_PATHS=/usr/local/bin:/usr/bin:/root/go/bin:/home/openclaw/go/bin
:: set TOOL_TIMEOUT_MS=600000
:: set SECLISTS_PATH=
:: set LOOT_DIR=

:: ---- Defaults ---------------------------------------------------
if not defined PORT set PORT=3000
if not defined HOST set HOST=127.0.0.1

:: ---- Check node -------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] node.exe not found on PATH.
    echo  Install Node.js from https://nodejs.org then try again.
    echo.
    pause
    exit /b 1
)

:: ---- Navigate to project root -----------------------------------
:: %~dp0 is always the directory containing this .bat file.
:: We cd here explicitly so node can find server\index.js regardless
:: of what working directory the shortcut or caller was in.
cd /d "%~dp0"
echo  [QACKER] Project dir: %CD%

:: ---- Install deps if missing ------------------------------------
if not exist "node_modules\" (
    echo  [QACKER] First run - installing dependencies...
    call npm install
    if errorlevel 1 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo  Done.
    echo.
)

:: ---- Kill any stale QACKER server on the same port --------------
powershell -NoProfile -NonInteractive -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*server\index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
timeout /t 2 /nobreak >nul

:: ---- Banner -----------------------------------------------------
echo.
echo   QACKER - CyberStrike Arsenal
echo   KING@THRONE
echo   Dashboard: http://localhost:%PORT%
echo   Press Ctrl+C to stop the server.
echo.

:: ---- Open browser in background (via companion .ps1 file) ------
start "" /b powershell -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0open-browser.ps1" -Port %PORT%

:: ---- Start server (foreground - Ctrl+C to stop) ----------------
if not exist "server\index.js" (
    echo  [ERROR] server\index.js not found in %CD%
    echo  Make sure start-qacker.bat is in the QACKER project root.
    pause
    exit /b 1
)

node server\index.js
set NODE_EXIT=%ERRORLEVEL%

echo.
if %NODE_EXIT% NEQ 0 (
    echo  [ERROR] Server exited with code %NODE_EXIT%
) else (
    echo  [QACKER] Server stopped.
)
echo.
pause
