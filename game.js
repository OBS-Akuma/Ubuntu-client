const { BrowserWindow, app } = require('electron');
const fs = require('fs');
const path = require('path');

function createGameWindow() {
  const gameWindow = new BrowserWindow({
    fullscreen: true,
    icon: path.join(__dirname, "/assets/icon.png"),
    width: 1280,
    height: 720,
    show: false,
    backgroundColor: "#141414",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  gameWindow.removeMenu();
  
  // ── READ ACTIVE TOKEN FROM TOKEN.TXT ──
  const documentsPath = app.getPath('documents');
  const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
  const tokenPath = path.join(ubuntuFolder, 'token.txt');
  let token = '';
  
  try {
    if (fs.existsSync(tokenPath)) {
      const data = fs.readFileSync(tokenPath, 'utf8');
      if (data && data.trim() !== '') {
        try {
          const accounts = JSON.parse(data);
          const active = accounts.find(a => a.active === true);
          if (active && active.token) {
            token = active.token;
            console.log('✅ Active token loaded for:', active.name, '#', active.tag);
          } else {
            console.log('ℹ️ No active account found in token file');
          }
        } catch (e) {
          console.log('⚠️ Invalid JSON in token file, ignoring');
        }
      }
    } else {
      console.log('ℹ️ No token file found');
    }
  } catch (e) {
    console.log('❌ Error reading token:', e);
  }

  // ── INJECTION SCRIPT ──
  const injectionScript = `
    (function() {
      console.log('🔑 Token injection starting...');
      
      if (!window.electronAPI) {
        window.electronAPI = {
          saveToken: (token) => {
            if (window.require) {
              try {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('save-token-request', token);
                console.log('✅ Token sent to launcher');
              } catch(e) {
                console.error('❌ Failed to send token:', e);
              }
            }
          }
        };
      }
      
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        if (value && (key === 'token' || key === 'Ubuntu_token' || key.toLowerCase().includes('token'))) {
          console.log('💾 Token saved with key:', key);
          if (window.electronAPI && window.electronAPI.saveToken) {
            window.electronAPI.saveToken(value);
          }
        }
      };
      
      // If we have a token, inject it
      const token = ${JSON.stringify(token)};
      if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('Ubuntu_token', token);
        console.log('✅ Injected token from file on game load');
      } else {
        console.log('ℹ️ No token to inject');
      }
      
      window.addEventListener('storage', function(e) {
        if (e.newValue && (e.key === 'token' || e.key === 'Ubuntu_token')) {
          console.log('🔄 Token changed in storage');
          if (window.electronAPI && window.electronAPI.saveToken) {
            window.electronAPI.saveToken(e.newValue);
          }
        }
      });
      
      console.log('✅ Token injection complete');
      console.log('📊 Current token:', localStorage.getItem('token') ? 'present' : 'null');
    })();
  `;

  gameWindow.webContents.on('did-finish-load', () => {
    console.log('🌐 Game loaded, injecting script');
    gameWindow.webContents.executeJavaScript(injectionScript)
      .then(() => console.log('✅ Script executed'))
      .catch(err => console.error('❌ Script failed:', err));
  });

  // ── LOAD THE PROXY URL ──
  const settingsPath = path.join(ubuntuFolder, 'settings.txt');
  let proxyUrl = 'https://kirka.io/';
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.proxy) proxyUrl = settings.proxy;
    }
  } catch (e) {
    console.log('❌ Error reading settings:', e);
  }
  
  console.log('🌐 Loading URL:', proxyUrl);
  gameWindow.loadURL(proxyUrl);

  gameWindow.once('ready-to-show', () => {
    gameWindow.show();
    console.log('🖥️ Game window shown');
  });

  return gameWindow;
}

module.exports = { createGameWindow };