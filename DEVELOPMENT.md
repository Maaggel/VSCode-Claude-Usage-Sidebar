# Development Guide

This document covers the technical architecture, development setup, and contribution guidelines for the Claude Usage Sidebar extension.

## Architecture Overview

The extension consists of two main components that work together:

```
┌─────────────────────┐         ┌─────────────────────┐
│   Chrome Extension  │         │  VS Code Extension  │
│                     │         │                     │
│  ┌───────────────┐  │         │  ┌───────────────┐  │
│  │  content.js   │  │         │  │  extension.js │  │
│  │ (scrapes data)│  │         │  │  (reads JSON) │  │
│  └───────┬───────┘  │         │  └───────┬───────┘  │
│          │          │         │          │          │
│  ┌───────▼───────┐  │         │  ┌───────▼───────┐  │
│  │ background.js │  │         │  │   Webview UI  │  │
│  │ (native msg)  │  │         │  │ (renders data)│  │
│  └───────┬───────┘  │         │  └───────────────┘  │
└──────────┼──────────┘         └─────────────────────┘
           │                              ▲
           │    ┌─────────────────────┐   │
           └────►  ~/.claude/         │───┘
                │  usage-limits-*.json│
                └─────────────────────┘
```

### Data Flow

1. **Chrome Extension** runs on `claude.ai/settings/usage`
2. **content.js** scrapes usage data from the page DOM
3. **background.js** sends data to the native host via Chrome's Native Messaging API
4. **Native Host** (Node.js) writes JSON to `~/.claude/usage-limits-{browser}.json`
5. **VS Code Extension** watches the JSON file and updates the sidebar webview

## Project Structure

```
claude-usage-sidebar/
├── extension.js              # VS Code extension entry point
├── package.json              # Extension manifest & dependencies
├── media/
│   └── icon.svg              # Activity bar icon
└── chrome-extension/
    ├── manifest.json         # Chrome extension manifest
    ├── content.js            # Content script (scrapes usage page)
    ├── background.js         # Service worker (handles native messaging)
    ├── popup.html            # Extension popup UI
    ├── popup.js              # Popup logic
    └── native-host/
        ├── host.js           # Native messaging host (Node.js)
        ├── host.bat          # Windows wrapper for host.js
        ├── com.claude.usage_tracker.json  # Native host manifest template
        └── setup-windows.bat # Windows installation script
```

## Development Setup

### Prerequisites

- Node.js 18+
- VS Code 1.108.0+
- Chrome or Chromium-based browser

### VS Code Extension Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd claude-usage-sidebar
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Open in VS Code:
   ```bash
   code .
   ```

4. Press **F5** to launch the Extension Development Host

5. The extension will be active in the new VS Code window with debugging enabled

### Chrome Extension Development

1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `chrome-extension` folder
4. After making changes, click the refresh icon on the extension card

### Testing the Full Flow

1. Set up native messaging (see README.md)
2. Run VS Code in debug mode (F5)
3. Open `https://claude.ai/settings/usage` in Chrome
4. Check that data appears in the VS Code sidebar

## Building

### Building the VS Code Extension

```bash
# Install dependencies
npm install

# Package the extension
npx vsce package --allow-missing-repository
```

This creates `claude-usage-sidebar-x.x.x.vsix` in the project root.

> **Note:** The `--allow-missing-repository` flag is needed because this is a private extension without a published repository URL.

### Building for Distribution

Before distributing, ensure:

1. Update version in `package.json`
2. Test on all target platforms (Windows, macOS, Linux)
3. Verify native messaging works with different browsers

## Key Files

### extension.js

The main VS Code extension file. Key components:

- `ClaudeUsageViewProvider` - Webview provider for the sidebar
- `_setupFileWatchers()` - Watches JSON files for changes
- `_readUsageLimits()` - Parses the JSON data
- `_getHtml()` - Generates the sidebar HTML/CSS

### chrome-extension/content.js

Content script that runs on the Claude usage page:

- Scrapes usage data from DOM elements
- Sends data to background script
- Handles page refresh for live updates

### chrome-extension/background.js

Service worker that:

- Receives data from content scripts
- Communicates with the native host
- Manages browser detection

### chrome-extension/native-host/host.js

Node.js script that:

- Receives messages from Chrome via stdin
- Writes JSON to `~/.claude/usage-limits-{browser}.json`
- Handles the native messaging protocol (length-prefixed messages)

## Configuration

### VS Code Settings

Standard settings are read from VS Code's configuration system (`claudeUsage.*`).

### Machine-Specific Config File

For environments where VS Code settings are shared (e.g., Windows + WSL via Remote extension), the extension supports a local config file that takes precedence:

**File:** `~/.claude/sidebar-config.json`

```json
{
  "dataBrowser": "chromium"
}
```

This is useful because:
- Windows and WSL have different home directories
- VS Code User settings are often synced between local and remote
- Each machine can have independent browser preferences

The extension checks for this file in `_getLocalConfig()` and uses its values over VS Code settings.

## Data Format

The JSON file (`~/.claude/usage-limits-{browser}.json`) contains:

```json
{
  "timestamp": 1234567890123,
  "currentSession": {
    "percent": 75,
    "resetTime": "in 4 hours"
  },
  "weeklyLimits": {
    "percent": 50,
    "resetDate": "Feb 10"
  },
  "extraUsage": {
    "spent": "$5.00",
    "balance": "$45.00",
    "limit": "$50.00"
  }
}
```

## Native Messaging Protocol

Chrome's Native Messaging uses a specific protocol:

1. Messages are JSON
2. Each message is prefixed with a 4-byte length (little-endian)
3. The native host reads from stdin and writes to stdout

Example in `host.js`:
```javascript
// Reading a message
const length = buffer.readUInt32LE(0);
const message = buffer.slice(4, 4 + length).toString();

// Writing a response
const response = JSON.stringify({ success: true });
const header = Buffer.alloc(4);
header.writeUInt32LE(response.length);
process.stdout.write(header);
process.stdout.write(response);
```

## Debugging

### VS Code Extension

1. Open the Debug panel in VS Code
2. Select "Run Extension" configuration
3. Set breakpoints in `extension.js`
4. Press F5 to start debugging

### Chrome Extension

1. Go to `chrome://extensions/`
2. Click "Service Worker" link to open DevTools for background.js
3. Right-click the extension popup and select "Inspect" for popup debugging
4. For content.js, open DevTools on the Claude usage page

### Native Host

Add logging to `host.js`:
```javascript
const fs = require('fs');
fs.appendFileSync('/tmp/native-host.log', `Message: ${JSON.stringify(data)}\n`);
```

## Common Issues

### Native host not connecting

- Verify the manifest JSON has the correct extension ID
- Check that the path in the manifest is absolute
- On Windows, ensure it points to `host.bat`, not `host.js`

### Data not updating

- Check Chrome DevTools console for content.js errors
- Verify the native host is writing to the correct path
- Ensure VS Code has read permissions for the JSON file

### Extension not activating

- Check VS Code's Output panel (select "Claude Usage Sidebar")
- Verify `package.json` activation events are correct

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on at least one platform
5. Submit a pull request

### Code Style

- Use 2-space indentation
- Prefer `const` over `let`
- Add comments for non-obvious logic
- Keep functions focused and small

### Commit Messages

Use conventional commit format:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG (if maintained)
3. Build and test: `npx vsce package`
4. Create a git tag: `git tag v1.0.x`
5. Push tag: `git push origin v1.0.x`
6. Create GitHub release with the `.vsix` file

## License

MIT - See LICENSE file for details.
