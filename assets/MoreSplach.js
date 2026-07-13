const { ipcRenderer } = require('electron');


let activeKeybinds = {
    up: null,
    down: null,
    left: null,
    right: null
};


const imageCheckTracker = {};

const dropdownImageLoadTracker = {};



async function getCachedProfileImage(tag) {
    try {
        const settings = await loadSettings();
        if (settings && settings.profileImages && settings.profileImages[tag]) {
            return settings.profileImages[tag];
        }
        return null;
    } catch (e) {
        console.error('[Profile Image] Error getting cached image:', e);
        return null;
    }
}

async function saveCachedProfileImage(tag, base64Data) {
    try {
        const settings = await loadSettings();
        if (!settings.profileImages) {
            settings.profileImages = {};
        }

        settings.profileImages[tag] = {
            data: base64Data,
            timestamp: Date.now()
        };
        await saveSettings(settings);
        console.log('[Profile Image] Cached image for tag:', tag);
        return true;
    } catch (e) {
        console.error('[Profile Image] Error saving cached image:', e);
        return false;
    }
}

function getImageHash(base64Data) {
    if (!base64Data) return null;
    const base64String = base64Data.split(',')[1] || base64Data;
    if (base64String.length <= 200) {
        return base64String;
    }
    return base64String.substring(0, 100) + base64String.substring(base64String.length - 100);
}

async function checkImageChanged(tag, cachedBase64) {
    try {
        console.log('[Profile Image] Checking if image changed for:', tag);
        const randV = Math.floor(Math.random() * 9000000) + 1000000;
        const url = `https://www.smudgy.store/api/list/profile.png?meow=${encodeURIComponent(tag)}&v=${randV}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const blob = await response.blob();
        const newBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        
        const oldHash = getImageHash(cachedBase64);
        const newHash = getImageHash(newBase64);
        const hasChanged = oldHash !== newHash;
        console.log('[Profile Image] Image changed:', hasChanged);
        
        return {
            changed: hasChanged,
            newBase64: newBase64
        };
    } catch (error) {
        console.error('[Profile Image] Error checking if image changed:', error);
        return { changed: false, newBase64: null };
    }
}

async function getProfileImage(tag, forceRefresh = false) {
    if (!tag) return null;
    
    if (!forceRefresh) {
        const cached = await getCachedProfileImage(tag);
        if (cached && cached.data) {
            const lastCheck = imageCheckTracker[tag] || 0;
            const shouldCheckChange = (Date.now() - lastCheck) > 3600000;
            
            if (shouldCheckChange) {
                console.log('[Profile Image] Cache is old, checking for changes...');
                const result = await checkImageChanged(tag, cached.data);
                imageCheckTracker[tag] = Date.now();
                
                if (result.changed && result.newBase64) {
                    await saveCachedProfileImage(tag, result.newBase64);
                    console.log('[Profile Image] Updated cached image for:', tag);
                    return result.newBase64;
                } else if (!result.changed) {
                    const settings = await loadSettings();
                    if (settings && settings.profileImages && settings.profileImages[tag]) {
                        settings.profileImages[tag].timestamp = Date.now();
                        await saveSettings(settings);
                    }
                }
            } else {
                console.log('[Profile Image] Skipping check for:', tag, '(checked recently)');
            }
            
            console.log('[Profile Image] Using cached image for:', tag);
            return cached.data;
        }
    }
    
    try {
        console.log('[Profile Image] Fetching fresh image for:', tag);
        const randV = Math.floor(Math.random() * 9000000) + 1000000;
        const url = `https://www.smudgy.store/api/list/profile.png?meow=${encodeURIComponent(tag)}&v=${randV}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const blob = await response.blob();
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        
        await saveCachedProfileImage(tag, base64);
        imageCheckTracker[tag] = Date.now();
        console.log('[Profile Image] Cached new image for:', tag);
        
        return base64;
    } catch (error) {
        console.error('[Profile Image] Error fetching image:', error);
        const cached = await getCachedProfileImage(tag);
        if (cached && cached.data) {
            console.log('[Profile Image] Using cached image as fallback');
            return cached.data;
        }
        return null;
    }
}

async function refreshProfileImage(tag) {
    if (!tag) return null;
    console.log('[Profile Image] Manual refresh for:', tag);
    return await getProfileImage(tag, true);
}



