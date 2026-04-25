const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let backendProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "FanFever - Dynamic Ticket Pricing",
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // In production, we load the built dist/index.html
  // In development, we could load http://localhost:5173
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

function startModularMonolith(callback) {
  console.log('🚀 Electron starting Modular Monolith backend...');
  
  // Use npm.cmd on Windows, npm on others
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  
  backendProcess = spawn(npmCmd, ['start'], {
    cwd: path.join(__dirname, 'modular-monolith'),
    stdio: 'inherit', // Let us see backend logs in the console
    shell: true
  });

  backendProcess.on('error', (err) => {
    console.error('❌ Failed to start monolith backend:', err);
  });

  // Give the monolith 5 seconds to boot up before showing the UI
  setTimeout(callback, 5000);
}

function checkBackendStatus(callback) {
  const req = http.request({
    hostname: 'localhost',
    port: 4000,
    path: '/health',
    method: 'GET',
    timeout: 1000
  }, (res) => {
    if (res.statusCode === 200) {
      console.log('✅ Backend already running on port 4000.');
      callback();
    } else {
      startModularMonolith(callback);
    }
  });

  req.on('error', () => startModularMonolith(callback));
  req.on('timeout', () => { req.destroy(); startModularMonolith(callback); });
  req.end();
}

app.on('ready', () => {
  checkBackendStatus(() => {
    createWindow();
  });
});

app.on('window-all-closed', () => {
  // Gracefully kill backend when closing app
  if (backendProcess) {
    console.log('🛑 Shutting down backend sidecars...');
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});