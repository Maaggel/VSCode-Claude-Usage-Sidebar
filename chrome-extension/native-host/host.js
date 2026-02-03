#!/usr/bin/env node
// Native messaging host for Claude Usage Tracker
// This receives data from the Chrome extension and saves it to a file

const fs = require('fs');
const path = require('path');
const os = require('os');

// Base directory for output files
const CLAUDE_DIR = path.join(os.homedir(), '.claude');

// Ensure .claude directory exists
if (!fs.existsSync(CLAUDE_DIR)) {
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
}

// Get output file path based on browser type
function getOutputFile(browser) {
  // Default to 'chrome' if no browser specified (backwards compatibility)
  const browserName = browser || 'chrome';
  return path.join(CLAUDE_DIR, `usage-limits-${browserName}.json`);
}

// Read message from stdin (Chrome native messaging protocol)
function readMessage() {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let messageLength = null;

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        chunks.push(chunk);

        // First 4 bytes are the message length
        if (messageLength === null && Buffer.concat(chunks).length >= 4) {
          const buffer = Buffer.concat(chunks);
          messageLength = buffer.readUInt32LE(0);
          chunks = [buffer.slice(4)];
        }

        // Check if we have the full message
        if (messageLength !== null) {
          const buffer = Buffer.concat(chunks);
          if (buffer.length >= messageLength) {
            const message = buffer.slice(0, messageLength).toString('utf8');
            resolve(JSON.parse(message));
            return;
          }
        }
      }
    });

    process.stdin.on('end', () => {
      reject(new Error('stdin ended unexpectedly'));
    });
  });
}

// Send response back to Chrome
function sendMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.alloc(4 + json.length);
  buffer.writeUInt32LE(json.length, 0);
  buffer.write(json, 4);
  process.stdout.write(buffer);
}

// Main
async function main() {
  try {
    const message = await readMessage();

    // Get browser-specific output file
    const outputFile = getOutputFile(message.browser);

    // Save the data to file
    const dataToSave = {
      ...message,
      savedAt: new Date().toISOString()
    };

    fs.writeFileSync(outputFile, JSON.stringify(dataToSave, null, 2));

    sendMessage({ success: true, savedTo: outputFile, browser: message.browser });
  } catch (err) {
    sendMessage({ success: false, error: err.message });
  }
}

main();
