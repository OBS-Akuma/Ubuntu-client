const { BrowserWindow, app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const DiscordRPC = require('./discord.js');

// ── STORE DISCORD RPC INSTANCE ──
let discordRPC = null;
let gameWindow = null;

// ── IPC HANDLERS ──
ipcMain.handle('get-documents-path', () => {
  return app.getPath('documents');
});

ipcMain.on('save-activity-data', (event, data) => {
  try {
    console.log(' Received save request from renderer:', data);
    const documentsPath = app.getPath('documents');
    const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
    
    if (!fs.existsSync(ubuntuFolder)) {
      fs.mkdirSync(ubuntuFolder, { recursive: true });
      console.log(' Created Ubuntu folder');
    }
    
    const filePath = path.join(ubuntuFolder, 'Activity.json');
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(' Saved to file:', filePath);
    console.log(' Total kills saved:', data.totalKills);
    
    event.reply('save-activity-reply', { success: true, filePath });
  } catch (e) {
    console.error(' Failed to save:', e);
    event.reply('save-activity-reply', { success: false, error: e.message });
  }
});

ipcMain.handle('load-activity-data', () => {
  try {
    const documentsPath = app.getPath('documents');
    const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
    const filePath = path.join(ubuntuFolder, 'Activity.json');
    
    if (!fs.existsSync(filePath)) {
      return { success: true, data: { totalKills: 0, weapons: {} } };
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    const stats = JSON.parse(data);
    return { success: true, data: stats };
  } catch (e) {
    console.error(' Failed to load activity data:', e);
    return { success: false, error: e.message };
  }
});

function createGameWindow() {
  gameWindow = new BrowserWindow({
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

  const documentsPath = app.getPath('documents');
  const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
  const tokenPath = path.join(ubuntuFolder, 'token.txt');
  let token = '';
  let targetPlayer = 'Akuma';
  
  try {
    if (fs.existsSync(tokenPath)) {
      const data = fs.readFileSync(tokenPath, 'utf8');
      if (data && data.trim() !== '') {
        try {
          const accounts = JSON.parse(data);
          const active = accounts.find(a => a.active === true);
          if (active && active.token) {
            token = active.token;
            targetPlayer = active.name || 'Akuma';
            console.log(' Active token loaded for:', active.name, '#', active.tag);
            console.log(' Tracking kills for player:', targetPlayer);
          } else {
            console.log(' No active account found in token file');
          }
        } catch (e) {
          console.log(' Invalid JSON in token file, ignoring');
        }
      }
    } else {
      console.log(' No token file found');
    }
  } catch (e) {
    console.log(' Error reading token:', e);
  }

  const gunTrackerScript = `
    (function() {
      console.log(' Gun Tracker starting...');
      
      async function loadExistingData() {
        try {
          if (window.require) {
            const { ipcRenderer } = window.require('electron');
            const result = await ipcRenderer.invoke('load-activity-data');
            if (result.success && result.data) {
              console.log(' Loaded existing data:', result.data.totalKills, 'kills');
              return result.data;
            }
          }
        } catch (e) {
          console.error(' Failed to load existing data:', e);
        }
        return { totalKills: 0, weapons: {} };
      }

      function saveToFile(data) {
        console.log(' Saving via IPC:', data.totalKills, 'kills');
        try {
          if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('save-activity-data', data);
            console.log(' IPC message sent');
            return true;
          } else {
            console.log(' window.require not available');
            return false;
          }
        } catch (e) {
          console.error(' Failed to send IPC:', e);
          return false;
        }
      }

      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.on('save-activity-reply', (event, reply) => {
          if (reply.success) {
            console.log(' File saved successfully at:', reply.filePath);
          } else {
            console.error(' File save failed:', reply.error);
          }
        });
      }

      const GUN_DATA_URL = 'https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/gd.json';
      const TARGET_PLAYER = '${targetPlayer || 'Akuma'}';

      let gunDataMap = {};
      let processedKills = new Set();
      let killCounter = 0;
      let stats = { totalKills: 0, weapons: {} };

      console.log(' Target player set to:', TARGET_PLAYER);

      function loadStats() {
        return stats;
      }

      function saveStats(data) {
        stats = data;
        saveToFile(data);
        console.log(' Stats saved:', data.totalKills, 'kills');
      }

      async function loadGunData() {
        try {
          const response = await fetch(GUN_DATA_URL);
          const data = await response.json();
          
          if (Array.isArray(data)) {
            data.forEach(item => {
              if (item && typeof item === 'object') {
                Object.keys(item).forEach(imageData => {
                  const gunName = item[imageData];
                  if (imageData && typeof imageData === 'string' && gunName) {
                    gunDataMap[imageData] = gunName;
                    const base64Only = imageData.replace(/^data:image\\/png;base64,/, '');
                    gunDataMap[base64Only] = gunName;
                  }
                });
              }
            });
          }
          console.log(' Gun data loaded,', Object.keys(gunDataMap).length, 'weapons');
          return true;
        } catch (e) {
          console.error(' Failed to load gun data:', e);
          return false;
        }
      }

      function getWeaponFromKillElement(killElement) {
        try {
          const weaponImg = killElement.querySelector('.weapon-cont');
          if (!weaponImg) return null;
          
          const src = weaponImg.getAttribute('src');
          if (!src || !src.includes('base64')) return null;
          
          let gunName = gunDataMap[src];
          if (!gunName) {
            const base64Only = src.replace(/^data:image\\/png;base64,/, '');
            gunName = gunDataMap[base64Only];
          }
          
          return gunName || null;
        } catch (e) {
          return null;
        }
      }

      function getPlayerNameFromKillElement(killElement) {
        try {
          const nameElement = killElement.querySelector('.killer-name');
          return nameElement ? nameElement.textContent.trim() : null;
        } catch (e) {
          return null;
        }
      }

      function processKillMessage(killElement) {
        const playerName = getPlayerNameFromKillElement(killElement);
        
        if (playerName !== TARGET_PLAYER) {
          return;
        }
        
        const weapon = getWeaponFromKillElement(killElement);
        if (!weapon) return;
        
        const killId = ++killCounter;
        
        if (!stats.weapons[weapon]) {
          stats.weapons[weapon] = 0;
        }
        stats.weapons[weapon]++;
        stats.totalKills++;
        stats.lastKill = {
          weapon: weapon,
          timestamp: new Date().toISOString(),
          killId: killId
        };
        
        saveStats(stats);
        console.log(' Kill tracked for', TARGET_PLAYER + ':', weapon, 'Total:', stats.totalKills);
      }

      function scanForKills() {
        const killItems = document.querySelectorAll('.kill-bar-item');
        killItems.forEach(kill => processKillMessage(kill));
      }

      function setupObserver() {
        const targetNode = document.body;
        const config = { childList: true, subtree: true };
        
        const callback = function(mutationsList) {
          for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
              for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                  if (node.classList && node.classList.contains('kill-bar-item')) {
                    processKillMessage(node);
                  }
                  if (node.querySelectorAll) {
                    const killItems = node.querySelectorAll('.kill-bar-item');
                    killItems.forEach(killItem => processKillMessage(killItem));
                  }
                }
              }
            }
          }
        };
        
        const observer = new MutationObserver(callback);
        observer.observe(targetNode, config);
        return observer;
      }

      function getAkumaStats() {
        console.log(' Current stats for', TARGET_PLAYER + ':', stats);
        return stats;
      }

      function clearStats() {
        stats = { totalKills: 0, weapons: {} };
        killCounter = 0;
        console.log(' Stats cleared for', TARGET_PLAYER);
        saveStats(stats);
      }

      function exportStats() {
        return JSON.stringify(stats, null, 2);
      }

      async function init() {
        console.log(' Gun Tracker initializing...');
        console.log(' Tracking kills for:', TARGET_PLAYER);
        
        const existingData = await loadExistingData();
        if (existingData && existingData.totalKills > 0) {
          stats = existingData;
          console.log(' Loaded existing stats:', stats.totalKills, 'kills');
          console.log(' Weapons from previous session:', Object.keys(stats.weapons));
        } else {
          console.log(' No existing data found, starting fresh');
        }
        
        await loadGunData();
        setupObserver();
        console.log(' Tracker running. Waiting for kills from', TARGET_PLAYER + '...');
        console.log(' Stats will be saved to: Documents/Ubuntu/Activity.json');
      }

      window.getAkumaStats = getAkumaStats;
      window.clearStats = clearStats;
      window.exportStats = exportStats;
      window.scanForKills = scanForKills;

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    })();
  `;

  const injectionScript = `
    (function() {
      console.log(' Token injection starting...');
      
      if (!window.electronAPI) {
        window.electronAPI = {
          saveToken: (token) => {
            if (window.require) {
              try {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('save-token-request', token);
                console.log(' Token sent to launcher');
              } catch(e) {
                console.error(' Failed to send token:', e);
              }
            }
          }
        };
      }
      
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        if (value && (key === 'token' || key === 'Ubuntu_token' || key.toLowerCase().includes('token'))) {
          console.log(' Token saved with key:', key);
          if (window.electronAPI && window.electronAPI.saveToken) {
            window.electronAPI.saveToken(value);
          }
        }
      };
      
      const token = ${JSON.stringify(token)};
      if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('Ubuntu_token', token);
        console.log(' Injected token from file on game load');
      } else {
        console.log(' No token to inject');
      }
      
      window.addEventListener('storage', function(e) {
        if (e.newValue && (e.key === 'token' || e.key === 'Ubuntu_token')) {
          console.log(' Token changed in storage');
          if (window.electronAPI && window.electronAPI.saveToken) {
            window.electronAPI.saveToken(e.newValue);
          }
        }
      });
      
      console.log(' Token injection complete');
    })();
  `;

  const combinedScript = injectionScript + '\n' + gunTrackerScript;

  // ── SETTINGS ──
  const settingsPath = path.join(ubuntuFolder, 'settings.txt');
  let proxyUrl = 'https://kirka.io/';
  let discordRpcEnabled = true; // Default to true
  
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.proxy) proxyUrl = settings.proxy;
      if (settings.discord_rpc !== undefined) discordRpcEnabled = settings.discord_rpc;
    }
  } catch (e) {
    console.log(' Error reading settings:', e);
  }

  // ── INITIALIZE DISCORD RPC ──
  if (discordRpcEnabled && !discordRPC) {
    try {
      discordRPC = new DiscordRPC();
      // Attach to gameWindow for access
      gameWindow.DiscordRPC = discordRPC;
      console.log('✅ Discord RPC initialized for game window');
    } catch (e) {
      console.error('❌ Failed to initialize Discord RPC:', e);
    }
  }

  // ── LISTEN FOR URL CHANGES ──
  gameWindow.webContents.on('did-navigate-in-page', (e, url) => {
    console.log('📍 URL changed to:', url);
    
    // ── DISCORD RPC UPDATE ──
    if (discordRpcEnabled && gameWindow.DiscordRPC) {
      const base_url = proxyUrl;
      const stateMap = {
        [`${base_url}`]: "In the lobby meow",
        [`${base_url}hub/leaderboard`]: "Viewing the leaderboard meow",
        [`${base_url}hub/clans/champions-league`]: "Viewing the clan leaderboard",
        [`${base_url}hub/clans/my-clan`]: "Viewing their clan meow",
        [`${base_url}hub/market`]: "Viewing the market meow",
        [`${base_url}hub/live`]: "Viewing videos meow",
        [`${base_url}hub/news`]: "Viewing news meow",
        [`${base_url}hub/terms`]: "Viewing the terms of service meow",
        [`${base_url}store`]: "Viewing the store meow",
        [`${base_url}servers/main`]: "Viewing main servers meow",
        [`${base_url}servers/parkour`]: "Viewing parkour servers meow",
        [`${base_url}servers/custom`]: "Viewing custom servers meow",
        [`${base_url}quests/hourly`]: "Viewing hourly quests meow",
        [`${base_url}friends`]: "Viewing friends meow",
        [`${base_url}inventory`]: "Viewing their inventory meow",
        [`https://accounts.google.com/`]: "Logining in (With google)",
        [`https://www.facebook.com/`]: "Logining in (With facebook)",
        [`https://appleid.apple.com/`]: "Logining in (With apple)",
        [`https://www.twitch.tv/login`]: "Logining in (With twitch)",
        [`https://discord.com/oauth2`]: "Logining in (With Discord)",
        [`https://id.vk.ru/`]: "Logining in (With vk)",
        [`${base_url}/profile/NUGGET`]: "Viewing the smudgy client owners Profle",
      };

      let state;

      if (stateMap[url]) {
        state = stateMap[url];
      } else if (url.startsWith(`${base_url}games/`)) {
        state = "In a match meow";
      } else if (url.startsWith(`${base_url}profile/`)) {
        const profileMatch = url.match(`${base_url}profile/(.+)`);
        if (profileMatch && profileMatch[1]) {
          const shortId = profileMatch[1];
          state = `Viewing player profile #${shortId}`;
          
          // Set the profile picture as small image with random number to bypass cache
          const randomNumbers = Math.floor(Math.random() * 1000000);
          const activity = gameWindow.DiscordRPC.defaultActivity();
          activity.state = state;
          activity.smallImageKey = `https://www.smudgy.store/api/list/profile.png?meow=${shortId}&v=${randomNumbers}`;
          activity.smallImageText = `Viewing ${shortId}'s profile`;
          gameWindow.DiscordRPC.setActivity(activity);
        } else {
          state = "Viewing a profile meow";
          const activity = gameWindow.DiscordRPC.defaultActivity();
          activity.state = state;
          delete activity.smallImageKey;
          delete activity.smallImageText;
          gameWindow.DiscordRPC.setActivity(activity);
        }
      } else {
        state = "In the lobby meow";
        const activity = gameWindow.DiscordRPC.defaultActivity();
        activity.state = state;
        delete activity.smallImageKey;
        delete activity.smallImageText;
        gameWindow.DiscordRPC.setActivity(activity);
      }

      if (!url.startsWith(`${base_url}profile/`) && !stateMap[url] && !url.startsWith(`${base_url}games/`)) {
        const activity = gameWindow.DiscordRPC.defaultActivity();
        activity.state = state;
        delete activity.smallImageKey;
        delete activity.smallImageText;
        gameWindow.DiscordRPC.setActivity(activity);
      } else if (!url.startsWith(`${base_url}profile/`)) {
        gameWindow.DiscordRPC.setState(state);
      }
    }
    
    // Send to renderer
    gameWindow.webContents.send('url-change', url);
  });

  gameWindow.webContents.on('did-finish-load', () => {
    console.log(' Game loaded, injecting scripts');
    
    // Update Discord RPC with initial state
    const currentUrl = gameWindow.webContents.getURL();
    
    // ── DISCORD RPC INITIAL UPDATE ──
    if (discordRpcEnabled && gameWindow.DiscordRPC) {
      const base_url = proxyUrl;
      const stateMap = {
        [`${base_url}`]: "In the lobby meow",
        [`${base_url}hub/leaderboard`]: "Viewing the leaderboard meow",
        [`${base_url}hub/clans/champions-league`]: "Viewing the clan leaderboard",
        [`${base_url}hub/clans/my-clan`]: "Viewing their clan meow",
        [`${base_url}hub/market`]: "Viewing the market meow",
        [`${base_url}hub/live`]: "Viewing videos meow",
        [`${base_url}hub/news`]: "Viewing news meow",
        [`${base_url}hub/terms`]: "Viewing the terms of service meow",
        [`${base_url}store`]: "Viewing the store meow",
        [`${base_url}servers/main`]: "Viewing main servers meow",
        [`${base_url}servers/parkour`]: "Viewing parkour servers meow",
        [`${base_url}servers/custom`]: "Viewing custom servers meow",
        [`${base_url}quests/hourly`]: "Viewing hourly quests meow",
        [`${base_url}friends`]: "Viewing friends meow",
        [`${base_url}inventory`]: "Viewing their inventory meow",
        [`https://accounts.google.com/`]: "Logining in (With google)",
        [`https://www.facebook.com/`]: "Logining in (With facebook)",
        [`https://appleid.apple.com/`]: "Logining in (With apple)",
        [`https://www.twitch.tv/login`]: "Logining in (With twitch)",
        [`https://discord.com/oauth2`]: "Logining in (With Discord)",
        [`https://id.vk.ru/`]: "Logining in (With vk)",
        [`${base_url}/profile/NUGGET`]: "Viewing the smudgy client owners Profle",
      };

      let state;

      if (stateMap[currentUrl]) {
        state = stateMap[currentUrl];
      } else if (currentUrl && currentUrl.startsWith(`${base_url}games/`)) {
        state = "In a match meow";
      } else if (currentUrl && currentUrl.startsWith(`${base_url}profile/`)) {
        const profileMatch = currentUrl.match(`${base_url}profile/(.+)`);
        if (profileMatch && profileMatch[1]) {
          const shortId = profileMatch[1];
          state = `Viewing player profile #${shortId}`;
          const randomNumbers = Math.floor(Math.random() * 1000000);
          const activity = gameWindow.DiscordRPC.defaultActivity();
          activity.state = state;
          activity.smallImageKey = `https://www.smudgy.store/api/list/profile.png?meow=${shortId}&v=${randomNumbers}`;
          activity.smallImageText = `Viewing ${shortId}'s profile`;
          gameWindow.DiscordRPC.setActivity(activity);
        } else {
          state = "Viewing a profile meow";
          const activity = gameWindow.DiscordRPC.defaultActivity();
          activity.state = state;
          delete activity.smallImageKey;
          delete activity.smallImageText;
          gameWindow.DiscordRPC.setActivity(activity);
        }
      } else {
        state = "In the lobby meow";
        const activity = gameWindow.DiscordRPC.defaultActivity();
        activity.state = state;
        delete activity.smallImageKey;
        delete activity.smallImageText;
        gameWindow.DiscordRPC.setActivity(activity);
      }

      if (!currentUrl.startsWith(`${base_url}profile/`) && !stateMap[currentUrl] && !currentUrl.startsWith(`${base_url}games/`)) {
        const activity = gameWindow.DiscordRPC.defaultActivity();
        activity.state = state;
        delete activity.smallImageKey;
        delete activity.smallImageText;
        gameWindow.DiscordRPC.setActivity(activity);
      } else if (!currentUrl.startsWith(`${base_url}profile/`)) {
        gameWindow.DiscordRPC.setState(state);
      }
    }
    
    gameWindow.webContents.executeJavaScript(combinedScript)
      .then(() => console.log(' Scripts executed successfully'))
      .catch(err => console.error(' Script execution failed:', err));
  });

  // ── SET USER AGENT ──
  gameWindow.webContents.setUserAgent(
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.116 Safari/537.36 Electron/${app.getVersion()} UbuntuClient/${app.getVersion()}`
  );

  console.log(' Loading URL:', proxyUrl);
  gameWindow.loadURL(proxyUrl);

  gameWindow.once('ready-to-show', () => {
    gameWindow.show();
    console.log(' Game window shown');
  });

  gameWindow.on('closed', () => {
    if (discordRPC) {
      try {
        discordRPC.client.destroy();
      } catch (e) {}
      discordRPC = null;
    }
    gameWindow = null;
  });

  return gameWindow;
}

module.exports = { createGameWindow };