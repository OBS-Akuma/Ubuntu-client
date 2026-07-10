const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { createGameWindow } = require('./game.js');
const { applySwitches } = require('./util/switches.js');

let splashWindow = null;
let gameWindow = null;


function loadAndApplySwitches() {
  try {
    const documentsPath = app.getPath('documents');
    const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
    const settingsPath = path.join(ubuntuFolder, 'settings.txt');
    
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(settingsData);
      console.log(' Loaded settings for switches:', settings);
    }
    

    applySwitches(settings);
    console.log(' Switches applied');
  } catch (e) {
    console.log(' Failed to apply switches:', e);

    try {
      applySwitches({});
    } catch (err) {
      console.log(' Failed to apply default switches:', err);
    }
  }
}



try {

  const documentsPath = app.getPath('documents');
  const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
  const settingsPath = path.join(ubuntuFolder, 'settings.txt');
  
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    settings = JSON.parse(settingsData);
    console.log(' Pre-load settings:', settings);
  }
  

  applySwitches(settings);
  console.log(' Switches applied immediately');
} catch (e) {
  console.log(' Could not apply switches immediately:', e);

  try {
    applySwitches({});
  } catch (err) {
    console.log(' Failed to apply default switches:', err);
  }
}

function getSettingsFilePath() {
  const documentsPath = app.getPath('documents');
  const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
  
  if (!fs.existsSync(ubuntuFolder)) {
    fs.mkdirSync(ubuntuFolder, { recursive: true });
    console.log(' Created Ubuntu folder at:', ubuntuFolder);
  }
  
  return path.join(ubuntuFolder, 'settings.txt');
}


