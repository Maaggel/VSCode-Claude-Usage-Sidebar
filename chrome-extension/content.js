// Content script that runs on claude.ai/settings/usage
// Extracts usage limit data and sends to background script

function extractUsageData() {
  const data = {
    timestamp: new Date().toISOString(),
    session: null,
    weekly: null,
    extraUsage: null
  };

  try {
    const sections = document.querySelectorAll('section');

    sections.forEach(section => {
      const text = section.innerText;

      // Session section: "Current session\nResets in X\nY% used"
      if (text.includes('Current session') && !data.session) {
        const percentMatch = text.match(/(\d+)%\s*used/);
        const resetMatch = text.match(/Resets in ([^\n]+)/);
        data.session = {
          percent: percentMatch ? parseInt(percentMatch[1], 10) : null,
          resetsIn: resetMatch ? resetMatch[1].trim() : null
        };
      }

      // Weekly section: "Weekly limits\n...\nAll models\nResets Wed 9:00 AM\nX% used"
      if ((text.includes('Weekly limits') || text.includes('All models')) && !data.weekly) {
        const percentMatch = text.match(/(\d+)%\s*used/);
        // Match "Resets <date>" but not "Resets in <duration>"
        const resetMatch = text.match(/Resets (?!in )([^\n]+)/);
        data.weekly = {
          percent: percentMatch ? parseInt(percentMatch[1], 10) : null,
          resetsAt: resetMatch ? resetMatch[1].trim() : null
        };
      }

      // Extra usage / Usage credits section
      if ((text.includes('Extra usage') || text.includes('Usage credits')) && !data.extraUsage) {
        const spentMatch = text.match(/([€$£][\d.,]+)\s*spent/);
        const percentMatch = text.match(/(\d+)%\s*used/);
        const resetMatch = text.match(/Resets ([A-Za-z]+ \d+)/);

        // Find limit via DOM (label text → sibling currency value)
        let limit = null;
        const limitLabel = Array.from(section.querySelectorAll('p')).find(p =>
          p.innerText.trim() === 'Monthly spending limit'
        );
        if (limitLabel) {
          const parent = limitLabel.parentElement;
          if (parent) {
            const currencyPs = Array.from(parent.querySelectorAll('p')).filter(p =>
              /^[€$£][\d.,]+$/.test(p.innerText.trim())
            );
            if (currencyPs.length > 0) limit = currencyPs[0].innerText.trim();
          }
        }

        // Find balance via DOM
        let balance = null;
        const balanceLabel = Array.from(section.querySelectorAll('p')).find(p =>
          p.innerText.includes('Current balance')
        );
        if (balanceLabel) {
          const parent = balanceLabel.parentElement;
          if (parent) {
            const currencyPs = Array.from(parent.querySelectorAll('p')).filter(p =>
              /^[€$£][\d.,]+$/.test(p.innerText.trim())
            );
            if (currencyPs.length > 0) balance = currencyPs[0].innerText.trim();
          }
        }

        const spent = spentMatch ? spentMatch[1] : null;
        const spentValue = spent ? parseFloat(spent.replace(/[€$£,]/g, '')) : null;
        const percent = percentMatch ? parseInt(percentMatch[1], 10) : null;

        // Calculate limit from percent if not found directly
        if (!limit && spentValue !== null && percent && percent > 0) {
          const calculatedLimit = spentValue / (percent / 100);
          const currency = spent?.match(/[€$£]/)?.[0] || '€';
          limit = currency + calculatedLimit.toFixed(0);
        }

        data.extraUsage = {
          spent,
          percent,
          resetsAt: resetMatch ? resetMatch[1] : null,
          limit,
          balance
        };
      }
    });

  } catch (err) {
    data.error = err.message;
    console.error('[Claude Usage] Extraction error:', err);
  }

  return data;
}

function sendDataToBackground(data) {
  chrome.runtime.sendMessage({ type: 'usageData', data: data }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('[Claude Usage] Error sending data:', chrome.runtime.lastError.message);
    } else {
      console.log('[Claude Usage] Data sent successfully');
    }
  });
}

// Extract and send data
function run() {
  console.log('[Claude Usage] Content script running on usage page');
  const data = extractUsageData();
  console.log('[Claude Usage] Extracted data:', JSON.stringify(data, null, 2));
  sendDataToBackground(data);
}

// Run after page loads
if (document.readyState === 'complete') {
  setTimeout(run, 500);
} else {
  window.addEventListener('load', () => setTimeout(run, 500));
}

// Also run again after more time in case of dynamic loading
setTimeout(run, 2000);
setTimeout(run, 5000);

// Set up a MutationObserver to detect changes
let debounceTimer = null;
const observer = new MutationObserver((mutations) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const data = extractUsageData();
    sendDataToBackground(data);
  }, 1000);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

console.log('[Claude Usage] Content script loaded');