const KTiersAPI = {
    tiers: [
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
    ],

    async getPlayer(identifier) {
        try {
            const result = await ipcRenderer.invoke('ktiers:get-player', identifier);
            if (result && result.success) {
                return result.player;
            }
            return null;
        } catch (error) {
            console.error('[KTiers] Error getting player:', error);
            return null;
        }
    },

    getTierForPlayer(player) {
        if (!player) return null;
        const totalPoints = parseInt(player.points) || 0;
        for (const tier of this.tiers) {
            if (totalPoints >= tier.minPoints) {
                return tier;
            }
        }
        return this.tiers[this.tiers.length - 1];
    },

    getBadgeHTML(player) {
        if (!player) return '';
        const tier = this.getTierForPlayer(player);
        if (!tier) return '';
        const totalPoints = parseInt(player.points) || 0;
        return `
            <span class="ktiers-badge ktiers-badge-${tier.name.toLowerCase()}" 
                  style="display:inline-flex;align-items:center;gap:6px;background:${tier.glow};border:1px solid ${tier.color}55;border-radius:12px;padding:3px 10px 3px 6px;font-size:0.7rem;font-weight:700;color:${tier.color};margin-left:6px;text-shadow: 0 0 10px ${tier.glow};">
                <img src="${tier.icon}" alt="${tier.name}" style="width:16px;height:16px;object-fit:contain;filter:drop-shadow(0 0 4px ${tier.glow});" onerror="this.style.display='none'">
                ${tier.name}
                <span style="font-weight:400;opacity:0.7;font-size:0.55rem;background:rgba(0,0,0,0.2);padding:0 6px;border-radius:8px;">${totalPoints}pts</span>
            </span>
        `;
    },

    async refresh() {
        try {
            const result = await ipcRenderer.invoke('ktiers:refresh');
            if (result && result.success) {
                console.log(`[KTiers] Refreshed, ${result.count} players`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[KTiers] Error refreshing:', error);
            return false;
        }
    },

    async getAllPlayersWithTiers() {
        try {
            const result = await ipcRenderer.invoke('ktiers:get-all-players');
            if (result && result.success) {
                return result.players;
            }
            return [];
        } catch (error) {
            console.error('[KTiers] Error getting all players:', error);
            return [];
        }
    }
};

async function applyKTiersBadge() {
    console.log('[KTiers] Checking for KTiers badge...');
    

    const settings = await loadSettings();
    if (!settings.ktiersEnabled) {
        console.log('[KTiers] KTiers is disabled in settings');

        const userNameDisplay = document.getElementById('userNameDisplay');
        if (userNameDisplay) {
            const existingBadge = userNameDisplay.parentElement.querySelector('.ktiers-badge');
            if (existingBadge) {
                existingBadge.remove();
                console.log('[KTiers] Removed badge because KTiers is disabled');
            }
        }
        const accountItems = document.querySelectorAll('.account-item');
        accountItems.forEach(item => {
            const badge = item.querySelector('.ktiers-badge');
            if (badge) {
                badge.remove();
            }
        });
        return;
    }
    
    try {

        const userNameDisplay = document.getElementById('userNameDisplay');
        if (userNameDisplay) {
            const existingBadge = userNameDisplay.parentElement.querySelector('.ktiers-badge');
            if (existingBadge) {
                existingBadge.remove();
                console.log('[KTiers] Removed existing badge from user name');
            }
        }
        

        const accountItems = document.querySelectorAll('.account-item');
        accountItems.forEach(item => {
            const badge = item.querySelector('.ktiers-badge');
            if (badge) {
                badge.remove();
            }
        });
        

        const accounts = await getAccounts();
        const activeAccount = accounts.find(a => a.active === true);
        
        if (!activeAccount) {
            console.log('[KTiers] No active account found');
            return;
        }
        

        const userId = activeAccount.userId;
        const userName = activeAccount.name;
        
        console.log(`[KTiers] Looking for user: ${userName} (${userId})`);
        

        let player = await KTiersAPI.getPlayer(userId);
        if (!player) {
            player = await KTiersAPI.getPlayer(userName);
        }
        
        if (!player) {
            console.log('[KTiers] User not found in KTiers list - no badge to show');
            return;
        }
        
        console.log(`[KTiers] Found player: ${player.name} with ${player.points} points`);
        

        const badgeHTML = KTiersAPI.getBadgeHTML(player);
        if (!badgeHTML) {
            console.log('[KTiers] No badge available for player');
            return;
        }
        

        if (userNameDisplay) {

            userNameDisplay.insertAdjacentHTML('afterend', badgeHTML);
            console.log('[KTiers] Badge applied successfully');
        }
        

        accountItems.forEach(item => {
            const nameSpan = item.querySelector('.value');
            if (nameSpan) {
                const itemName = nameSpan.textContent.trim();

                const accountName = player.name;
                const accountTag = player.shortId;
                
                if (itemName.includes(accountName) || itemName.includes(accountTag)) {
                    const existingBadge = item.querySelector('.ktiers-badge');
                    if (!existingBadge) {
                        nameSpan.insertAdjacentHTML('afterend', badgeHTML);
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('[KTiers] Error applying badge:', error);
    }
}

async function refreshKTiers() {
    const refreshed = await KTiersAPI.refresh();
    if (refreshed) {
        await applyKTiersBadge();
    }
}

function initKTiers() {
    console.log('[KTiers] Initializing...');
    setTimeout(() => {
        applyKTiersBadge();
    }, 500);
    document.addEventListener('account-switched', () => {
        console.log('[KTiers] Account switched, updating badge...');
        setTimeout(() => {
            applyKTiersBadge();
        }, 300);
    });
    const userPill = document.getElementById('userPill');
    if (userPill) {
        userPill.addEventListener('click', () => {
            setTimeout(() => {
                applyKTiersBadge();
            }, 200);
        });
    }
    ipcRenderer.on('token-updated', () => {
        console.log('[KTiers] Token updated, refreshing badge...');
        setTimeout(() => {
            applyKTiersBadge();
        }, 500);
    });
    setInterval(() => {
        console.log('[KTiers] Auto-refreshing data...');
        refreshKTiers();
    }, 5 * 60 * 1000);
    console.log('[KTiers] Initialized successfully');
}

async function loadActivityData() {
    console.log(' Loading activity data...');
    try {
        const documentsPath = await ipcRenderer.invoke('get-documents-path');
        const fs = require('fs');
        const path = require('path');
        const activityPath = path.join(documentsPath, 'Ubuntu', 'Activity.json');
        console.log(' Looking for:', activityPath);
        if (!fs.existsSync(activityPath)) {
            document.getElementById('activityLoading').style.display = 'none';
            document.getElementById('activityEmpty').style.display = 'block';
            return;
        }
        const data = fs.readFileSync(activityPath, 'utf8');
        const stats = JSON.parse(data);
        console.log(' Stats found:', stats);
        document.getElementById('activityLoading').style.display = 'none';
        if (!stats.totalKills || stats.totalKills === 0) {
            document.getElementById('activityEmpty').style.display = 'block';
            return;
        }
        const content = document.getElementById('activityContent');
        content.style.display = 'block';
        let html = `<div style="padding:20px;">`;
        html += `<h2 style="color:var(--green);margin-bottom:20px;">Kill Statistics</h2>`;
        html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:30px;">`;
        html += `<div style="background:var(--bg2);padding:20px;border-radius:8px;text-align:center;border:1px solid var(--border);"><div style="font-size:32px;font-weight:bold;color:var(--green);">${stats.totalKills}</div><div style="color:var(--text-muted);font-size:12px;">Total Kills</div></div>`;
        html += `<div style="background:var(--bg2);padding:20px;border-radius:8px;text-align:center;border:1px solid var(--border);"><div style="font-size:32px;font-weight:bold;color:var(--green);">${Object.keys(stats.weapons).length}</div><div style="color:var(--text-muted);font-size:12px;">Weapons Used</div></div>`;
        if (stats.lastKill) {
            html += `<div style="background:var(--bg2);padding:20px;border-radius:8px;text-align:center;border:1px solid var(--border);"><div style="font-size:32px;font-weight:bold;color:var(--green);">${stats.lastKill.weapon}</div><div style="color:var(--text-muted);font-size:12px;">Last Kill</div></div>`;
        }
        html += `</div>`;
        html += `<h3 style="color:var(--text);margin-bottom:15px;">Weapon Breakdown</h3>`;
        const sortedWeapons = Object.entries(stats.weapons).sort((a, b) => b[1] - a[1]);
        sortedWeapons.forEach(([weapon, count]) => {
            const percentage = ((count / stats.totalKills) * 100).toFixed(1);
            html += `
                <div style="margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                        <span style="color:var(--text);font-size:13px;">${weapon}</span>
                        <span style="color:var(--text-muted);font-size:13px;">${count} (${percentage}%)</span>
                    </div>
                    <div style="background:var(--bg3);height:8px;border-radius:4px;overflow:hidden;">
                        <div style="background:var(--green);height:100%;width:${percentage}%;transition:width 0.5s;"></div>
                    </div>
                </div>
            `;
        });
        if (stats.lastUpdated) {
            html += `<div style="margin-top:20px;color:var(--text-muted);font-size:11px;text-align:center;border-top:1px solid var(--border);padding-top:15px;">Last updated: ${new Date(stats.lastUpdated).toLocaleString()}</div>`;
        }
        html += `</div>`;
        content.innerHTML = html;
    } catch (e) {
        console.error(' Error loading activity:', e);
        document.getElementById('activityLoading').style.display = 'none';
        document.getElementById('activityError').style.display = 'block';
    }
}

async function saveSettings(settings) {
    try {
        const result = await ipcRenderer.invoke('save-settings', settings);
        if (result && result.success) {
            console.log(' Settings saved successfully');
            return true;
        } else {
            console.error(' Failed to save settings:', result?.error);
            return false;
        }
    } catch (e) {
        console.error(' Failed to save settings:', e);
        return false;
    }
}

function getDefaultSettings() {
    return {
        proxy: 'https://kirka.io/',
        newsEnabled: true,
        ktiersEnabled: true,
        unlimited_fps: true,
        in_process_gpu: true,
        discord_rpc: true,
        discord_rpc_show_lobby: true,
        discord_rpc_show_matches: true,
        discord_rpc_show_profile: true,
        discord_rpc_show_launcher: true,
        hide_usernames: false,
        menu_keybind: 'ShiftRight',
        endgame_message_text: 'Good Game',
        endgame_message_up: 'Up',
        endgame_message_down: 'Down',
        endgame_message_left: 'Left',
        endgame_message_right: 'Right',
        keybind_up: null,
        keybind_down: null,
        keybind_left: null,
        keybind_right: null,
        profileImages: {},
        newsCategories: {
            general: true,
            event: true,
            alert: true,
            promotional: true
        }
    };
}

async function loadSettings() {
    try {
        const result = await ipcRenderer.invoke('load-settings');
        if (result && result.success && result.settings) {
            const defaults = getDefaultSettings();
            return { ...defaults, ...result.settings };
        }
    } catch (e) {
        console.error(' Failed to load settings:', e);
    }
    return getDefaultSettings();
}

function applySettingsToUI(settings) {
    const defaults = getDefaultSettings();
    const mergedSettings = { ...defaults, ...settings };
    
    const proxySelect = document.getElementById('base_url');
    if (proxySelect && mergedSettings.proxy) {
        for (let option of proxySelect.options) {
            if (option.value === mergedSettings.proxy) {
                proxySelect.value = mergedSettings.proxy;
                break;
            }
        }
    }
    
    const endgameMessageInput = document.getElementById('endgame_message_text');
    if (endgameMessageInput) {
        endgameMessageInput.value = mergedSettings.endgame_message_text || 'Good Game';
    }
    
    const messageUpInput = document.getElementById('message_up');
    if (messageUpInput) {
        messageUpInput.value = mergedSettings.endgame_message_up || 'Up';
    }
    
    const messageDownInput = document.getElementById('message_down');
    if (messageDownInput) {
        messageDownInput.value = mergedSettings.endgame_message_down || 'Down';
    }
    
    const messageLeftInput = document.getElementById('message_left');
    if (messageLeftInput) {
        messageLeftInput.value = mergedSettings.endgame_message_left || 'Left';
    }
    
    const messageRightInput = document.getElementById('message_right');
    if (messageRightInput) {
        messageRightInput.value = mergedSettings.endgame_message_right || 'Right';
    }
    
    const keybindUpBtn = document.getElementById('keybindup');
    if (keybindUpBtn && mergedSettings.keybind_up) {
        keybindUpBtn.textContent = formatKeybindDisplay(mergedSettings.keybind_up);
        activeKeybinds.up = mergedSettings.keybind_up;
    }
    
    const keybindDownBtn = document.getElementById('keybinddown');
    if (keybindDownBtn && mergedSettings.keybind_down) {
        keybindDownBtn.textContent = formatKeybindDisplay(mergedSettings.keybind_down);
        activeKeybinds.down = mergedSettings.keybind_down;
    }
    
    const keybindLeftBtn = document.getElementById('keybindleft');
    if (keybindLeftBtn && mergedSettings.keybind_left) {
        keybindLeftBtn.textContent = formatKeybindDisplay(mergedSettings.keybind_left);
        activeKeybinds.left = mergedSettings.keybind_left;
    }
    
    const keybindRightBtn = document.getElementById('keybindright');
    if (keybindRightBtn && mergedSettings.keybind_right) {
        keybindRightBtn.textContent = formatKeybindDisplay(mergedSettings.keybind_right);
        activeKeybinds.right = mergedSettings.keybind_right;
    }
    
    const unlimitedFpsToggle = document.getElementById('unlimited_fps');
    if (unlimitedFpsToggle) {
        unlimitedFpsToggle.checked = mergedSettings.unlimited_fps !== undefined ? mergedSettings.unlimited_fps : true;
    }

    const inProcessGpuToggle = document.getElementById('in_process_gpu');
    if (inProcessGpuToggle) {
        inProcessGpuToggle.checked = mergedSettings.in_process_gpu !== undefined ? mergedSettings.in_process_gpu : true;
    }

    const discordRpcToggle = document.getElementById('discord_rpc');
    if (discordRpcToggle) {
        discordRpcToggle.checked = mergedSettings.discord_rpc !== undefined ? mergedSettings.discord_rpc : true;
    }

    const discordRpcShowLobbyToggle = document.getElementById('discord_rpc_show_lobby');
    if (discordRpcShowLobbyToggle) {
        discordRpcShowLobbyToggle.checked = mergedSettings.discord_rpc_show_lobby !== undefined ? mergedSettings.discord_rpc_show_lobby : true;
    }

    const discordRpcShowMatchesToggle = document.getElementById('discord_rpc_show_matches');
    if (discordRpcShowMatchesToggle) {
        discordRpcShowMatchesToggle.checked = mergedSettings.discord_rpc_show_matches !== undefined ? mergedSettings.discord_rpc_show_matches : true;
    }

    const discordRpcShowProfileToggle = document.getElementById('discord_rpc_show_profile');
    if (discordRpcShowProfileToggle) {
        discordRpcShowProfileToggle.checked = mergedSettings.discord_rpc_show_profile !== undefined ? mergedSettings.discord_rpc_show_profile : true;
    }

    const discordRpcShowLauncherToggle = document.getElementById('discord_rpc_show_launcher');
    if (discordRpcShowLauncherToggle) {
        discordRpcShowLauncherToggle.checked = mergedSettings.discord_rpc_show_launcher !== undefined ? mergedSettings.discord_rpc_show_launcher : true;
    }

    const hideUsernamesToggle = document.getElementById('hide_usernames');
    if (hideUsernamesToggle) {
        hideUsernamesToggle.checked = mergedSettings.hide_usernames || false;
        applyHideUsernames(mergedSettings.hide_usernames || false);
    }


    const ktiersToggle = document.getElementById('Ktiers');
    if (ktiersToggle) {
        ktiersToggle.checked = mergedSettings.ktiersEnabled !== undefined ? mergedSettings.ktiersEnabled : true;
    }

    const keybindBtn = document.getElementById('keybindBtn');
    if (keybindBtn && mergedSettings.menu_keybind) {
        const displayName = formatKeybindDisplay(mergedSettings.menu_keybind);
        keybindBtn.textContent = displayName;
        keybindBtn.style.opacity = '0.8';
        keybindBtn.style.cursor = 'pointer';
    }

    const newsToggle = document.getElementById('newsToggle');
    if (newsToggle) {
        newsToggle.checked = mergedSettings.newsEnabled !== undefined ? mergedSettings.newsEnabled : true;
    }

    const categoryToggles = document.querySelectorAll('.category-toggle');
    categoryToggles.forEach(toggle => {
        const category = toggle.dataset.category;
        if (category && mergedSettings.newsCategories && mergedSettings.newsCategories[category] !== undefined) {
            toggle.checked = mergedSettings.newsCategories[category];
        } else if (category) {
            toggle.checked = true;
        }
    });
}

function formatKeybindDisplay(key) {
    if (!key) return 'Click to set';
    const arrowKeyMap = {
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'ArrowLeft': '←',
        'ArrowRight': '→'
    };
    if (arrowKeyMap[key]) {
        return arrowKeyMap[key];
    }
    return key
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .replace('Shift Right', 'Right Shift')
        .replace('Shift Left', 'Left Shift')
        .replace('Control Right', 'Right Ctrl')
        .replace('Control Left', 'Left Ctrl')
        .replace('Alt Right', 'Right Alt')
        .replace('Alt Left', 'Left Alt')
        .replace('Meta Right', 'Right Win')
        .replace('Meta Left', 'Left Win');
}

function applyHideUsernames(enabled) {
    const cssContent = `
        .nickname,
        .name.profile[data-v-4f4783e0],
        .username[data-v-e3674cae],
        .value[data-v-cb399910],
        .short-id-clipboard[data-v-6d2f629a],
        .teammate-name[data-v-48f745a8],
        .killer-name[data-v-4cc6715c],
        .name-kill[data-v-4cc6715c],
        .short-id[data-v-9744172e] {
            filter: blur(14px) !important;
            transition: filter 0.3s ease;
        }
    `;
    const existingStyle = document.getElementById('hide-usernames-style');
    if (existingStyle) {
        existingStyle.remove();
    }
    if (enabled) {
        const style = document.createElement('style');
        style.id = 'hide-usernames-style';
        style.textContent = cssContent;
        document.head.appendChild(style);
        console.log(' Username hiding enabled');
    } else {
        console.log(' Username hiding disabled');
    }
}

async function getAccounts() {
    try {
        const result = await ipcRenderer.invoke('get-accounts');
        if (result && result.success) {
            return result.accounts || [];
        }
        return [];
    } catch (e) {
        console.error(' Failed to get accounts:', e);
        return [];
    }
}

async function saveAccounts(accounts) {
    try {
        console.log(' Saving accounts to file, count:', accounts.length);
        const result = await ipcRenderer.invoke('save-accounts', accounts);
        if (result && result.success) {
            console.log(' Accounts saved successfully');
            return true;
        } else {
            console.error(' Failed to save accounts:', result?.error);
            return false;
        }
    } catch (e) {
        console.error(' Failed to save accounts:', e);
        return false;
    }
}

async function getActiveAccount() {
    const accounts = await getAccounts();
    const active = accounts.find(a => a.active === true);
    return active || null;
}

async function setActiveAccount(userId) {
    console.log(' Switching to account:', userId);
    const accounts = await getAccounts();
    const accountIndex = accounts.findIndex(a => a.userId === userId);
    if (accountIndex === -1) {
        console.error(' Account not found:', userId);
        return false;
    }
    accounts.forEach(a => a.active = false);
    accounts[accountIndex].active = true;
    const saved = await saveAccounts(accounts);
    if (!saved) {
        console.error(' Failed to save accounts');
        return false;
    }
    const activeAccount = accounts[accountIndex];
    console.log(' Switched to account:', activeAccount.name, '#', activeAccount.tag);
    await ipcRenderer.invoke('save-token', activeAccount.token);
    ipcRenderer.send('update-game-token', activeAccount.token);
    await applyUserProfile(activeAccount);
    await renderAccountList();
    document.dispatchEvent(new CustomEvent('account-switched', { 
        detail: { account: activeAccount }
    }));
    return true;
}

async function removeAccount(userId) {
    console.log(' Removing account:', userId);
    let accounts = await getAccounts();
    const wasActive = accounts.find(a => a.userId === userId)?.active || false;
    accounts = accounts.filter(a => a.userId !== userId);
    await saveAccounts(accounts);
    if (accounts.length === 0) {
        resetUserPill();
        await ipcRenderer.invoke('clear-token');
        ipcRenderer.send('update-game-token', null);
    } else if (wasActive) {
        accounts[0].active = true;
        await saveAccounts(accounts);
        await ipcRenderer.invoke('save-token', accounts[0].token);
        ipcRenderer.send('update-game-token', accounts[0].token);
        await applyUserProfile(accounts[0]);
    } else {
        const active = await getActiveAccount();
        if (active) {
            await applyUserProfile(active);
        }
    }
    await renderAccountList();
}

function updateDropdownData(profile) {
    const nameEl = document.getElementById('dropdownName');
    const tagEl = document.getElementById('dropdownTag');
    const idEl = document.getElementById('dropdownId');
    if (nameEl) nameEl.textContent = profile?.name || 'Guest';
    if (tagEl) tagEl.textContent = profile?.tag || '—';
    if (idEl) idEl.textContent = profile?.userId || '—';
}

async function applyUserProfile(profile) {
    console.log(' Applying user profile:', profile?.name || 'Guest');
    if (!profile) {
        resetUserPill();
        return;
    }
    const tag = profile.tag || '';
    const name = profile.name || '';
    const displayName = name && tag ? `${name}#${tag}` : (name || tag || 'Guest');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userLevelDisplay = document.getElementById('userLevelDisplay');
    const userAvatarIcon = document.getElementById('userAvatarIcon');
    const userAvatarImg = document.getElementById('userAvatarImg');
    const userAvatarWrap = document.getElementById('userAvatarWrap');
    if (userNameDisplay) userNameDisplay.textContent = displayName;
    if (userLevelDisplay) {
        userLevelDisplay.style.display = 'none';
    }
    const avatarData = await getProfileImage(tag);
    if (userAvatarImg) {
        if (avatarData) {
            userAvatarImg.src = avatarData;
            userAvatarImg.style.display = 'block';
            if (userAvatarIcon) userAvatarIcon.style.display = 'none';
            if (userAvatarWrap) {
                userAvatarWrap.style.background = 'transparent';
                userAvatarWrap.style.border = 'none';
            }
        } else {
            userAvatarImg.style.display = 'none';
            if (userAvatarIcon) userAvatarIcon.style.display = '';
            if (userAvatarWrap) {
                userAvatarWrap.style.background = '';
                userAvatarWrap.style.border = '';
            }
        }
    }
    const tokenStatusRow = document.getElementById('tokenStatusRow');
    const tokenStatusName = document.getElementById('tokenStatusName');
    if (tokenStatusRow) tokenStatusRow.style.display = '';
    if (tokenStatusName) tokenStatusName.textContent = displayName;
    updateDropdownData(profile);
}

function resetUserPill() {
    console.log(' Resetting user pill to Guest');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userLevelDisplay = document.getElementById('userLevelDisplay');
    const userAvatarIcon = document.getElementById('userAvatarIcon');
    const userAvatarImg = document.getElementById('userAvatarImg');
    const userAvatarWrap = document.getElementById('userAvatarWrap');
    const tokenStatusRow = document.getElementById('tokenStatusRow');
    if (userNameDisplay) userNameDisplay.textContent = 'Guest';
    if (userLevelDisplay) {
        userLevelDisplay.textContent = '';
        userLevelDisplay.style.display = 'none';
    }
    if (userAvatarImg) {
        userAvatarImg.src = '';
        userAvatarImg.style.display = 'none';
    }
    if (userAvatarIcon) userAvatarIcon.style.display = '';
    if (userAvatarWrap) {
        userAvatarWrap.style.background = '';
        userAvatarWrap.style.border = '';
    }
    if (tokenStatusRow) tokenStatusRow.style.display = 'none';
    updateDropdownData(null);
}

async function renderAccountList() {
    console.log(' Rendering account list...');
    const accountList = document.getElementById('accountList');
    if (!accountList) {
        console.warn(' accountList element not found');
        return;
    }
    const accounts = await getAccounts();
    const active = await getActiveAccount();
    console.log(' Accounts in render:', accounts.length, 'Active:', active?.name || 'none');
    if (accounts.length === 0) {
        accountList.innerHTML = `
            <div class="user-dropdown-item" style="color:#444;font-style:italic;cursor:default;padding:8px 16px;font-size:0.75rem;">
                No accounts saved
                <br>
                <span style="color:#555;font-size:0.65rem;">Login to Kirka to save an account</span>
            </div>
        `;
        return;
    }
    const dropdownElement = document.getElementById('userDropdown');
    const isOpen = dropdownElement && dropdownElement.classList.contains('open');
    const accountPromises = accounts.map(async (acc) => {
        const isActive = active && active.userId === acc.userId;
        const displayName = acc.name && acc.tag ? `${acc.name}#${acc.tag}` : (acc.name || acc.tag || 'Unknown');
        let avatarData = null;
        if (isOpen || isActive) {
            avatarData = await getProfileImage(acc.tag);
            if (acc.tag) {
                dropdownImageLoadTracker[acc.tag] = true;
            }
        } else {
            const cached = await getCachedProfileImage(acc.tag);
            if (cached && cached.data) {
                avatarData = cached.data;
            }
        }
        return `
            <div class="user-dropdown-item account-item ${isActive ? 'active-account' : ''}" 
                 data-userid="${acc.userId}"
                 style="${isActive ? 'background:var(--green-dim);border-left:3px solid var(--green);' : ''} cursor:pointer;padding:6px 12px;display:flex;align-items:center;gap:10px;">
                <div class="account-avatar" style="width:28px;height:28px;border-radius:4px;overflow:hidden;flex-shrink:0;background:var(--bg3);border:1px solid var(--border);">
                    ${avatarData ? `<img src="${avatarData}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;">` : `<i class='fas fa-user' style='font-size:0.7rem;color:var(--text-muted);display:flex;align-items:center;justify-content:center;width:100%;height:100%;'></i>`}
                </div>
                <span class="value" style="flex:1;font-size:0.78rem;color:#ccc;">${displayName}</span>
                ${isActive ? '<span style="color:var(--green);font-size:0.6rem;margin-left:auto;">✓</span>' : ''}
                <button class="remove-account" data-userid="${acc.userId}" style="background:none;border:none;color:#666;cursor:pointer;padding:0 4px;font-size:0.7rem;border-radius:3px;margin-left:4px;">×</button>
            </div>
        `;
    });
    const accountHtml = await Promise.all(accountPromises);
    accountList.innerHTML = accountHtml.join('');
    accountList.querySelectorAll('.account-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            if (e.target.classList.contains('remove-account')) return;
            const userId = item.dataset.userid;
            const active = await getActiveAccount();
            if (active && active.userId !== userId) {
                await setActiveAccount(userId);
            }
            const dropdown = document.getElementById('userDropdown');
            const arrow = document.getElementById('dropdownArrow');
            if (dropdown) dropdown.classList.remove('open');
            if (arrow) arrow.classList.remove('open');
        });
    });
    accountList.querySelectorAll('.remove-account').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const userId = btn.dataset.userid;
            if (confirm('Remove this account?')) {
                await removeAccount(userId);
            }
        });
    });
    setTimeout(() => {
        applyKTiersBadge();
    }, 100);
}

