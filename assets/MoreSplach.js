const { ipcRenderer } = require('electron');


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


async function loadSettings() {
    try {
        const result = await ipcRenderer.invoke('load-settings');
        if (result && result.success && result.settings) {
            return result.settings;
        }
    } catch (e) {
        console.error(' Failed to load settings:', e);
    }
    return {
        proxy: 'https://kirka.io/'
    };
}


function applySettingsToUI(settings) {
    // Proxy
    const proxySelect = document.getElementById('base_url');
    if (proxySelect && settings.proxy) {
        for (let option of proxySelect.options) {
            if (option.value === settings.proxy) {
                proxySelect.value = settings.proxy;
                break;
            }
        }
    }
}


function decodeJwtPayload(token) {
    try {
        const parts = token.trim().split('.');
        if (parts.length !== 3) throw new Error('Not a valid JWT');
        let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const json = decodeURIComponent(atob(b64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        return JSON.parse(json);
    } catch (e) {
        return null;
    }
}

async function fetchKirkaProfile(token) {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.sub) {
        throw new Error('Invalid token: missing user ID');
    }
    
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
    
    if (!response.ok) {
        throw new Error(`API error ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data) {
        throw new Error('Profile not found');
    }
    
    return {
        tag: result.data.shortId || '',
        name: result.data.name || '',
        level: result.data.level || null,
        userId: result.data.userId || payload.sub || '',
        token: token,
        active: false
    };
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
    console.log(' Current accounts before switch:', accounts.length);
    
    const accountIndex = accounts.findIndex(a => a.userId === userId);
    if (accountIndex === -1) {
        console.error(' Account not found:', userId);
        return false;
    }
    
    console.log(' Refreshing profile data for:', accounts[accountIndex].name);
    try {
        const freshProfile = await fetchKirkaProfile(accounts[accountIndex].token);
        console.log(' Fresh profile data:', freshProfile.name, '#', freshProfile.tag);
        
        accounts[accountIndex] = {
            ...accounts[accountIndex],
            name: freshProfile.name || accounts[accountIndex].name,
            tag: freshProfile.tag || accounts[accountIndex].tag,
            level: freshProfile.level !== null ? freshProfile.level : accounts[accountIndex].level,
            userId: freshProfile.userId || accounts[accountIndex].userId,
            token: accounts[accountIndex].token,
            active: true
        };
    } catch (e) {
        console.error(' Failed to refresh profile data:', e);
    }
    
    accounts.forEach(a => a.active = false);
    accounts[accountIndex].active = true;
    
    console.log(' Saving accounts after switch:', accounts.length);
    const saved = await saveAccounts(accounts);
    if (!saved) {
        console.error(' Failed to save accounts');
        return false;
    }
    
    const activeAccount = accounts[accountIndex];
    console.log(' Switched to account:', activeAccount.name, '#', activeAccount.tag);
    
    await ipcRenderer.invoke('save-token', activeAccount.token);
    ipcRenderer.send('update-game-token', activeAccount.token);
    
    applyUserProfile(activeAccount);
    renderAccountList();
    
    return true;
}


async function autoSaveAccount(token) {
    try {
        console.log(' Auto-saving account from token...');
        const profile = await fetchKirkaProfile(token);
        profile.active = true;
        
        let accounts = await getAccounts();
        console.log(' Current accounts before auto-save:', accounts.length);
        
        const existingIndex = accounts.findIndex(a => a.userId === profile.userId);
        
        if (existingIndex !== -1) {
            console.log(' Updating existing account with fresh data:', profile.name);
            accounts[existingIndex] = { 
                ...accounts[existingIndex], 
                ...profile, 
                token: token,
                active: true 
            };
            accounts.forEach((a, i) => {
                if (i !== existingIndex) a.active = false;
            });
        } else {
            console.log(' Adding new account:', profile.name);
            accounts.forEach(a => a.active = false);
            accounts.push(profile);
        }
        
        console.log(' Saving accounts after auto-save:', accounts.length);
        const saved = await saveAccounts(accounts);
        if (!saved) {
            console.error(' Failed to save accounts');
            return null;
        }
        
        await ipcRenderer.invoke('save-token', token);
        
        applyUserProfile(profile);
        renderAccountList();
        
        console.log(' Account auto-saved with fresh data:', profile.name, '#', profile.tag);
        console.log(' Total accounts:', accounts.length);
        return profile;
    } catch (e) {
        console.error(' Failed to auto-save account:', e);
        return null;
    }
}

async function removeAccount(userId) {
    let accounts = await getAccounts();
    console.log(' Accounts before removal:', accounts.length);
    
    accounts = accounts.filter(a => a.userId !== userId);
    
    console.log(' Accounts after removal:', accounts.length);
    await saveAccounts(accounts);
    
    const active = await getActiveAccount();
    if (!active && accounts.length > 0) {
        accounts[0].active = true;
        await saveAccounts(accounts);
        await ipcRenderer.invoke('save-token', accounts[0].token);
        ipcRenderer.send('update-game-token', accounts[0].token);
        applyUserProfile(accounts[0]);
    } else if (accounts.length === 0) {
        resetUserPill();
        ipcRenderer.invoke('clear-token');
        ipcRenderer.send('update-game-token', null);
    }
    renderAccountList();
}

function getAvatarUrl(tag) {
    const randV = Math.floor(Math.random() * 9000000) + 1000000;
    return `https://www.smudgy.store/api/list/profile.png?meow=${encodeURIComponent(tag)}&v=${randV}`;
}



function updateDropdownData(profile) {
    const nameEl = document.getElementById('dropdownName');
    const tagEl = document.getElementById('dropdownTag');
    const levelEl = document.getElementById('dropdownLevel');
    const idEl = document.getElementById('dropdownId');
    
    if (nameEl) nameEl.textContent = profile?.name || 'Guest';
    if (tagEl) tagEl.textContent = profile?.tag || '—';
    if (levelEl) levelEl.textContent = profile?.level !== null && profile?.level !== undefined ? `Lv.${profile.level}` : '—';
    if (idEl) idEl.textContent = profile?.userId || '—';
}

function applyUserProfile(profile) {
    if (!profile) {
        resetUserPill();
        return;
    }

    const tag = profile.tag || '';
    const name = profile.name || '';
    const level = profile.level !== null && profile.level !== undefined ? profile.level : null;

    const randV = Math.floor(Math.random() * 9000000) + 1000000;
    const avatarUrl = `https://www.smudgy.store/api/list/profile.png?meow=${encodeURIComponent(tag)}&v=${randV}`;
    const displayName = name && tag ? `${name}#${tag}` : (name || tag || 'Guest');

    const userNameDisplay = document.getElementById('userNameDisplay');
    const userLevelDisplay = document.getElementById('userLevelDisplay');
    const userAvatarIcon = document.getElementById('userAvatarIcon');
    const userAvatarImg = document.getElementById('userAvatarImg');
    const userAvatarWrap = document.getElementById('userAvatarWrap');

    if (userNameDisplay) userNameDisplay.textContent = displayName;
    if (userLevelDisplay && level !== null) {
        userLevelDisplay.textContent = `Lv.${level}`;
        userLevelDisplay.style.display = '';
    } else if (userLevelDisplay) {
        userLevelDisplay.style.display = 'none';
    }

    if (userAvatarImg) {
        userAvatarImg.src = avatarUrl;
        userAvatarImg.style.display = 'block';
        if (userAvatarIcon) userAvatarIcon.style.display = 'none';
        if (userAvatarWrap) {
            userAvatarWrap.style.background = 'transparent';
            userAvatarWrap.style.border = 'none';
        }
    }

    const tokenStatusRow = document.getElementById('tokenStatusRow');
    const tokenStatusName = document.getElementById('tokenStatusName');
    if (tokenStatusRow) tokenStatusRow.style.display = '';
    if (tokenStatusName) tokenStatusName.textContent = displayName;

    updateDropdownData(profile);
    renderAccountList();
}

function resetUserPill() {
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
    renderAccountList();
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
    
    accountList.innerHTML = accounts.map(acc => {
        const isActive = active && active.userId === acc.userId;
        const displayName = acc.name && acc.tag ? `${acc.name}#${acc.tag}` : (acc.name || acc.tag || 'Unknown');
        const avatarUrl = getAvatarUrl(acc.tag);
        
        return `
            <div class="user-dropdown-item account-item ${isActive ? 'active-account' : ''}" 
                 data-userid="${acc.userId}"
                 style="${isActive ? 'background:var(--green-dim);border-left:3px solid var(--green);' : ''} cursor:pointer;padding:6px 12px;display:flex;align-items:center;gap:10px;">
                <div class="account-avatar" style="width:28px;height:28px;border-radius:4px;overflow:hidden;flex-shrink:0;background:var(--bg3);border:1px solid var(--border);">
                    <img src="${avatarUrl}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fas fa-user\\' style=\\'font-size:0.7rem;color:var(--text-muted);display:flex;align-items:center;justify-content:center;width:100%;height:100%;\\'></i>'">
                </div>
                <span class="value" style="flex:1;font-size:0.78rem;color:#ccc;">${displayName}</span>
                ${isActive ? '<span style="color:var(--green);font-size:0.6rem;margin-left:auto;">✓</span>' : ''}
                <button class="remove-account" data-userid="${acc.userId}" style="background:none;border:none;color:#666;cursor:pointer;padding:0 4px;font-size:0.7rem;border-radius:3px;margin-left:4px;">×</button>
            </div>
        `;
    }).join('');
    
    accountList.querySelectorAll('.account-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            if (e.target.classList.contains('remove-account')) return;
            const userId = item.dataset.userid;
            await setActiveAccount(userId);
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
        if (token) {
            try {
                const profile = await autoSaveAccount(token);
                if (profile) {
                    console.log(' Account auto-saved from game login:', profile.name, '#', profile.tag);
                }
            } catch(e) {
                console.error(' Failed to auto-save account:', e);
            }
        }
    });
    
    ipcRenderer.on('accounts-updated', async (event, accounts) => {
        console.log(' Accounts updated from main process');
        renderAccountList();
        const active = await getActiveAccount();
        if (active) {
            applyUserProfile(active);
        }
    });
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



function renderNews() {
    const newsScroll = document.getElementById('newsScroll');
    if (!newsScroll || !window._newsItems) return;
    const filtered = window._newsItems;
    if (!filtered.length) {
        newsScroll.innerHTML = `<div class="news-empty">No news available.</div>`;
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
        const res = await fetch('https://raw.githubusercontent.com/OBS-Akuma/Ubuntu-client/refs/heads/main/Api/news.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        window._newsItems = await res.json();
        renderNews();
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
            applyUserProfile(active);
        } else {
            accounts[0].active = true;
            await saveAccounts(accounts);
            await ipcRenderer.invoke('save-token', accounts[0].token);
            applyUserProfile(accounts[0]);
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
