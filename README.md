# Claude Usage Sidebar

A VS Code extension that shows your [Claude.ai](https://claude.ai) usage limits directly in the sidebar — session usage, weekly limits, and extra usage at a glance.

![VS Code](https://img.shields.io/badge/VS%20Code-1.108%2B-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Session usage** — current session percentage and time until reset
- **Weekly limits** — usage across all models with reset date
- **Extra usage** — spent amount, remaining balance, and limit
- **Auto-refresh** — updates every 30 seconds (configurable)
- **Visual progress bars** — quick status at a glance

## How It Works

The extension has two parts:

1. A **Chrome extension** that reads your usage data from Claude.ai and saves it locally via native messaging
2. A **VS Code extension** that reads that local data and displays it in a sidebar panel

## Requirements

- **VS Code** 1.108.0+
- **Chrome** or any Chromium-based browser (Edge, Brave, Vivaldi, Opera)
- **Node.js** installed and available in your PATH
- A **Claude.ai Pro or Team subscription** (free accounts don't have usage limits to track)

## Installation

### Step 1: Install the Chrome Extension

1. [Download the Chrome extension from the latest release](https://github.com/Maaggel/VSCode-Claude-Usage-Sidebar/releases)
2. Open your browser and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Unpack and select the downloaded `chrome-extension`
6. Copy the **Extension ID** shown under the extension name — you'll need it in Step 3

### Step 2: Install the VS Code Extension

1. [Download the .vsix file from the latest release](https://github.com/Maaggel/VSCode-Claude-Usage-Sidebar/releases) or build the `.vsix` file yourself:
   ```
   npx vsce package --allow-missing-repository
   ```
2. In VS Code, press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Search for **"Install from VSIX"** and select it
4. Choose the `.vsix` file

### Step 3: Set Up Native Messaging

The Chrome extension uses [native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) to save usage data to a local file that VS Code can read. Pick your platform below.

<details>
<summary><strong>Windows</strong></summary>

1. Open a terminal in the project folder
2. Run the setup script:
   ```batch
   chrome-extension\native-host\setup-windows.bat
   ```
3. Enter your Chrome extension ID when prompted
4. Done — the script handles everything automatically

</details>

<details>
<summary><strong>macOS</strong></summary>

```bash
# Create the native host directory
mkdir -p ~/.claude/native-host

# Copy files (run from the project directory)
cp chrome-extension/native-host/host.js ~/.claude/native-host/
cp chrome-extension/native-host/com.claude.usage_tracker.json ~/.claude/native-host/

# Make the host script executable
chmod +x ~/.claude/native-host/host.js

# Replace placeholders with your extension ID and path
sed -i '' "s/EXTENSION_ID_PLACEHOLDER/YOUR_EXTENSION_ID/g" ~/.claude/native-host/com.claude.usage_tracker.json
sed -i '' "s|HOST_PATH_PLACEHOLDER|$HOME/.claude/native-host/host.js|g" ~/.claude/native-host/com.claude.usage_tracker.json

# Register the native host with Chrome
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts
ln -sf ~/.claude/native-host/com.claude.usage_tracker.json \
  ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
```

</details>

<details>
<summary><strong>Linux</strong></summary>

```bash
# Create the native host directory
mkdir -p ~/.claude/native-host

# Copy files (run from the project directory)
cp chrome-extension/native-host/host.js ~/.claude/native-host/
cp chrome-extension/native-host/com.claude.usage_tracker.json ~/.claude/native-host/

# Make the host script executable
chmod +x ~/.claude/native-host/host.js

# Replace placeholders with your extension ID and path
sed -i "s/EXTENSION_ID_PLACEHOLDER/YOUR_EXTENSION_ID/g" ~/.claude/native-host/com.claude.usage_tracker.json
sed -i "s|HOST_PATH_PLACEHOLDER|$HOME/.claude/native-host/host.js|g" ~/.claude/native-host/com.claude.usage_tracker.json

# Register the native host with Chrome
mkdir -p ~/.config/google-chrome/NativeMessagingHosts
ln -sf ~/.claude/native-host/com.claude.usage_tracker.json \
  ~/.config/google-chrome/NativeMessagingHosts/

# Or for Chromium
mkdir -p ~/.config/chromium/NativeMessagingHosts
ln -sf ~/.claude/native-host/com.claude.usage_tracker.json \
  ~/.config/chromium/NativeMessagingHosts/
```

</details>

### Step 4: Verify It Works

1. Click the **Claude** icon in the VS Code Activity Bar (left sidebar)
2. Click **Open Usage Page** — this opens Claude's usage page in your browser
3. Log in to Claude.ai if needed
4. The sidebar will automatically sync and display your usage data

> **Tip:** You can drag the Claude icon from the Activity Bar to the **Secondary Side Bar** (right side) or the **Panel** (bottom) to keep your usage data visible while you work. This way you can have your file explorer or source control open on the left and your Claude usage always visible on the right.

## Settings

Open VS Code Settings (`Ctrl+,`) and search for "Claude Usage":

| Setting | Description | Default |
|---------|-------------|---------|
| `claudeUsage.refreshSeconds` | Auto-refresh interval in seconds | `30` |
| `claudeUsage.browserPath` | Custom browser path for opening the usage page | System default |
| `claudeUsage.dataBrowser` | Which browser's data to display: `auto`, `chrome`, `chromium`, `edge`, `brave`, `vivaldi`, `opera` | `auto` |

## Troubleshooting

<details>
<summary><strong>"No usage data found"</strong></summary>

1. Make sure the Chrome extension is installed and enabled
2. Open the Claude usage page at least once (click **Open Usage Page** in the sidebar)
3. Verify native messaging is set up correctly (see Step 3 above)

</details>

<details>
<summary><strong>Data not updating</strong></summary>

1. Check that the Chrome extension is enabled at `chrome://extensions/`
2. Open the usage page again via the sidebar button
3. Check the Chrome extension popup for error messages

</details>

<details>
<summary><strong>Native messaging errors</strong></summary>

**Windows:** Re-run `setup-windows.bat` and make sure Node.js is in your PATH.

**macOS/Linux:** Verify `~/.claude/native-host/host.js` exists and is executable, and that the symlink was created in the correct browser directory.

</details>

<details>
<summary><strong>"Select an app to open this .js file" (Windows)</strong></summary>

Re-run `chrome-extension\native-host\setup-windows.bat` — this fixes the host path.

</details>

## Multi-Browser Support

If you use Claude in multiple browsers, each browser saves its data separately. Set `claudeUsage.dataBrowser` to choose which browser's data to display, or leave it as `auto` to show whichever was updated most recently.

## Machine-Specific Configuration

If you use VS Code on multiple machines (e.g., Windows + WSL), you can create a local config file that overrides VS Code settings per machine:

**File:** `~/.claude/sidebar-config.json`

```json
{
  "dataBrowser": "chromium"
}
```

Since Windows and WSL have separate home directories, this lets each environment point to a different browser's data:
- **Windows:** `C:\Users\<username>\.claude\sidebar-config.json`
- **WSL/Linux:** `~/.claude/sidebar-config.json`

## Contributing

See [DEVELOPMENT.md](DEVELOPMENT.md) for build instructions and architecture details.

## License

This project is licensed under the [MIT License](LICENSE).
