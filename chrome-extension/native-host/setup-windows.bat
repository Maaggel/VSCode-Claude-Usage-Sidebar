@echo off
setlocal enabledelayedexpansion

echo Claude Usage Tracker - Native Host Setup
echo ==========================================
echo.

:: Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "HOST_PATH=%SCRIPT_DIR%host.bat"
set "MANIFEST_TEMPLATE=%SCRIPT_DIR%com.claude.usage_tracker.json"
set "MANIFEST_DIR=%LOCALAPPDATA%\Claude Usage Tracker"
set "MANIFEST_PATH=%MANIFEST_DIR%\com.claude.usage_tracker.json"

:: Create manifest directory
if not exist "%MANIFEST_DIR%" mkdir "%MANIFEST_DIR%"

:: Get Extension IDs from user
echo.
echo Please enter your extension ID(s) for each browser where the extension is installed.
echo (You can find the ID at chrome://extensions or edge://extensions)
echo Press Enter to skip a browser if the extension isn't installed there.
echo.

set "EXTENSION_IDS="

set /p CHROME_ID="Chrome extension ID (or press Enter to skip): "
if not "%CHROME_ID%"=="" (
    set "EXTENSION_IDS=chrome-extension://%CHROME_ID%/"
)

set /p CHROMIUM_ID="Chromium extension ID (or press Enter to skip): "
if not "%CHROMIUM_ID%"=="" (
    if "%EXTENSION_IDS%"=="" (
        set "EXTENSION_IDS=chrome-extension://%CHROMIUM_ID%/"
    ) else (
        set "EXTENSION_IDS=%EXTENSION_IDS%,chrome-extension://%CHROMIUM_ID%/"
    )
)

set /p EDGE_ID="Edge extension ID (or press Enter to skip): "
if not "%EDGE_ID%"=="" (
    if "%EXTENSION_IDS%"=="" (
        set "EXTENSION_IDS=chrome-extension://%EDGE_ID%/"
    ) else (
        set "EXTENSION_IDS=%EXTENSION_IDS%,chrome-extension://%EDGE_ID%/"
    )
)

set /p BRAVE_ID="Brave extension ID (or press Enter to skip): "
if not "%BRAVE_ID%"=="" (
    if "%EXTENSION_IDS%"=="" (
        set "EXTENSION_IDS=chrome-extension://%BRAVE_ID%/"
    ) else (
        set "EXTENSION_IDS=%EXTENSION_IDS%,chrome-extension://%BRAVE_ID%/"
    )
)

if "%EXTENSION_IDS%"=="" (
    echo Error: At least one extension ID is required.
    pause
    exit /b 1
)

:: Create the manifest with correct paths
echo.
echo Creating native messaging host manifest...

:: Use PowerShell to create the manifest JSON with multiple allowed_origins
powershell -Command ^
    "$ids = '%EXTENSION_IDS%'.Split(','); $manifest = @{ 'name' = 'com.claude.usage_tracker'; 'description' = 'Native messaging host for Claude Usage Tracker'; 'path' = '%HOST_PATH:\=\\%'; 'type' = 'stdio'; 'allowed_origins' = $ids }; $manifest | ConvertTo-Json | Out-File -FilePath '%MANIFEST_PATH%' -Encoding UTF8"

:: Register with all Chromium-based browsers via registry
echo Registering native messaging host with Chrome, Chromium, Edge, and Brave...

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.claude.usage_tracker" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f
reg add "HKCU\Software\Chromium\NativeMessagingHosts\com.claude.usage_tracker" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.claude.usage_tracker" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f
reg add "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.claude.usage_tracker" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f

echo.
echo Setup complete!
echo.
echo The native messaging host has been registered.
echo Please reload the Chrome extension for changes to take effect.
echo.
pause
