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

  _getUsageLimitsPath() {
    return path.join(os.homedir(), ".claude", "usage-limits.json");
  }

  _setupFileWatchers() {
    const claudeDir = path.join(os.homedir(), ".claude");

    try {
      // Watch for usage-limits.json changes from Chrome extension
      this.fileWatcher = fs.watch(claudeDir, (_, filename) => {
        if (filename === "usage-limits.json") {
          this.refresh();
        }
      });
    } catch (err) {
      console.error("[Claude Usage] Could not set up file watcher:", err);
    }
  }

  _loadUsageLimits() {
    try {
      const limitsPath = this._getUsageLimitsPath();
      if (fs.existsSync(limitsPath)) {
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
        limitsHtml += `
      <div class="limit-section">
        <div class="limit-row">
          <span class="limit-label">Extra Usage</span>
          <span class="limit-value" style="color: ${extraColor}">${limits.extraUsage.spent || '?'} / ${limits.extraUsage.limit || '?'}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${limits.extraUsage.percent || 0}%; background: ${extraColor}"></div>
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
      }
      .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
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

  // Helper function to open Chrome usage page in app mode
  const openUsagePage = () => {
    const url = 'https://claude.ai/settings/usage';
    const { exec } = require('child_process');
    const platform = process.platform;

    if (platform === 'win32') {
      // Find Chrome installation
      const chromePaths = [
        path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
      ];

      let chromePath = null;
      for (const p of chromePaths) {
        if (fs.existsSync(p)) {
          chromePath = p;
          break;
        }
      }

      if (chromePath) {
        const { spawn } = require('child_process');
        spawn(chromePath, ['--app=' + url, '--new-window'], {
          detached: true,
          stdio: 'ignore'
        }).unref();
      } else {
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
    } else if (platform === 'darwin') {
      exec(`open -na "Google Chrome" --args --app="${url}"`, (err) => {
        if (err) {
          vscode.env.openExternal(vscode.Uri.parse(url));
        }
      });
    } else {
      exec(`google-chrome --app="${url}"`, (err) => {
        if (err) {
          vscode.env.openExternal(vscode.Uri.parse(url));
        }
      });
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("claudeUsage.openUsagePage", () => openUsagePage())
  );

  console.log("[Claude Usage] Extension activated");
}

function deactivate() {}

module.exports = { activate, deactivate };
