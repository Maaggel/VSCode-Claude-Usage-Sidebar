// Background service worker for Claude Usage Tracker

const NATIVE_HOST_NAME = 'com.claude.usage_tracker';
const REFRESH_INTERVAL_MINUTES = 1;

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'usageData') {
    console.log('[Claude Usage] Received usage data:', message.data);

    // Store in chrome.storage.local
    chrome.storage.local.set({
      usageData: message.data,
      lastUpdated: new Date().toISOString()
    }, () => {
      console.log('[Claude Usage] Data saved to storage');
    });

    // Try to send via native messaging
    sendToNativeHost(message.data);

    sendResponse({ success: true });
  }
  return true;
});

// Send data to native messaging host
function sendToNativeHost(data) {
  try {
    chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, data, (response) => {
      if (chrome.runtime.lastError) {
        console.log('[Claude Usage] Native messaging error:', chrome.runtime.lastError.message);
        // Fall back to storing in extension storage only
      } else {
        console.log('[Claude Usage] Native host response:', response);
      }
    });
  } catch (err) {
    console.log('[Claude Usage] Native messaging not available:', err.message);
  }
}

// Set up periodic refresh alarm
chrome.alarms.create('refreshUsage', {
  periodInMinutes: REFRESH_INTERVAL_MINUTES
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshUsage') {
    refreshUsagePage();
  }
});

// Refresh the usage page ONLY if it's already open (never opens new windows)
function refreshUsagePage() {
  const usageUrl = 'https://claude.ai/settings/usage';

  chrome.tabs.query({ url: usageUrl + '*' }, (tabs) => {
    if (tabs.length > 0) {
      // Reload silently without changing focus
      chrome.tabs.reload(tabs[0].id);
    }
  });
}

// Open usage page in a new window (called from popup or VSCode)
function openUsageWindow() {
  const usageUrl = 'https://claude.ai/settings/usage';

  chrome.windows.create({
    url: usageUrl,
    type: 'popup',
    width: 500,
    height: 700,
    focused: true
  });
}

// Handle extension icon click - open usage page in new window
chrome.action.onClicked.addListener(() => {
  openUsageWindow();
});

// On install, clear any old alarms and create fresh one
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Claude Usage] Extension installed');
  chrome.alarms.clearAll(() => {
    chrome.alarms.create('refreshUsage', {
      periodInMinutes: REFRESH_INTERVAL_MINUTES
    });
  });
});

console.log('[Claude Usage] Background script loaded');
