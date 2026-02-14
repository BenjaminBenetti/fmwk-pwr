import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SocketClient } from './socket-client.js';
import { registerIpcHandlers, setupConnectionForwarding } from './ipc-handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new SocketClient();
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 920,
    useContentSize: true,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    title: 'fmwk-pwr',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

registerIpcHandlers(client);
setupConnectionForwarding(client, () => mainWindow);

ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:set-size', (_e, width: number, height: number) => {
  mainWindow?.setContentSize(width, height);
});

app.whenReady().then(() => {
  createWindow();
  client.connect();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    client.destroy();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