function initUserDropdown() {
    const userPill = document.getElementById('userPill');
    const dropdown = document.getElementById('userDropdown');
    const arrow = document.getElementById('dropdownArrow');
    if (!userPill || !dropdown) {
        console.warn(' User pill or dropdown not found');
        return;
    }
    const newUserPill = userPill.cloneNode(true);
    userPill.parentNode.replaceChild(newUserPill, userPill);
    const finalUserPill = document.getElementById('userPill');
    const finalDropdown = document.getElementById('userDropdown');
    const finalArrow = document.getElementById('dropdownArrow');
    finalUserPill.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        finalDropdown.classList.toggle('open');
        if (finalArrow) finalArrow.classList.toggle('open');
        if (finalDropdown.classList.contains('open')) {
            dropdownImageLoadTracker.clear();
            renderAccountList();
        }
    });
    document.addEventListener('click', (e) => {
        if (!finalUserPill.contains(e.target) && !finalDropdown.contains(e.target)) {
            finalDropdown.classList.remove('open');
            if (finalArrow) finalArrow.classList.remove('open');
        }
    });
    const logoutBtn = document.getElementById('dropdownLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const active = await getActiveAccount();
            if (active) {
                if (confirm(`Remove account ${active.name}#${active.tag}?`)) {
                    await removeAccount(active.userId);
                }
            }
            finalDropdown.classList.remove('open');
            if (finalArrow) finalArrow.classList.remove('open');
        });
    }
    console.log(' User dropdown initialized');
}

