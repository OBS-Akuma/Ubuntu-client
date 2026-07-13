const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { createGameWindow } = require('./game.js');
const { applySwitches, applyWindowSettings, getDefaultSettings } = require('./Switches.js');

let splashWindow = null;
let gameWindow = null;


let ktiersCache = null;
let ktiersCacheTime = null;
const KTiersCacheDuration = 5 * 60 * 1000;


const KTiersTiers = [
    { 
        name: 'Grandmaster', 
        minPoints: 150, 
        icon: 'https://ktiers.com/imgs/placements/Grandmaster.svg',
        gradient: 'linear-gradient(135deg, #FFD700, #FFF176, #FFB300)',
        glow: '#ffdc0030',
        color: '#FFD700'
    },
    { 
        name: 'Master', 
        minPoints: 115, 
        icon: 'https://ktiers.com/imgs/placements/Master.svg',
        gradient: '#fffc5b',
        glow: '#fffc5b30',
        color: '#fffc5b'
    },
    { 
        name: 'Ace', 
        minPoints: 75, 
        icon: 'https://ktiers.com/imgs/placements/Ace.svg',
        gradient: '#ff8585',
        glow: '#ff858530',
        color: '#ff8585'
    },
    { 
        name: 'Specialist', 
        minPoints: 60, 
        icon: 'https://ktiers.com/imgs/placements/Specialist.svg',
        gradient: '#e66bff',
        glow: '#e66bff30',
        color: '#e66bff'
    },
    { 
        name: 'Cadet', 
        minPoints: 35, 
        icon: 'https://ktiers.com/imgs/placements/Cadet.svg',
        gradient: '#8b5cf6',
        glow: '#8b5cf630',
        color: '#8b5cf6'
    },
    { 
        name: 'Novice', 
        minPoints: 15, 
        icon: 'https://ktiers.com/imgs/placements/Novice.svg',
        gradient: '#0ea5e9',
        glow: '#0ea5e930',
        color: '#0ea5e9'
    },
    { 
        name: 'Rookie', 
        minPoints: 0, 
        icon: 'https://ktiers.com/imgs/placements/Rookie.svg',
        gradient: '#acacac',
        glow: '#acacac30',
        color: '#acacac'
    }
];



async function fetchKTiersData() {

    if (ktiersCache && ktiersCacheTime && (Date.now() - ktiersCacheTime < KTiersCacheDuration)) {
        console.log('[KTiers] Using cached data');
        return ktiersCache;
    }

    try {
        console.log('[KTiers] Fetching data from API...');
        const response = await fetch('https://www.smudgy.store/api/KTierslist');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('API returned success: false');
        }
        

        ktiersCache = data;
        ktiersCacheTime = Date.now();
        
        console.log(`[KTiers] Fetched ${data.players?.length || 0} players`);
        return data;
    } catch (error) {
        console.error('[KTiers] Error fetching data:', error);

        if (ktiersCache) {
            console.log('[KTiers] Using expired cache as fallback');
            return ktiersCache;
        }
        return null;
    }
}

function getTierForPlayer(player) {
    if (!player) return null;
    
    const totalPoints = parseInt(player.points) || 0;
    
    for (const tier of KTiersTiers) {
        if (totalPoints >= tier.minPoints) {
            return tier;
        }
    }
    
    return KTiersTiers[KTiersTiers.length - 1];
}

function getPlayerFromKTiers(identifier, data) {
    if (!data || !data.players) return null;
    
    return data.players.find(p => 
        p.uuid.toLowerCase() === identifier.toLowerCase() || 
        p.shortId.toLowerCase() === identifier.toLowerCase() ||
        p.name.toLowerCase() === identifier.toLowerCase()
    );
}


