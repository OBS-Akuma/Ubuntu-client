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
  // Check if game window already exists
  if (gameWindow && !gameWindow.isDestroyed()) {
    console.log(' Game window already exists, showing it');
    gameWindow.show();
    gameWindow.focus();
    return gameWindow;
  }

  // Read menu files
  let menuHTML = '';
  let menuCSS = '';
  try {
    menuHTML = fs.readFileSync(path.join(__dirname, 'assets/html/menu.html'), 'utf8');
    menuCSS = fs.readFileSync(path.join(__dirname, 'assets/css/menu.css'), 'utf8');
    console.log('[Menu] Loaded menu files');
  } catch (e) {
    console.log('[Menu] Could not read menu files:', e.message);
  }

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
  let targetPlayer = 'Newbie'; // Default fallback name
  
  // Load the active account from token.txt
  try {
    if (fs.existsSync(tokenPath)) {
      const data = fs.readFileSync(tokenPath, 'utf8');
      if (data && data.trim() !== '') {
        try {
          const accounts = JSON.parse(data);
          const active = accounts.find(a => a.active === true);
          if (active) {
            token = active.token || '';
            targetPlayer = active.name || active.tag || 'Newbie';
            console.log('═══════════════════════════════════════════════════════');
            console.log(' ACTIVE ACCOUNT LOADED:');
            console.log(`   Name: ${active.name}`);
            console.log(`   Tag: ${active.tag}`);
            console.log(`   Level: ${active.level}`);
            console.log(`   UserId: ${active.userId}`);
            console.log('═══════════════════════════════════════════════════════');
            console.log(` Tracking kills for player: ${targetPlayer}`);
          } else {
            console.log(' No active account found in token file, using fallback: Newbie');
          }
        } catch (e) {
          console.log(' Invalid JSON in token file, using fallback: Newbie');
        }
      } else {
        console.log(' Token file is empty, using fallback: Newbie');
      }
    } else {
      console.log(' No token file found, using fallback: Newbie');
    }
  } catch (e) {
    console.log(' Error reading token:', e);
  }

  // ─── MENU SCRIPT ───
  const menuScript = `
    (function() {
      console.log('[Menu] Loading menu system...');
      
      function initMenu() {
        try {
          // Menu HTML and CSS from main process
          const menuHTML = ${JSON.stringify(menuHTML)};
          const menuCSS = ${JSON.stringify(menuCSS)};
          
          if (!menuHTML) {
            console.error('[Menu] No menu HTML provided');
            return;
          }
          
          // Create menu container
          const container = document.createElement('div');
          container.innerHTML = menuHTML;
          container.id = 'ubuntu-menu-container';
          container.style.cssText = 'z-index: 99999999; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.95); display: none; opacity: 0; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);';
          
          // Inject CSS
          const style = document.createElement('style');
          style.innerHTML = menuCSS;
          container.prepend(style);
          
          document.body.appendChild(container);
          console.log('[Menu] Container added to DOM');
          
          // Create menu object
          const menu = {
            container: container,
            visible: false,
            show: function() {
              this.visible = true;
              this.container.style.display = 'block';
              requestAnimationFrame(() => {
                this.container.style.opacity = '1';
                this.container.style.transform = 'translate(-50%, -50%) scale(1)';
              });
              document.body.style.overflow = 'hidden';
              console.log('[Menu] Shown');
            },
            hide: function() {
              this.visible = false;
              this.container.style.opacity = '0';
              this.container.style.transform = 'translate(-50%, -50%) scale(0.95)';
              setTimeout(() => {
                this.container.style.display = 'none';
                document.body.style.overflow = '';
              }, 300);
              console.log('[Menu] Hidden');
            },
            toggle: function() {
              if (this.visible) {
                this.hide();
              } else {
                this.show();
              }
            }
          };
          
          // Store reference globally
          window.UbuntuMenu = menu;
          
          // ── EVENT LISTENERS ──
          
          // Right-click to toggle
          document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            menu.toggle();
            return false;
          });
          
          // Right Shift key to toggle
          document.addEventListener('keydown', (e) => {
            if (e.code === 'ShiftRight') {
              e.preventDefault();
              e.stopPropagation();
              console.log('[Menu] Right Shift pressed - toggling menu');
              menu.toggle();
              return false;
            }
            
            // Escape key to close
            if (e.key === 'Escape' && menu.visible) {
              e.preventDefault();
              menu.hide();
            }
          });
          
          // ── CLOSE BUTTON ──
          const closeBtn = container.querySelector('.menu-close');
          if (closeBtn) {
            closeBtn.addEventListener('click', () => menu.hide());
            console.log('[Menu] Close button bound');
          }
          
          // ── ZOOM CONTROLS ──
          let zoomLevel = parseInt(localStorage.getItem('menu_zoom')) || 100;
          const zoomDisplay = container.querySelector('#zoom-display');
          const zoomIn = container.querySelector('#zoom-in');
          const zoomOut = container.querySelector('#zoom-out');
          const zoomReset = container.querySelector('#zoom-reset');
          
          function updateZoom() {
            if (zoomDisplay) {
              zoomDisplay.textContent = zoomLevel + '%';
            }
            document.body.style.zoom = zoomLevel / 100;
            localStorage.setItem('menu_zoom', zoomLevel);
          }
          
          if (zoomIn) {
            zoomIn.addEventListener('click', () => {
              if (zoomLevel < 200) {
                zoomLevel += 10;
                updateZoom();
              }
            });
          }
          
          if (zoomOut) {
            zoomOut.addEventListener('click', () => {
              if (zoomLevel > 50) {
                zoomLevel -= 10;
                updateZoom();
              }
            });
          }
          
          if (zoomReset) {
            zoomReset.addEventListener('click', () => {
              zoomLevel = 100;
              updateZoom();
            });
          }
          
          updateZoom();
          console.log('[Menu] Zoom controls bound');
          
          // ── MENU ITEMS WITH DATA-ACTION ──
          container.querySelectorAll('[data-action]').forEach((item) => {
            item.addEventListener('click', () => {
              const action = item.dataset.action;
              console.log('[Menu] Action:', action);
              switch (action) {
                case 'close':
                  menu.hide();
                  break;
                case 'reload':
                  location.reload();
                  break;
                case 'about':
                  alert('Ubuntu Client v1.0.0\\nCreated by OBS-Akuma');
                  break;
                case 'discord':
                  window.open('https://discord.gg/r6S3mMyT4K', '_blank');
                  break;
                default:
                  console.log('[Menu] Unknown action:', action);
              }
            });
          });
          
          // ── SETTING INPUTS ──
          container.querySelectorAll('.setting-input').forEach((input) => {
            const saved = localStorage.getItem('menu_' + input.id);
            if (saved) {
              input.value = saved;
            }
            input.addEventListener('change', () => {
              localStorage.setItem('menu_' + input.id, input.value);
              console.log('[Menu] Setting', input.id, '=', input.value);
            });
          });
          
          // ── SELECT DROPDOWNS ──
          container.querySelectorAll('.setting-select').forEach((select) => {
            const saved = localStorage.getItem('menu_' + select.id);
            if (saved) {
              select.value = saved;
            }
            select.addEventListener('change', () => {
              localStorage.setItem('menu_' + select.id, select.value);
              console.log('[Menu] Setting', select.id, '=', select.value);
            });
          });
          
          console.log('[Menu] Menu system initialized successfully!');
          console.log('[Menu] Right click or Right Shift to open');
        } catch (e) {
          console.error('[Menu] Failed to initialize menu:', e);
          console.error('[Menu] Stack:', e.stack);
        }
      }
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMenu);
      } else {
        initMenu();
      }
    })();
  `;

  // ─── TOKEN INJECTION SCRIPT ───
  const injectionScript = `
    (function() {
      console.log(' Token injection starting...');
      
      let tokenSaved = false;
      
      if (!window.electronAPI) {
        window.electronAPI = {
          saveToken: (token) => {
            if (tokenSaved) {
              console.log(' Token already saved, skipping duplicate');
              return;
            }
            
            if (window.require) {
              try {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('save-token-request', token);
                tokenSaved = true;
                console.log(' Token sent to launcher');
              } catch(e) {
                console.error(' Failed to send token:', e);
              }
            }
          }
        };
      }
      
      if (!window._localStorageOverridden) {
        window._localStorageOverridden = true;
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
          originalSetItem.call(this, key, value);
          if (value && (key === 'token' || key === 'Ubuntu_token')) {
            console.log(' Token saved with key:', key);
            if (window.electronAPI && window.electronAPI.saveToken) {
              window.electronAPI.saveToken(value);
            }
          }
        };
      }
      
      const token = ${JSON.stringify(token)};
      if (token) {
        const existingToken = localStorage.getItem('token');
        if (existingToken !== token) {
          localStorage.setItem('token', token);
          localStorage.setItem('Ubuntu_token', token);
          console.log(' Injected token from file on game load');
        } else {
          console.log(' Token already exists, skipping injection');
        }
      } else {
        console.log(' No token to inject');
      }
      
      if (!window._storageListenerAdded) {
        window._storageListenerAdded = true;
        window.addEventListener('storage', function(e) {
          if (e.newValue && (e.key === 'token' || e.key === 'Ubuntu_token') && e.newValue !== e.oldValue) {
            console.log(' Token changed in storage');
            if (window.electronAPI && window.electronAPI.saveToken) {
              window.electronAPI.saveToken(e.newValue);
            }
          }
        });
      }
      
      console.log(' Token injection complete');
    })();
  `;

  // ─── GUN TRACKER SCRIPT ───
  const gunTrackerScript = `
    (function() {
      console.log(' Gun Tracker starting...');
      console.log(' Tracking kills for player: ${targetPlayer}');
      
      let isSaving = false;
      let saveTimeout = null;
      
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
        if (isSaving) {
          console.log(' Save already in progress, queuing...');
          if (saveTimeout) clearTimeout(saveTimeout);
          saveTimeout = setTimeout(() => {
            saveToFile(data);
          }, 500);
          return false;
        }
        
        console.log(' Saving via IPC:', data.totalKills, 'kills');
        try {
          if (window.require) {
            isSaving = true;
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('save-activity-data', data);
            console.log(' IPC message sent');
            
            setTimeout(() => {
              isSaving = false;
            }, 1000);
            
            return true;
          } else {
            console.log(' window.require not available');
            return false;
          }
        } catch (e) {
          console.error(' Failed to send IPC:', e);
          isSaving = false;
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
      const TARGET_PLAYER = '${targetPlayer}';

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

      function getStats() {
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

      window.getStats = getStats;
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

  const combinedScript = injectionScript + '\n' + gunTrackerScript + '\n' + menuScript;

  // ── SETTINGS ──
  const settingsPath = path.join(ubuntuFolder, 'settings.txt');
  let proxyUrl = 'https://kirka.io/';
  let discordRpcEnabled = true;
  
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
      gameWindow.DiscordRPC = discordRPC;
      console.log(' Discord RPC initialized for game window');
    } catch (e) {
      console.error(' Failed to initialize Discord RPC:', e);
    }
  }

  // ── LISTEN FOR URL CHANGES ──
  gameWindow.webContents.on('did-navigate-in-page', (e, url) => {
    console.log(' URL changed to:', url);
    
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
    
    gameWindow.webContents.send('url-change', url);
  });

  // ── PAGE LOAD HANDLER ──
  gameWindow.webContents.on('did-finish-load', () => {
    console.log(' Game loaded, injecting scripts');
    
    const currentUrl = gameWindow.webContents.getURL();
    
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
      .then(() => {
        console.log(' Scripts executed successfully');
      })
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