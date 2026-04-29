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

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

function waitForBackend(callback, attempts = 0) {
  if (attempts > 30) {
    console.error('❌ Backend failed to start within 30 seconds.');
    return;
  }

  const req = http.request({ hostname: 'localhost', port: 4000, path: '/health', method: 'GET', timeout: 1000 }, (res) => {
    if (res.statusCode === 200) {
      console.log('✅ Backend is ready!');
      callback();
    } else {
      setTimeout(() => waitForBackend(callback, attempts + 1), 1000);
    }
  });

  req.on('error', () => setTimeout(() => waitForBackend(callback, attempts + 1), 1000));
  req.on('timeout', () => { req.destroy(); setTimeout(() => waitForBackend(callback, attempts + 1), 1000); });
  req.end();
}

function startModularMonolith(callback) {
  console.log('🚀 Electron starting Modular Monolith backend...');
  
  // Directly spawn Node to avoid detached/orphaned shell processes on Windows
  backendProcess = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, 'modular-monolith'),
    stdio: 'inherit',
    env: { ...process.env, PORT: 4000 }
  });

  backendProcess.on('error', (err) => {
    console.error('❌ Failed to start monolith backend:', err);
  });

  // Dynamically wait for the server to be ready instead of a hard 5-second wait
  waitForBackend(callback);
}

function checkBackendStatus(callback) {
  const req = http.request({ hostname: 'localhost', port: 4000, path: '/health', method: 'GET', timeout: 1000 }, (res) => {
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