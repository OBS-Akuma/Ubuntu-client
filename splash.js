const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { createGameWindow } = require('./game.js');

let splashWindow = null;
let gameWindow = null;


function getTokenFilePath() {
  const documentsPath = app.getPath('documents');
  const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
  
  if (!fs.existsSync(ubuntuFolder)) {
    fs.mkdirSync(ubuntuFolder, { recursive: true });
    console.log(' Created Ubuntu folder at:', ubuntuFolder);
  }
  
  return path.join(ubuntuFolder, 'token.txt');
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    icon: path.join(__dirname, "/assets/icon.png"),
    width: 920,
    height: 620,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'Splash.html'));

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}


ipcMain.handle('splash:get-version', () => {
  try {
    return app.getVersion();
  } catch (e) {
    return '0.0.0';
  }
});



ipcMain.handle('save-token', async (event, token) => {
  try {
    const tokenStr = String(token || '').trim();
    if (!tokenStr) {
      return { success: false, error: 'Token is empty' };
    }
    
    const filePath = getTokenFilePath();
    fs.writeFileSync(filePath, tokenStr, 'utf8');
    console.log(' Token saved to:', filePath);
    return { success: true };
  } catch (e) {
    console.error(' Failed to save token:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-token', async () => {
  try {
    const filePath = getTokenFilePath();
    if (fs.existsSync(filePath)) {
      const token = fs.readFileSync(filePath, 'utf8').trim();
      if (token) {
        return { success: true, token };
      }
    }
    return { success: false, token: null };
  } catch (e) {
    return { success: false, token: null };
  }
});

ipcMain.handle('clear-token', async () => {
  try {
    const filePath = getTokenFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});


ipcMain.on('save-token-request', async (event, token) => {
  try {
    const tokenStr = String(token || '').trim();
    if (!tokenStr) return;
    
    const filePath = getTokenFilePath();
    fs.writeFileSync(filePath, tokenStr, 'utf8');
    console.log(' Token saved from game window');
    
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('token-updated', tokenStr);
    }
  } catch (e) {
    console.error(' Failed to save token from game window:', e);
  }
});


ipcMain.on('window-minimize', () => {
  console.log(' Minimize request received');
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.minimize();
    console.log(' Window minimized');
  } else {
    console.log(' No splash window to minimize');
  }
});


ipcMain.on('launcher-close', () => {
  console.log(' Close request received');
  app.quit();
});


ipcMain.on('launch-game', () => {
  console.log(' Launch game request received');
  
  if (gameWindow) {
    gameWindow.show();
    gameWindow.focus();
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    return;
  }

  gameWindow = createGameWindow();

  gameWindow.webContents.once('did-finish-load', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  gameWindow.on('closed', () => {
    gameWindow = null;
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('launcher:reset');
    } else {
      if (BrowserWindow.getAllWindows().length === 0) {
        createSplashWindow();
      }
    }
  });
});


app.whenReady().then(() => {
  console.log(' App ready');
  const tokenPath = getTokenFilePath();
  console.log(' Token path:', tokenPath);
  createSplashWindow();
  
  
  console.log(' BrowserWindows:', BrowserWindow.getAllWindows().length);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});