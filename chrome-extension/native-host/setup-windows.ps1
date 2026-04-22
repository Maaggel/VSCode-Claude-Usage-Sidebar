Write-Host "Claude Usage Tracker - Native Host Setup"
Write-Host "=========================================="
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$hostPath  = Join-Path $scriptDir "host.bat"
$manifestDir  = Join-Path $env:LOCALAPPDATA "Claude Usage Tracker"
$manifestPath = Join-Path $manifestDir "com.claude.usage_tracker.json"

if (-not (Test-Path $manifestDir)) {
    New-Item -ItemType Directory -Path $manifestDir | Out-Null
}

Write-Host "Please enter your extension ID(s) for each browser where the extension is installed."
Write-Host "(You can find the ID at chrome://extensions or edge://extensions)"
Write-Host "Press Enter to skip a browser if the extension isn't installed there."
Write-Host ""

$origins = @()

$chromeId = Read-Host "Chrome extension ID (or press Enter to skip)"
if ($chromeId) { $origins += "chrome-extension://$chromeId/" }

$chromiumId = Read-Host "Chromium extension ID (or press Enter to skip)"
if ($chromiumId) { $origins += "chrome-extension://$chromiumId/" }

$edgeId = Read-Host "Edge extension ID (or press Enter to skip)"
if ($edgeId) { $origins += "chrome-extension://$edgeId/" }

$braveId = Read-Host "Brave extension ID (or press Enter to skip)"
if ($braveId) { $origins += "chrome-extension://$braveId/" }

if ($origins.Count -eq 0) {
    Write-Host "Error: At least one extension ID is required." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Creating native messaging host manifest..."

$manifest = [ordered]@{
    name            = "com.claude.usage_tracker"
    description     = "Native messaging host for Claude Usage Tracker"
    path            = $hostPath
    type            = "stdio"
    allowed_origins = $origins
}

$manifest | ConvertTo-Json | Out-File -FilePath $manifestPath -Encoding UTF8

Write-Host "Registering native messaging host with Chrome, Chromium, Edge, and Brave..."

$regKeys = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.claude.usage_tracker"
    "HKCU:\Software\Chromium\NativeMessagingHosts\com.claude.usage_tracker"
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.claude.usage_tracker"
    "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.claude.usage_tracker"
)

foreach ($key in $regKeys) {
    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty -Path $key -Name "(default)" -Value $manifestPath
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "The native messaging host has been registered."
Write-Host "Please reload the Chrome extension for changes to take effect."
Write-Host ""
Read-Host "Press Enter to exit"