function initTokenListener() {
    ipcRenderer.on('token-updated', async (event, token) => {
        console.log(' Token updated from game');
        await renderAccountList();
        const active = await getActiveAccount();
        if (active) {
            await applyUserProfile(active);
        }
    });
    ipcRenderer.on('accounts-updated', async (event, accounts) => {
        console.log(' Accounts updated from main process');
        await renderAccountList();
        const active = await getActiveAccount();
        if (active) {
            await applyUserProfile(active);
        }
    });
}

function initKeybindButton() {
    const keybindBtn = document.getElementById('keybindBtn');
    if (!keybindBtn) return;
    loadSettings().then(settings => {
        if (settings && settings.menu_keybind) {
            const displayName = formatKeybindDisplay(settings.menu_keybind);
            keybindBtn.textContent = displayName;
            keybindBtn.style.opacity = '0.8';
            keybindBtn.style.cursor = 'pointer';
        }
    });
    let listening = false;
    let timeoutId = null;
    keybindBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (listening) {
            listening = false;
            clearTimeout(timeoutId);
            this.textContent = 'Click to set';
            this.style.opacity = '0.6';
            this.style.cursor = 'default';
            this.style.borderColor = '';
            this.style.background = '';
            console.log('[Keybind] Cancelled');
            return;
        }
        listening = true;
        this.textContent = 'Press a key...';
        this.style.opacity = '1';
        this.style.cursor = 'pointer';
        this.style.borderColor = 'var(--green)';
        this.style.background = 'rgba(26, 142, 80, 0.1)';
        console.log('[Keybind] Listening for key...');
        const keydownHandler = function(event) {
            event.preventDefault();
            event.stopPropagation();
            let key = event.code;
            if (key === 'ShiftLeft' || key === 'ShiftRight' || 
                key === 'ControlLeft' || key === 'ControlRight' ||
                key === 'AltLeft' || key === 'AltRight' ||
                key === 'MetaLeft' || key === 'MetaRight' ||
                key === 'CapsLock' || key === 'NumLock' ||
                key === 'ScrollLock') {
            } else if (key.startsWith('F') && key.length <= 3) {
            } else if (key.startsWith('Key')) {
            } else if (key.startsWith('Digit')) {
            } else if (key === 'Space') {
            } else if (key === 'Escape') {
            } else {
                return;
            }
            const displayName = formatKeybindDisplay(key);
            loadSettings().then(async settings => {
                settings.menu_keybind = key;
                await saveSettings(settings);
                console.log('[Keybind] Saved keybind:', key);
            });
            keybindBtn.textContent = displayName;
            keybindBtn.style.opacity = '0.8';
            keybindBtn.style.cursor = 'pointer';
            keybindBtn.style.borderColor = '';
            keybindBtn.style.background = '';
            document.removeEventListener('keydown', keydownHandler);
            clearTimeout(timeoutId);
            listening = false;
            console.log('[Keybind] Keybind set to:', key);
        };
        document.addEventListener('keydown', keydownHandler);
        timeoutId = setTimeout(() => {
            if (listening) {
                listening = false;
                document.removeEventListener('keydown', keydownHandler);
                keybindBtn.textContent = 'Click to set';
                keybindBtn.style.opacity = '0.6';
                keybindBtn.style.cursor = 'default';
                keybindBtn.style.borderColor = '';
                keybindBtn.style.background = '';
                console.log('[Keybind] Timeout - cancelled');
            }
        }, 5000);
    });
    console.log('[Keybind] Keybind button initialized');
}

