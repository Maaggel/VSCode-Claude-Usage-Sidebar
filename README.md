# Claude Usage Sidebar

A VS Code extension that displays your Claude.ai usage limits directly in the sidebar.

![Usage Display](https://img.shields.io/badge/VS%20Code-Extension-blue)

## Features

- **Current Session** - See your session usage with percentage and reset time
- **Weekly Limits** - Track usage across all models with reset date
- **Extra Usage** - Monitor spent amount, balance, and limit
- Auto-refreshes every 30 seconds
- Visual progress bars for quick status checks

## Requirements

- **VS Code** 1.108.0 or higher
- **Chrome/Chromium-based browser** (Chrome, Edge, Brave, Vivaldi, or Opera)
- **Node.js** installed on your system
- **Claude.ai Pro/Team subscription** (to have usage limits to track)

## Installation

This extension has two components: a Chrome extension that collects data from Claude.ai, and a VS Code extension that displays it.

### Step 1: Install the VS Code Extension

**Option A: From VSIX file (Recommended)**
1. Download the `.vsix` file from the [Releases](../../releases) page
2. In VS Code, press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type **"Install from VSIX"** and select it
4. Choose the downloaded `.vsix` file

**Option B: From source**
1. Download or clone this repository
2. Run `npm install` in the project folder
3. Run `npx vsce package` to build the `.vsix` file
4. Install the generated `.vsix` file as described above

### Step 2: Install the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder from this project
5. Note the **Extension ID** shown under the extension name (you'll need this)

### Step 3: Set Up Native Messaging

The Chrome extension needs native messaging to save data locally so VS Code can read it.

#### Windows

1. Open a command prompt in the project folder
2. Run:
   ```batch
   chrome-extension\native-host\setup-windows.bat
   ```
3. Enter your Chrome extension ID when prompted
4. The script will set up everything automatically

#### macOS

```bash
# Create the native host directory
mkdir -p ~/.claude/native-host

# Copy files (run from project directory)
cp chrome-extension/native-host/host.js ~/.claude/native-host/
cp chrome-extension/native-host/com.claude.usage_tracker.json ~/.claude/native-host/

# Make executable
chmod +x ~/.claude/native-host/host.js

# Update the manifest with your extension ID (replace YOUR_EXTENSION_ID)
sed -i '' "s/EXTENSION_ID_PLACEHOLDER/YOUR_EXTENSION_ID/g" ~/.claude/native-host/com.claude.usage_tracker.json
sed -i '' "s|HOST_PATH_PLACEHOLDER|$HOME/.claude/native-host/host.js|g" ~/.claude/native-host/com.claude.usage_tracker.json

# Register for Chrome
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts
ln -sf ~/.claude/native-host/com.claude.usage_tracker.json ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
```

#### Linux

```bash
# Create the native host directory
mkdir -p ~/.claude/native-host

# Copy files (run from project directory)
cp chrome-extension/native-host/host.js ~/.claude/native-host/
cp chrome-extension/native-host/com.claude.usage_tracker.json ~/.claude/native-host/

# Make executable
chmod +x ~/.claude/native-host/host.js

# Update the manifest with your extension ID (replace YOUR_EXTENSION_ID)
sed -i "s/EXTENSION_ID_PLACEHOLDER/YOUR_EXTENSION_ID/g" ~/.claude/native-host/com.claude.usage_tracker.json
sed -i "s|HOST_PATH_PLACEHOLDER|$HOME/.claude/native-host/host.js|g" ~/.claude/native-host/com.claude.usage_tracker.json

# Register for Chrome
mkdir -p ~/.config/google-chrome/NativeMessagingHosts
ln -sf ~/.claude/native-host/com.claude.usage_tracker.json ~/.config/google-chrome/NativeMessagingHosts/

# Or for Chromium
mkdir -p ~/.config/chromium/NativeMessagingHosts
ln -sf ~/.claude/native-host/com.claude.usage_tracker.json ~/.config/chromium/NativeMessagingHosts/
```

### Step 4: First Use

1. Click the **Claude** icon in the VS Code Activity Bar (left sidebar)
2. Click **Open Usage Page** to open Claude's usage page in your browser
3. Log in to Claude.ai if needed
4. The extension will automatically sync and display your usage data

## Usage

Once set up, the sidebar shows:

- **Current Session** - Usage in your current session with time until reset
- **Weekly Limits** - Your weekly usage across all models
- **Extra Usage** - Any extra usage charges (if applicable)

The data refreshes automatically. If data becomes stale, a refresh button will appear.

## Settings

Open VS Code Settings (`Ctrl+,`) and search for "Claude Usage":

| Setting | Description | Default |
|---------|-------------|---------|
| `claudeUsage.refreshSeconds` | How often to refresh (seconds) | 30 |
| `claudeUsage.browserPath` | Custom browser path for opening usage page | (system default) |
| `claudeUsage.dataBrowser` | Which browser's data to show (`auto`, `chrome`, `chromium`, `edge`, `brave`, `vivaldi`, `opera`) | auto |

## Troubleshooting

### "No usage data found"

1. Make sure the Chrome extension is installed and enabled
2. Open the Claude usage page at least once (click "Open Usage Page" in the sidebar)
3. Verify native messaging is set up correctly (see Step 3)

### Data not updating

1. Check that the Chrome extension is enabled at `chrome://extensions/`
2. Try opening the usage page again via the sidebar button
3. Check the Chrome extension popup for any error messages

### Native messaging errors

**Windows:**
- Re-run `setup-windows.bat` if you see errors
- Make sure Node.js is installed and in your PATH

**macOS/Linux:**
- Verify `~/.claude/native-host/host.js` exists and is executable
- Check that symlinks were created in the correct browser directory

### "Select an app to open this .js file" (Windows)

Re-run `chrome-extension\native-host\setup-windows.bat` - this fixes the host path.

## Multi-Browser Support

If you use Claude in multiple browsers, each saves data separately. Set `claudeUsage.dataBrowser` to choose which browser's data to show, or leave it as `auto` to show the most recent.

## For Developers

See [DEVELOPMENT.md](DEVELOPMENT.md) for build instructions, architecture details, and contribution guidelines.

## License

MIT
