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
  let startX = 0;
  let startY = 0;
  let startMenuX = 0;
  let startMenuY = 0;
  
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
  let gameSettingsApplied = false;
  let gameStylesElement = null;
  let gameSettingElements = {};

  // ---- Load Settings from localStorage ----
  function loadSettings() {
    try {
      const saved = localStorage.getItem('clientsettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults
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
    // Load settings first
    loadSettings();

    // Create overlay - transparent background
    overlayElement = document.createElement('div');
    overlayElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      z-index: 99999;
      display: none;
      justify-content: flex-start;
      align-items: flex-start;
      font-family: "Inter", sans-serif;
      pointer-events: none;
    `;

    // Create menu container - fixed size 700x475
    menuElement = document.createElement('div');
    menuElement.style.cssText = `
      position: fixed;
      top: ${menuY}px;
      left: ${menuX}px;
      background: var(--bg0, #1a1a1f);
      border-radius: 0px;
      width: 700px;
      height: 475px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.8);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      color: var(--text, #e8e8f0);
      transform: scale(0.95);
      transition: transform 0.2s ease, opacity 0.2s ease;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      opacity: 0;
      will-change: transform, opacity, left, top;
    `;

    // ---- Draggable Top Bar ----
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      height: 52px;
      background: var(--bg1, #22222a);
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
      display: flex;
      align-items: center;
      padding: 0 18px;
      gap: 14px;
      flex-shrink: 0;
      cursor: grab;
      user-select: none;
      -webkit-app-region: drag;
      touch-action: none;
    `;
    topBar.addEventListener('mousedown', startDrag);
    topBar.addEventListener('touchstart', startDragTouch, { passive: false });

    // Logo area
    const logoArea = document.createElement('div');
    logoArea.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      pointer-events: none;
      -webkit-app-region: no-drag;
    `;
const icon = document.createElement('div');
icon.style.cssText = `
  width: 32px;
  height: 32px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg3, #33333d);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

// Use Ubuntu logo image
const iconImg = document.createElement('img');
iconImg.src = 'https://raw.githubusercontent.com/OBS-Akuma/Ubuntu-client/main/assets/icon.png'; // or local path
iconImg.style.cssText = `
  width: 100%;
  height: 100%;
  object-fit: cover;
`;
icon.appendChild(iconImg);
logoArea.appendChild(icon);

    const name = document.createElement('span');
    name.textContent = 'UbuntuClient';
    name.style.cssText = `
      font-family: 'roboto', cursive, system-ui, sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.03em;
      text-transform: lowercase;
    `;
    logoArea.appendChild(name);
    topBar.appendChild(logoArea);

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.cssText = 'flex: 1; -webkit-app-region: drag;';
    topBar.appendChild(spacer);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
      width: 28px;
      height: 28px;
      border-radius: 5px;
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      background: transparent;
      color: var(--text-muted, #8888a0);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
      font-size: 0.75rem;
      pointer-events: auto;
      font-family: "Inter", sans-serif;
      outline: none !important;
      -webkit-appearance: none !important;
      -webkit-app-region: no-drag;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(220,40,40,0.2)';
      closeBtn.style.borderColor = 'rgba(220,40,40,0.4)';
      closeBtn.style.color = '#ff6666';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
      closeBtn.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      closeBtn.style.color = 'var(--text-muted, #8888a0)';
    });
    closeBtn.addEventListener('click', toggleMenu);
    topBar.appendChild(closeBtn);

    menuElement.appendChild(topBar);

    // ---- Main Layout (Sidebar + Content) ----
    const mainLayout = document.createElement('div');
    mainLayout.style.cssText = `
      display: flex;
      flex: 1;
      min-height: 0;
      height: calc(100% - 52px);
    `;

    // ---- Sidebar ----
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      width: 64px;
      background: var(--bg1, #22222a);
      border-right: 1px solid var(--border, rgba(255,255,255,0.08));
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 0;
      gap: 4px;
      flex-shrink: 0;
      height: 100%;
    `;

    // Sidebar tabs
    const tabs = [
      { id: 'injector', icon: 'fa-file-code', label: 'CSS' },
      { id: 'scripts', icon: 'fa-code', label: 'Scripts' },
      { id: 'game', icon: 'fa-gamepad', label: 'Game' },
      { id: 'client', icon: 'fa-user', label: 'Client' },
      { id: 'files', icon: 'fa-folder-open', label: 'Files' },
      { id: 'settings', icon: 'fa-cog', label: 'Settings' }
    ];

    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = `sidebar-tab ${tab.id === activeTab ? 'active' : ''}`;
      btn.dataset.tab = tab.id;
      btn.style.cssText = `
        width: 44px;
        height: 44px;
        border-radius: 8px;
        background: ${tab.id === activeTab ? 'var(--green-dim, rgba(46, 204, 113, 0.15))' : 'transparent'};
        border: ${tab.id === activeTab ? '1px solid var(--green-border, rgba(46, 204, 113, 0.35))' : 'none'};
        color: ${tab.id === activeTab ? 'var(--green, #2ECC71)' : '#555568'};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s;
        position: relative;
        font-size: 1.1rem;
        font-family: "Inter", sans-serif;
        outline: none !important;
        -webkit-appearance: none !important;
      `;
      
      btn.innerHTML = `<i class="fas ${tab.icon}"></i>`;
      
      // Tooltip
      const tooltip = document.createElement('span');
      tooltip.textContent = tab.label;
      tooltip.style.cssText = `
        position: absolute;
        left: calc(100% + 10px);
        top: 50%;
        transform: translateY(-50%);
        background: var(--bg2, #2a2a33);
        border: 1px solid var(--border, rgba(255,255,255,0.08));
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
      `;
      btn.appendChild(tooltip);
      
      btn.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1';
      });
      btn.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
      
      btn.addEventListener('click', () => switchTab(tab.id));
      
      sidebar.appendChild(btn);
    });

    // Spacer
    const spacer2 = document.createElement('div');
    spacer2.style.cssText = 'flex: 1;';
    sidebar.appendChild(spacer2);

    mainLayout.appendChild(sidebar);

    // ---- Content Area ----
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      background: var(--bg0, #1a1a1f);
      height: 100%;
    `;
    contentArea.style.overflowY = 'auto';

    // ---- Tab Content: CSS (Injector) ----
    const injectorTab = document.createElement('div');
    injectorTab.className = 'tab-content';
    injectorTab.id = 'tab-injector';
    injectorTab.style.cssText = `
      display: ${activeTab === 'injector' ? 'block' : 'none'};
      height: 100%;
    `;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'CSS Injector';
    title.style.cssText = `
      font-family: "Permanent Marker", cursive;
      font-size: 1rem;
      font-weight: 700;
      color: #8a8aa0;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0 0 12px 0;
    `;
    injectorTab.appendChild(title);

    // CSS Link Input Section
    const linkLabel = document.createElement('label');
    linkLabel.textContent = 'CSS URL (Raw GitHub supported)';
    linkLabel.style.cssText = `
      display: block;
      margin-top: 8px;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      letter-spacing: 0.03em;
    `;
    injectorTab.appendChild(linkLabel);

    cssLinkInput = document.createElement('input');
    cssLinkInput.type = 'text';
    cssLinkInput.placeholder = 'https://raw.githubusercontent.com/.../style.css';
    cssLinkInput.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      background: var(--bg2, #2a2a33);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text, #e8e8f0);
      font-size: 0.78rem;
      font-family: "Inter", sans-serif;
      box-sizing: border-box;
      transition: border-color 0.2s;
      outline: none !important;
      -webkit-appearance: none !important;
    `;
    cssLinkInput.addEventListener('focus', () => {
      cssLinkInput.style.borderColor = 'var(--green-border, rgba(46, 204, 113, 0.35))';
      cssLinkInput.style.outline = 'none';
    });
    cssLinkInput.addEventListener('blur', () => {
      cssLinkInput.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      cssLinkInput.style.outline = 'none';
    });
    cssLinkInput.addEventListener('input', handleAutoApply);
    cssLinkInput.addEventListener('change', handleAutoApply);
    cssLinkInput.addEventListener('paste', () => {
      setTimeout(handleAutoApply, 100);
    });
    injectorTab.appendChild(cssLinkInput);

    // ---- CSS File Import Section ----
    const cssFileLabel = document.createElement('label');
    cssFileLabel.textContent = 'Upload CSS Files';
    cssFileLabel.style.cssText = `
      display: block;
      margin-top: 10px;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      letter-spacing: 0.03em;
    `;
    injectorTab.appendChild(cssFileLabel);

    const cssFileWrapper = document.createElement('div');
    cssFileWrapper.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;
    
    cssFileInput = document.createElement('input');
    cssFileInput.type = 'file';
    cssFileInput.accept = '.css';
    cssFileInput.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      background: var(--bg2, #2a2a33);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text, #e8e8f0);
      font-size: 0.72rem;
      font-family: "Inter", sans-serif;
      outline: none !important;
      -webkit-appearance: none !important;
      cursor: pointer;
    `;
    cssFileInput.addEventListener('change', handleCssFileImport);
    cssFileWrapper.appendChild(cssFileInput);
    injectorTab.appendChild(cssFileWrapper);

    // CSS File count indicator
    const cssFileCount = document.createElement('div');
    cssFileCount.id = 'css-file-count';
    cssFileCount.style.cssText = `
      font-size: 0.65rem;
      color: var(--text-muted, #8888a0);
      margin-top: 2px;
      text-align: right;
    `;
    cssFileCount.textContent = `0 / ${MAX_CSS_FILES} CSS files uploaded`;
    injectorTab.appendChild(cssFileCount);

    // CSS File list container
    cssFileListContainer = document.createElement('div');
    cssFileListContainer.id = 'css-file-list';
    cssFileListContainer.style.cssText = `
      margin-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-height: 60px;
      overflow-y: auto;
    `;
    injectorTab.appendChild(cssFileListContainer);

    // Clear CSS files button
    const clearCssFilesBtn = document.createElement('button');
    clearCssFilesBtn.textContent = 'Clear All CSS Files';
    clearCssFilesBtn.style.cssText = `
      margin-top: 4px;
      padding: 4px 12px;
      background: transparent;
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text-muted, #8888a0);
      cursor: pointer;
      font-size: 0.65rem;
      font-family: "Inter", sans-serif;
      transition: all 0.15s;
      outline: none !important;
      -webkit-appearance: none !important;
      width: 100%;
    `;
    clearCssFilesBtn.addEventListener('mouseenter', () => {
      clearCssFilesBtn.style.background = 'rgba(220,40,40,0.2)';
      clearCssFilesBtn.style.borderColor = 'rgba(220,40,40,0.4)';
      clearCssFilesBtn.style.color = '#ff6666';
    });
    clearCssFilesBtn.addEventListener('mouseleave', () => {
      clearCssFilesBtn.style.background = 'transparent';
      clearCssFilesBtn.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      clearCssFilesBtn.style.color = 'var(--text-muted, #8888a0)';
    });
    clearCssFilesBtn.addEventListener('click', () => {
      uploadedCssFiles = [];
      updateCssFileList();
    });
    injectorTab.appendChild(clearCssFilesBtn);

    // Raw CSS Input Section
    const rawLabel = document.createElement('label');
    rawLabel.textContent = 'Raw CSS (Paste CSS code here)';
    rawLabel.style.cssText = `
      display: block;
      margin-top: 10px;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      letter-spacing: 0.03em;
    `;
    injectorTab.appendChild(rawLabel);

    rawCssInput = document.createElement('textarea');
    rawCssInput.placeholder = '/* Paste your CSS code here */\nbody { background: red; }';
    rawCssInput.style.cssText = `
      width: 100%;
      min-height: 60px;
      max-height: 100px;
      padding: 8px 12px;
      background: var(--bg2, #2a2a33);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text, #e8e8f0);
      font-size: 0.72rem;
      font-family: 'Consolas', monospace;
      box-sizing: border-box;
      resize: vertical;
      transition: border-color 0.2s;
      line-height: 1.5;
      outline: none !important;
      -webkit-appearance: none !important;
    `;
    rawCssInput.addEventListener('focus', () => {
      rawCssInput.style.borderColor = 'var(--green-border, rgba(46, 204, 113, 0.35))';
      rawCssInput.style.outline = 'none';
    });
    rawCssInput.addEventListener('blur', () => {
      rawCssInput.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      rawCssInput.style.outline = 'none';
    });
    rawCssInput.addEventListener('input', handleAutoApply);
    rawCssInput.addEventListener('change', handleAutoApply);
    injectorTab.appendChild(rawCssInput);

    contentArea.appendChild(injectorTab);

    // ---- Tab Content: Scripts ----
    const scriptsTab = document.createElement('div');
    scriptsTab.className = 'tab-content';
    scriptsTab.id = 'tab-scripts';
    scriptsTab.style.cssText = `
      display: ${activeTab === 'scripts' ? 'block' : 'none'};
      height: 100%;
    `;

    // Title
    const scriptsTitle = document.createElement('h2');
    scriptsTitle.textContent = 'JS Injector';
    scriptsTitle.style.cssText = `
      font-family: "Permanent Marker", cursive;
      font-size: 1rem;
      font-weight: 700;
      color: #8a8aa0;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0 0 12px 0;
    `;
    scriptsTab.appendChild(scriptsTitle);

    // JS URL Input Section
    const jsUrlLabel = document.createElement('label');
    jsUrlLabel.textContent = 'JavaScript URL (Raw GitHub supported)';
    jsUrlLabel.style.cssText = `
      display: block;
      margin-top: 8px;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      letter-spacing: 0.03em;
    `;
    scriptsTab.appendChild(jsUrlLabel);

    jsUrlInput = document.createElement('input');
    jsUrlInput.type = 'text';
    jsUrlInput.placeholder = 'https://raw.githubusercontent.com/.../script.js';
    jsUrlInput.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      background: var(--bg2, #2a2a33);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text, #e8e8f0);
      font-size: 0.78rem;
      font-family: "Inter", sans-serif;
      box-sizing: border-box;
      transition: border-color 0.2s;
      outline: none !important;
      -webkit-appearance: none !important;
    `;
    jsUrlInput.addEventListener('focus', () => {
      jsUrlInput.style.borderColor = 'var(--blue-border, rgba(52, 152, 219, 0.35))';
      jsUrlInput.style.outline = 'none';
    });
    jsUrlInput.addEventListener('blur', () => {
      jsUrlInput.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      jsUrlInput.style.outline = 'none';
    });
    jsUrlInput.addEventListener('input', handleJsAutoApply);
    jsUrlInput.addEventListener('change', handleJsAutoApply);
    jsUrlInput.addEventListener('paste', () => {
      setTimeout(handleJsAutoApply, 100);
    });
    scriptsTab.appendChild(jsUrlInput);

    // ---- JS File Upload Section ----
    const jsFileLabel = document.createElement('label');
    jsFileLabel.textContent = 'Upload JavaScript Files';
    jsFileLabel.style.cssText = `
      display: block;
      margin-top: 10px;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      letter-spacing: 0.03em;
    `;
    scriptsTab.appendChild(jsFileLabel);

    const jsFileWrapper = document.createElement('div');
    jsFileWrapper.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;
    
    jsFileInput = document.createElement('input');
    jsFileInput.type = 'file';
    jsFileInput.accept = '.js';
    jsFileInput.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      background: var(--bg2, #2a2a33);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text, #e8e8f0);
      font-size: 0.72rem;
      font-family: "Inter", sans-serif;
      outline: none !important;
      -webkit-appearance: none !important;
      cursor: pointer;
    `;
    jsFileInput.addEventListener('change', handleJsFileImport);
    jsFileWrapper.appendChild(jsFileInput);
    scriptsTab.appendChild(jsFileWrapper);

    // JS File count indicator
    const jsFileCount = document.createElement('div');
    jsFileCount.id = 'js-file-count';
    jsFileCount.style.cssText = `
      font-size: 0.65rem;
      color: var(--text-muted, #8888a0);
      margin-top: 2px;
      text-align: right;
    `;
    jsFileCount.textContent = `0 / ${MAX_JS_FILES} JS files uploaded`;
    scriptsTab.appendChild(jsFileCount);

    // JS File list container
    jsFileListContainer = document.createElement('div');
    jsFileListContainer.id = 'js-file-list';
    jsFileListContainer.style.cssText = `
      margin-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-height: 60px;
      overflow-y: auto;
    `;
    scriptsTab.appendChild(jsFileListContainer);

    // Clear JS files button
    const clearJsFilesBtn = document.createElement('button');
    clearJsFilesBtn.textContent = 'Clear All JS Files';
    clearJsFilesBtn.style.cssText = `
      margin-top: 4px;
      padding: 4px 12px;
      background: transparent;
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text-muted, #8888a0);
      cursor: pointer;
      font-size: 0.65rem;
      font-family: "Inter", sans-serif;
      transition: all 0.15s;
      outline: none !important;
      -webkit-appearance: none !important;
      width: 100%;
    `;
    clearJsFilesBtn.addEventListener('mouseenter', () => {
      clearJsFilesBtn.style.background = 'rgba(220,40,40,0.2)';
      clearJsFilesBtn.style.borderColor = 'rgba(220,40,40,0.4)';
      clearJsFilesBtn.style.color = '#ff6666';
    });
    clearJsFilesBtn.addEventListener('mouseleave', () => {
      clearJsFilesBtn.style.background = 'transparent';
      clearJsFilesBtn.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      clearJsFilesBtn.style.color = 'var(--text-muted, #8888a0)';
    });
    clearJsFilesBtn.addEventListener('click', () => {
      uploadedJsFiles = [];
      updateJsFileList();
    });
    scriptsTab.appendChild(clearJsFilesBtn);

    // Raw JS Input Section
    const rawJsLabel = document.createElement('label');
    rawJsLabel.textContent = 'Raw JavaScript (Paste JS code here)';
    rawJsLabel.style.cssText = `
      display: block;
      margin-top: 10px;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      letter-spacing: 0.03em;
    `;
    scriptsTab.appendChild(rawJsLabel);

    rawJsInput = document.createElement('textarea');
    rawJsInput.placeholder = '/* Paste your JavaScript code here */\nconsole.log("Hello from injected script!");';
    rawJsInput.style.cssText = `
      width: 100%;
      min-height: 60px;
      max-height: 100px;
      padding: 8px 12px;
      background: var(--bg2, #2a2a33);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text, #e8e8f0);
      font-size: 0.72rem;
      font-family: 'Consolas', monospace;
      box-sizing: border-box;
      resize: vertical;
      transition: border-color 0.2s;
      line-height: 1.5;
      outline: none !important;
      -webkit-appearance: none !important;
    `;
    rawJsInput.addEventListener('focus', () => {
      rawJsInput.style.borderColor = 'var(--blue-border, rgba(52, 152, 219, 0.35))';
      rawJsInput.style.outline = 'none';
    });
    rawJsInput.addEventListener('blur', () => {
      rawJsInput.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      rawJsInput.style.outline = 'none';
    });
    rawJsInput.addEventListener('input', handleJsAutoApply);
    rawJsInput.addEventListener('change', handleJsAutoApply);
    scriptsTab.appendChild(rawJsInput);

    // ---- Community Scripts Section ----
    const communityLabel = document.createElement('label');
    communityLabel.textContent = 'Community Scripts';
    communityLabel.style.cssText = `
      display: block;
      margin-top: 10px;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      letter-spacing: 0.03em;
    `;
    scriptsTab.appendChild(communityLabel);

    // Dropdown for community scripts
    const communityWrapper = document.createElement('div');
    communityWrapper.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    communityScriptDropdown = document.createElement('select');
    communityScriptDropdown.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      background: var(--bg2, #2a2a33);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text, #e8e8f0);
      font-size: 0.72rem;
      font-family: "Inter", sans-serif;
      outline: none !important;
      -webkit-appearance: none !important;
      cursor: pointer;
    `;
    communityWrapper.appendChild(communityScriptDropdown);

    // Install button
    const installBtn = document.createElement('button');
    installBtn.textContent = 'Install';
    installBtn.style.cssText = `
      padding: 6px 12px;
      background: var(--green-dim, rgba(46, 204, 113, 0.15));
      border: 1px solid var(--green-border, rgba(46, 204, 113, 0.35));
      border-radius: 0px;
      color: var(--green, #2ECC71);
      cursor: pointer;
      font-size: 0.7rem;
      font-family: "Inter", sans-serif;
      transition: all 0.15s;
      outline: none !important;
      -webkit-appearance: none !important;
      white-space: nowrap;
    `;
    installBtn.addEventListener('mouseenter', () => {
      installBtn.style.background = 'rgba(46, 204, 113, 0.25)';
    });
    installBtn.addEventListener('mouseleave', () => {
      installBtn.style.background = 'var(--green-dim, rgba(46, 204, 113, 0.15))';
    });
    installBtn.addEventListener('click', installCommunityScript);
    communityWrapper.appendChild(installBtn);

    scriptsTab.appendChild(communityWrapper);

    // Community script list container
    communityScriptListContainer = document.createElement('div');
    communityScriptListContainer.id = 'community-script-list';
    communityScriptListContainer.style.cssText = `
      margin-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-height: 80px;
      overflow-y: auto;
    `;
    scriptsTab.appendChild(communityScriptListContainer);

    // Clear all community scripts button
    const clearCommunityBtn = document.createElement('button');
    clearCommunityBtn.textContent = 'Clear All Community Scripts';
    clearCommunityBtn.style.cssText = `
      margin-top: 4px;
      padding: 4px 12px;
      background: transparent;
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text-muted, #8888a0);
      cursor: pointer;
      font-size: 0.65rem;
      font-family: "Inter", sans-serif;
      transition: all 0.15s;
      outline: none !important;
      -webkit-appearance: none !important;
      width: 100%;
    `;
    clearCommunityBtn.addEventListener('mouseenter', () => {
      clearCommunityBtn.style.background = 'rgba(220,40,40,0.2)';
      clearCommunityBtn.style.borderColor = 'rgba(220,40,40,0.4)';
      clearCommunityBtn.style.color = '#ff6666';
    });
    clearCommunityBtn.addEventListener('mouseleave', () => {
      clearCommunityBtn.style.background = 'transparent';
      clearCommunityBtn.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      clearCommunityBtn.style.color = 'var(--text-muted, #8888a0)';
    });
    clearCommunityBtn.addEventListener('click', () => {
      clearAllCommunityScripts();
    });
    scriptsTab.appendChild(clearCommunityBtn);

    contentArea.appendChild(scriptsTab);

    // ---- Tab Content: Game ----
    const gameTab = document.createElement('div');
    gameTab.className = 'tab-content';
    gameTab.id = 'tab-game';
    gameTab.style.cssText = `
      display: ${activeTab === 'game' ? 'block' : 'none'};
      height: 100%;
      overflow-y: auto;
    `;

    // Title
    const gameTitle = document.createElement('h2');
    gameTitle.textContent = 'Game Settings';
    gameTitle.style.cssText = `
      font-family: "Permanent Marker", cursive;
      font-size: 1rem;
      font-weight: 700;
      color: #8a8aa0;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0 0 12px 0;
    `;
    gameTab.appendChild(gameTitle);

    // Toggle settings
    const toggleSettings = [
      { id: 'perm_crosshair', label: 'Permanent Crosshair' },
      { id: 'perm_tablist', label: 'Permanent Tablist' },
      { id: 'hide_chat', label: 'Hide Chat' },
      { id: 'hide_kill_text', label: 'Hide Kill Text' },
      { id: 'hide_interface', label: 'Hide Interface' },
      { id: 'skip_loading', label: 'Skip Loading Screen' }
    ];

    toggleSettings.forEach(setting => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 0;
      `;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = gameSettings[setting.id] || false;
      checkbox.style.cssText = `
        width: 16px;
        height: 16px;
        accent-color: #2ECC71;
        cursor: pointer;
      `;
      checkbox.addEventListener('change', () => {
        gameSettings[setting.id] = checkbox.checked;
        saveSettings();
        applyGameSettings();
      });
      gameSettingElements[setting.id] = checkbox;

      const label = document.createElement('label');
      label.textContent = setting.label;
      label.style.cssText = `
        color: var(--text, #e8e8f0);
        font-size: 0.78rem;
        cursor: pointer;
        user-select: none;
      `;

      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
      gameTab.appendChild(wrapper);
    });

    // Chat Height slider
    const chatHeightWrapper = document.createElement('div');
    chatHeightWrapper.style.cssText = `
      margin-top: 8px;
      padding: 4px 0;
    `;

    const chatHeightLabel = document.createElement('label');
    chatHeightLabel.textContent = 'Chat Height';
    chatHeightLabel.style.cssText = `
      display: block;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      margin-bottom: 2px;
    `;
    chatHeightWrapper.appendChild(chatHeightLabel);

    const chatHeightRow = document.createElement('div');
    chatHeightRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    const chatHeightInput = document.createElement('input');
    chatHeightInput.type = 'range';
    chatHeightInput.min = '0';
    chatHeightInput.max = '10';
    chatHeightInput.step = '0.5';
    chatHeightInput.value = gameSettings.chat_height || 0;
    chatHeightInput.style.cssText = `
      flex: 1;
      accent-color: #2ECC71;
      cursor: pointer;
    `;
    chatHeightInput.addEventListener('input', () => {
      gameSettings.chat_height = parseFloat(chatHeightInput.value);
      chatHeightValue.textContent = gameSettings.chat_height.toFixed(1);
      saveSettings();
      applyGameSettings();
    });
    gameSettingElements.chat_height = chatHeightInput;

    const chatHeightValue = document.createElement('span');
    chatHeightValue.textContent = (gameSettings.chat_height || 0).toFixed(1);
    chatHeightValue.style.cssText = `
      color: var(--text, #e8e8f0);
      font-size: 0.78rem;
      min-width: 30px;
      text-align: center;
    `;

    chatHeightRow.appendChild(chatHeightInput);
    chatHeightRow.appendChild(chatHeightValue);
    chatHeightWrapper.appendChild(chatHeightRow);
    gameTab.appendChild(chatHeightWrapper);

    // Interface Opacity slider
    const opacityWrapper = document.createElement('div');
    opacityWrapper.style.cssText = `
      margin-top: 8px;
      padding: 4px 0;
    `;

    const opacityLabel = document.createElement('label');
    opacityLabel.textContent = 'Interface Opacity';
    opacityLabel.style.cssText = `
      display: block;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      margin-bottom: 2px;
    `;
    opacityWrapper.appendChild(opacityLabel);

    const opacityRow = document.createElement('div');
    opacityRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    const opacityInput = document.createElement('input');
    opacityInput.type = 'range';
    opacityInput.min = '0';
    opacityInput.max = '100';
    opacityInput.step = '5';
    opacityInput.value = gameSettings.interface_opacity || 100;
    opacityInput.style.cssText = `
      flex: 1;
      accent-color: #2ECC71;
      cursor: pointer;
    `;
    opacityInput.addEventListener('input', () => {
      gameSettings.interface_opacity = parseInt(opacityInput.value);
      opacityValue.textContent = gameSettings.interface_opacity + '%';
      saveSettings();
      applyGameSettings();
    });
    gameSettingElements.interface_opacity = opacityInput;

    const opacityValue = document.createElement('span');
    opacityValue.textContent = (gameSettings.interface_opacity || 100) + '%';
    opacityValue.style.cssText = `
      color: var(--text, #e8e8f0);
      font-size: 0.78rem;
      min-width: 40px;
      text-align: center;
    `;

    opacityRow.appendChild(opacityInput);
    opacityRow.appendChild(opacityValue);
    opacityWrapper.appendChild(opacityRow);
    gameTab.appendChild(opacityWrapper);

    // Interface Bounds dropdown
    const boundsWrapper = document.createElement('div');
    boundsWrapper.style.cssText = `
      margin-top: 8px;
      padding: 4px 0;
    `;

    const boundsLabel = document.createElement('label');
    boundsLabel.textContent = 'Interface Scale';
    boundsLabel.style.cssText = `
      display: block;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      margin-bottom: 2px;
    `;
    boundsWrapper.appendChild(boundsLabel);

    const boundsSelect = document.createElement('select');
    boundsSelect.style.cssText = `
      width: 100%;
      padding: 6px 8px;
      background: var(--bg2, #2a2a33);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text, #e8e8f0);
      font-size: 0.78rem;
      font-family: "Inter", sans-serif;
      outline: none !important;
      -webkit-appearance: none !important;
      cursor: pointer;
    `;
    
    const boundsOptions = [
      { value: '0', label: '80%' },
      { value: '1', label: '90%' },
      { value: '2', label: '100%' }
    ];
    
    boundsOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (gameSettings.interface_bounds === opt.value) {
        option.selected = true;
      }
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

    // Apply button
    const applyGameBtn = document.createElement('button');
    applyGameBtn.textContent = 'Apply Game Settings';
    applyGameBtn.style.cssText = `
      margin-top: 12px;
      padding: 6px 16px;
      background: var(--green-dim, rgba(46, 204, 113, 0.15));
      border: 1px solid var(--green-border, rgba(46, 204, 113, 0.35));
      border-radius: 0px;
      color: var(--green, #2ECC71);
      cursor: pointer;
      font-size: 0.78rem;
      font-family: "Inter", sans-serif;
      transition: all 0.15s;
      outline: none !important;
      -webkit-appearance: none !important;
      width: 100%;
    `;
    applyGameBtn.addEventListener('mouseenter', () => {
      applyGameBtn.style.background = 'rgba(46, 204, 113, 0.25)';
    });
    applyGameBtn.addEventListener('mouseleave', () => {
      applyGameBtn.style.background = 'var(--green-dim, rgba(46, 204, 113, 0.15))';
    });
    applyGameBtn.addEventListener('click', applyGameSettings);
    gameTab.appendChild(applyGameBtn);

    contentArea.appendChild(gameTab);

    // ---- Tab Content: Client ----
    const clientTab = document.createElement('div');
    clientTab.className = 'tab-content';
    clientTab.id = 'tab-client';
    clientTab.style.cssText = `
      display: ${activeTab === 'client' ? 'block' : 'none'};
      height: 100%;
      padding: 10px 0;
    `;

    const clientTitle = document.createElement('h2');
    clientTitle.textContent = 'Client Settings';
    clientTitle.style.cssText = `
      font-family: "Permanent Marker", cursive;
      font-size: 1rem;
      font-weight: 700;
      color: #8a8aa0;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0 0 12px 0;
    `;
    clientTab.appendChild(clientTitle);

    // Export section
    const exportLabel = document.createElement('label');
    exportLabel.textContent = 'Export Settings';
    exportLabel.style.cssText = `
      display: block;
      margin-top: 8px;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      letter-spacing: 0.03em;
    `;
    clientTab.appendChild(exportLabel);

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export Settings to JSON';
    exportBtn.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      background: var(--blue-dim, rgba(52, 152, 219, 0.15));
      border: 1px solid var(--blue-border, rgba(52, 152, 219, 0.35));
      border-radius: 0px;
      color: var(--blue, #3498db);
      cursor: pointer;
      font-size: 0.78rem;
      font-family: "Inter", sans-serif;
      transition: all 0.15s;
      margin-bottom: 12px;
      outline: none !important;
      -webkit-appearance: none !important;
    `;
    exportBtn.addEventListener('mouseenter', () => {
      exportBtn.style.background = 'rgba(52, 152, 219, 0.25)';
    });
    exportBtn.addEventListener('mouseleave', () => {
      exportBtn.style.background = 'var(--blue-dim, rgba(52, 152, 219, 0.15))';
    });
    exportBtn.addEventListener('click', exportSettings);
    clientTab.appendChild(exportBtn);

    // Import section
    const importLabel = document.createElement('label');
    importLabel.textContent = 'Import Settings';
    importLabel.style.cssText = `
      display: block;
      margin-top: 8px;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      letter-spacing: 0.03em;
    `;
    clientTab.appendChild(importLabel);

    const importWrapper = document.createElement('div');
    importWrapper.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json';
    importInput.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      background: var(--bg2, #2a2a33);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text, #e8e8f0);
      font-size: 0.72rem;
      font-family: "Inter", sans-serif;
      outline: none !important;
      -webkit-appearance: none !important;
      cursor: pointer;
    `;
    importInput.addEventListener('change', importSettings);
    importWrapper.appendChild(importInput);

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import';
    importBtn.style.cssText = `
      padding: 6px 12px;
      background: var(--green-dim, rgba(46, 204, 113, 0.15));
      border: 1px solid var(--green-border, rgba(46, 204, 113, 0.35));
      border-radius: 0px;
      color: var(--green, #2ECC71);
      cursor: pointer;
      font-size: 0.7rem;
      font-family: "Inter", sans-serif;
      transition: all 0.15s;
      outline: none !important;
      -webkit-appearance: none !important;
      white-space: nowrap;
    `;
    importBtn.addEventListener('mouseenter', () => {
      importBtn.style.background = 'rgba(46, 204, 113, 0.25)';
    });
    importBtn.addEventListener('mouseleave', () => {
      importBtn.style.background = 'var(--green-dim, rgba(46, 204, 113, 0.15))';
    });
    importBtn.addEventListener('click', () => importInput.click());
    importWrapper.appendChild(importBtn);

    clientTab.appendChild(importWrapper);

    // Reset section
    const resetLabel = document.createElement('label');
    resetLabel.textContent = 'Reset Settings';
    resetLabel.style.cssText = `
      display: block;
      margin-top: 12px;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--text-muted, #8888a0);
      font-size: 0.72rem;
      letter-spacing: 0.03em;
    `;
    clientTab.appendChild(resetLabel);

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset to Defaults';
    resetBtn.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      background: transparent;
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text-muted, #8888a0);
      cursor: pointer;
      font-size: 0.78rem;
      font-family: "Inter", sans-serif;
      transition: all 0.15s;
      outline: none !important;
      -webkit-appearance: none !important;
    `;
    resetBtn.addEventListener('mouseenter', () => {
      resetBtn.style.background = 'rgba(220,40,40,0.2)';
      resetBtn.style.borderColor = 'rgba(220,40,40,0.4)';
      resetBtn.style.color = '#ff6666';
    });
    resetBtn.addEventListener('mouseleave', () => {
      resetBtn.style.background = 'transparent';
      resetBtn.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      resetBtn.style.color = 'var(--text-muted, #8888a0)';
    });
    resetBtn.addEventListener('click', resetSettings);
    clientTab.appendChild(resetBtn);

    contentArea.appendChild(clientTab);

    // ---- Tab Content: Files ----
    const filesTab = document.createElement('div');
    filesTab.className = 'tab-content';
    filesTab.id = 'tab-files';
    filesTab.style.cssText = `
      display: ${activeTab === 'files' ? 'block' : 'none'};
      height: 100%;
      display: ${activeTab === 'files' ? 'flex' : 'none'};
      align-items: center;
      justify-content: center;
    `;

    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = `
      padding: 20px;
      text-align: center;
      color: var(--text-muted, #8888a0);
      font-size: 0.85rem;
    `;
    emptyMsg.innerHTML = '<i class="fas fa-folder-open" style="font-size: 2rem; display: block; margin-bottom: 8px; opacity: 0.3;"></i>File management moved to respective tabs';
    filesTab.appendChild(emptyMsg);

    contentArea.appendChild(filesTab);

    // ---- Tab Content: Settings ----
    const settingsTab = document.createElement('div');
    settingsTab.className = 'tab-content';
    settingsTab.id = 'tab-settings';
    settingsTab.style.cssText = `
      display: ${activeTab === 'settings' ? 'block' : 'none'};
      height: 100%;
      padding: 10px 0;
    `;

    const settingsTitle = document.createElement('h2');
    settingsTitle.textContent = 'Settings';
    settingsTitle.style.cssText = `
      font-family: "Permanent Marker", cursive;
      font-size: 1rem;
      font-weight: 700;
      color: #8a8aa0;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0 0 12px 0;
    `;
    settingsTab.appendChild(settingsTitle);

    // Clear all styles button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear All Injected Styles & Scripts';
    clearBtn.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      background: transparent;
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text-muted, #8888a0);
      cursor: pointer;
      font-size: 0.8rem;
      font-family: "Inter", sans-serif;
      transition: all 0.15s;
      margin-bottom: 8px;
      outline: none !important;
      -webkit-appearance: none !important;
    `;
    clearBtn.addEventListener('mouseenter', () => {
      clearBtn.style.background = 'rgba(220,40,40,0.2)';
      clearBtn.style.borderColor = 'rgba(220,40,40,0.4)';
      clearBtn.style.color = '#ff6666';
    });
    clearBtn.addEventListener('mouseleave', () => {
      clearBtn.style.background = 'transparent';
      clearBtn.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      clearBtn.style.color = 'var(--text-muted, #8888a0)';
    });
    clearBtn.addEventListener('click', () => {
      clearAllStyles(true);
      clearAllScripts(true);
      clearAllCommunityScripts();
      updateCssFileList();
      updateJsFileList();
      updateCommunityScriptList();
    });
    settingsTab.appendChild(clearBtn);

    // Refresh community scripts button
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh Community Scripts';
    refreshBtn.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      background: transparent;
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text-muted, #8888a0);
      cursor: pointer;
      font-size: 0.8rem;
      font-family: "Inter", sans-serif;
      transition: all 0.15s;
      margin-bottom: 8px;
      outline: none !important;
      -webkit-appearance: none !important;
    `;
    refreshBtn.addEventListener('mouseenter', () => {
      refreshBtn.style.background = 'rgba(46, 204, 113, 0.15)';
      refreshBtn.style.borderColor = 'rgba(46, 204, 113, 0.35)';
      refreshBtn.style.color = '#2ECC71';
    });
    refreshBtn.addEventListener('mouseleave', () => {
      refreshBtn.style.background = 'transparent';
      refreshBtn.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      refreshBtn.style.color = 'var(--text-muted, #8888a0)';
    });
    refreshBtn.addEventListener('click', loadCommunityScripts);
    settingsTab.appendChild(refreshBtn);

    // Keybind info
    const keybindInfo = document.createElement('div');
    keybindInfo.style.cssText = `
      padding: 10px 12px;
      background: var(--bg2, #2a2a33);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      font-size: 0.72rem;
      color: var(--text-muted, #8888a0);
      line-height: 1.5;
    `;
    keybindInfo.innerHTML = `
      <strong style="color: var(--text, #e8e8f0);">Keybinds</strong><br>
      <kbd style="background: var(--bg3, #33333d); padding: 1px 8px; border-radius: 3px; color: #ccc; font-family: inherit;">Right Shift</kbd> - Toggle menu<br>
      <kbd style="background: var(--bg3, #33333d); padding: 1px 8px; border-radius: 3px; color: #ccc; font-family: inherit;">Escape</kbd> - Close menu
    `;
    settingsTab.appendChild(keybindInfo);

    contentArea.appendChild(settingsTab);

    // Status indicator - hidden
    const status = document.createElement('div');
    status.id = 'dev-menu-status';
    status.style.cssText = `
      display: none;
    `;
    contentArea.appendChild(status);

    mainLayout.appendChild(contentArea);
    menuElement.appendChild(mainLayout);
    overlayElement.appendChild(menuElement);
    document.body.appendChild(overlayElement);

    // Load Font Awesome if not already loaded
    loadFontAwesome();
    updateCssFileList();
    updateJsFileList();
    
    // Load community scripts
    loadCommunityScripts();
    
    // Apply game settings after UI is ready
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
    startMenuX = rect.left;
    startMenuY = rect.top;
    startX = e.clientX;
    startY = e.clientY;
    
    menuElement.style.cursor = 'grabbing';
    menuElement.style.transition = 'none';
    menuElement.style.transform = 'none';
    menuElement.style.opacity = '1';
    
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
    startMenuX = rect.left;
    startMenuY = rect.top;
    startX = touch.clientX;
    startY = touch.clientY;
    
    menuElement.style.transition = 'none';
    menuElement.style.transform = 'none';
    menuElement.style.opacity = '1';
    
    document.addEventListener('touchmove', onDragMoveTouch, { passive: false });
    document.addEventListener('touchend', stopDragTouch, { passive: false });
  }

  function onDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;
    
    const maxX = window.innerWidth - menuElement.offsetWidth;
    const maxY = window.innerHeight - menuElement.offsetHeight;
    
    menuX = Math.max(0, Math.min(newX, maxX));
    menuY = Math.max(0, Math.min(newY, maxY));
    
    menuElement.style.left = menuX + 'px';
    menuElement.style.top = menuY + 'px';
  }

  function onDragMoveTouch(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    if (!touch) return;
    
    const newX = touch.clientX - dragOffsetX;
    const newY = touch.clientY - dragOffsetY;
    
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
    menuElement.style.cursor = '';
    menuElement.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', stopDrag);
  }

  function stopDragTouch() {
    if (!isDragging) return;
    isDragging = false;
    menuElement.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    document.removeEventListener('touchmove', onDragMoveTouch);
    document.removeEventListener('touchend', stopDragTouch);
  }

  // ---- Switch Tab ----
  function switchTab(tabId) {
    activeTab = tabId;
    
    // Update sidebar buttons
    document.querySelectorAll('.sidebar-tab').forEach(btn => {
      const tab = btn.dataset.tab;
      if (tab) {
        const isActive = tab === tabId;
        btn.style.background = isActive ? 'var(--green-dim, rgba(46, 204, 113, 0.15))' : 'transparent';
        btn.style.border = isActive ? '1px solid var(--green-border, rgba(46, 204, 113, 0.35))' : 'none';
        btn.style.color = isActive ? 'var(--green, #2ECC71)' : '#555568';
      }
    });
    
    // Update content panels
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });
    
    const target = document.getElementById(`tab-${tabId}`);
    if (target) {
      target.style.display = 'block';
    }
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
    // Remove existing game styles
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
      gameSettingsApplied = true;
      console.log('[UbuntuClient] Applied game settings,', styles.length, 'styles');
    } else {
      gameSettingsApplied = false;
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
          // Merge with defaults
          gameSettings = { ...gameSettings, ...data.settings };
          saveSettings();
          
          // Update UI elements
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
    // Update toggles
    const toggleIds = ['perm_crosshair', 'perm_tablist', 'hide_chat', 'hide_kill_text', 'hide_interface', 'skip_loading'];
    toggleIds.forEach(id => {
      if (gameSettingElements[id]) {
        gameSettingElements[id].checked = gameSettings[id] || false;
      }
    });
    
    // Update chat height
    if (gameSettingElements.chat_height) {
      gameSettingElements.chat_height.value = gameSettings.chat_height || 0;
      const valueDisplay = gameSettingElements.chat_height.parentElement?.querySelector('span');
      if (valueDisplay) {
        valueDisplay.textContent = (gameSettings.chat_height || 0).toFixed(1);
      }
    }
    
    // Update opacity
    if (gameSettingElements.interface_opacity) {
      gameSettingElements.interface_opacity.value = gameSettings.interface_opacity || 100;
      const valueDisplay = gameSettingElements.interface_opacity.parentElement?.querySelector('span');
      if (valueDisplay) {
        valueDisplay.textContent = (gameSettings.interface_opacity || 100) + '%';
      }
    }
    
    // Update bounds
    if (gameSettingElements.interface_bounds) {
      gameSettingElements.interface_bounds.value = gameSettings.interface_bounds || '2';
    }
  }

  // ---- Reset Settings ----
  function resetSettings() {
    if (!confirm('Reset all game settings to defaults?')) return;
    
    const defaults = {
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
    
    gameSettings = { ...defaults };
    saveSettings();
    updateGameSettingsUI();
    applyGameSettings();
    
    console.log('[UbuntuClient] Settings reset to defaults');
  }

  // ---- Load Community Scripts ----
  function loadCommunityScripts() {
    const dropdown = communityScriptDropdown;
    if (!dropdown) return;
    
    // Show loading state
    dropdown.innerHTML = '';
    const loadingOption = document.createElement('option');
    loadingOption.textContent = 'Loading scripts...';
    loadingOption.disabled = true;
    loadingOption.selected = true;
    dropdown.appendChild(loadingOption);
    
    const scriptUrl = 'https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/script.json';
    
    fetch(scriptUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
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
        const errorOption = document.createElement('option');
        errorOption.textContent = 'Error loading scripts';
        errorOption.disabled = true;
        errorOption.selected = true;
        dropdown.appendChild(errorOption);
      });
  }

  // ---- Populate Community Dropdown ----
  function populateCommunityDropdown() {
    const dropdown = communityScriptDropdown;
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    
    if (communityScripts.length === 0) {
      const emptyOption = document.createElement('option');
      emptyOption.textContent = 'No scripts available';
      emptyOption.disabled = true;
      emptyOption.selected = true;
      dropdown.appendChild(emptyOption);
      return;
    }
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.textContent = '-- Select a script --';
    defaultOption.value = '';
    defaultOption.selected = true;
    dropdown.appendChild(defaultOption);
    
    // Add scripts
    communityScripts.forEach((script, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = script.name;
      dropdown.appendChild(option);
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
    
    // Check if already installed
    if (installedCommunityScripts.some(s => s.name === script.name)) {
      console.warn('[UbuntuClient] Script already installed:', script.name);
      return;
    }
    
    // Install the script
    fetch(script.url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
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
        
        // Add to installed list
        installedCommunityScripts.push({
          ...script,
          element: scriptElement
        });
        
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
    
    // Remove the script element from DOM
    if (script.element && script.element.parentNode) {
      script.element.remove();
      const idx = injectedScripts.indexOf(script.element);
      if (idx > -1) injectedScripts.splice(idx, 1);
    }
    
    // Remove from installed list
    installedCommunityScripts.splice(index, 1);
    updateCommunityScriptList();
    console.log('[UbuntuClient] Uninstalled community script:', script.name);
  }

  // ---- Clear All Community Scripts ----
  function clearAllCommunityScripts() {
    const scriptsToRemove = [];
    installedCommunityScripts.forEach(script => {
      if (script.element && script.element.parentNode) {
        scriptsToRemove.push(script.element);
      }
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
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = `
        padding: 4px;
        text-align: center;
        color: var(--text-muted, #8888a0);
        font-size: 0.7rem;
      `;
      emptyMsg.textContent = 'No community scripts installed yet.';
      communityScriptListContainer.appendChild(emptyMsg);
      return;
    }
    
    installedCommunityScripts.forEach((script, index) => {
      const fileItem = document.createElement('div');
      fileItem.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px;
        background: var(--bg2, #2a2a33);
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 0px;
        font-size: 0.7rem;
        color: var(--text, #e8e8f0);
      `;
      
      const fileInfo = document.createElement('span');
      fileInfo.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        overflow: hidden;
      `;
      
      const icon = document.createElement('i');
      icon.className = 'fa-users';
      icon.style.cssText = `color: var(--purple, #9b59b6); font-size: 0.8rem;`;
      fileInfo.appendChild(icon);
      
      const name = document.createElement('span');
      name.textContent = script.name;
      name.style.cssText = `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.7rem;`;
      fileInfo.appendChild(name);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
      deleteBtn.style.cssText = `
        background: transparent;
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 0px;
        color: var(--text-muted, #8888a0);
        cursor: pointer;
        padding: 2px 6px;
        font-size: 0.6rem;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
        outline: none !important;
        -webkit-appearance: none !important;
      `;
      deleteBtn.addEventListener('mouseenter', () => {
        deleteBtn.style.background = 'rgba(220,40,40,0.2)';
        deleteBtn.style.borderColor = 'rgba(220,40,40,0.4)';
        deleteBtn.style.color = '#ff6666';
      });
      deleteBtn.addEventListener('mouseleave', () => {
        deleteBtn.style.background = 'transparent';
        deleteBtn.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
        deleteBtn.style.color = 'var(--text-muted, #8888a0)';
      });
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
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = `
        padding: 4px;
        text-align: center;
        color: var(--text-muted, #8888a0);
        font-size: 0.7rem;
      `;
      emptyMsg.textContent = 'No CSS files uploaded yet.';
      cssFileListContainer.appendChild(emptyMsg);
      return;
    }
    
    uploadedCssFiles.forEach((file, index) => {
      const fileItem = createFileListItem(file, index, 'css');
      cssFileListContainer.appendChild(fileItem);
    });
    
    // Update file count
    const countEl = document.getElementById('css-file-count');
    if (countEl) {
      countEl.textContent = `${uploadedCssFiles.length} / ${MAX_CSS_FILES} CSS files uploaded`;
    }
    
    // Enable/disable file input
    if (cssFileInput) {
      cssFileInput.disabled = uploadedCssFiles.length >= MAX_CSS_FILES;
      cssFileInput.style.opacity = uploadedCssFiles.length >= MAX_CSS_FILES ? '0.5' : '1';
    }
  }

  // ---- Update JS File List ----
  function updateJsFileList() {
    if (!jsFileListContainer) return;
    
    jsFileListContainer.innerHTML = '';
    
    if (uploadedJsFiles.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = `
        padding: 4px;
        text-align: center;
        color: var(--text-muted, #8888a0);
        font-size: 0.7rem;
      `;
      emptyMsg.textContent = 'No JS files uploaded yet.';
      jsFileListContainer.appendChild(emptyMsg);
      return;
    }
    
    uploadedJsFiles.forEach((file, index) => {
      const fileItem = createFileListItem(file, index, 'js');
      jsFileListContainer.appendChild(fileItem);
    });
    
    // Update file count
    const countEl = document.getElementById('js-file-count');
    if (countEl) {
      countEl.textContent = `${uploadedJsFiles.length} / ${MAX_JS_FILES} JS files uploaded`;
    }
    
    // Enable/disable file input
    if (jsFileInput) {
      jsFileInput.disabled = uploadedJsFiles.length >= MAX_JS_FILES;
      jsFileInput.style.opacity = uploadedJsFiles.length >= MAX_JS_FILES ? '0.5' : '1';
    }
  }

  // ---- Create File List Item ----
  function createFileListItem(file, index, type) {
    const fileItem = document.createElement('div');
    fileItem.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
      background: var(--bg2, #2a2a33);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      font-size: 0.7rem;
      color: var(--text, #e8e8f0);
    `;
    
    const fileInfo = document.createElement('span');
    fileInfo.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
    `;
    
    const icon = document.createElement('i');
    icon.className = type === 'css' ? 'fa-file-code' : 'fa-file-code';
    icon.style.cssText = `color: ${type === 'css' ? 'var(--green, #2ECC71)' : 'var(--blue, #3498db)'}; font-size: 0.8rem;`;
    fileInfo.appendChild(icon);
    
    const name = document.createElement('span');
    name.textContent = file.name;
    name.style.cssText = `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.7rem;`;
    fileInfo.appendChild(name);
    
    const size = document.createElement('span');
    size.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
    size.style.cssText = `color: var(--text-muted, #8888a0); font-size: 0.6rem;`;
    fileInfo.appendChild(size);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
    deleteBtn.style.cssText = `
      background: transparent;
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 0px;
      color: var(--text-muted, #8888a0);
      cursor: pointer;
      padding: 2px 6px;
      font-size: 0.6rem;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none !important;
      -webkit-appearance: none !important;
    `;
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.background = 'rgba(220,40,40,0.2)';
      deleteBtn.style.borderColor = 'rgba(220,40,40,0.4)';
      deleteBtn.style.color = '#ff6666';
    });
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.background = 'transparent';
      deleteBtn.style.borderColor = 'var(--border, rgba(255,255,255,0.08))';
      deleteBtn.style.color = 'var(--text-muted, #8888a0)';
    });
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
      
      // Remove the injected style for this file
      const stylesToRemove = [];
      injectedStyles.forEach(style => {
        if (style.dataset && style.dataset.fileName === removed.name) {
          stylesToRemove.push(style);
        }
      });
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
      
      // Remove the injected script for this file
      const scriptsToRemove = [];
      injectedScripts.forEach(script => {
        if (script.dataset && script.dataset.fileName === removed.name) {
          scriptsToRemove.push(script);
        }
      });
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
    
    // Check if already at max
    if (uploadedCssFiles.length >= MAX_CSS_FILES) {
      cssFileInput.value = '';
      return;
    }
    
    // Check for duplicate filename
    if (uploadedCssFiles.some(f => f.name === file.name)) {
      cssFileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      const cssContent = event.target.result;
      
      // Store the file
      uploadedCssFiles.push({
        name: file.name,
        content: cssContent,
        size: file.size
      });
      
      // Inject the CSS
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
    reader.onerror = function() {
      cssFileInput.value = '';
    };
    reader.readAsText(file);
  }

  // ---- Handle JS File Import ----
  function handleJsFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if already at max
    if (uploadedJsFiles.length >= MAX_JS_FILES) {
      jsFileInput.value = '';
      return;
    }
    
    // Check for duplicate filename
    if (uploadedJsFiles.some(f => f.name === file.name)) {
      jsFileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      const jsContent = event.target.result;
      
      // Store the file
      uploadedJsFiles.push({
        name: file.name,
        content: jsContent,
        size: file.size
      });
      
      // Inject the JavaScript
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
    reader.onerror = function() {
      jsFileInput.value = '';
    };
    reader.readAsText(file);
  }

  // ---- Handle Auto-Apply for CSS ----
  function handleAutoApply() {
    if (autoApplyTimeout) {
      clearTimeout(autoApplyTimeout);
    }
    autoApplyTimeout = setTimeout(() => {
      applyStyles();
      autoApplyTimeout = null;
    }, 300);
  }

  // ---- Handle Auto-Apply for JavaScript ----
  function handleJsAutoApply() {
    if (autoApplyTimeout) {
      clearTimeout(autoApplyTimeout);
    }
    autoApplyTimeout = setTimeout(() => {
      applyJavaScript();
      autoApplyTimeout = null;
    }, 300);
  }

  // ---- Apply Styles ----
  function applyStyles() {
    const linkValue = cssLinkInput.value.trim();
    const rawValue = rawCssInput.value.trim();

    // Clear previous URL and raw styles (but keep file styles)
    const stylesToRemove = [];
    injectedStyles.forEach(style => {
      if (style.dataset && (style.dataset.type === 'url' || style.dataset.type === 'raw')) {
        stylesToRemove.push(style);
      }
    });
    stylesToRemove.forEach(style => {
      style.remove();
      const idx = injectedStyles.indexOf(style);
      if (idx > -1) injectedStyles.splice(idx, 1);
    });

    // Apply CSS from URL - Fetch and inject as raw CSS
    if (linkValue) {
      fetch(linkValue)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
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

    // Apply Raw CSS
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

    // Clear previous URL and raw scripts (but keep file scripts)
    const scriptsToRemove = [];
    injectedScripts.forEach(script => {
      if (script.dataset && (script.dataset.type === 'url' || script.dataset.type === 'raw')) {
        scriptsToRemove.push(script);
      }
    });
    scriptsToRemove.forEach(script => {
      script.remove();
      const idx = injectedScripts.indexOf(script);
      if (idx > -1) injectedScripts.splice(idx, 1);
    });

    // Apply JavaScript from URL
    if (urlValue) {
      fetch(urlValue)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
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

    // Apply Raw JavaScript
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
    const scriptsToRemove = [];
    injectedScripts.forEach(script => {
      if (script.parentNode) {
        scriptsToRemove.push(script);
      }
    });

    scriptsToRemove.forEach(script => {
      script.remove();
    });

    injectedScripts = [];
    uploadedJsFiles = [];
    updateJsFileList();
    
    if (showFeedback) {
      console.log('[UbuntuClient] Cleared all injected scripts');
    }
  }

  // ---- Clear All Styles ----
  function clearAllStyles(showFeedback = true) {
    const stylesToRemove = [];
    injectedStyles.forEach(style => {
      if (style.parentNode) {
        stylesToRemove.push(style);
      }
    });

    stylesToRemove.forEach(style => {
      style.remove();
    });

    injectedStyles = [];
    
    // Clear uploaded CSS files
    uploadedCssFiles = [];
    updateCssFileList();
    
    if (showFeedback) {
      console.log('[UbuntuClient] Cleared all injected styles');
    }
  }

  // ---- Toggle Menu ----
  function toggleMenu(event) {
    if (event && event.key) {
      if (event.key !== 'Shift' || event.location !== 2) {
        return;
      }
      event.preventDefault();
    }

    menuVisible = !menuVisible;
    overlayElement.style.display = menuVisible ? 'flex' : 'none';

    if (menuVisible) {
      menuElement.style.transform = 'scale(1)';
      menuElement.style.opacity = '1';
      setTimeout(() => {
        if (cssLinkInput) cssLinkInput.focus();
      }, 200);
      setTimeout(() => {
        if (cssLinkInput.value.trim() || rawCssInput.value.trim()) {
          applyStyles();
        }
        if (jsUrlInput.value.trim() || rawJsInput.value.trim()) {
          applyJavaScript();
        }
      }, 300);
    } else {
      menuElement.style.transform = 'scale(0.95)';
      menuElement.style.opacity = '0';
    }
  }

  // ---- Initialize ----
  function init() {
    createMenu();

    document.addEventListener('keydown', toggleMenu);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuVisible) {
        toggleMenu(event);
      }
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
    if (overlayElement && overlayElement.parentNode) {
      overlayElement.remove();
    }
    clearAllStyles(false);
    clearAllScripts(false);
    clearAllCommunityScripts();
    if (statusTimeout) {
      clearTimeout(statusTimeout);
      statusTimeout = null;
    }
    if (autoApplyTimeout) {
      clearTimeout(autoApplyTimeout);
      autoApplyTimeout = null;
    }
    console.log('[UbuntuClient] Cleaned up.');
  }

  // Start the addon
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