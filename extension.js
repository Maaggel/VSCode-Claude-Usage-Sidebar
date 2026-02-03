/* Claude Usage Sidebar - VS Code Extension
 *
 * Displays Claude usage statistics from local stats and Chrome extension data.
 */

const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const os = require("os");

const INSTALL_MESSAGE_DISMISSED_KEY = 'claudeUsage.installMessageDismissed';

class ClaudeUsageViewProvider {
  static viewType = "claudeUsage.view";

  constructor(ctx) {
    this.ctx = ctx;
    this.view = undefined;
    this.timer = undefined;
    this.fileWatcher = undefined;
    this.limitsWatcher = undefined;
    this.usageLimits = null;
    this.installMessageDismissed = ctx.globalState.get(INSTALL_MESSAGE_DISMISSED_KEY, false);
  }

  async resolveWebviewView(view) {
    console.log("[Claude Usage] resolveWebviewView called");

    this.view = view;
    view.webview.options = { enableScripts: true };

    // Set up message handling from webview
    view.webview.onDidReceiveMessage(message => {
      if (message.command === 'openUsagePage') {
        vscode.commands.executeCommand('claudeUsage.openUsagePage');
      } else if (message.command === 'dismissInstallMessage') {
        this.installMessageDismissed = true;
        this.ctx.globalState.update(INSTALL_MESSAGE_DISMISSED_KEY, true);
        this.refresh();
      }
    });

    // Initial render
    await this.refresh();

    // Set up file watchers
    this._setupFileWatchers();

    // Refresh on interval
    const cfg = this._getConfig();
    this.timer = setInterval(() => this.refresh(), cfg.refreshSeconds * 1000);

    // React to setting changes
    this.settingsWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("claudeUsage.refreshSeconds")) {
        this._resetTimer();
      }
    });

    view.onDidDispose(() => this.dispose());
    console.log("[Claude Usage] resolveWebviewView completed");
  }

  _getConfig() {
    const cfg = vscode.workspace.getConfiguration("claudeUsage");
    return {
      refreshSeconds: Math.max(10, Number(cfg.get("refreshSeconds", 30))),
    };
  }

  _getUsageLimitsPath(browser) {
    if (browser && browser !== 'auto') {
      return path.join(os.homedir(), ".claude", `usage-limits-${browser}.json`);
    }
    // Legacy path for backwards compatibility
    return path.join(os.homedir(), ".claude", "usage-limits.json");
  }

  _getAllUsageLimitsPaths() {
    const claudeDir = path.join(os.homedir(), ".claude");
    const browsers = ['chrome', 'chromium', 'edge', 'brave', 'vivaldi', 'opera'];
    const paths = browsers.map(b => ({
      browser: b,
      path: path.join(claudeDir, `usage-limits-${b}.json`)
    }));
    // Also include legacy path
    paths.push({ browser: 'legacy', path: path.join(claudeDir, 'usage-limits.json') });
    return paths;
  }

  _setupFileWatchers() {
    const claudeDir = path.join(os.homedir(), ".claude");

    try {
      // Watch for usage-limits*.json changes from Chrome extension (any browser)
      this.fileWatcher = fs.watch(claudeDir, (_, filename) => {
        if (filename && filename.startsWith("usage-limits") && filename.endsWith(".json")) {
          this.refresh();
        }
      });
    } catch (err) {
      console.error("[Claude Usage] Could not set up file watcher:", err);
    }
  }

  _loadUsageLimits() {
    try {
      const cfg = vscode.workspace.getConfiguration("claudeUsage");
      const dataBrowser = cfg.get("dataBrowser", "auto");

      let limitsPath;
      if (dataBrowser === 'auto') {
        // Find the most recently updated file
        const allPaths = this._getAllUsageLimitsPaths();
        let mostRecent = null;
        let mostRecentTime = 0;

        for (const { path: filePath } of allPaths) {
          if (fs.existsSync(filePath)) {
            try {
              const stats = fs.statSync(filePath);
              if (stats.mtimeMs > mostRecentTime) {
                mostRecentTime = stats.mtimeMs;
                mostRecent = filePath;
              }
            } catch (e) {
              // Ignore stat errors
            }
          }
        }
        limitsPath = mostRecent;
      } else {
        limitsPath = this._getUsageLimitsPath(dataBrowser);
      }

      if (limitsPath && fs.existsSync(limitsPath)) {
        const content = fs.readFileSync(limitsPath, "utf-8");
        const newLimits = JSON.parse(content);
        // Only update if we got valid data (keep previous data if file is empty/invalid)
        if (newLimits && (newLimits.session || newLimits.weekly || newLimits.extraUsage)) {
          this.usageLimits = newLimits;
          return true;
        }
      }
    } catch (err) {
      // Keep previous limits on error (file might be mid-write)
      console.error("[Claude Usage] Error reading usage limits:", err);
    }
    return false;
  }

  _resetTimer() {
    if (this.timer) clearInterval(this.timer);
    const cfg = this._getConfig();
    this.timer = setInterval(() => this.refresh(), cfg.refreshSeconds * 1000);
  }

  _getProgressBarColor(percent) {
    if (percent >= 90) return 'var(--vscode-charts-red, #f14c4c)';
    if (percent >= 75) return 'var(--vscode-charts-orange, #cca700)';
    return 'var(--vscode-charts-blue, #3794ff)';
  }

  _html() {
    // Load usage limits from Chrome extension
    this._loadUsageLimits();
    const limits = this.usageLimits;

    // Check if we have any data at all
    const hasLimits = limits && (limits.session || limits.weekly || limits.extraUsage);

    // Check if data is stale (older than 2 minutes)
    let isStale = false;
    let lastUpdatedText = '';
    if (limits && (limits.savedAt || limits.timestamp)) {
      const savedTime = new Date(limits.savedAt || limits.timestamp);
      const now = new Date();
      const ageMs = now - savedTime;
      const ageMinutes = ageMs / 1000 / 60;
      isStale = ageMinutes > 2;
      lastUpdatedText = savedTime.toLocaleTimeString();
    }

    if (!hasLimits) {
      return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; padding: 20px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
      .error { opacity: 0.7; text-align: center; padding: 40px 20px; }
      .error-title { font-size: 14px; margin-bottom: 10px; }
      .error-hint { font-size: 12px; opacity: 0.7; margin-bottom: 16px; }
      .btn {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .btn:hover { background: var(--vscode-button-hoverBackground); }
      .install-banner {
        background: var(--vscode-editorInfo-background, rgba(0, 122, 204, 0.1));
        border: 1px solid var(--vscode-editorInfo-foreground, #3794ff);
        border-radius: 4px;
        padding: 12px;
        margin-bottom: 16px;
        position: relative;
      }
      .install-banner-title { font-weight: 600; margin-bottom: 6px; font-size: 12px; }
      .install-banner-text { font-size: 11px; opacity: 0.8; line-height: 1.4; }
      .dismiss-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        background: transparent;
        border: none;
        color: var(--vscode-foreground);
        opacity: 0.6;
        cursor: pointer;
        font-size: 14px;
        padding: 2px 6px;
      }
      .dismiss-btn:hover { opacity: 1; }
    </style>
  </head>
  <body>
    ${!this.installMessageDismissed ? `
    <div class="install-banner">
      <button class="dismiss-btn" onclick="dismissInstall()" title="Don't show again">&times;</button>
      <div class="install-banner-title">Chrome Extension Required</div>
      <div class="install-banner-text">
        Please install the Chrome extension and follow the setup guide in the README to enable usage tracking.
      </div>
    </div>
    ` : ''}
    <div class="error">
      <div class="error-title">No usage data found</div>
      <div class="error-hint">
        1. Install the Chrome extension<br>
        2. Open the Claude usage page<br>
        3. Data will sync automatically
      </div>
      <button class="btn" onclick="openUsagePage()">Open Usage Page</button>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      function openUsagePage() {
        vscode.postMessage({ command: 'openUsagePage' });
      }
      function dismissInstall() {
        vscode.postMessage({ command: 'dismissInstallMessage' });
      }
    </script>
  </body>
</html>`;
    }

    // Build usage limits HTML
    let limitsHtml = '';
    if (hasLimits) {
      limitsHtml = `
    <div class="card">
      <div class="card-title" style="margin-bottom: 12px;">Usage Limits</div>`;

      // Session usage
      if (limits.session) {
        const sessionColor = this._getProgressBarColor(limits.session.percent || 0);
        limitsHtml += `
      <div class="limit-section">
        <div class="limit-row">
          <span class="limit-label">Current Session</span>
          <span class="limit-value" style="color: ${sessionColor}">${limits.session.percent || '?'}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${limits.session.percent || 0}%; background: ${sessionColor}"></div>
        </div>
        <div class="limit-reset">Resets in ${limits.session.resetsIn || 'unknown'}</div>
      </div>`;
      }

      // Weekly usage
      if (limits.weekly) {
        const weeklyColor = this._getProgressBarColor(limits.weekly.percent || 0);
        limitsHtml += `
      <div class="limit-section">
        <div class="limit-row">
          <span class="limit-label">Weekly (All models)</span>
          <span class="limit-value" style="color: ${weeklyColor}">${limits.weekly.percent || '?'}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${limits.weekly.percent || 0}%; background: ${weeklyColor}"></div>
        </div>
        <div class="limit-reset">Resets ${limits.weekly.resetsAt || 'unknown'}</div>
      </div>`;
      }

      // Extra usage
      if (limits.extraUsage) {
        const extraColor = this._getProgressBarColor(limits.extraUsage.percent || 0);

        // Calculate balance marker position (spent + remaining balance)
        let balanceMarkerHtml = '';
        const parseAmount = (str) => {
          if (!str) return null;
          const match = str.replace(/[^0-9.,]/g, '').replace(',', '.');
          return parseFloat(match) || null;
        };

        const spent = parseAmount(limits.extraUsage.spent);
        const balance = parseAmount(limits.extraUsage.balance);
        const limit = parseAmount(limits.extraUsage.limit);

        if (spent !== null && balance !== null && limit !== null && limit > 0) {
          const balanceEndPosition = ((spent + balance) / limit) * 100;
          if (balanceEndPosition <= 100) {
            balanceMarkerHtml = `<div class="balance-marker" style="left: ${balanceEndPosition}%" title="Balance ends here"></div>`;
          }
        }

        limitsHtml += `
      <div class="limit-section">
        <div class="limit-row">
          <span class="limit-label">Extra Usage</span>
          <span class="limit-value" style="color: ${extraColor}">${limits.extraUsage.spent || '?'} / ${limits.extraUsage.limit || '?'}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${limits.extraUsage.percent || 0}%; background: ${extraColor}"></div>
          ${balanceMarkerHtml}
        </div>
        <div class="limit-reset">Balance: ${limits.extraUsage.balance || '?'} · Resets ${limits.extraUsage.resetsAt || 'unknown'}</div>
      </div>`;
      }

      // Show stale warning or last updated time
      if (isStale) {
        limitsHtml += `
      <div class="stale-warning">
        <span>Data is stale (${lastUpdatedText})</span>
        <button class="btn-small" onclick="openUsagePage()">Refresh</button>
      </div>`;
      } else if (lastUpdatedText) {
        limitsHtml += `
      <div class="last-updated">Updated: ${lastUpdatedText}</div>`;
      }

      limitsHtml += `
    </div>`;
    } else {
      // No limits data - show button to open usage page
      limitsHtml = `
    <div class="card">
      <div class="card-title">Usage Limits</div>
      <div class="no-limits">
        <p>Install Chrome extension to see limits</p>
        <button class="btn" onclick="openUsagePage()">Open Usage Page</button>
      </div>
    </div>`;
    }

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        padding: 12px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        font-size: 12px;
        min-width: 180px;
      }
      .card {
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 10px;
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .card-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.7;
      }
      .refresh-btn {
        background: transparent;
        border: none;
        color: var(--vscode-foreground);
        opacity: 0.5;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
      }
      .refresh-btn:hover {
        opacity: 1;
        background: var(--vscode-toolbar-hoverBackground);
      }
      .limit-section {
        margin-bottom: 12px;
      }
      .limit-section:last-of-type {
        margin-bottom: 8px;
      }
      .limit-row {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
      }
      .limit-label { opacity: 0.8; font-size: 12px; }
      .limit-value { font-weight: 600; font-size: 14px; }
      .limit-reset {
        font-size: 10px;
        opacity: 0.5;
        margin-top: 4px;
      }
      .progress-bar {
        height: 8px;
        background: var(--vscode-widget-border);
        border-radius: 4px;
        margin: 6px 0 4px 0;
        overflow: hidden;
        position: relative;
      }
      .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
      }
      .balance-marker {
        position: absolute;
        top: -2px;
        bottom: -2px;
        width: 2px;
        background: var(--vscode-charts-green, #89d185);
        border-radius: 1px;
        z-index: 1;
      }
      .balance-marker::after {
        content: '';
        position: absolute;
        top: -3px;
        left: -2px;
        width: 6px;
        height: 6px;
        background: var(--vscode-charts-green, #89d185);
        border-radius: 50%;
      }
      .last-updated {
        font-size: 10px;
        opacity: 0.4;
        text-align: right;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--vscode-widget-border);
      }
      .stale-warning {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: var(--vscode-charts-orange, #cca700);
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--vscode-widget-border);
      }
      .btn-small {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 3px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
      }
      .btn-small:hover { background: var(--vscode-button-hoverBackground); }
      .no-limits {
        text-align: center;
        padding: 12px 0;
      }
      .no-limits p {
        margin: 0 0 12px 0;
        opacity: 0.6;
      }
      .btn {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
      }
      .btn:hover { background: var(--vscode-button-hoverBackground); }
    </style>
  </head>
  <body>
    ${limitsHtml}

    <script>
      const vscode = acquireVsCodeApi();
      function openUsagePage() {
        vscode.postMessage({ command: 'openUsagePage' });
      }
    </script>
  </body>
</html>`;
  }

  async refresh() {
    if (!this.view) return;

    try {
      this.view.webview.html = this._html();
    } catch (err) {
      console.error("[Claude Usage] Error refreshing:", err);
    }
  }

  async dispose() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;

    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
    }

    if (this.settingsWatcher) this.settingsWatcher.dispose();
  }
}