function loadAndApplySwitches() {
  try {
    const settingsPath = getSettingsFilePath();
    let settings = {};
    
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const fileSettings = JSON.parse(data);
      const defaults = getDefaultSettings();
      settings = { ...defaults, ...fileSettings };
      console.log('[Main] Loaded settings for switches:', settings);
    } else {
      settings = getDefaultSettings();
      console.log('[Main] Using default settings for switches');
    }
    

    applySwitches(settings);
    return settings;
  } catch (e) {
    console.error('[Main] Failed to load settings for switches:', e);
    const defaults = getDefaultSettings();
    applySwitches(defaults);
    return defaults;
  }
}

function getSettingsFilePath() {
  const documentsPath = app.getPath('documents');
  const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
  if (!fs.existsSync(ubuntuFolder)) {
    fs.mkdirSync(ubuntuFolder, { recursive: true });
    console.log('Created Ubuntu folder at:', ubuntuFolder);
  }
  return path.join(ubuntuFolder, 'settings.txt');
}

function getTokenFilePath() {
  const documentsPath = app.getPath('documents');
  const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
  if (!fs.existsSync(ubuntuFolder)) {
    fs.mkdirSync(ubuntuFolder, { recursive: true });
    console.log('Created Ubuntu folder at:', ubuntuFolder);
  }
  return path.join(ubuntuFolder, 'token.txt');
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    icon: path.join(__dirname, "/assets/icon.png"),
    width: 1120,
    height: 720,
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
  splashWindow.once('ready-to-show', () => splashWindow.show());
  splashWindow.on('closed', () => { splashWindow = null; });
}

ipcMain.handle('splash:get-version', () => {
  try {
    return app.getVersion();
  } catch (e) {
    return '0.0.0';
  }
});



