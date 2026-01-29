# Claude Usage Sidebar

A VS Code extension that displays your Claude.ai usage limits in a sidebar, including:

- **Current Session** usage with percentage and reset time
- **Weekly limits** (all models) with percentage and reset date
- **Extra Usage** with spent amount, balance, and limit

## Installation

This extension requires two components: a Chrome extension to collect usage data, and the VS Code extension to display it.

### Step 1: Install the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder from this project
5. The "Claude Usage Tracker" extension should now appear

### Step 2: Set Up Native Messaging (Required)

The Chrome extension needs native messaging to save data locally. **You must run these commands:**

#### Windows (PowerShell as Administrator):

```powershell
# Create the .claude directory
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude"

# Create the native host directory
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\native-host"

# Copy the native host files (run from project directory)
Copy-Item "chrome-extension\native-host\*" "$env:USERPROFILE\.claude\native-host\"

# Update the path in the manifest (replace YOUR_USERNAME)
$manifest = Get-Content "$env:USERPROFILE\.claude\native-host\com.claude.usage_tracker.json" -Raw
$manifest = $manifest -replace 'C:\\\\Users\\\\YOUR_USERNAME', $env:USERPROFILE.Replace('\', '\\')
Set-Content "$env:USERPROFILE\.claude\native-host\com.claude.usage_tracker.json" $manifest

# Register the native messaging host
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.claude.usage_tracker" /ve /t REG_SZ /d "$env:USERPROFILE\.claude\native-host\com.claude.usage_tracker.json" /f
```

#### macOS/Linux:

```bash
# Create directories
mkdir -p ~/.claude/native-host

# Copy native host files (run from project directory)
cp chrome-extension/native-host/* ~/.claude/native-host/

# Update the path in the manifest
sed -i '' "s|/Users/YOUR_USERNAME|$HOME|g" ~/.claude/native-host/com.claude.usage_tracker.json

# Make the host script executable
chmod +x ~/.claude/native-host/native-host.js

# Register for Chrome (macOS)
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts
ln -sf ~/.claude/native-host/com.claude.usage_tracker.json ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/

# Register for Chrome (Linux)
mkdir -p ~/.config/google-chrome/NativeMessagingHosts
ln -sf ~/.claude/native-host/com.claude.usage_tracker.json ~/.config/google-chrome/NativeMessagingHosts/
```

### Step 3: Install the VS Code Extension

#### From VSIX file:
1. Download or build the `.vsix` file
2. In VS Code, press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Install from VSIX" and select it
4. Choose the `.vsix` file

#### For development:
1. Open this folder in VS Code
2. Run `npm install`
3. Press **F5** to launch the extension in development mode

### Step 4: First Use

1. Click the **Claude** icon in the VS Code Activity Bar
2. If you see "No usage data found", click **Open Usage Page**
3. Log in to Claude.ai if needed
4. The usage page will open in its own window
5. Data will automatically sync to the sidebar

## Usage

- The sidebar displays all three usage metrics with progress bars
- Data refreshes automatically every 30 seconds (configurable)
- If data becomes stale (>2 minutes old), a warning appears with a refresh button
- Click the refresh icon or "Open Usage Page" button to update data

## Settings

- `claudeUsage.refreshSeconds` - Refresh interval in seconds (default: 30, minimum: 10)

## How It Works

1. The Chrome extension runs on the `claude.ai/settings/usage` page
2. It extracts usage data from the page and saves it to `~/.claude/usage-limits.json`
3. The VS Code extension watches this file and displays the data in the sidebar
4. The Chrome extension auto-refreshes the usage page every minute (when open)

## Troubleshooting

### "No usage data found"
- Make sure the Chrome extension is installed and enabled
- Open the Claude usage page at least once
- Check that native messaging is set up correctly

### Data not updating
- Verify the Chrome extension is running (check `chrome://extensions/`)
- Make sure the usage page tab is open (or open it via the sidebar button)
- Check Chrome DevTools console for errors (right-click extension > Inspect)

### Native messaging errors
- Ensure the registry entry (Windows) or symlink (Mac/Linux) points to the correct path
- Verify the manifest JSON file has the correct path to `native-host.js`
- Check that `native-host.js` has execute permissions (Mac/Linux)