function initDirectionKeybindButtons() {
    const directionButtons = [
        { id: 'keybindup', setting: 'keybind_up', direction: 'up' },
        { id: 'keybinddown', setting: 'keybind_down', direction: 'down' },
        { id: 'keybindleft', setting: 'keybind_left', direction: 'left' },
        { id: 'keybindright', setting: 'keybind_right', direction: 'right' }
    ];
    directionButtons.forEach(({ id, setting, direction }) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        loadSettings().then(settings => {
            if (settings && settings[setting]) {
                btn.textContent = formatKeybindDisplay(settings[setting]);
                activeKeybinds[direction] = settings[setting];
            }
        });
        let listening = false;
        let timeoutId = null;
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (listening) {
                listening = false;
                clearTimeout(timeoutId);
                this.textContent = 'Click to set';
                this.style.opacity = '0.6';
                this.style.cursor = 'default';
                this.style.borderColor = '';
                this.style.background = '';
                console.log(`[Keybind ${id}] Cancelled`);
                return;
            }
            listening = true;
            this.textContent = 'Press a key...';
            this.style.opacity = '1';
            this.style.cursor = 'pointer';
            this.style.borderColor = 'var(--green)';
            this.style.background = 'rgba(26, 142, 80, 0.1)';
            console.log(`[Keybind ${id}] Listening for key...`);
            const keydownHandler = (event) => {
                event.preventDefault();
                event.stopPropagation();
                let key = event.code;
                if (key === 'ArrowUp' || key === 'ArrowDown' || 
                    key === 'ArrowLeft' || key === 'ArrowRight') {
                }
                else if (key === 'ShiftLeft' || key === 'ShiftRight' || 
                    key === 'ControlLeft' || key === 'ControlRight' ||
                    key === 'AltLeft' || key === 'AltRight' ||
                    key === 'MetaLeft' || key === 'MetaRight' ||
                    key === 'CapsLock' || key === 'NumLock' ||
                    key === 'ScrollLock') {
                } else if (key.startsWith('F') && key.length <= 3) {
                } else if (key.startsWith('Key')) {
                } else if (key.startsWith('Digit')) {
                } else if (key === 'Space') {
                } else if (key === 'Escape') {
                } else if (key === 'Enter') {
                } else if (key === 'Tab') {
                } else if (key.startsWith('Numpad')) {
                } else {
                    return;
                }
                const displayName = formatKeybindDisplay(key);
                loadSettings().then(async settings => {
                    settings[setting] = key;
                    await saveSettings(settings);
                    activeKeybinds[direction] = key;
                    console.log(`[Keybind ${id}] Saved keybind:`, key);
                });
                btn.textContent = displayName;
                btn.style.opacity = '0.8';
                btn.style.cursor = 'pointer';
                btn.style.borderColor = '';
                btn.style.background = '';
                document.removeEventListener('keydown', keydownHandler);
                clearTimeout(timeoutId);
                listening = false;
                console.log(`[Keybind ${id}] Keybind set to:`, key);
            };
            document.addEventListener('keydown', keydownHandler);
            timeoutId = setTimeout(() => {
                if (listening) {
                    listening = false;
                    document.removeEventListener('keydown', keydownHandler);
                    btn.textContent = 'Click to set';
                    btn.style.opacity = '0.6';
                    btn.style.cursor = 'default';
                    btn.style.borderColor = '';
                    btn.style.background = '';
                    console.log(`[Keybind ${id}] Timeout - cancelled`);
                }
            }, 5000);
        });
    });
    console.log('[Keybind] Direction keybind buttons initialized');
}

function sendMessageToGame(message) {
    try {
        console.log('[Chat] Attempting to send message:', message);
        const chatInput = document.querySelector('input[placeholder*="chat"], input[placeholder*="Chat"], .chat-input, textarea.chat-input, input[class*="chat"], textarea[class*="chat"]');
        if (chatInput) {
            console.log('[Chat] Found chat input');
            chatInput.focus();
            chatInput.value = message;
            chatInput.dispatchEvent(new Event('input', { bubbles: true }));
            chatInput.dispatchEvent(new Event('change', { bubbles: true }));
            const sendButton = document.querySelector('button[type="submit"], .send-btn, .chat-send, button:has(.fa-paper-plane), button:has(.fa-send), .send-message-btn');
            if (sendButton) {
                console.log('[Chat] Found send button, clicking');
                setTimeout(() => {
                    sendButton.click();
                    console.log('[Chat] Message sent via button click');
                }, 50);
            } else {
                console.log('[Chat] No send button found, trying Enter key');
                setTimeout(() => {
                    chatInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
                    chatInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
                    console.log('[Chat] Message sent via Enter key');
                }, 50);
            }
            return true;
        } else {
            console.log('[Chat] No chat input found');
            const chatContainer = document.querySelector('.chat-container, .chat-box, .chat-panel, [class*="chat"]');
            if (chatContainer) {
                const input = chatContainer.querySelector('input, textarea');
                if (input) {
                    console.log('[Chat] Found input in chat container');
                    input.focus();
                    input.value = message;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    const btn = chatContainer.querySelector('button');
                    if (btn) {
                        setTimeout(() => btn.click(), 50);
                    } else {
                        setTimeout(() => {
                            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
                        }, 50);
                    }
                    return true;
                }
            }
            return false;
        }
    } catch (error) {
        console.error('[Chat] Error sending message:', error);
        return false;
    }
}

function initDirectionKeyListener() {
    let lastMessageTime = 0;
    const messageCooldown = 200;
    document.addEventListener('keydown', (event) => {
        const key = event.code;
        let direction = null;
        if (activeKeybinds.up && key === activeKeybinds.up) {
            direction = 'up';
        } else if (activeKeybinds.down && key === activeKeybinds.down) {
            direction = 'down';
        } else if (activeKeybinds.left && key === activeKeybinds.left) {
            direction = 'left';
        } else if (activeKeybinds.right && key === activeKeybinds.right) {
            direction = 'right';
        }
        if (direction) {
            event.preventDefault();
            event.stopPropagation();
            const now = Date.now();
            if (now - lastMessageTime < messageCooldown) {
                console.log(`[Direction Key] ${direction} - Cooldown, ignoring`);
                return;
            }
            lastMessageTime = now;
            loadSettings().then(settings => {
                let message = '';
                switch(direction) {
                    case 'up':
                        message = settings.endgame_message_up || 'Up';
                        break;
                    case 'down':
                        message = settings.endgame_message_down || 'Down';
                        break;
                    case 'left':
                        message = settings.endgame_message_left || 'Left';
                        break;
                    case 'right':
                        message = settings.endgame_message_right || 'Right';
                        break;
                }
                console.log(`[Direction Key] ${direction} key pressed, sending message: "${message}"`);
                const sent = sendMessageToGame(message);
                if (!sent) {
                    console.log('[Direction Key] Direct send failed, trying IPC');
                    ipcRenderer.send('send-chat-message', message);
                }
            });
        }
    });
    console.log('[Direction Keys] Global key listener initialized');
}