ipcMain.handle('ktiers:get-player', async (event, identifier) => {
    try {
        const data = await fetchKTiersData();
        if (!data) {
            return { success: false, error: 'Failed to fetch KTiers data' };
        }
        
        const player = getPlayerFromKTiers(identifier, data);
        if (!player) {
            return { success: false, player: null };
        }
        
        const tier = getTierForPlayer(player);
        return {
            success: true,
            player: {
                ...player,
                tierInfo: tier,
                points: parseInt(player.points) || 0
            }
        };
    } catch (error) {
        console.error('[KTiers] Error getting player:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('ktiers:refresh', async () => {
    ktiersCache = null;
    ktiersCacheTime = null;
    const data = await fetchKTiersData();
    return { success: !!data, count: data?.players?.length || 0 };
});

ipcMain.handle('ktiers:get-all-players', async () => {
    const data = await fetchKTiersData();
    if (!data) {
        return { success: false, players: [] };
    }
    
    const playersWithTiers = data.players.map(player => ({
        ...player,
        tierInfo: getTierForPlayer(player),
        points: parseInt(player.points) || 0
    }));
    
    return { success: true, players: playersWithTiers };
});



ipcMain.handle('load-settings', async () => {
  try {
    const filePath = getSettingsFilePath();



    const defaultSettings = {
      proxy: 'https://kirka.io/',
      discord_rpc: true,
      discord_rpc_show_lobby: true,
      discord_rpc_show_matches: true,
      discord_rpc_show_profile: true,
      discord_rpc_show_login: true,
      discord_rpc_show_launcher: true,
      unlimited_fps: true,
      in_process_gpu: true,
      hide_usernames: false
    };

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const settings = JSON.parse(data);
      const mergedSettings = { ...defaultSettings, ...settings };
      console.log('[Main] Loaded settings from file:', mergedSettings);
      return { success: true, settings: mergedSettings };
    }
    console.log('[Main] Using default settings');
    return { success: true, settings: defaultSettings };
  } catch (e) {
    console.error('Failed to load settings:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const filePath = getSettingsFilePath();
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
    console.log('Settings saved to:', filePath);
    console.log('Settings saved:', settings);
    

    applySwitches(settings);
    
    return { success: true };
  } catch (e) {
    console.error('Failed to save settings:', e);
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
    if (Array.isArray(accounts)) return accounts;
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
    return [];
  } catch (e) {
    console.error('Failed to get accounts:', e);
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
    if (!accounts || !Array.isArray(accounts)) return false;
    const filePath = getTokenFilePath();
    fs.writeFileSync(filePath, JSON.stringify(accounts, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to save accounts:', e);
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
    console.log('Accounts saved, count:', accounts.length);
    return { success: true };
  }
  return { success: false, error: 'Failed to save accounts' };
});

ipcMain.handle('save-token', async (event, token) => {
  try {
    console.log('save-token called (legacy)');
    const tokenStr = String(token || '').trim();
    if (!tokenStr) {
      return { success: false, error: 'Token is empty' };
    }

    const accounts = await getAccountsFromFile();
    const activeIndex = accounts.findIndex(a => a.active === true);

    if (activeIndex !== -1) {
      accounts[activeIndex].token = tokenStr;
      await saveAccountsToFile(accounts);
      console.log('Active account token updated');
    } else if (accounts.length > 0) {
      accounts[0].token = tokenStr;
      accounts[0].active = true;
      await saveAccountsToFile(accounts);
      console.log('First account token updated and set as active');
    } else {
      accounts.push({ token: tokenStr, active: true, name: 'Unknown', tag: '—', level: null, userId: 'unknown' });
      await saveAccountsToFile(accounts);
      console.log('New account created with token');
    }
    return { success: true };
  } catch (e) {
    console.error('Failed to save token:', e);
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
      console.log('Token file deleted');
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
  console.log('Received update-game-token');
  console.log('Token:', token ? token.substring(0, 30) + '...' : 'null');
  console.log('Game window exists:', !!gameWindow);

  if (gameWindow && !gameWindow.isDestroyed()) {
    console.log('Updating token in game window...');
    gameWindow.webContents.executeJavaScript(`
      (function() {
        try {
          const token = ${JSON.stringify(token)};
          console.log('Updating localStorage with token:', token ? 'present' : 'null');
          if (token) {
            localStorage.setItem('token', token);
            localStorage.setItem('Ubuntu_token', token);
            console.log('Game token updated to:', token.substring(0, 20) + '...');
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('Ubuntu_token');
            console.log('Game token cleared');
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
      console.log('Game token update result:', result);
    }).catch(err => {
      console.error('Failed to execute token update in game:', err);
    });
  } else {
    console.log('No game window to update - token will be used when game launches');
  }
});

async function fetchProfileFromAPI(userId) {
  try {
    console.log('=========================================');
    console.log(' FETCHING PROFILE FROM API');
    console.log('=========================================');
    console.log('userId:', userId);

    const isShortId = userId.length < 10 && !userId.includes('-');
    console.log(` Detected ID type: ${isShortId ? 'SHORT' : 'LONG'}`);
    console.log(` Sending: isShortId = ${isShortId}`);

    const requestBody = JSON.stringify({ userId, isShortId });
    console.log(' Request body:', requestBody);

    const response = await fetch('https://www.smudgy.store/api/getprofile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: requestBody
    });
    console.log(' Response status:', response.status);
    if (!response.ok) {
      console.error(' HTTP Error:', response.status);
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(' Full API Response:', JSON.stringify(result, null, 2));
    if (result && result.success && result.data) {
      const data = result.data;
      console.log(' PROFILE FOUND!');
      console.log('   Name:', data.name);
      console.log('   Tag:', data.shortId);
      console.log('   Level:', data.level);
      console.log('   ID:', data.id);
      return {
        tag: data.shortId || '',
        name: data.name || '',
        level: data.level !== undefined ? data.level : null,
        userId: data.id || userId
      };
    } else {
      console.error(' API returned success:false or no data');
      console.error('Result:', result);
      return null;
    }
  } catch (error) {
    console.error(' FETCH PROFILE FAILED:', error.message);
    return null;
  }
}

function decodeToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log(' Token payload:', payload);
    return payload;
  } catch (error) {
    console.error(' Failed to decode token:', error.message);
    return null;
  }
}

ipcMain.on('save-token-request', async (event, token) => {
  try {
    console.log('=========================================');
    console.log(' SAVE TOKEN REQUEST RECEIVED');
    console.log('=========================================');

    const tokenStr = String(token || '').trim();
    if (!tokenStr) {
      console.log(' Empty token received, ignoring');
      event.reply('save-token-reply', { success: false, error: 'Empty token' });
      return;
    }

    console.log('Token length:', tokenStr.length);
    console.log('Token preview:', tokenStr.substring(0, 40) + '...');

    const payload = decodeToken(tokenStr);
    if (!payload || !payload.sub) {
      console.log(' Invalid token: no userId found');
      event.reply('save-token-reply', { success: false, error: 'Invalid token' });
      return;
    }

    const userId = payload.sub;
    console.log(' User ID from token:', userId);

    console.log(' Calling fetchProfileFromAPI...');
    const profileData = await fetchProfileFromAPI(userId);
    console.log(' fetchProfileFromAPI returned:', profileData);

    let accounts = await getAccountsFromFile();
    console.log(' Current accounts in file:', accounts.length);

    let accountData;

    if (profileData) {
      accountData = {
        tag: profileData.tag || '',
        name: profileData.name || '',
        level: profileData.level !== null ? profileData.level : null,
        userId: profileData.userId || userId,
        token: tokenStr,
        active: true
      };
      console.log(' USING API DATA:');
      console.log('   Name:', accountData.name);
      console.log('   Tag:', accountData.tag);
      console.log('   Level:', accountData.level);
      console.log('   UserId:', accountData.userId);
    } else {
      console.log(' API returned null, using fallback data from token');
      const subParts = userId.split('-');
      let nameFromToken = subParts[0] || 'User';
      let tagFromToken = subParts.length > 1 ? subParts[1].substring(0, 6) : '';

      accountData = {
        tag: tagFromToken || '',
        name: nameFromToken || '',
        level: null,
        userId: userId,
        token: tokenStr,
        active: true
      };
      console.log(' FALLBACK DATA:');
      console.log('   Name:', accountData.name);
      console.log('   Tag:', accountData.tag);
    }

    console.log(' Final account data to save:', JSON.stringify(accountData, null, 2));

    const existingIndex = accounts.findIndex(a => a.token === tokenStr);

    if (existingIndex !== -1) {
      accounts[existingIndex] = { ...accounts[existingIndex], ...accountData, active: true };
      accounts.forEach((a, i) => { if (i !== existingIndex) a.active = false; });
      console.log(' Updated existing account');
    } else {
      const existingByUserId = accounts.findIndex(a => a.userId === userId);
      if (existingByUserId !== -1) {
        accounts[existingByUserId] = { ...accounts[existingByUserId], ...accountData, active: true };
        accounts.forEach((a, i) => { if (i !== existingByUserId) a.active = false; });
        console.log(' Updated existing account by userId');
      } else {
        accounts.push(accountData);
        accounts.forEach((a, i) => { if (i !== accounts.length - 1) a.active = false; });
        console.log(' Added new account');
      }
    }

    await saveAccountsToFile(accounts);
    console.log(' Accounts saved to file, total:', accounts.length);

    const savedAccount = accounts.find(a => a.active === true);
    if (savedAccount) {
      console.log(' ACTIVE ACCOUNT SAVED:');
      console.log(`   Name: ${savedAccount.name}`);
      console.log(`   Tag: ${savedAccount.tag}`);
      console.log(`   Level: ${savedAccount.level}`);
      console.log(`   UserId: ${savedAccount.userId}`);
    }

    event.reply('save-token-reply', { success: true, profile: profileData || accountData });

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('token-updated', tokenStr);
      splashWindow.webContents.send('accounts-updated', accounts);
    }

    if (gameWindow && !gameWindow.isDestroyed()) {
      gameWindow.webContents.send('token-updated', tokenStr);
      gameWindow.webContents.send('accounts-updated', accounts);
    }

    console.log('=========================================');
    console.log(' TOKEN SAVE COMPLETE');
    console.log('=========================================');
  } catch (e) {
    console.error(' Failed to save token:', e);
    console.error('Stack:', e.stack);
    event.reply('save-token-reply', { success: false, error: e.message });
  }
});

ipcMain.on('window-minimize', () => {
  console.log('Minimize request received from HTML');
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.minimize();
  }
});

ipcMain.on('window-close', () => {
  console.log('Close request received from HTML');
  app.quit();
});

ipcMain.on('launcher-close', () => {
  console.log('Close request received (launcher-close)');
  app.quit();
});

ipcMain.on('launch-game', () => {
  console.log('Launch game request received');

  if (gameWindow) {
    gameWindow.show();
    gameWindow.focus();
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    return;
  }


  let windowSettings = {};
  try {
    const settingsPath = getSettingsFilePath();
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(data);
      const defaults = getDefaultSettings();
      windowSettings = { ...defaults, ...settings };
      console.log('[Main] Settings passed to game window:', {
        hide_usernames: windowSettings.hide_usernames,
        discord_rpc: windowSettings.discord_rpc,
        proxy: windowSettings.proxy
      });
    } else {
      windowSettings = getDefaultSettings();
      console.log('[Main] Using default settings for game window');
    }
  } catch (e) {
    console.error('Failed to load settings for game window:', e);
    windowSettings = getDefaultSettings();
  }


  gameWindow = createGameWindow(windowSettings);


  applyWindowSettings(gameWindow, windowSettings);

  gameWindow.webContents.once('did-finish-load', () => {
    console.log('Game finished loading, injecting token...');
    getAccountsFromFile().then(accounts => {
      const active = accounts.find(a => a.active === true);
      if (active && active.token) {
        console.log('Injecting active token on game load for:', active.name, '#', active.tag);
        gameWindow.webContents.executeJavaScript(`
          (function() {
            try {
              const token = ${JSON.stringify(active.token)};
              if (token) {
                localStorage.setItem('token', token);
                localStorage.setItem('Ubuntu_token', token);
                console.log('Token injected on game load');
              }
            } catch(e) {
              console.error('Failed to inject token:', e);
            }
          })();
        `).catch(err => console.error('Failed to inject token on load:', err));
      } else {
        console.log('No active token to inject');
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


const appSettings = loadAndApplySwitches();

app.whenReady().then(() => {
  console.log('App is ready');

  const tokenPath = getTokenFilePath();
  console.log('Token path:', tokenPath);

  try {
    if (!fs.existsSync(tokenPath)) {
      fs.writeFileSync(tokenPath, JSON.stringify([], null, 2), 'utf8');
      console.log('Created empty token file');
    } else {
      const data = fs.readFileSync(tokenPath, 'utf8');
      if (!data || data.trim() === '') {
        fs.writeFileSync(tokenPath, JSON.stringify([], null, 2), 'utf8');
        console.log('Reset empty token file');
      } else {
        JSON.parse(data);
        console.log('Token file is valid');
      }
    }
  } catch (e) {
    console.log('Token file invalid, resetting');
    fs.writeFileSync(tokenPath, JSON.stringify([], null, 2), 'utf8');
  }

  createSplashWindow();
  

  fetchKTiersData().then(data => {
    if (data) {
      console.log('[KTiers] Pre-fetched data on startup');
    }
  }).catch(err => {
    console.error('[KTiers] Failed to pre-fetch:', err);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


setInterval(() => {
  console.log('[KTiers] Auto-refreshing cache...');
  fetchKTiersData().catch(err => {
    console.error('[KTiers] Auto-refresh failed:', err);
  });
}, 5 * 60 * 1000);