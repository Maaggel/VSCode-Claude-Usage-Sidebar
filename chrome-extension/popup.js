// Popup script for Claude Usage Tracker

document.addEventListener('DOMContentLoaded', () => {
  const contentDiv = document.getElementById('content');
  const refreshBtn = document.getElementById('refreshBtn');
  const lastUpdatedSpan = document.getElementById('lastUpdated');
  const browserSelect = document.getElementById('browserSelect');

  // Load browser preference and stored data
  chrome.storage.local.get(['usageData', 'lastUpdated', 'browserOverride'], (result) => {
    // Set browser dropdown to saved value
    if (result.browserOverride) {
      browserSelect.value = result.browserOverride;
    }
    if (result.usageData) {
      displayData(result.usageData);
      if (result.lastUpdated) {
        const date = new Date(result.lastUpdated);
        lastUpdatedSpan.textContent = `Updated: ${date.toLocaleTimeString()}`;
      }
    } else {
      contentDiv.innerHTML = '<div class="no-data">No data yet. Open the usage page to collect data.</div>';
    }
  });

  // Open usage page button
  refreshBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://claude.ai/settings/usage' });
  });

  // Browser selection change
  browserSelect.addEventListener('change', () => {
    const value = browserSelect.value;
    chrome.storage.local.set({ browserOverride: value }, () => {
      console.log('[Claude Usage] Browser override set to:', value);
    });
  });

  function displayData(data) {
    let html = '';

    // Session usage
    if (data.session) {
      html += `
        <div class="stat">
          <div class="stat-label">Current Session</div>
          <div class="stat-value">${data.session.percent || '?'}%</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${data.session.percent || 0}%"></div>
          </div>
          <div class="stat-label" style="font-size: 11px; margin-top: 4px;">
            Resets in ${data.session.resetsIn || 'unknown'}
          </div>
        </div>
      `;
    }

    // Weekly usage
    if (data.weekly) {
      html += `
        <div class="stat">
          <div class="stat-label">Weekly (All models)</div>
          <div class="stat-value">${data.weekly.percent || '?'}%</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${data.weekly.percent || 0}%"></div>
          </div>
          <div class="stat-label" style="font-size: 11px; margin-top: 4px;">
            Resets ${data.weekly.resetsAt || 'unknown'}
          </div>
        </div>
      `;
    }

    // Extra usage
    if (data.extraUsage) {
      html += `
        <div class="stat">
          <div class="stat-label">Extra Usage</div>
          <div class="stat-value">${data.extraUsage.spent || '?'} / ${data.extraUsage.limit || '?'}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${data.extraUsage.percent || 0}%; background: #10b981;"></div>
          </div>
          <div class="stat-label" style="font-size: 11px; margin-top: 4px;">
            Balance: ${data.extraUsage.balance || '?'} · Resets ${data.extraUsage.resetsAt || 'unknown'}
          </div>
        </div>
      `;
    }

    if (!html) {
      html = '<div class="no-data">No usage data found on page.</div>';
    }

    contentDiv.innerHTML = html;
  }
});
