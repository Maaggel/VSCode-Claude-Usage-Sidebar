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
    // Find all sections
    const sections = document.querySelectorAll('section');

    sections.forEach(section => {
      const sectionText = section.innerText;

      // Check if this is the Plan usage limits section
      if (sectionText.includes('Current session') && sectionText.includes('Weekly limits')) {
        // Extract Current session data
        const sessionDiv = Array.from(section.querySelectorAll('div')).find(div => {
          const text = div.innerText;
          return text.includes('Current session') && !text.includes('Weekly');
        });

        if (sessionDiv) {
          // Find the progress bar width
          const progressBar = section.querySelector('div[style*="width:"][class*="bg-accent"]');
          const percentText = section.querySelector('p.font-base.text-text-400.whitespace-nowrap.text-right');

          // Get reset time
          const resetMatch = sectionText.match(/Resets in ([^\n]+)/);

          // Get percentage from text or progress bar
          let percent = null;
          if (percentText) {
            const match = percentText.innerText.match(/(\d+)%/);
            if (match) percent = parseInt(match[1], 10);
          }

          data.session = {
            percent: percent,
            resetsIn: resetMatch ? resetMatch[1].trim() : null
          };
        }

        // Extract Weekly limits data (All models)
        const weeklyMatch = sectionText.match(/All models[\s\S]*?Resets ([^\n]+)[\s\S]*?(\d+)% used/);
        if (weeklyMatch) {
          data.weekly = {
            percent: parseInt(weeklyMatch[2], 10),
            resetsAt: weeklyMatch[1].trim()
          };
        }
      }

      // Check if this is the Extra usage section
      if (section.dataset.testid === 'extra-usage-section' || sectionText.includes('Extra usage')) {
        // Extract spent amount - look for "€X.XX spent"
        const spentMatch = sectionText.match(/([€$£][\d.,]+)\s*spent/);

        // Extract reset date for extra usage - "Resets Feb 1" or similar
        const resetMatch = sectionText.match(/Resets ([A-Za-z]+ \d+)/);

        // Extract percentage for extra usage - find the one near "spent"
        // The section has multiple percentages, we want the one for extra usage
        const extraPercentMatch = sectionText.match(/spent[\s\S]*?(\d+)%\s*used/);
        const percent = extraPercentMatch ? parseInt(extraPercentMatch[1], 10) : null;

        // Extract limit - find the p element containing "Monthly spending limit"
        // then look at the sibling/parent structure for the €10 value
        let limit = null;
        const limitLabel = Array.from(section.querySelectorAll('p')).find(p =>
          p.innerText.trim() === 'Monthly spending limit'
        );
        if (limitLabel) {
          // The limit value should be in a sibling element before this label
          const parent = limitLabel.parentElement;
          if (parent) {
            // Find all p elements in the parent that contain a currency value
            const currencyPs = Array.from(parent.querySelectorAll('p')).filter(p =>
              /^[€$£][\d.,]+$/.test(p.innerText.trim())
            );
            if (currencyPs.length > 0) {
              limit = currencyPs[0].innerText.trim();
            }
          }
        }

        // Extract balance - find the p element containing "Current balance"
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
            if (currencyPs.length > 0) {
              balance = currencyPs[0].innerText.trim();
            }
          }
        }

        // Parse spent value for calculation
        const spentValue = spentMatch ? parseFloat(spentMatch[1].replace(/[€$£,]/g, '')) : null;

        // Calculate limit from percentage if not found directly
        if (!limit && spentValue && percent && percent > 0) {
          const calculatedLimit = spentValue / (percent / 100);
          const currency = spentMatch ? spentMatch[1].match(/[€$£]/)?.[0] || '€' : '€';
          limit = currency + calculatedLimit.toFixed(0);
        }

        data.extraUsage = {
          spent: spentMatch ? spentMatch[1] : null,
          percent: percent,
          resetsAt: resetMatch ? resetMatch[1] : null,
          limit: limit,
          balance: balance
        };
      }
    });

    // Alternative extraction using more specific selectors
    if (!data.session || !data.session.percent) {
      // Find all progress bar containers
      const progressContainers = document.querySelectorAll('.flex-1.flex.items-center.gap-3');

      progressContainers.forEach((container, index) => {
        const progressFill = container.querySelector('div[style*="width:"]');
        const percentText = container.querySelector('p.whitespace-nowrap');

        if (progressFill && percentText) {
          const widthMatch = progressFill.getAttribute('style')?.match(/width:\s*([\d.]+)%/);
          const percentMatch = percentText.innerText.match(/(\d+)%/);
          const percent = percentMatch ? parseInt(percentMatch[1], 10) : (widthMatch ? Math.round(parseFloat(widthMatch[1])) : null);

          // Find the label for this progress bar
          const parent = container.closest('.flex.flex-row');
          const labelDiv = parent?.querySelector('.flex.flex-col.gap-1\\.5');
          const labelText = labelDiv?.innerText || '';

          if (labelText.includes('Current session') && !data.session?.percent) {
            const resetMatch = labelText.match(/Resets in (.+)/);
            data.session = {
              percent: percent,
              resetsIn: resetMatch ? resetMatch[1].trim() : null
            };
          } else if (labelText.includes('All models') && !data.weekly?.percent) {
            const resetMatch = labelText.match(/Resets (.+)/);
            data.weekly = {
              percent: percent,
              resetsAt: resetMatch ? resetMatch[1].trim() : null
            };
          } else if (labelText.includes('spent') && !data.extraUsage?.percent) {
            const spentMatch = labelText.match(/([€$£][\d.]+)\s*spent/);
            const resetMatch = labelText.match(/Resets (.+)/);
            data.extraUsage = data.extraUsage || {};
            data.extraUsage.spent = spentMatch ? spentMatch[1] : data.extraUsage.spent;
            data.extraUsage.percent = percent;
            data.extraUsage.resetsAt = resetMatch ? resetMatch[1].trim() : data.extraUsage.resetsAt;
          }
        }
      });
    }

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
