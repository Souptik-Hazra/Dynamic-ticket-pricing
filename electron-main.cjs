
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let backendProcess;
let mlProcess;



const net = require('net');
const { execSync } = require('child_process');

function killPortProcess(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`);
    const lines = output.toString().split('\n');
    lines.forEach(line => {
      const match = line.match(/\s+(\d+)$/);
      if (match) {
        const pid = match[1];
        execSync(`taskkill /PID ${pid} /F`);
      }
    });
  } catch (err) {
    // Ignore if nothing found
  }
}

function startBackend() {
  // Kill any process using port 3001 before starting backend
  killPortProcess(3001);
  // Start the backend server.js using Node.js
  const backendPath = path.join(__dirname, 'backend', 'server.js');
  backendProcess = spawn(process.execPath, [backendPath], {
    cwd: path.join(__dirname, 'backend'),
    stdio: 'inherit',
    shell: false
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function startMLModel() {
  // Start the Python ML model server (app.py)
  const mlPath = path.join(__dirname, 'ml-model', 'app.py');
  // Use 'python' or 'python3' depending on environment; here we use 'python'
  mlProcess = spawn('python', [mlPath], {
    cwd: path.join(__dirname, 'ml-model'),
    stdio: 'inherit',
    shell: false
  });
}

function stopMLModel() {
  if (mlProcess) {
    mlProcess.kill();
    mlProcess = null;
  }
}

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
  startBackend();
  startMLModel();
  createWindow();
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


app.on('will-quit', () => {
  stopBackend();
  stopMLModel();
});