function getTokenFilePath() {
  const documentsPath = app.getPath('documents');
  const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
  
  if (!fs.existsSync(ubuntuFolder)) {
    fs.mkdirSync(ubuntuFolder, { recursive: true });
    console.log(' Created Ubuntu folder at:', ubuntuFolder);
  }
  
  const tokenPath = path.join(ubuntuFolder, 'token.txt');
  return tokenPath;
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


ipcMain.handle('load-settings', async () => {
  try {
    const filePath = getSettingsFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const settings = JSON.parse(data);
      

      const defaultSettings = {
        proxy: 'https://kirka.io/',
        unlimited_fps: false,
        in_process_gpu: false,
        enable_gpu_rasterization: false,
        enable_zero_copy: false,
        ignore_gpu_blacklist: false,
        high_dpi_support: true,
        discord_rpc: true
      };
      

      const mergedSettings = { ...defaultSettings, ...settings };
      
      return { success: true, settings: mergedSettings };
    }
    return { success: true, settings: { 
      proxy: 'https://kirka.io/',
      unlimited_fps: false,
      in_process_gpu: false,
      enable_gpu_rasterization: false,
      enable_zero_copy: false,
      ignore_gpu_blacklist: false,
      high_dpi_support: true,
      discord_rpc: true
    } };
  } catch (e) {
    console.error(' Failed to load settings:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const filePath = getSettingsFilePath();
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(' Settings saved to:', filePath);
    

    try {
      applySwitches(settings);
      console.log(' Switches re-applied with new settings');
    } catch (e) {
      console.error(' Failed to re-apply switches:', e);
    }
    
    return { success: true };
  } catch (e) {
    console.error(' Failed to save settings:', e);
    return { success: false, error: e.message };
  }
});




async function getAccountsFromFile() {
  try {
    const filePath = getTokenFilePath();
    
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    if (!data || data.trim() === '') {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
    
    const accounts = JSON.parse(data);
    if (Array.isArray(accounts)) {
      return accounts;
    } else {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
  } catch (e) {
    console.error(' Failed to get accounts:', e);
    try {
      const filePath = getTokenFilePath();
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
      return [];
    } catch (err) {
      return [];
    }
  }
}


async function saveAccountsToFile(accounts) {
  try {
    if (!accounts || !Array.isArray(accounts)) {
      return false;
    }
    const filePath = getTokenFilePath();
    fs.writeFileSync(filePath, JSON.stringify(accounts, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(' Failed to save accounts:', e);
    return false;
  }
}




ipcMain.handle('get-accounts', async () => {
  const accounts = await getAccountsFromFile();
  return { success: true, accounts };
});


ipcMain.handle('save-accounts', async (event, accounts) => {
  const success = await saveAccountsToFile(accounts);
  if (success) {
    console.log(' Accounts saved, count:', accounts.length);
    return { success: true };
  }
  return { success: false, error: 'Failed to save accounts' };
});




ipcMain.handle('save-token', async (event, token) => {
  try {
    console.log(' save-token called (legacy)');
    const tokenStr = String(token || '').trim();
    if (!tokenStr) {
      return { success: false, error: 'Token is empty' };
    }
    
    
    const accounts = await getAccountsFromFile();
    const activeIndex = accounts.findIndex(a => a.active === true);
    
    if (activeIndex !== -1) {
      
      accounts[activeIndex].token = tokenStr;
      await saveAccountsToFile(accounts);
      console.log(' Active account token updated');
    } else if (accounts.length > 0) {
      
      accounts[0].token = tokenStr;
      accounts[0].active = true;
      await saveAccountsToFile(accounts);
      console.log(' First account token updated and set as active');
    } else {
      
      
      accounts.push({ 
        token: tokenStr, 
        active: true,
        name: 'Unknown',
        tag: '—',
        level: null,
        userId: 'unknown'
      });
      await saveAccountsToFile(accounts);
      console.log(' New account created with token');
    }
    
    return { success: true };
  } catch (e) {
    console.error(' Failed to save token:', e);
    return { success: false, error: e.message };
  }
});


ipcMain.handle('get-token', async () => {
  try {
    const accounts = await getAccountsFromFile();
    const active = accounts.find(a => a.active === true);
    if (active && active.token) {
      return { success: true, token: active.token };
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
      console.log(' Token file deleted');
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});


ipcMain.handle('get-active-token', async () => {
  try {
    const accounts = await getAccountsFromFile();
    const active = accounts.find(a => a.active === true);
    if (active && active.token) {
      return { success: true, token: active.token };
    }
    return { success: false, token: null };
  } catch (e) {
    return { success: false, token: null };
  }
});


ipcMain.on('update-game-token', (event, token) => {
  console.log(' update-game-token received in main process');
  console.log(' Token:', token ? token.substring(0, 30) + '...' : 'null');
  console.log(' Game window exists:', !!gameWindow);
  
  if (gameWindow && !gameWindow.isDestroyed()) {
    console.log(' Game window exists, updating token...');
    gameWindow.webContents.executeJavaScript(`
      (function() {
        try {
          const token = ${JSON.stringify(token)};
          console.log(' Updating game localStorage with token:', token ? 'present' : 'null');
          if (token) {
            localStorage.setItem('token', token);
            localStorage.setItem('Ubuntu_token', token);
            console.log(' Game token updated to:', token.substring(0, 20) + '...');
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('Ubuntu_token');
            console.log(' Game token cleared');
          }
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'token',
            newValue: token,
            oldValue: null,
            storageArea: localStorage
          }));
          return 'Token updated successfully';
        } catch(e) {
          console.error('Failed to update game token:', e);
          return 'Error: ' + e.message;
        }
      })();
    `).then(result => {
      console.log(' Game token update result:', result);
    }).catch(err => {
      console.error(' Failed to execute token update in game:', err);
    });
  } else {
    console.log(' No game window to update - token will be used when game launches');
  }
});


ipcMain.on('save-token-request', async (event, token) => {
  try {
    console.log(' save-token-request received from game');
    const tokenStr = String(token || '').trim();
    if (!tokenStr) {
      console.log(' Empty token received, ignoring');
      return;
    }
    
    let accounts = await getAccountsFromFile();
    
    try {
      const payload = JSON.parse(Buffer.from(tokenStr.split('.')[1], 'base64').toString());
      const userId = payload.sub;
      
      const existingIndex = accounts.findIndex(a => a.userId === userId);
      
      const profile = await fetchProfile(tokenStr);
      
      if (existingIndex !== -1) {
        accounts[existingIndex] = { 
          ...accounts[existingIndex], 
          ...profile, 
          token: tokenStr,
          active: true 
        };
        accounts.forEach((a, i) => {
          if (i !== existingIndex) a.active = false;
        });
      } else {
        accounts.push({ ...profile, token: tokenStr, active: true });
        accounts.forEach((a, i) => {
          if (i !== accounts.length - 1) a.active = false;
        });
      }
      
      await saveAccountsToFile(accounts);
      
      console.log(' Token saved from game window');
      
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('token-updated', tokenStr);
        splashWindow.webContents.send('accounts-updated', accounts);
      }
    } catch (e) {
      console.error(' Failed to process token:', e);
    }
  } catch (e) {
    console.error(' Failed to save token from game window:', e);
  }
});


async function fetchProfile(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const response = await fetch('https://www.smudgy.store/api/getprofile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        userId: payload.sub,
        isShortId: false
      })
    });
    
    const result = await response.json();
    if (result.success && result.data) {
      return {
        tag: result.data.shortId || '',
        name: result.data.name || '',
        level: result.data.level || null,
        userId: result.data.userId || payload.sub || ''
      };
    }
  } catch (e) {
    console.error('Failed to fetch profile:', e);
  }
  return { tag: '', name: 'Unknown', level: null, userId: '' };
}


ipcMain.on('window-minimize', () => {
  console.log(' Minimize request received');
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.minimize();
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
    console.log(' Game finished loading, injecting token...');
    
    getAccountsFromFile().then(accounts => {
      const active = accounts.find(a => a.active === true);
      if (active && active.token) {
        console.log(' Injecting active token on game load for:', active.name, '#', active.tag);
        gameWindow.webContents.executeJavaScript(`
          (function() {
            try {
              const token = ${JSON.stringify(active.token)};
              if (token) {
                localStorage.setItem('token', token);
                localStorage.setItem('Ubuntu_token', token);
                console.log(' Token injected on game load');
              }
            } catch(e) {
              console.error('Failed to inject token:', e);
            }
          })();
        `).catch(err => console.error('Failed to inject token on load:', err));
      } else {
        console.log(' No active token to inject');
      }
    });
    
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
  
  try {
    if (!fs.existsSync(tokenPath)) {
      fs.writeFileSync(tokenPath, JSON.stringify([], null, 2), 'utf8');
      console.log(' Created empty token file');
    } else {
      const data = fs.readFileSync(tokenPath, 'utf8');
      if (!data || data.trim() === '') {
        fs.writeFileSync(tokenPath, JSON.stringify([], null, 2), 'utf8');
        console.log(' Reset empty token file');
      } else {
        JSON.parse(data);
        console.log(' Token file is valid');
      }
    }
  } catch (e) {
    console.log(' Token file invalid, resetting');
    fs.writeFileSync(tokenPath, JSON.stringify([], null, 2), 'utf8');
  }
  
  createSplashWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});