/**
 * Adds a developer menu that opens on Right Shift key press.
 * The menu allows you to inject CSS via link, raw CSS input, or file import.
 * Supports up to 3 uploaded files with individual delete buttons.
 * Features a tabbed sidebar interface with a draggable top bar.
 * Now includes JavaScript injection support via URL, raw code, or file upload.
 * Includes community scripts with install/uninstall functionality.
 * Features a Game tab with various UI customization options (saved to localStorage).
 * Includes a Client tab with export/import functionality.
 *
 * Run this in the devtools console.
 *
 * CSS ARCHITECTURE NOTE:
 * All menu chrome (not the injected user CSS/JS) is styled by ONE stylesheet
 * (see STYLE_SHEET below) using classes + real :hover rules, instead of
 * per-element inline cssText + mouseenter/mouseleave listener pairs. To
 * retheme the menu, edit STYLE_SHEET — you don't need to touch element
 * creation code at all.
 */
const devMenuAddon = () => {
  // ---- State ----
  let menuVisible = false;
  let menuElement = null;
  let overlayElement = null;
  let cssLinkInput = null;
  let rawCssInput = null;
  let jsUrlInput = null;
  let rawJsInput = null;
  let cssFileInput = null;
  let jsFileInput = null;
  let injectedStyles = [];
  let injectedScripts = [];
  let statusTimeout = null;
  let autoApplyTimeout = null;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let menuX = 50;
  let menuY = 50;

  // ---- File Management State ----
  let uploadedCssFiles = [];
  let uploadedJsFiles = [];
  const MAX_CSS_FILES = 3;
  const MAX_JS_FILES = 3;
  let cssFileListContainer = null;
  let jsFileListContainer = null;
  let activeTab = 'injector';

  // ---- Community Scripts State ----
  let communityScripts = [];
  let installedCommunityScripts = [];
  let communityScriptListContainer = null;
  let communityScriptDropdown = null;

  // ---- Game Settings State ----
  let gameSettings = {
    perm_crosshair: false,
    perm_tablist: false,
    hide_chat: false,
    hide_kill_text: false,
    hide_interface: false,
    skip_loading: false,
    chat_height: 0,
    interface_opacity: 100,
    interface_bounds: '2' // 0=80%, 1=90%, 2=100%
  };
  let gameStylesElement = null;
  let gameSettingElements = {};

  const STYLE_ID = 'dev-menu-chrome-styles';

  // =========================================================================
  // ONE stylesheet for all menu chrome. Colors/spacing live in CSS custom
  // properties at the top so retheming is a find-and-replace, not a hunt
  // through element creation code. Falls back gracefully if the host page
  // doesn't define --bg0 etc.
  // =========================================================================
  const STYLE_SHEET = `
  .dm-root {
    --dm-bg0: var(--bg0, #1a1a1f);
    --dm-bg1: var(--bg1, #22222a);
    --dm-bg2: var(--bg2, #2a2a33);
    --dm-bg3: var(--bg3, #33333d);
    --dm-border: var(--border, rgba(255,255,255,0.08));
    --dm-text: var(--text, #e8e8f0);
    --dm-text-muted: var(--text-muted, #8888a0);
    --dm-green: var(--green, #2ECC71);
    --dm-green-dim: var(--green-dim, rgba(46, 204, 113, 0.15));
    --dm-green-border: var(--green-border, rgba(46, 204, 113, 0.35));
    --dm-blue: var(--blue, #3498db);
    --dm-blue-dim: var(--blue-dim, rgba(52, 152, 219, 0.15));
    --dm-blue-border: var(--blue-border, rgba(52, 152, 219, 0.35));
    --dm-purple: var(--purple, #9b59b6);
    --dm-danger-bg: rgba(220,40,40,0.2);
    --dm-danger-border: rgba(220,40,40,0.4);
    --dm-danger-text: #ff6666;
    font-family: "Inter", sans-serif;
  }

  .dm-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: transparent;
    z-index: 99999;
    display: none;
    justify-content: flex-start;
    align-items: flex-start;
    pointer-events: none;
  }
  .dm-overlay.dm-visible { display: flex; }

  .dm-window {
    position: fixed;
    background: var(--dm-bg0);
    width: 700px;
    height: 475px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.8);
    border: 1px solid var(--dm-border);
    color: var(--dm-text);
    transform: scale(0.95);
    opacity: 0;
    transition: transform 0.2s ease, opacity 0.2s ease;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    will-change: transform, opacity, left, top;
  }
  .dm-window.dm-open { transform: scale(1); opacity: 1; }
  .dm-window.dm-dragging { transition: none; transform: none; opacity: 1; }

  .dm-topbar {
    height: 52px;
    background: var(--dm-bg1);
    border-bottom: 1px solid var(--dm-border);
    display: flex;
    align-items: center;
    padding: 0 18px;
    gap: 14px;
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
    -webkit-app-region: drag;
    touch-action: none;
  }
  .dm-topbar.dm-dragging { cursor: grabbing; }

  .dm-logo-area {
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: none;
    -webkit-app-region: no-drag;
  }
  .dm-icon {
    width: 32px; height: 32px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--dm-bg3);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .dm-icon img { width: 100%; height: 100%; object-fit: cover; }
  .dm-brand-name {
    font-family: 'roboto', cursive, system-ui, sans-serif;
    font-size: 1.15rem;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.03em;
    text-transform: lowercase;
  }
  .dm-spacer { flex: 1; -webkit-app-region: drag; }

  .dm-icon-btn {
    width: 28px; height: 28px;
    border-radius: 5px;
    border: 1px solid var(--dm-border);
    background: transparent;
    color: var(--dm-text-muted);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 0.75rem;
    pointer-events: auto;
    outline: none !important;
    -webkit-appearance: none !important;
    -webkit-app-region: no-drag;
  }
  .dm-icon-btn:hover {
    background: var(--dm-danger-bg);
    border-color: var(--dm-danger-border);
    color: var(--dm-danger-text);
  }

  .dm-main {
    display: flex;
    flex: 1;
    min-height: 0;
    height: calc(100% - 52px);
  }

  .dm-sidebar {
    width: 64px;
    background: var(--dm-bg1);
    border-right: 1px solid var(--dm-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 0;
    gap: 4px;
    flex-shrink: 0;
    height: 100%;
  }
  .dm-sidebar-spacer { flex: 1; }

  .dm-tab-btn {
    width: 44px; height: 44px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: #555568;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
    font-size: 1.1rem;
    outline: none !important;
    -webkit-appearance: none !important;
  }
  .dm-tab-btn.dm-active {
    background: var(--dm-green-dim);
    border: 1px solid var(--dm-green-border);
    color: var(--dm-green);
  }

  .dm-tooltip {
    position: absolute;
    left: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    background: var(--dm-bg2);
    border: 1px solid var(--dm-border);
    color: #ccc;
    font-size: 0.7rem;
    font-weight: 500;
    white-space: nowrap;
    padding: 4px 8px;
    border-radius: 4px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 999;
  }
  .dm-tab-btn:hover .dm-tooltip { opacity: 1; }

  .dm-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    background: var(--dm-bg0);
    height: 100%;
  }

  .dm-tab-content { display: none; height: 100%; }
  .dm-tab-content.dm-active { display: block; }
  .dm-tab-content.dm-centered.dm-active { display: flex; align-items: center; justify-content: center; }
  #tab-game.dm-active { overflow-y: auto; }

  .dm-section-title {
    font-family: "Permanent Marker", cursive;
    font-size: 1rem;
    font-weight: 700;
    color: #8a8aa0;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin: 0 0 12px 0;
  }

  .dm-label {
    display: block;
    margin-top: 8px;
    margin-bottom: 4px;
    font-weight: 600;
    color: var(--dm-text-muted);
    font-size: 0.72rem;
    letter-spacing: 0.03em;
  }
  .dm-label.dm-label-tight { margin-top: 10px; }

  .dm-input, .dm-textarea, .dm-select, .dm-file-input {
    width: 100%;
    padding: 8px 12px;
    background: var(--dm-bg2);
    border: 1px solid var(--dm-border);
    border-radius: 0px;
    color: var(--dm-text);
    font-size: 0.78rem;
    font-family: "Inter", sans-serif;
    box-sizing: border-box;
    transition: border-color 0.2s;
    outline: none !important;
    -webkit-appearance: none !important;
  }
  .dm-input:focus, .dm-textarea:focus { border-color: var(--dm-green-border); }
  .dm-input.dm-focus-blue:focus, .dm-textarea.dm-focus-blue:focus { border-color: var(--dm-blue-border); }

  .dm-textarea {
    min-height: 60px;
    max-height: 100px;
    font-size: 0.72rem;
    font-family: 'Consolas', monospace;
    resize: vertical;
    line-height: 1.5;
  }

  .dm-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .dm-file-input {
    flex: 1;
    padding: 6px 8px;
    font-size: 0.72rem;
    cursor: pointer;
  }
  .dm-file-input:disabled { opacity: 0.5; }

  .dm-count {
    font-size: 0.65rem;
    color: var(--dm-text-muted);
    margin-top: 2px;
    text-align: right;
  }

  .dm-file-list {
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 60px;
    overflow-y: auto;
  }
  .dm-file-list.dm-file-list-tall { max-height: 80px; }

  .dm-file-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background: var(--dm-bg2);
    border: 1px solid var(--dm-border);
    font-size: 0.7rem;
    color: var(--dm-text);
  }
  .dm-file-info {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }
  .dm-file-icon-css { color: var(--dm-green); font-size: 0.8rem; }
  .dm-file-icon-js { color: var(--dm-blue); font-size: 0.8rem; }
  .dm-file-icon-community { color: var(--dm-purple); font-size: 0.8rem; }
  .dm-file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.7rem;
  }
  .dm-file-size { color: var(--dm-text-muted); font-size: 0.6rem; }

  .dm-delete-btn {
    background: transparent;
    border: 1px solid var(--dm-border);
    color: var(--dm-text-muted);
    cursor: pointer;
    padding: 2px 6px;
    font-size: 0.6rem;
    transition: all 0.15s;
    display: flex; align-items: center; justify-content: center;
    outline: none !important;
    -webkit-appearance: none !important;
  }
  .dm-delete-btn:hover {
    background: var(--dm-danger-bg);
    border-color: var(--dm-danger-border);
    color: var(--dm-danger-text);
  }

  .dm-empty-msg {
    padding: 4px;
    text-align: center;
    color: var(--dm-text-muted);
    font-size: 0.7rem;
  }
  .dm-empty-msg.dm-empty-large {
    padding: 20px;
    font-size: 0.85rem;
  }
  .dm-empty-msg.dm-empty-large i {
    font-size: 2rem;
    display: block;
    margin-bottom: 8px;
    opacity: 0.3;
  }

  .dm-btn {
    padding: 6px 12px;
    border-radius: 0px;
    cursor: pointer;
    font-size: 0.7rem;
    font-family: "Inter", sans-serif;
    transition: all 0.15s;
    outline: none !important;
    -webkit-appearance: none !important;
    white-space: nowrap;
  }
  .dm-btn-block { width: 100%; padding: 8px 12px; font-size: 0.78rem; }
  .dm-btn-wide { width: 100%; padding: 4px 12px; font-size: 0.65rem; margin-top: 4px; }

  .dm-btn-neutral {
    background: transparent;
    border: 1px solid var(--dm-border);
    color: var(--dm-text-muted);
  }
  .dm-btn-neutral:hover {
    background: var(--dm-danger-bg);
    border-color: var(--dm-danger-border);
    color: var(--dm-danger-text);
  }
  .dm-btn-neutral.dm-hover-green:hover {
    background: var(--dm-green-dim);
    border-color: var(--dm-green-border);
    color: var(--dm-green);
  }

  .dm-btn-green {
    background: var(--dm-green-dim);
    border: 1px solid var(--dm-green-border);
    color: var(--dm-green);
  }
  .dm-btn-green:hover { background: rgba(46, 204, 113, 0.25); }

  .dm-btn-blue {
    background: var(--dm-blue-dim);
    border: 1px solid var(--dm-blue-border);
    color: var(--dm-blue);
  }
  .dm-btn-blue:hover { background: rgba(52, 152, 219, 0.25); }

  .dm-toggle-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
  }
  .dm-checkbox { width: 16px; height: 16px; accent-color: var(--dm-green); cursor: pointer; }
  .dm-toggle-label { color: var(--dm-text); font-size: 0.78rem; cursor: pointer; user-select: none; }

  .dm-slider-wrapper { margin-top: 8px; padding: 4px 0; }
  .dm-slider-label { display: block; color: var(--dm-text-muted); font-size: 0.72rem; margin-bottom: 2px; }
  .dm-slider-row { display: flex; align-items: center; gap: 10px; }
  .dm-slider { flex: 1; accent-color: var(--dm-green); cursor: pointer; }
  .dm-slider-value { color: var(--dm-text); font-size: 0.78rem; min-width: 30px; text-align: center; }
  .dm-slider-value.dm-slider-value-wide { min-width: 40px; }

  .dm-keybind-info {
    padding: 10px 12px;
    background: var(--dm-bg2);
    border: 1px solid var(--dm-border);
    font-size: 0.72rem;
    color: var(--dm-text-muted);
    line-height: 1.5;
  }
  .dm-keybind-info strong { color: var(--dm-text); }
  .dm-keybind-info kbd {
    background: var(--dm-bg3);
    padding: 1px 8px;
    border-radius: 3px;
    color: #ccc;
    font-family: inherit;
  }
  `;

  function injectChromeStylesheet() {
    if (document.getElementById(STYLE_ID)) return;
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = STYLE_SHEET;
    document.head.appendChild(styleEl);
  }

  // ---- helper: create an element with class(es) and optional props ----
  function el(tag, className, props) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (props) Object.assign(node, props);
    return node;
  }

  // ---- Load Settings from localStorage ----
  function loadSettings() {
    try {
      const saved = localStorage.getItem('clientsettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        gameSettings = { ...gameSettings, ...parsed };
        console.log('[UbuntuClient] Loaded settings from localStorage');
      }
    } catch (e) {
      console.warn('[UbuntuClient] Failed to load settings:', e);
    }
  }

  // ---- Save Settings to localStorage ----
  function saveSettings() {
    try {
      localStorage.setItem('clientsettings', JSON.stringify(gameSettings));
      console.log('[UbuntuClient] Saved settings to localStorage');
    } catch (e) {
      console.warn('[UbuntuClient] Failed to save settings:', e);
    }
  }

  // ---- Create Menu Elements ----
  function createMenu() {
    loadSettings();
    injectChromeStylesheet();

    overlayElement = el('div', 'dm-root dm-overlay');
    menuElement = el('div', 'dm-window');
    menuElement.style.top = menuY + 'px';
    menuElement.style.left = menuX + 'px';

    // ---- Draggable Top Bar ----
    const topBar = el('div', 'dm-topbar');
    topBar.addEventListener('mousedown', startDrag);
    topBar.addEventListener('touchstart', startDragTouch, { passive: false });

    const logoArea = el('div', 'dm-logo-area');
    const icon = el('div', 'dm-icon');
    const iconImg = el('img', null, {
      src: 'https://raw.githubusercontent.com/OBS-Akuma/Ubuntu-client/main/assets/icon.png'
    });
    icon.appendChild(iconImg);
    logoArea.appendChild(icon);

    const name = el('span', 'dm-brand-name', { textContent: 'UbuntuClient' });
    logoArea.appendChild(name);
    topBar.appendChild(logoArea);

    topBar.appendChild(el('div', 'dm-spacer'));

    const closeBtn = el('button', 'dm-icon-btn', { innerHTML: '<i class="fas fa-times"></i>' });
    closeBtn.addEventListener('click', toggleMenu);
    topBar.appendChild(closeBtn);

    menuElement.appendChild(topBar);

    // ---- Main Layout (Sidebar + Content) ----
    const mainLayout = el('div', 'dm-main');

    // ---- Sidebar ----
    const sidebar = el('div', 'dm-sidebar');
    const tabs = [
      { id: 'injector', icon: 'fa-file-code', label: 'CSS' },
      { id: 'scripts', icon: 'fa-code', label: 'Scripts' },
      { id: 'game', icon: 'fa-gamepad', label: 'Game' },
      { id: 'client', icon: 'fa-user', label: 'Client' },
      { id: 'files', icon: 'fa-folder-open', label: 'Files' },
      { id: 'settings', icon: 'fa-cog', label: 'Settings' }
    ];

    tabs.forEach(tab => {
      const btn = el('button', `dm-tab-btn${tab.id === activeTab ? ' dm-active' : ''} sidebar-tab`);
      btn.dataset.tab = tab.id;
      btn.innerHTML = `<i class="fas ${tab.icon}"></i>`;
      const tooltip = el('span', 'dm-tooltip', { textContent: tab.label });
      btn.appendChild(tooltip);
      btn.addEventListener('click', () => switchTab(tab.id));
      sidebar.appendChild(btn);
    });
    sidebar.appendChild(el('div', 'dm-sidebar-spacer'));
    mainLayout.appendChild(sidebar);

    // ---- Content Area ----
    const contentArea = el('div', 'dm-content');

    // ---- Tab Content: CSS (Injector) ----
    const injectorTab = el('div', `dm-tab-content tab-content${activeTab === 'injector' ? ' dm-active' : ''}`);
    injectorTab.id = 'tab-injector';
    injectorTab.appendChild(el('h2', 'dm-section-title', { textContent: 'CSS Injector' }));

    injectorTab.appendChild(el('label', 'dm-label', { textContent: 'CSS URL (Raw GitHub supported)' }));
    cssLinkInput = el('input', 'dm-input', {
      type: 'text',
      placeholder: 'https://raw.githubusercontent.com/.../style.css'
    });
    cssLinkInput.addEventListener('input', handleAutoApply);
    cssLinkInput.addEventListener('change', handleAutoApply);
    cssLinkInput.addEventListener('paste', () => setTimeout(handleAutoApply, 100));
    injectorTab.appendChild(cssLinkInput);

    injectorTab.appendChild(el('label', 'dm-label dm-label-tight', { textContent: 'Upload CSS Files' }));
    const cssFileWrapper = el('div', 'dm-row');
    cssFileInput = el('input', 'dm-file-input', { type: 'file', accept: '.css' });
    cssFileInput.addEventListener('change', handleCssFileImport);
    cssFileWrapper.appendChild(cssFileInput);
    injectorTab.appendChild(cssFileWrapper);

    const cssFileCount = el('div', 'dm-count', { id: 'css-file-count', textContent: `0 / ${MAX_CSS_FILES} CSS files uploaded` });
    injectorTab.appendChild(cssFileCount);

    cssFileListContainer = el('div', 'dm-file-list', { id: 'css-file-list' });
    injectorTab.appendChild(cssFileListContainer);

    const clearCssFilesBtn = el('button', 'dm-btn dm-btn-neutral dm-btn-wide', { textContent: 'Clear All CSS Files' });
    clearCssFilesBtn.addEventListener('click', () => {
      uploadedCssFiles = [];
      updateCssFileList();
    });
    injectorTab.appendChild(clearCssFilesBtn);

    injectorTab.appendChild(el('label', 'dm-label dm-label-tight', { textContent: 'Raw CSS (Paste CSS code here)' }));
    rawCssInput = el('textarea', 'dm-textarea', {
      placeholder: '/* Paste your CSS code here */\nbody { background: red; }'
    });
    rawCssInput.addEventListener('input', handleAutoApply);
    rawCssInput.addEventListener('change', handleAutoApply);
    injectorTab.appendChild(rawCssInput);

    contentArea.appendChild(injectorTab);

    // ---- Tab Content: Scripts ----
    const scriptsTab = el('div', `dm-tab-content tab-content${activeTab === 'scripts' ? ' dm-active' : ''}`);
    scriptsTab.id = 'tab-scripts';
    scriptsTab.appendChild(el('h2', 'dm-section-title', { textContent: 'JS Injector' }));

    scriptsTab.appendChild(el('label', 'dm-label', { textContent: 'JavaScript URL (Raw GitHub supported)' }));
    jsUrlInput = el('input', 'dm-input dm-focus-blue', {
      type: 'text',
      placeholder: 'https://raw.githubusercontent.com/.../script.js'
    });
    jsUrlInput.addEventListener('input', handleJsAutoApply);
    jsUrlInput.addEventListener('change', handleJsAutoApply);
    jsUrlInput.addEventListener('paste', () => setTimeout(handleJsAutoApply, 100));
    scriptsTab.appendChild(jsUrlInput);

    scriptsTab.appendChild(el('label', 'dm-label dm-label-tight', { textContent: 'Upload JavaScript Files' }));
    const jsFileWrapper = el('div', 'dm-row');
    jsFileInput = el('input', 'dm-file-input', { type: 'file', accept: '.js' });
    jsFileInput.addEventListener('change', handleJsFileImport);
    jsFileWrapper.appendChild(jsFileInput);
    scriptsTab.appendChild(jsFileWrapper);

    const jsFileCount = el('div', 'dm-count', { id: 'js-file-count', textContent: `0 / ${MAX_JS_FILES} JS files uploaded` });
    scriptsTab.appendChild(jsFileCount);

    jsFileListContainer = el('div', 'dm-file-list', { id: 'js-file-list' });
    scriptsTab.appendChild(jsFileListContainer);

    const clearJsFilesBtn = el('button', 'dm-btn dm-btn-neutral dm-btn-wide', { textContent: 'Clear All JS Files' });
    clearJsFilesBtn.addEventListener('click', () => {
      uploadedJsFiles = [];
      updateJsFileList();
    });
    scriptsTab.appendChild(clearJsFilesBtn);

    scriptsTab.appendChild(el('label', 'dm-label dm-label-tight', { textContent: 'Raw JavaScript (Paste JS code here)' }));
    rawJsInput = el('textarea', 'dm-textarea dm-focus-blue', {
      placeholder: '/* Paste your JavaScript code here */\nconsole.log("Hello from injected script!");'
    });
    rawJsInput.addEventListener('input', handleJsAutoApply);
    rawJsInput.addEventListener('change', handleJsAutoApply);
    scriptsTab.appendChild(rawJsInput);

    // ---- Community Scripts Section ----
    scriptsTab.appendChild(el('label', 'dm-label dm-label-tight', { textContent: 'Community Scripts' }));
    const communityWrapper = el('div', 'dm-row');
    communityScriptDropdown = el('select', 'dm-select');
    communityWrapper.appendChild(communityScriptDropdown);

    const installBtn = el('button', 'dm-btn dm-btn-green', { textContent: 'Install' });
    installBtn.addEventListener('click', installCommunityScript);
    communityWrapper.appendChild(installBtn);
    scriptsTab.appendChild(communityWrapper);

    communityScriptListContainer = el('div', 'dm-file-list dm-file-list-tall', { id: 'community-script-list' });
    scriptsTab.appendChild(communityScriptListContainer);

    const clearCommunityBtn = el('button', 'dm-btn dm-btn-neutral dm-btn-wide', { textContent: 'Clear All Community Scripts' });
    clearCommunityBtn.addEventListener('click', () => clearAllCommunityScripts());
    scriptsTab.appendChild(clearCommunityBtn);

    contentArea.appendChild(scriptsTab);

    // ---- Tab Content: Game ----
    const gameTab = el('div', `dm-tab-content tab-content${activeTab === 'game' ? ' dm-active' : ''}`);
    gameTab.id = 'tab-game';
    gameTab.appendChild(el('h2', 'dm-section-title', { textContent: 'Game Settings' }));

    const toggleSettings = [
      { id: 'perm_crosshair', label: 'Permanent Crosshair' },
      { id: 'perm_tablist', label: 'Permanent Tablist' },
      { id: 'hide_chat', label: 'Hide Chat' },
      { id: 'hide_kill_text', label: 'Hide Kill Text' },
      { id: 'hide_interface', label: 'Hide Interface' },
      { id: 'skip_loading', label: 'Skip Loading Screen' }
    ];

    toggleSettings.forEach(setting => {
      const wrapper = el('div', 'dm-toggle-row');
      const checkbox = el('input', 'dm-checkbox', { type: 'checkbox', checked: gameSettings[setting.id] || false });
      checkbox.addEventListener('change', () => {
        gameSettings[setting.id] = checkbox.checked;
        saveSettings();
        applyGameSettings();
      });
      gameSettingElements[setting.id] = checkbox;

      const label = el('label', 'dm-toggle-label', { textContent: setting.label });
      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
      gameTab.appendChild(wrapper);
    });

    // Chat Height slider
    const chatHeightWrapper = el('div', 'dm-slider-wrapper');
    chatHeightWrapper.appendChild(el('label', 'dm-slider-label', { textContent: 'Chat Height' }));
    const chatHeightRow = el('div', 'dm-slider-row');
    const chatHeightInput = el('input', 'dm-slider', {
      type: 'range', min: '0', max: '10', step: '0.5', value: gameSettings.chat_height || 0
    });
    const chatHeightValue = el('span', 'dm-slider-value', { textContent: (gameSettings.chat_height || 0).toFixed(1) });
    chatHeightInput.addEventListener('input', () => {
      gameSettings.chat_height = parseFloat(chatHeightInput.value);
      chatHeightValue.textContent = gameSettings.chat_height.toFixed(1);
      saveSettings();
      applyGameSettings();
    });
    gameSettingElements.chat_height = chatHeightInput;
    chatHeightRow.appendChild(chatHeightInput);
    chatHeightRow.appendChild(chatHeightValue);
    chatHeightWrapper.appendChild(chatHeightRow);
    gameTab.appendChild(chatHeightWrapper);

    // Interface Opacity slider
    const opacityWrapper = el('div', 'dm-slider-wrapper');
    opacityWrapper.appendChild(el('label', 'dm-slider-label', { textContent: 'Interface Opacity' }));
    const opacityRow = el('div', 'dm-slider-row');
    const opacityInput = el('input', 'dm-slider', {
      type: 'range', min: '0', max: '100', step: '5', value: gameSettings.interface_opacity || 100
    });
    const opacityValue = el('span', 'dm-slider-value dm-slider-value-wide', {
      textContent: (gameSettings.interface_opacity || 100) + '%'
    });
    opacityInput.addEventListener('input', () => {
      gameSettings.interface_opacity = parseInt(opacityInput.value);
      opacityValue.textContent = gameSettings.interface_opacity + '%';
      saveSettings();
      applyGameSettings();
    });
    gameSettingElements.interface_opacity = opacityInput;
    opacityRow.appendChild(opacityInput);
    opacityRow.appendChild(opacityValue);
    opacityWrapper.appendChild(opacityRow);
    gameTab.appendChild(opacityWrapper);

    // Interface Bounds dropdown
    const boundsWrapper = el('div', 'dm-slider-wrapper');
    boundsWrapper.appendChild(el('label', 'dm-slider-label', { textContent: 'Interface Scale' }));
    const boundsSelect = el('select', 'dm-select');
    const boundsOptions = [
      { value: '0', label: '80%' },
      { value: '1', label: '90%' },
      { value: '2', label: '100%' }
    ];
    boundsOptions.forEach(opt => {
      const option = el('option', null, { value: opt.value, textContent: opt.label });
      if (gameSettings.interface_bounds === opt.value) option.selected = true;
      boundsSelect.appendChild(option);
    });
    boundsSelect.addEventListener('change', () => {
      gameSettings.interface_bounds = boundsSelect.value;
      saveSettings();
      applyGameSettings();
    });
    gameSettingElements.interface_bounds = boundsSelect;
    boundsWrapper.appendChild(boundsSelect);
    gameTab.appendChild(boundsWrapper);

    const applyGameBtn = el('button', 'dm-btn dm-btn-green dm-btn-block', { textContent: 'Apply Game Settings' });
    applyGameBtn.style.marginTop = '12px';
    applyGameBtn.addEventListener('click', applyGameSettings);
    gameTab.appendChild(applyGameBtn);

    contentArea.appendChild(gameTab);

    // ---- Tab Content: Client ----
    const clientTab = el('div', `dm-tab-content tab-content${activeTab === 'client' ? ' dm-active' : ''}`);
    clientTab.id = 'tab-client';
    clientTab.style.padding = '10px 0';
    clientTab.appendChild(el('h2', 'dm-section-title', { textContent: 'Client Settings' }));

    clientTab.appendChild(el('label', 'dm-label', { textContent: 'Export Settings' }));
    const exportBtn = el('button', 'dm-btn dm-btn-blue dm-btn-block', { textContent: 'Export Settings to JSON' });
    exportBtn.style.marginBottom = '12px';
    exportBtn.addEventListener('click', exportSettings);
    clientTab.appendChild(exportBtn);

    clientTab.appendChild(el('label', 'dm-label', { textContent: 'Import Settings' }));
    const importWrapper = el('div', 'dm-row');
    const importInput = el('input', 'dm-file-input', { type: 'file', accept: '.json' });
    importInput.addEventListener('change', importSettings);
    importWrapper.appendChild(importInput);

    const importBtn = el('button', 'dm-btn dm-btn-green', { textContent: 'Import' });
    importBtn.addEventListener('click', () => importInput.click());
    importWrapper.appendChild(importBtn);
    clientTab.appendChild(importWrapper);

    clientTab.appendChild(el('label', 'dm-label', { textContent: 'Reset Settings' }));
    clientTab.querySelector('label:last-of-type').style.marginTop = '12px';
    const resetBtn = el('button', 'dm-btn dm-btn-neutral dm-btn-block', { textContent: 'Reset to Defaults' });
    resetBtn.addEventListener('click', resetSettings);
    clientTab.appendChild(resetBtn);

    contentArea.appendChild(clientTab);

    // ---- Tab Content: Files ----
    const filesTab = el('div', `dm-tab-content dm-centered tab-content${activeTab === 'files' ? ' dm-active' : ''}`);
    filesTab.id = 'tab-files';
    const emptyMsg = el('div', 'dm-empty-msg dm-empty-large');
    emptyMsg.innerHTML = '<i class="fas fa-folder-open"></i>File management moved to respective tabs';
    filesTab.appendChild(emptyMsg);
    contentArea.appendChild(filesTab);

    // ---- Tab Content: Settings ----
    const settingsTab = el('div', `dm-tab-content tab-content${activeTab === 'settings' ? ' dm-active' : ''}`);
    settingsTab.id = 'tab-settings';
    settingsTab.style.padding = '10px 0';
    settingsTab.appendChild(el('h2', 'dm-section-title', { textContent: 'Settings' }));

    const clearBtn = el('button', 'dm-btn dm-btn-neutral dm-btn-block', { textContent: 'Clear All Injected Styles & Scripts' });
    clearBtn.style.marginBottom = '8px';
    clearBtn.addEventListener('click', () => {
      clearAllStyles(true);
      clearAllScripts(true);
      clearAllCommunityScripts();
      updateCssFileList();
      updateJsFileList();
      updateCommunityScriptList();
    });
    settingsTab.appendChild(clearBtn);

    const refreshBtn = el('button', 'dm-btn dm-btn-neutral dm-hover-green dm-btn-block', { textContent: 'Refresh Community Scripts' });
    refreshBtn.style.marginBottom = '8px';
    refreshBtn.addEventListener('click', loadCommunityScripts);
    settingsTab.appendChild(refreshBtn);

    const keybindInfo = el('div', 'dm-keybind-info');
    keybindInfo.innerHTML = `
      <strong>Keybinds</strong><br>
      <kbd>Right Shift</kbd> - Toggle menu<br>
      <kbd>Escape</kbd> - Close menu
    `;
    settingsTab.appendChild(keybindInfo);

    contentArea.appendChild(settingsTab);

    mainLayout.appendChild(contentArea);
    menuElement.appendChild(mainLayout);
    overlayElement.appendChild(menuElement);
    document.body.appendChild(overlayElement);

    loadFontAwesome();
    updateCssFileList();
    updateJsFileList();
    loadCommunityScripts();

    setTimeout(applyGameSettings, 500);
  }

  // ---- Improved Drag Functions ----
  function startDrag(e) {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;
    e.preventDefault();

    isDragging = true;
    const rect = menuElement.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    menuElement.classList.add('dm-dragging');

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', stopDrag);
  }

  function startDragTouch(e) {
    const touch = e.touches[0];
    if (!touch) return;
    if (e.target.closest('button')) return;
    e.preventDefault();

    isDragging = true;
    const rect = menuElement.getBoundingClientRect();
    dragOffsetX = touch.clientX - rect.left;
    dragOffsetY = touch.clientY - rect.top;

    menuElement.classList.add('dm-dragging');

    document.addEventListener('touchmove', onDragMoveTouch, { passive: false });
    document.addEventListener('touchend', stopDragTouch, { passive: false });
  }

  function onDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    positionMenu(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
  }

  function onDragMoveTouch(e) {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    positionMenu(touch.clientX - dragOffsetX, touch.clientY - dragOffsetY);
  }

  function positionMenu(newX, newY) {
    const maxX = window.innerWidth - menuElement.offsetWidth;
    const maxY = window.innerHeight - menuElement.offsetHeight;
    menuX = Math.max(0, Math.min(newX, maxX));
    menuY = Math.max(0, Math.min(newY, maxY));
    menuElement.style.left = menuX + 'px';
    menuElement.style.top = menuY + 'px';
  }

  function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    menuElement.classList.remove('dm-dragging');
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', stopDrag);
  }

  function stopDragTouch() {
    if (!isDragging) return;
    isDragging = false;
    menuElement.classList.remove('dm-dragging');
    document.removeEventListener('touchmove', onDragMoveTouch);
    document.removeEventListener('touchend', stopDragTouch);
  }

  // ---- Switch Tab ----
  function switchTab(tabId) {
    activeTab = tabId;

    document.querySelectorAll('.sidebar-tab').forEach(btn => {
      btn.classList.toggle('dm-active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('dm-active');
    });

    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add('dm-active');
  }

  // ---- Load Font Awesome ----
  function loadFontAwesome() {
    if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('link[href*="fontawesome"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(link);
    }
  }

  // ---- Apply Game Settings ----
  function applyGameSettings() {
    if (gameStylesElement && gameStylesElement.parentNode) {
      gameStylesElement.remove();
    }

    const styles = [];

    if (gameSettings.perm_crosshair)
      styles.push(
        ".crosshair-static { opacity: 1 !important; visibility: visible !important; display: block !important; }"
      );
    if (gameSettings.perm_tablist)
      styles.push(
        ".tab-info,.tab-team-info {    display: flex !important;    box-shadow: unset !important;    border-radius: 0.5rem !important;    max-width: 30rem !important;    top: 0 !important;    right: 0 !important;    position: fixed;    margin: 0.5rem !important;    padding: 0.15rem !important;}.tab-team-info .players-cont {    flex-direction: column !important;    gap: 0.25rem;}.tab-info .player-list,.tab-team-info .player-list {    margin: unset !important;    gap: 0.25rem;}.tab-info > .head,.tab-team-info > .head,.tab-team-info .player-left-cont > .list {    display: none;}.tab-info .list,.tab-team-info .player-list > .list {    order: 999;}.tab-info .players-wrap,.tab-team-info .players-wrap {    padding: 0.25rem;}.tab-info .player-cont,.tab-team-info .player-cont {    margin: unset;    border-radius: 0.25rem;}.player-left-cont > .player-cont {    border-left: solid 0.5rem #ff4d42;}.player-right-cont > .player-cont {    border-left: solid 0.5rem #0d6dc6;}.kill-bar-cont {    right: 31.5rem !important;    top: 0.5rem !important;}"
      );
    if (gameSettings.hide_chat)
      styles.push(
        ".desktop-game-interface > #bottom-left > .chat { display: none !important; }"
      );
    if (gameSettings.hide_kill_text)
      styles.push(
        ".ach-cont .text { display: none !important; }"
      );
    if (gameSettings.hide_interface)
      styles.push(
        ".desktop-game-interface, .ach-cont, .hitme-cont, .sniper-mwNMW-cont, .team-score, .score { display: none !important; }"
      );
    if (gameSettings.skip_loading)
      styles.push(".loading-scene { display: none !important; }");
    if (gameSettings.chat_height && gameSettings.chat_height > 0) {
      styles.push(`.desktop-game-interface #chat { bottom: calc(4.7em + ${gameSettings.chat_height}em * 1.2) !important } .desktop-game-interface #chat .messages { min-height: calc(11.75em + ${gameSettings.chat_height}em) !important }`);
    }
    if (gameSettings.interface_opacity !== undefined && gameSettings.interface_opacity < 100) {
      styles.push(
        `.desktop-game-interface { opacity: ${gameSettings.interface_opacity}% !important; }`
      );
    }
    if (gameSettings.interface_bounds) {
      let scale =
        gameSettings.interface_bounds === "1"
          ? 0.9
          : gameSettings.interface_bounds === "0"
            ? 0.8
            : 1;
      styles.push(
        `.desktop-game-interface { transform: scale(${scale}) !important; }`
      );
    }

    if (styles.length > 0) {
      gameStylesElement = document.createElement('style');
      gameStylesElement.dataset.devMenu = 'true';
      gameStylesElement.dataset.type = 'game';
      gameStylesElement.textContent = styles.join('\n');
      document.head.appendChild(gameStylesElement);
      console.log('[UbuntuClient] Applied game settings,', styles.length, 'styles');
    } else {
      console.log('[UbuntuClient] No game settings to apply');
    }
  }

  // ---- Export Settings ----
  function exportSettings() {
    try {
      const data = {
        settings: gameSettings,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `client-settings-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[UbuntuClient] Settings exported');
    } catch (e) {
      console.error('[UbuntuClient] Failed to export settings:', e);
    }
  }

  // ---- Import Settings ----
  function importSettings(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const data = JSON.parse(event.target.result);
        if (data.settings) {
          gameSettings = { ...gameSettings, ...data.settings };
          saveSettings();
          updateGameSettingsUI();
          applyGameSettings();
          console.log('[UbuntuClient] Settings imported successfully');
          e.target.value = '';
        } else {
          console.warn('[UbuntuClient] Invalid settings file');
        }
      } catch (err) {
        console.error('[UbuntuClient] Failed to import settings:', err);
      }
    };
    reader.readAsText(file);
  }

  // ---- Update Game Settings UI ----
  function updateGameSettingsUI() {
    const toggleIds = ['perm_crosshair', 'perm_tablist', 'hide_chat', 'hide_kill_text', 'hide_interface', 'skip_loading'];
    toggleIds.forEach(id => {
      if (gameSettingElements[id]) {
        gameSettingElements[id].checked = gameSettings[id] || false;
      }
    });

    if (gameSettingElements.chat_height) {
      gameSettingElements.chat_height.value = gameSettings.chat_height || 0;
      const valueDisplay = gameSettingElements.chat_height.parentElement?.querySelector('span');
      if (valueDisplay) valueDisplay.textContent = (gameSettings.chat_height || 0).toFixed(1);
    }

    if (gameSettingElements.interface_opacity) {
      gameSettingElements.interface_opacity.value = gameSettings.interface_opacity || 100;
      const valueDisplay = gameSettingElements.interface_opacity.parentElement?.querySelector('span');
      if (valueDisplay) valueDisplay.textContent = (gameSettings.interface_opacity || 100) + '%';
    }

    if (gameSettingElements.interface_bounds) {
      gameSettingElements.interface_bounds.value = gameSettings.interface_bounds || '2';
    }
  }

  // ---- Reset Settings ----
  function resetSettings() {
    if (!confirm('Reset all game settings to defaults?')) return;

    gameSettings = {
      perm_crosshair: false,
      perm_tablist: false,
      hide_chat: false,
      hide_kill_text: false,
      hide_interface: false,
      skip_loading: false,
      chat_height: 0,
      interface_opacity: 100,
      interface_bounds: '2'
    };

    saveSettings();
    updateGameSettingsUI();
    applyGameSettings();

    console.log('[UbuntuClient] Settings reset to defaults');
  }

  // ---- Load Community Scripts ----
  function loadCommunityScripts() {
    const dropdown = communityScriptDropdown;
    if (!dropdown) return;

    dropdown.innerHTML = '';
    dropdown.appendChild(el('option', null, { textContent: 'Loading scripts...', disabled: true, selected: true }));

    const scriptUrl = 'https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/script.json';

    fetch(scriptUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        communityScripts = data.scripts || [];
        populateCommunityDropdown();
        console.log('[UbuntuClient] Loaded community scripts:', communityScripts.length);
      })
      .catch(err => {
        console.error('[UbuntuClient] Failed to load community scripts:', err);
        dropdown.innerHTML = '';
        dropdown.appendChild(el('option', null, { textContent: 'Error loading scripts', disabled: true, selected: true }));
      });
  }

  // ---- Populate Community Dropdown ----
  function populateCommunityDropdown() {
    const dropdown = communityScriptDropdown;
    if (!dropdown) return;

    dropdown.innerHTML = '';

    if (communityScripts.length === 0) {
      dropdown.appendChild(el('option', null, { textContent: 'No scripts available', disabled: true, selected: true }));
      return;
    }

    dropdown.appendChild(el('option', null, { textContent: '-- Select a script --', value: '', selected: true }));

    communityScripts.forEach((script, index) => {
      dropdown.appendChild(el('option', null, { value: index, textContent: script.name }));
    });
  }

  // ---- Install Community Script ----
  function installCommunityScript() {
    const dropdown = communityScriptDropdown;
    if (!dropdown) return;

    const selectedIndex = parseInt(dropdown.value);
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= communityScripts.length) {
      console.warn('[UbuntuClient] No valid script selected');
      return;
    }

    const script = communityScripts[selectedIndex];
    if (!script || !script.url) {
      console.warn('[UbuntuClient] Script has no URL');
      return;
    }

    if (installedCommunityScripts.some(s => s.name === script.name)) {
      console.warn('[UbuntuClient] Script already installed:', script.name);
      return;
    }

    fetch(script.url)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(jsContent => {
        const scriptElement = document.createElement('script');
        scriptElement.dataset.devMenu = 'true';
        scriptElement.dataset.type = 'community';
        scriptElement.dataset.scriptName = script.name;
        scriptElement.textContent = jsContent;
        document.head.appendChild(scriptElement);
        injectedScripts.push(scriptElement);

        installedCommunityScripts.push({ ...script, element: scriptElement });

        updateCommunityScriptList();
        console.log('[UbuntuClient] Installed community script:', script.name);
      })
      .catch(err => {
        console.error('[UbuntuClient] Failed to install community script:', err);
      });
  }

  // ---- Uninstall Community Script ----
  function uninstallCommunityScript(index) {
    if (index < 0 || index >= installedCommunityScripts.length) return;

    const script = installedCommunityScripts[index];
    if (!script) return;

    if (script.element && script.element.parentNode) {
      script.element.remove();
      const idx = injectedScripts.indexOf(script.element);
      if (idx > -1) injectedScripts.splice(idx, 1);
    }

    installedCommunityScripts.splice(index, 1);
    updateCommunityScriptList();
    console.log('[UbuntuClient] Uninstalled community script:', script.name);
  }

  // ---- Clear All Community Scripts ----
  function clearAllCommunityScripts() {
    const scriptsToRemove = [];
    installedCommunityScripts.forEach(script => {
      if (script.element && script.element.parentNode) scriptsToRemove.push(script.element);
    });

    scriptsToRemove.forEach(element => {
      element.remove();
      const idx = injectedScripts.indexOf(element);
      if (idx > -1) injectedScripts.splice(idx, 1);
    });

    installedCommunityScripts = [];
    updateCommunityScriptList();
    console.log('[UbuntuClient] Cleared all community scripts');
  }

  // ---- Update Community Script List ----
  function updateCommunityScriptList() {
    if (!communityScriptListContainer) return;
    communityScriptListContainer.innerHTML = '';

    if (installedCommunityScripts.length === 0) {
      communityScriptListContainer.appendChild(
        el('div', 'dm-empty-msg', { textContent: 'No community scripts installed yet.' })
      );
      return;
    }

    installedCommunityScripts.forEach((script, index) => {
      const fileItem = el('div', 'dm-file-item');
      const fileInfo = el('div', 'dm-file-info');
      fileInfo.appendChild(el('i', 'fa-users dm-file-icon-community'));
      fileInfo.appendChild(el('span', 'dm-file-name', { textContent: script.name }));

      const deleteBtn = el('button', 'dm-delete-btn', { innerHTML: '<i class="fas fa-times"></i>' });
      deleteBtn.addEventListener('click', () => uninstallCommunityScript(index));

      fileItem.appendChild(fileInfo);
      fileItem.appendChild(deleteBtn);
      communityScriptListContainer.appendChild(fileItem);
    });
  }

  // ---- Update CSS File List ----
  function updateCssFileList() {
    if (!cssFileListContainer) return;
    cssFileListContainer.innerHTML = '';

    if (uploadedCssFiles.length === 0) {
      cssFileListContainer.appendChild(el('div', 'dm-empty-msg', { textContent: 'No CSS files uploaded yet.' }));
    } else {
      uploadedCssFiles.forEach((file, index) => {
        cssFileListContainer.appendChild(createFileListItem(file, index, 'css'));
      });
    }

    const countEl = document.getElementById('css-file-count');
    if (countEl) countEl.textContent = `${uploadedCssFiles.length} / ${MAX_CSS_FILES} CSS files uploaded`;

    if (cssFileInput) cssFileInput.disabled = uploadedCssFiles.length >= MAX_CSS_FILES;
  }

  // ---- Update JS File List ----
  function updateJsFileList() {
    if (!jsFileListContainer) return;
    jsFileListContainer.innerHTML = '';

    if (uploadedJsFiles.length === 0) {
      jsFileListContainer.appendChild(el('div', 'dm-empty-msg', { textContent: 'No JS files uploaded yet.' }));
    } else {
      uploadedJsFiles.forEach((file, index) => {
        jsFileListContainer.appendChild(createFileListItem(file, index, 'js'));
      });
    }

    const countEl = document.getElementById('js-file-count');
    if (countEl) countEl.textContent = `${uploadedJsFiles.length} / ${MAX_JS_FILES} JS files uploaded`;

    if (jsFileInput) jsFileInput.disabled = uploadedJsFiles.length >= MAX_JS_FILES;
  }

  // ---- Create File List Item ----
  function createFileListItem(file, index, type) {
    const fileItem = el('div', 'dm-file-item');
    const fileInfo = el('div', 'dm-file-info');

    fileInfo.appendChild(el('i', `fa-file-code ${type === 'css' ? 'dm-file-icon-css' : 'dm-file-icon-js'}`));
    fileInfo.appendChild(el('span', 'dm-file-name', { textContent: file.name }));
    fileInfo.appendChild(el('span', 'dm-file-size', { textContent: `(${(file.size / 1024).toFixed(1)} KB)` }));

    const deleteBtn = el('button', 'dm-delete-btn', { innerHTML: '<i class="fas fa-times"></i>' });
    deleteBtn.addEventListener('click', () => removeFile(index, type));

    fileItem.appendChild(fileInfo);
    fileItem.appendChild(deleteBtn);
    return fileItem;
  }

  // ---- Remove File ----
  function removeFile(index, type) {
    if (type === 'css') {
      if (index < 0 || index >= uploadedCssFiles.length) return;
      const removed = uploadedCssFiles[index];
      uploadedCssFiles.splice(index, 1);

      const stylesToRemove = injectedStyles.filter(s => s.dataset && s.dataset.fileName === removed.name);
      stylesToRemove.forEach(style => {
        style.remove();
        const idx = injectedStyles.indexOf(style);
        if (idx > -1) injectedStyles.splice(idx, 1);
      });

      updateCssFileList();
    } else if (type === 'js') {
      if (index < 0 || index >= uploadedJsFiles.length) return;
      const removed = uploadedJsFiles[index];
      uploadedJsFiles.splice(index, 1);

      const scriptsToRemove = injectedScripts.filter(s => s.dataset && s.dataset.fileName === removed.name);
      scriptsToRemove.forEach(script => {
        script.remove();
        const idx = injectedScripts.indexOf(script);
        if (idx > -1) injectedScripts.splice(idx, 1);
      });

      updateJsFileList();
    }
  }

  // ---- Handle CSS File Import ----
  function handleCssFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (uploadedCssFiles.length >= MAX_CSS_FILES) {
      cssFileInput.value = '';
      return;
    }
    if (uploadedCssFiles.some(f => f.name === file.name)) {
      cssFileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      const cssContent = event.target.result;
      uploadedCssFiles.push({ name: file.name, content: cssContent, size: file.size });

      try {
        const style = document.createElement('style');
        style.dataset.devMenu = 'true';
        style.dataset.type = 'file';
        style.dataset.fileName = file.name;
        style.textContent = cssContent;
        document.head.appendChild(style);
        injectedStyles.push(style);

        updateCssFileList();
        console.log('[UbuntuClient] Uploaded CSS file:', file.name);
      } catch (err) {
        console.error('[UbuntuClient] Failed to inject file CSS:', err);
      }

      cssFileInput.value = '';
    };
    reader.onerror = function() { cssFileInput.value = ''; };
    reader.readAsText(file);
  }

  // ---- Handle JS File Import ----
  function handleJsFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (uploadedJsFiles.length >= MAX_JS_FILES) {
      jsFileInput.value = '';
      return;
    }
    if (uploadedJsFiles.some(f => f.name === file.name)) {
      jsFileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      const jsContent = event.target.result;
      uploadedJsFiles.push({ name: file.name, content: jsContent, size: file.size });

      try {
        const script = document.createElement('script');
        script.dataset.devMenu = 'true';
        script.dataset.type = 'file';
        script.dataset.fileName = file.name;
        script.textContent = jsContent;
        document.head.appendChild(script);
        injectedScripts.push(script);

        updateJsFileList();
        console.log('[UbuntuClient] Uploaded JS file:', file.name);
      } catch (err) {
        console.error('[UbuntuClient] Failed to inject file JavaScript:', err);
      }

      jsFileInput.value = '';
    };
    reader.onerror = function() { jsFileInput.value = ''; };
    reader.readAsText(file);
  }

  // ---- Handle Auto-Apply for CSS ----
  function handleAutoApply() {
    if (autoApplyTimeout) clearTimeout(autoApplyTimeout);
    autoApplyTimeout = setTimeout(() => {
      applyStyles();
      autoApplyTimeout = null;
    }, 300);
  }

  // ---- Handle Auto-Apply for JavaScript ----
  function handleJsAutoApply() {
    if (autoApplyTimeout) clearTimeout(autoApplyTimeout);
    autoApplyTimeout = setTimeout(() => {
      applyJavaScript();
      autoApplyTimeout = null;
    }, 300);
  }

  // ---- Apply Styles ----
  function applyStyles() {
    const linkValue = cssLinkInput.value.trim();
    const rawValue = rawCssInput.value.trim();

    const stylesToRemove = injectedStyles.filter(s => s.dataset && (s.dataset.type === 'url' || s.dataset.type === 'raw'));
    stylesToRemove.forEach(style => {
      style.remove();
      const idx = injectedStyles.indexOf(style);
      if (idx > -1) injectedStyles.splice(idx, 1);
    });

    if (linkValue) {
      fetch(linkValue)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then(cssContent => {
          const style = document.createElement('style');
          style.dataset.devMenu = 'true';
          style.dataset.type = 'url';
          style.textContent = cssContent;
          document.head.appendChild(style);
          injectedStyles.push(style);
          console.log('[UbuntuClient] Injected fetched CSS from:', linkValue);
        })
        .catch(err => {
          console.error('[UbuntuClient] Failed to fetch CSS:', err);
        });
      return;
    }

    if (rawValue) {
      try {
        const style = document.createElement('style');
        style.dataset.devMenu = 'true';
        style.dataset.type = 'raw';
        style.textContent = rawValue;
        document.head.appendChild(style);
        injectedStyles.push(style);
        console.log('[UbuntuClient] Injected raw CSS');
      } catch (err) {
        console.error('[UbuntuClient] Failed to inject raw CSS:', err);
      }
    }
  }

  // ---- Apply JavaScript ----
  function applyJavaScript() {
    const urlValue = jsUrlInput.value.trim();
    const rawValue = rawJsInput.value.trim();

    const scriptsToRemove = injectedScripts.filter(s => s.dataset && (s.dataset.type === 'url' || s.dataset.type === 'raw'));
    scriptsToRemove.forEach(script => {
      script.remove();
      const idx = injectedScripts.indexOf(script);
      if (idx > -1) injectedScripts.splice(idx, 1);
    });

    if (urlValue) {
      fetch(urlValue)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then(jsContent => {
          const script = document.createElement('script');
          script.dataset.devMenu = 'true';
          script.dataset.type = 'url';
          script.textContent = jsContent;
          document.head.appendChild(script);
          injectedScripts.push(script);
          console.log('[UbuntuClient] Injected fetched JavaScript from:', urlValue);
        })
        .catch(err => {
          console.error('[UbuntuClient] Failed to fetch JavaScript:', err);
        });
      return;
    }

    if (rawValue) {
      try {
        const script = document.createElement('script');
        script.dataset.devMenu = 'true';
        script.dataset.type = 'raw';
        script.textContent = rawValue;
        document.head.appendChild(script);
        injectedScripts.push(script);
        console.log('[UbuntuClient] Injected raw JavaScript');
      } catch (err) {
        console.error('[UbuntuClient] Failed to inject raw JavaScript:', err);
      }
    }
  }

  // ---- Clear All Scripts ----
  function clearAllScripts(showFeedback = true) {
    injectedScripts.filter(s => s.parentNode).forEach(script => script.remove());
    injectedScripts = [];
    uploadedJsFiles = [];
    updateJsFileList();
    if (showFeedback) console.log('[UbuntuClient] Cleared all injected scripts');
  }

  // ---- Clear All Styles ----
  function clearAllStyles(showFeedback = true) {
    injectedStyles.filter(s => s.parentNode).forEach(style => style.remove());
    injectedStyles = [];
    uploadedCssFiles = [];
    updateCssFileList();
    if (showFeedback) console.log('[UbuntuClient] Cleared all injected styles');
  }

  // ---- Toggle Menu ----
  function toggleMenu(event) {
    if (event && event.key) {
      if (event.key !== 'Shift' || event.location !== 2) return;
      event.preventDefault();
    }

    menuVisible = !menuVisible;
    overlayElement.classList.toggle('dm-visible', menuVisible);

    if (menuVisible) {
      menuElement.classList.add('dm-open');
      setTimeout(() => { if (cssLinkInput) cssLinkInput.focus(); }, 200);
      setTimeout(() => {
        if (cssLinkInput.value.trim() || rawCssInput.value.trim()) applyStyles();
        if (jsUrlInput.value.trim() || rawJsInput.value.trim()) applyJavaScript();
      }, 300);
    } else {
      menuElement.classList.remove('dm-open');
    }
  }

  // ---- Initialize ----
  function init() {
    createMenu();

    document.addEventListener('keydown', toggleMenu);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuVisible) toggleMenu(event);
    });

    console.log('[UbuntuClient] Initialized. Press Right Shift to open.');
    console.log('[UbuntuClient] Upload up to 3 CSS files and 3 JS files with delete support.');
    console.log('[UbuntuClient] Inject JavaScript via URL, raw code, or file upload.');
    console.log('[UbuntuClient] Community scripts available in the Scripts tab with install/uninstall.');
    console.log('[UbuntuClient] Game settings saved to localStorage.clientsettings');
    console.log('[UbuntuClient] Export/import settings in the Client tab.');
    console.log('[UbuntuClient] Drag the top bar to move the window.');
  }

  // ---- Cleanup Function ----
  function cleanup() {
    document.removeEventListener('keydown', toggleMenu);
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDragMoveTouch);
    document.removeEventListener('touchend', stopDragTouch);
    if (overlayElement && overlayElement.parentNode) overlayElement.remove();
    const chromeStyles = document.getElementById(STYLE_ID);
    if (chromeStyles) chromeStyles.remove();
    clearAllStyles(false);
    clearAllScripts(false);
    clearAllCommunityScripts();
    if (statusTimeout) { clearTimeout(statusTimeout); statusTimeout = null; }
    if (autoApplyTimeout) { clearTimeout(autoApplyTimeout); autoApplyTimeout = null; }
    console.log('[UbuntuClient] Cleaned up.');
  }

  init();

  return {
    toggle: toggleMenu,
    cleanup: cleanup,
    applyStyles: applyStyles,
    applyJavaScript: applyJavaScript,
    clearAllStyles: clearAllStyles,
    clearAllScripts: clearAllScripts,
    clearAllCommunityScripts: clearAllCommunityScripts,
    applyGameSettings: applyGameSettings,
    exportSettings: exportSettings,
    importSettings: importSettings,
    resetSettings: resetSettings,
    getInjectedStyles: () => injectedStyles,
    getInjectedScripts: () => injectedScripts,
    getUploadedCssFiles: () => uploadedCssFiles,
    getUploadedJsFiles: () => uploadedJsFiles,
    getInstalledCommunityScripts: () => installedCommunityScripts,
    getGameSettings: () => gameSettings,
    loadCommunityScripts: loadCommunityScripts,
    isVisible: () => menuVisible,
    switchTab: switchTab
  };
};

// Export for use in main file
module.exports = { devMenuAddon };