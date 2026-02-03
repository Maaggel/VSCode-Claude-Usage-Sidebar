@echo off
:: Native messaging host wrapper for Windows
:: This runs the Node.js script that handles Chrome native messaging

:: Run the host.js script with Node.js
node "%~dp0host.js"
