@echo off
setlocal enabledelayedexpansion

echo Claude Usage Tracker - Native Host Setup
echo ==========================================
echo.

:: Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "HOST_PATH=%SCRIPT_DIR%host.js"
set "MANIFEST_TEMPLATE=%SCRIPT_DIR%com.claude.usage_tracker.json"
set "MANIFEST_DIR=%LOCALAPPDATA%\Claude Usage Tracker"
set "MANIFEST_PATH=%MANIFEST_DIR%\com.claude.usage_tracker.json"

:: Create manifest directory
if not exist "%MANIFEST_DIR%" mkdir "%MANIFEST_DIR%"

:: Get Extension ID from user
echo.
echo Please enter your Chrome extension ID.
echo (You can find this at chrome://extensions after loading the extension)
echo.
set /p EXTENSION_ID="Extension ID: "

if "%EXTENSION_ID%"=="" (
    echo Error: Extension ID is required.
    pause
    exit /b 1
)

:: Create the manifest with correct paths
echo Creating native messaging host manifest...

:: Use PowerShell to create the manifest JSON
powershell -Command ^
    "$manifest = @{ 'name' = 'com.claude.usage_tracker'; 'description' = 'Native messaging host for Claude Usage Tracker'; 'path' = '%HOST_PATH:\=\\%'; 'type' = 'stdio'; 'allowed_origins' = @('chrome-extension://%EXTENSION_ID%/') }; $manifest | ConvertTo-Json | Out-File -FilePath '%MANIFEST_PATH%' -Encoding UTF8"

:: Register with Chrome via registry
echo Registering native messaging host with Chrome...

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.claude.usage_tracker" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f

echo.
echo Setup complete!
echo.
echo The native messaging host has been registered.
echo Please reload the Chrome extension for changes to take effect.
echo.
pause