function initChatMessageHandler() {
    ipcRenderer.on('execute-chat-message', (event, message) => {
        console.log('[Renderer] Executing chat message via IPC:', message);
        sendMessageToGame(message);
    });
    ipcRenderer.on('chat-message-sent', (event, success) => {
        if (success) {
            console.log('[Chat] Message sent successfully');
        } else {
            console.log('[Chat] Failed to send message');
        }
    });
    console.log('[Chat] Chat message handler initialized');
}

async function initSettings() {
    console.log(' Initializing settings...');
    const settings = await loadSettings();
    applySettingsToUI(settings);
    
    const proxySelect = document.getElementById('base_url');
    if (proxySelect) {
        proxySelect.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.proxy = proxySelect.value;
            await saveSettings(currentSettings);
            console.log(' Proxy updated to:', proxySelect.value);
        });
    }

    const unlimitedFpsToggle = document.getElementById('unlimited_fps');
    if (unlimitedFpsToggle) {
        unlimitedFpsToggle.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.unlimited_fps = unlimitedFpsToggle.checked;
            await saveSettings(currentSettings);
            console.log(' Unlimited FPS set to:', unlimitedFpsToggle.checked);
        });
    }
    
    const endgameMessageInput = document.getElementById('endgame_message_text');
    if (endgameMessageInput) {
        endgameMessageInput.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.endgame_message_text = endgameMessageInput.value || 'Good Game';
            await saveSettings(currentSettings);
            console.log(' End game message set to:', currentSettings.endgame_message_text);
        });
    }
    
    const messageUpInput = document.getElementById('message_up');
    if (messageUpInput) {
        messageUpInput.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.endgame_message_up = messageUpInput.value || 'Up';
            await saveSettings(currentSettings);
            console.log(' Up message set to:', currentSettings.endgame_message_up);
        });
    }
    
    const messageDownInput = document.getElementById('message_down');
    if (messageDownInput) {
        messageDownInput.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.endgame_message_down = messageDownInput.value || 'Down';
            await saveSettings(currentSettings);
            console.log(' Down message set to:', currentSettings.endgame_message_down);
        });
    }
    
    const messageLeftInput = document.getElementById('message_left');
    if (messageLeftInput) {
        messageLeftInput.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.endgame_message_left = messageLeftInput.value || 'Left';
            await saveSettings(currentSettings);
            console.log(' Left message set to:', currentSettings.endgame_message_left);
        });
    }
    
    const messageRightInput = document.getElementById('message_right');
    if (messageRightInput) {
        messageRightInput.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.endgame_message_right = messageRightInput.value || 'Right';
            await saveSettings(currentSettings);
            console.log(' Right message set to:', currentSettings.endgame_message_right);
        });
    }
    
    const inProcessGpuToggle = document.getElementById('in_process_gpu');
    if (inProcessGpuToggle) {
        inProcessGpuToggle.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.in_process_gpu = inProcessGpuToggle.checked;
            await saveSettings(currentSettings);
            console.log(' In-process GPU set to:', inProcessGpuToggle.checked);
        });
    }

    const discordRpcToggle = document.getElementById('discord_rpc');
    if (discordRpcToggle) {
        discordRpcToggle.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.discord_rpc = discordRpcToggle.checked;
            await saveSettings(currentSettings);
            console.log(' Discord RPC set to:', discordRpcToggle.checked);
        });
    }

    const discordRpcShowLobbyToggle = document.getElementById('discord_rpc_show_lobby');
    if (discordRpcShowLobbyToggle) {
        discordRpcShowLobbyToggle.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.discord_rpc_show_lobby = discordRpcShowLobbyToggle.checked;
            await saveSettings(currentSettings);
            console.log(' Discord RPC show lobby set to:', discordRpcShowLobbyToggle.checked);
        });
    }

    const discordRpcShowMatchesToggle = document.getElementById('discord_rpc_show_matches');
    if (discordRpcShowMatchesToggle) {
        discordRpcShowMatchesToggle.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.discord_rpc_show_matches = discordRpcShowMatchesToggle.checked;
            await saveSettings(currentSettings);
            console.log(' Discord RPC show matches set to:', discordRpcShowMatchesToggle.checked);
        });
    }

    const discordRpcShowProfileToggle = document.getElementById('discord_rpc_show_profile');
    if (discordRpcShowProfileToggle) {
        discordRpcShowProfileToggle.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.discord_rpc_show_profile = discordRpcShowProfileToggle.checked;
            await saveSettings(currentSettings);
            console.log(' Discord RPC show profile set to:', discordRpcShowProfileToggle.checked);
        });
    }

    const discordRpcShowLauncherToggle = document.getElementById('discord_rpc_show_launcher');
    if (discordRpcShowLauncherToggle) {
        discordRpcShowLauncherToggle.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.discord_rpc_show_launcher = discordRpcShowLauncherToggle.checked;
            await saveSettings(currentSettings);
            console.log(' Discord RPC show launcher set to:', discordRpcShowLauncherToggle.checked);
        });
    }

    const hideUsernamesToggle = document.getElementById('hide_usernames');
    if (hideUsernamesToggle) {
        hideUsernamesToggle.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.hide_usernames = hideUsernamesToggle.checked;
            await saveSettings(currentSettings);
            applyHideUsernames(currentSettings.hide_usernames);
            console.log(' Hide usernames set to:', currentSettings.hide_usernames);
        });
    }


    const ktiersToggle = document.getElementById('Ktiers');
    if (ktiersToggle) {
        ktiersToggle.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.ktiersEnabled = ktiersToggle.checked;
            await saveSettings(currentSettings);
            console.log(' KTiers enabled set to:', ktiersToggle.checked);

            applyKTiersBadge();
        });
    }

    const newsToggle = document.getElementById('newsToggle');
    if (newsToggle) {
        newsToggle.addEventListener('change', async () => {
            const currentSettings = await loadSettings();
            currentSettings.newsEnabled = newsToggle.checked;
            await saveSettings(currentSettings);
            console.log(' News enabled:', newsToggle.checked);
            loadNews();
        });
    }

    const categoryToggles = document.querySelectorAll('.category-toggle');
    categoryToggles.forEach(toggle => {
        toggle.addEventListener('change', async () => {
            const category = toggle.dataset.category;
            const currentSettings = await loadSettings();
            if (!currentSettings.newsCategories) {
                currentSettings.newsCategories = {
                    general: true,
                    event: true,
                    alert: true,
                    promotional: true
                };
            }
            currentSettings.newsCategories[category] = toggle.checked;
            await saveSettings(currentSettings);
            console.log(` Category ${category} set to:`, toggle.checked);
            loadNews();
        });
    });

    initKeybindButton();
    initDirectionKeybindButtons();
    initDirectionKeyListener();
    initChatMessageHandler();
    initKTiers();

    console.log(' Settings initialized');
}

function initWindowControls() {
    const minimizeBtn = document.getElementById('minimize-btn');
    const closeBtn = document.getElementById('close-btn');
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log(' Minimize clicked');
            ipcRenderer.send('window-minimize');
        });
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log(' Close clicked');
            ipcRenderer.send('window-close');
        });
    }
}

async function fetchVersion() {
    try {
        const res = await fetch('https://raw.githubusercontent.com/OBS-Akuma/Ubuntu-client/refs/heads/main/package.json');
        const data = await res.json();
        const versionDisplay = document.getElementById('versionDisplay');
        const versionTag = document.getElementById('version-tag');
        const version = data.version || '0.0.0';
        if (versionDisplay) versionDisplay.textContent = `v${version}`;
        if (versionTag) versionTag.textContent = `v${version}`;
    } catch(e) {
        const versionDisplay = document.getElementById('versionDisplay');
        const versionTag = document.getElementById('version-tag');
        if (versionDisplay) versionDisplay.textContent = 'v?.?.?';
        if (versionTag) versionTag.textContent = 'v?.?.?';
    }
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabs = document.querySelectorAll('.tab-content');
    function switchTab(id) {
        tabs.forEach(t => t.classList.remove('active'));
        tabBtns.forEach(b => b.classList.remove('active'));
        const targetTab = document.getElementById(`${id}-tab`);
        if (targetTab) targetTab.classList.add('active');
        const targetBtn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
        if (targetBtn) targetBtn.classList.add('active');
        if (id === 'activity') {
            loadActivityData();
        }
    }
    tabBtns.forEach(b => {
        b.addEventListener('click', () => switchTab(b.dataset.tab));
    });
}

