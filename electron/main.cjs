const path = require('node:path');
const { app, BrowserWindow } = require('electron');

app.setAppUserModelId('com.moonlitcourier.game');

function createWindow() {
  const window = new BrowserWindow({
    width: 1060,
    height: 700,
    minWidth: 760,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#111427',
    title: 'Moonlit Courier',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  window.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
