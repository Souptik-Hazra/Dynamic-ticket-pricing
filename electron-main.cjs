const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.loadFile(path.join(__dirname, 'dist/index.html'));
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const { spawn } = require('child_process');
const http = require('http');
let backendStarted = false;
let backendProcess = null;

function checkBackendAndStart(callback) {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/health',
    method: 'GET',
    timeout: 1500
  };
  const req = http.request(options, res => {
    if (res.statusCode === 200) {
      backendStarted = true;
      callback();
    } else {
      startBackend(callback);
    }
  });
  req.on('error', () => {
    startBackend(callback);
  });
  req.on('timeout', () => {
    req.destroy();
    startBackend(callback);
  });
  req.end();
}

function startBackend(callback) {
  if (backendStarted) {
    callback();
    return;
  }
  backendStarted = true;
  backendProcess = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['start'], {
    cwd: require('path').join(__dirname, 'backend'),
    detached: true,
    stdio: 'ignore'
  });
  backendProcess.unref();
  setTimeout(callback, 3000);
}

app.whenReady = () => {
  return new Promise(resolve => {
    checkBackendAndStart(() => {
      createWindow();
      resolve();
    });
  });
};