function initVersionTabs() {
    const verTabs = document.querySelectorAll('.ver-tab');
    verTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            verTabs.forEach(v => v.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function initLaunchAnimation() {
    const launchBtn = document.getElementById('launchBtn');
    const mainUI = document.querySelector('.launcher');
    const iconLayer = document.getElementById('iconLayer');
    const flashOverlay = document.getElementById('flashOverlay');
    if (!launchBtn) return;
    const iconSVGs = [
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A8E50" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C12 2 7 6 7 12c0 2.5 1 4.5 2.5 6L12 22l2.5-4C16 16.5 17 14.5 17 12c0-6-5-10-5-10z"/><circle cx="12" cy="12" r="2" fill="#1A8E50" stroke="none"/><path d="M7.5 15.5L5 18M16.5 15.5L19 18"/></svg>`,
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A8E50" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="12" rx="4"/><path d="M7 13h4M9 11v4"/><circle cx="16" cy="12" r="1" fill="#1A8E50" stroke="none"/><circle cx="15" cy="15" r="1" fill="#1A8E50" stroke="none"/></svg>`,
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A8E50" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 9 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9 9 9"/></svg>`,
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A8E50" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A8E50" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-4 9-8 11C8 20 4 16 4 11V5z"/><path d="M9 12l2 2 4-4"/></svg>`,
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A8E50" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>`,
    ];
    function spawnParticle(x, y, color) {
        const p = document.createElement('div');
        p.className = 'anim-particle';
        const size = 3 + Math.random() * 7;
        p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${color};border-radius:50%;position:fixed;`;
        document.body.appendChild(p);
        const angle = Math.random() * Math.PI * 2;
        const dist = 100 + Math.random() * 220;
        const dur = 600 + Math.random() * 400;
        p.animate([
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0)`, opacity: 0 }
        ], { duration: dur, easing: 'cubic-bezier(0.2,0.9,0.4,1)', fill: 'forwards' });
        setTimeout(() => p.remove(), dur + 50);
    }
    function spawnRipple(x, y) {
        const r = document.createElement('div');
        r.className = 'ripple-ring';
        r.style.cssText = `left:${x}px;top:${y}px;`;
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 900);
    }
    launchBtn.addEventListener('click', () => {
        launchBtn.disabled = true;
        const rect = launchBtn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        spawnRipple(cx, cy);
        const created = [];
        iconSVGs.forEach(svg => {
            const el = document.createElement('div');
            el.className = 'fly-icon';
            el.innerHTML = svg;
            el.style.left = `${cx - 16}px`;
            el.style.top = `${cy - 16}px`;
            if (iconLayer) iconLayer.appendChild(el);
            created.push(el);
        });
        created.forEach((el, i) => {
            const angle = (Math.PI * 2 / created.length) * i - Math.PI / 2;
            const radius = 120 + Math.random() * 50;
            const tx = Math.cos(angle) * radius;
            const ty = Math.sin(angle) * radius;
            const rot = (Math.random() - 0.5) * 60;
            setTimeout(() => {
                el.style.opacity = '1';
                el.style.transition = `transform 0.65s cubic-bezier(0.22,1,0.36,1), opacity 0.3s`;
                el.style.transform = `translate(${tx}px,${ty}px) rotate(${rot}deg) scale(1)`;
            }, i * 30);
        });
        setTimeout(() => {
            created.forEach(el => {
                el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s';
                el.style.transform = 'translate(0px,0px) rotate(360deg) scale(1.2)';
                el.style.opacity = '0.95';
            });
        }, 800);
        setTimeout(() => {
            spawnRipple(cx, cy);
            spawnRipple(cx, cy);
        }, 850);
        setTimeout(() => {
            created.forEach((el, i) => {
                const angle = (Math.PI * 2 / created.length) * i + Math.random() * 0.8 - 0.4;
                const dist = 380 + Math.random() * 180;
                el.style.transition = 'transform 0.75s cubic-bezier(0.2,0.8,0.4,1.1), opacity 0.45s';
                el.style.transform = `translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist}px) rotate(${(Math.random() - 0.5) * 720}deg) scale(0.3)`;
                el.style.opacity = '0';
            });
            const colors = ['#1A8E50', '#14703e', '#00cc66', '#ffffff', '#aaffcc'];
            for (let i = 0; i < 50; i++) {
                setTimeout(() => spawnParticle(cx, cy, colors[Math.floor(Math.random() * colors.length)]), Math.random() * 200);
            }
            if (flashOverlay) {
                flashOverlay.style.opacity = '0.12';
                setTimeout(() => { flashOverlay.style.opacity = '0'; }, 180);
            }
            document.body.animate([
                { transform: 'translate(0,0)' },
                { transform: 'translate(-6px,3px)' },
                { transform: 'translate(5px,-4px)' },
                { transform: 'translate(-3px,2px)' },
                { transform: 'translate(2px,-1px)' },
                { transform: 'translate(0,0)' }
            ], { duration: 340, easing: 'ease-out' });
            setTimeout(() => { if (mainUI) mainUI.classList.add('fade-out'); }, 300);
        }, 1400);
        setTimeout(() => {
            created.forEach(el => el.remove());
            ipcRenderer.send('launch-game');
            setTimeout(() => {
                launchBtn.disabled = false;
                launchBtn.innerHTML = '<i class="fas fa-play" style="font-size:0.9rem;"></i> Play Now';
            }, 3000);
        }, 2800);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatNewsDate(ts) {
    if (!ts) return '';
    const ms = ts > 1e12 ? ts : ts * 1000;
    const d = new Date(ms);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const CATEGORY_COLORS = {
    general: '#1A8E50',
    event: '#c78c14',
    alert: '#b03a3a',
    promotional: '#3a6eb0',
};

async function renderNews() {
    const newsScroll = document.getElementById('newsScroll');
    if (!newsScroll) return;
    const settings = await loadSettings();
    const newsEnabled = settings.newsEnabled !== undefined ? settings.newsEnabled : true;
    const categoryFilters = settings.newsCategories || {
        general: true,
        event: true,
        alert: true,
        promotional: true
    };
    if (!newsEnabled || !window._newsItems) {
        if (!newsEnabled) {
            newsScroll.innerHTML = `<div class="news-empty">News is disabled. Enable it in settings.</div>`;
        } else {
            newsScroll.innerHTML = `<div class="news-loading"><i class="fas fa-spinner fa-pulse"></i> Loading news...</div>`;
        }
        return;
    }
    const filtered = window._newsItems.filter(n => {
        return categoryFilters[n.category] !== false;
    });
    if (!filtered.length) {
        newsScroll.innerHTML = `<div class="news-empty">No news available for selected categories.</div>`;
        return;
    }
    newsScroll.innerHTML = filtered.map(n => {
        const catColor = CATEGORY_COLORS[n.category] || '#1A8E50';
        const dateStr = formatNewsDate(n.updatedAt);
        let imgHtml;
        if (n.imgType === 'banner' && n.img) {
            imgHtml = `<div class="news-banner-wrap"><img class="news-banner" src="${escapeHtml(n.img)}" alt="" onerror="this.parentElement.style.display='none'"></div>`;
        } else if (n.img) {
            imgHtml = `<img class="news-icon-img" src="${escapeHtml(n.img)}" alt="" onerror="this.style.display='none'">`;
        } else {
            imgHtml = `<div class="news-icon-fallback"><i class="fas fa-newspaper"></i></div>`;
        }
        const isIcon = n.imgType === 'icon' || !n.imgType;
        return `
            <div class="news-item ${isIcon ? 'news-item--icon' : 'news-item--banner'}">
                ${isIcon ? `<div class="news-item-top">
                    ${imgHtml}
                    <div class="news-item-header">
                        <span class="news-cat-badge" style="color:${catColor};border-color:${catColor}20;background:${catColor}18;">${escapeHtml(n.category)}</span>
                        <div class="news-title">${escapeHtml(n.title)}</div>
                    </div>
                </div>` : `${imgHtml}<div class="news-item-header" style="padding:0 10px 0;">
                    <span class="news-cat-badge" style="color:${catColor};border-color:${catColor}20;background:${catColor}18;">${escapeHtml(n.category)}</span>
                    <div class="news-title">${escapeHtml(n.title)}</div>
                </div>`}
                <div class="news-content">${escapeHtml(n.content)}</div>
                <div class="news-footer">
                    ${dateStr ? `<span class="news-date">${dateStr}</span>` : ''}
                    ${n.link ? `<a class="news-btn" href="${escapeHtml(n.link)}" target="_blank">View Post <i class="fas fa-external-link-alt" style="font-size:0.6rem;"></i></a>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function loadNews() {
    const newsScroll = document.getElementById('newsScroll');
    if (!newsScroll) return;
    newsScroll.innerHTML = `<div class="news-loading"><i class="fas fa-spinner fa-pulse"></i> Loading news...</div>`;
    try {
        const res = await fetch('https://raw.githubusercontent.com/OBS-Akuma/Ubuntu-client/refs/heads/main/api/news.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        window._newsItems = await res.json();
        await renderNews();
    } catch(e) {
        console.error('News fetch error:', e);
        newsScroll.innerHTML = `<div class="news-empty">Failed to load news.</div>`;
    }
}

async function loadFeatures() {
    const featuresGrid = document.getElementById('featuresGrid');
    const featuresLoading = document.getElementById('featuresLoading');
    const featuresErrorDiv = document.getElementById('featuresError');
    const featuresNoResults = document.getElementById('featuresNoResults');
    if (!featuresGrid) return;
    try {
        const res = await fetch('assets/features.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const features = await res.json();
        if (featuresLoading) featuresLoading.style.display = 'none';
        if (features && features.length) {
            featuresGrid.innerHTML = features.map(f => {
                const featureItems = f.features && f.features.length ? f.features : [];
                return `
                    <div class="feature-card">
                        <div class="feature-header">
                            <span class="feature-name">${escapeHtml(f.name)}</span>
                            <span class="feature-category">${escapeHtml(f.category)}</span>
                        </div>
                        <div class="feature-description">${escapeHtml(f.description)}</div>
                        ${featureItems.length ? `<div class="feature-list">${featureItems.map(item => `<span class="feature-list-item">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
                    </div>
                `;
            }).join('');
            if (featuresErrorDiv) featuresErrorDiv.style.display = 'none';
        } else {
            featuresGrid.innerHTML = '';
            if (featuresNoResults) featuresNoResults.style.display = 'block';
        }
    } catch(e) {
        console.error('Features fetch error:', e);
        if (featuresLoading) featuresLoading.style.display = 'none';
        if (featuresErrorDiv) featuresErrorDiv.style.display = 'block';
        if (featuresGrid) featuresGrid.innerHTML = '';
    }
}

async function loadTools() {
    const toolsGrid = document.getElementById('toolsGrid');
    const toolsLoading = document.getElementById('toolsLoading');
    const toolsErrorDiv = document.getElementById('toolsError');
    const toolsNoResultsSpan = document.getElementById('toolsNoResults');
    if (!toolsGrid) return;
    try {
        const res = await fetch('assets/tools.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tools = await res.json();
        if (toolsLoading) toolsLoading.style.display = 'none';
        if (tools && tools.length) {
            toolsGrid.innerHTML = tools.map(tool => {
                let iconSrc = tool.iconUrl || tool.icon || 'https://placehold.co/38x38/1a1a1a/1A8E50';
                const toolName = tool.name || 'Tool';
                const toolDesc = tool.description || 'Useful resource';
                const toolUrl = tool.url || tool.src || '#';
                return `
                    <div class="tool-card">
                        <a href="${toolUrl}" target="_blank" class="tool-link">
                            <img src="${iconSrc}" class="tool-icon" onerror="this.src='https://placehold.co/38x38/1a1a1a/1A8E50'">
                            <div>
                                <div class="tool-name">${escapeHtml(toolName)}</div>
                                <div class="tool-desc">${escapeHtml(toolDesc)}</div>
                            </div>
                            <div class="tool-arrow"><i class="fas fa-external-link-alt"></i></div>
                        </a>
                    </div>
                `;
            }).join('');
            if (toolsErrorDiv) toolsErrorDiv.style.display = 'none';
        } else {
            toolsGrid.innerHTML = '';
            if (toolsNoResultsSpan) toolsNoResultsSpan.style.display = 'block';
        }
    } catch(e) {
        console.error('Tools fetch error:', e);
        if (toolsLoading) toolsLoading.style.display = 'none';
        if (toolsErrorDiv) toolsErrorDiv.style.display = 'block';
        if (toolsGrid) toolsGrid.innerHTML = '';
    }
}

async function loadClients() {
    const clientsGrid = document.getElementById('clientsGrid');
    const clientsLoading = document.getElementById('clientsLoading');
    const clientsErrorDiv = document.getElementById('clientsError');
    const clientsNoResults = document.getElementById('clientsNoResults');
    if (!clientsGrid) return;
    try {
        const res = await fetch('https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/clients.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const clients = await res.json();
        if (clientsLoading) clientsLoading.style.display = 'none';
        if (clients && clients.length) {
            clientsGrid.innerHTML = clients.map(c => {
                const platformsList = c.platforms && c.platforms.length ? c.platforms.join(', ') : 'multi-platform';
                const devStatus = c.development || 'unknown';
                const isInactive = (devStatus === 'inactive');
                const devBadgeClass = isInactive ? 'badge inactive-dev' : (devStatus === 'active' ? 'badge active' : 'badge');
                return `
                    <div class="client-card">
                        <a href="${c.downloadUrl}" target="_blank" class="client-link">
                            <img src="${c.icon}" class="client-icon-img" onerror="this.src='https://placehold.co/32x32/1a1a1a/1A8E50'">
                            <div>
                                <div class="client-name-card">${escapeHtml(c.name)}</div>
                                <div class="client-owner">by ${escapeHtml(c.owner)}</div>
                                <div class="client-meta">
                                    <span class="${devBadgeClass}">${devStatus}</span>
                                    <span class="badge">${escapeHtml(platformsList)}</span>
                                    <span class="badge">${c.source || 'source'}</span>
                                </div>
                            </div>
                            <div class="tool-arrow"><i class="fas fa-external-link-alt"></i></div>
                        </a>
                    </div>
                `;
            }).join('');
            if (clientsNoResults) clientsNoResults.style.display = 'none';
            if (clientsErrorDiv) clientsErrorDiv.style.display = 'none';
        } else {
            clientsGrid.innerHTML = '';
            if (clientsNoResults) clientsNoResults.style.display = 'block';
        }
    } catch(e) {
        console.error('Clients fetch error:', e);
        if (clientsLoading) clientsLoading.style.display = 'none';
        if (clientsErrorDiv) clientsErrorDiv.style.display = 'block';
        if (clientsGrid) clientsGrid.innerHTML = '';
    }
}

function initSearch() {
    const searchInput = document.getElementById('globalSearch');
    const clearBtn = document.getElementById('searchClearBtn');
    if (!searchInput) return;
    function filterItems() {
        const q = searchInput.value.toLowerCase().trim();
        const toolCards = document.querySelectorAll('#toolsGrid .tool-card');
        const clientCards = document.querySelectorAll('#clientsGrid .client-card');
        const featureCards = document.querySelectorAll('#featuresGrid .feature-card');
        toolCards.forEach(card => {
            card.style.display = (!q || card.innerText.toLowerCase().includes(q)) ? '' : 'none';
        });
        clientCards.forEach(card => {
            card.style.display = (!q || card.innerText.toLowerCase().includes(q)) ? '' : 'none';
        });
        featureCards.forEach(card => {
            card.style.display = (!q || card.innerText.toLowerCase().includes(q)) ? '' : 'none';
        });
        const toolsNoResultsDiv = document.getElementById('toolsNoResults');
        if (toolsNoResultsDiv && q) {
            const anyVisible = Array.from(toolCards).some(c => c.style.display !== 'none');
            toolsNoResultsDiv.style.display = anyVisible ? 'none' : 'block';
        } else if (toolsNoResultsDiv) {
            toolsNoResultsDiv.style.display = 'none';
        }
        const featuresNoResultsDiv = document.getElementById('featuresNoResults');
        if (featuresNoResultsDiv && q) {
            const anyVisible = Array.from(featureCards).some(c => c.style.display !== 'none');
            featuresNoResultsDiv.style.display = anyVisible ? 'none' : 'block';
        } else if (featuresNoResultsDiv) {
            featuresNoResultsDiv.style.display = 'none';
        }
    }
    searchInput.addEventListener('input', filterItems);
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            filterItems();
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log(' DOM loaded, initializing...');
    const accounts = await getAccounts();
    console.log(' Accounts loaded:', accounts.length);
    if (accounts.length > 0) {
        const active = accounts.find(a => a.active === true);
        if (active) {
            console.log(' Active account found:', active.name, '#', active.tag);
            await applyUserProfile(active);
        } else {
            accounts[0].active = true;
            await saveAccounts(accounts);
            await ipcRenderer.invoke('save-token', accounts[0].token);
            await applyUserProfile(accounts[0]);
        }
    } else {
        resetUserPill();
    }
    fetchVersion();
    initTabs();
    initVersionTabs();
    initLaunchAnimation();
    initTokenListener();
    initWindowControls();
    initUserDropdown();
    await initSettings();
    setTimeout(() => {
        renderAccountList();
    }, 100);
    loadNews();
    loadFeatures();
    loadTools();
    loadClients();
    initSearch();
    console.log(' Loading activity data on startup...');
    setTimeout(() => {
        loadActivityData();
    }, 500);
    console.log(' Initialization complete');
});