function activate(context) {
  console.log("[Claude Usage] Extension activating...");

  const provider = new ClaudeUsageViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ClaudeUsageViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("claudeUsage.refreshNow", async () => {
      await provider.refresh();
    })
  );

  // Helper function to open browser usage page in app mode
  const openUsagePage = () => {
    const url = 'https://claude.ai/settings/usage';
    const { exec } = require('child_process');
    const platform = process.platform;
    const cfg = vscode.workspace.getConfiguration("claudeUsage");
    const customBrowserPath = cfg.get("browserPath", "");

    // Helper to check if path is a valid executable (not a script file)
    const isValidExecutable = (browserPath) => {
      const lowerPath = browserPath.toLowerCase();
      if (platform === 'win32') {
        return lowerPath.endsWith('.exe');
      }
      // On macOS/Linux, just make sure it's not a script file
      return !lowerPath.endsWith('.js') && !lowerPath.endsWith('.sh') && !lowerPath.endsWith('.py');
    };

    // Helper to check if a path looks like a Chrome-based browser
    const isChromeBased = (browserPath) => {
      const lowerPath = browserPath.toLowerCase();
      return lowerPath.includes('chrome') ||
             lowerPath.includes('chromium') ||
             lowerPath.includes('brave') ||
             lowerPath.includes('edge') ||
             lowerPath.includes('vivaldi') ||
             lowerPath.includes('opera');
    };

    // Helper to launch browser - uses exec with shell for better Windows compatibility
    const launchBrowser = (browserPath, useAppMode) => {
      const args = useAppMode ? `--app="${url}" --new-window` : `"${url}"`;
      const command = `"${browserPath}" ${args}`;

      try {
        exec(command, { windowsHide: true }, (err) => {
          if (err) {
            console.error('[Claude Usage] Browser launch failed, falling back to default:', err.message);
            vscode.env.openExternal(vscode.Uri.parse(url));
          }
        });
        return true;
      } catch (err) {
        console.error('[Claude Usage] Failed to launch browser:', err);
        return false;
      }
    };

    // If a custom browser path is configured, use it
    if (customBrowserPath) {
      if (!isValidExecutable(customBrowserPath)) {
        console.warn('[Claude Usage] Browser path is not a valid executable:', customBrowserPath);
        vscode.window.showWarningMessage(`Invalid browser path: "${customBrowserPath}". Please set a valid executable (e.g., .exe on Windows).`);
      } else if (fs.existsSync(customBrowserPath)) {
        const useAppMode = isChromeBased(customBrowserPath);
        if (launchBrowser(customBrowserPath, useAppMode)) {
          return;
        }
      } else {
        console.warn('[Claude Usage] Custom browser path does not exist:', customBrowserPath);
        vscode.window.showWarningMessage(`Browser not found at: "${customBrowserPath}"`);
      }
      // Fall through to default browser if custom path fails
    }

    // Try to find Chrome on Windows for app mode
    if (platform === 'win32') {
      const chromePaths = [];

      if (process.env.PROGRAMFILES) {
        chromePaths.push(path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      }
      if (process.env['PROGRAMFILES(X86)']) {
        chromePaths.push(path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'));
      }
      if (process.env.LOCALAPPDATA) {
        chromePaths.push(path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      }

      for (const chromePath of chromePaths) {
        if (fs.existsSync(chromePath)) {
          if (launchBrowser(chromePath, true)) {
            return;
          }
        }
      }
    } else if (platform === 'darwin') {
      const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      if (fs.existsSync(macChromePath)) {
        if (launchBrowser(macChromePath, true)) {
          return;
        }
      }
    } else {
      // Linux - try common Chrome paths
      const linuxChromePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
      ];
      for (const chromePath of linuxChromePaths) {
        if (fs.existsSync(chromePath)) {
          if (launchBrowser(chromePath, true)) {
            return;
          }
        }
      }
    }

    // Fall back to system default browser
    vscode.env.openExternal(vscode.Uri.parse(url));
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("claudeUsage.openUsagePage", () => openUsagePage())
  );

  console.log("[Claude Usage] Extension activated");
}

function deactivate() {}

module.exports = { activate, deactivate };
