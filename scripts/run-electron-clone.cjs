const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 940,
    minHeight: 600,
    title: 'LYC Arena — Discord Web Base',
    backgroundColor: '#1e1f22',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  win.loadURL('http://localhost:3000');
});
