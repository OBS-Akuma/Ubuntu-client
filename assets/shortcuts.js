const { app, screen, dialog, clipboard, Menu } = require("electron");
const shortcut = require("electron-localshortcut");
const fs = require("fs");
const path = require("path");

const registerShortcuts = (window) => {
  const register = (key, action) => shortcut.register(window, key, action);
  
  let menuVisible = false;
  
  // Send link to chat function - NO POPUPS
  const sendLinkToChat = () => {
    window.webContents.executeJavaScript(`
      (function() {
        const WS_URL = 'wss://chat.kirka.io/';
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.log('[Chat] No token found');
          return false;
        }
        
        const currentUrl = window.location.href;
        let ws = new WebSocket(WS_URL, token);
        
        ws.onopen = function() {
          ws.send(currentUrl);
          console.log('[Chat] Link sent:', currentUrl);
          
          // Keep the connection alive as per the script
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 2 && data.message === '.') {
                setTimeout(() => ws.send(';3'), 100);
              }
            } catch(e) {}
          };
          
          ws.onclose = () => setTimeout(() => {
            ws = new WebSocket(WS_URL, localStorage.getItem('token'));
          }, 3000);
        };
        
        ws.onerror = function() {
          console.log('[Chat] Failed to send link');
        };
        
        return true;
      })();
    `).catch((err) => {
      console.error('[Chat] Failed to send link:', err);
    });
  };

  // Copy to clipboard function - NO POPUPS
  const copyToClipboard = () => {
    window.webContents.executeJavaScript(`
      window.location.href;
    `).then((currentUrl) => {
      clipboard.writeText(currentUrl);
      console.log('[Invite] Link copied to clipboard:', currentUrl);
    }).catch((err) => {
      console.error('[Invite] Failed to copy link:', err);
    });
  };

  // Function to show the native menu bar
  const showMenuBar = () => {
    const template = [
      {
        label: 'Invite',
        submenu: [
          {
            label: 'Send Link to Chat',
            click: sendLinkToChat
          },
          {
            label: 'Copy to Clipboard',
            click: copyToClipboard
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    menuVisible = true;
  };

  // Function to hide the menu bar
  const hideMenuBar = () => {
    Menu.setApplicationMenu(null);
    menuVisible = false;
  };

  // PageUp key to toggle menu
  window.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'PageUp' && input.type === 'keyDown') {
      event.preventDefault();
      
      if (menuVisible) {
        hideMenuBar();
      } else {
        showMenuBar();
      }
    }
    
    if (input.key === 'Escape' && input.type === 'keyDown' && menuVisible) {
      hideMenuBar();
      event.preventDefault();
    }
  });

  // F2 - Save screenshot
  register("F2", () => {
    const { x, y, width, height } = screen.getPrimaryDisplay().bounds;
    window.capturePage({ x, y, width, height }).then((image) => {
      const documentsPath = app.getPath('documents');
      const saveDir = path.join(documentsPath, "Ubuntu", "screenshots");
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = path.join(saveDir, `screenshot-${timestamp}.png`);
      
      fs.writeFile(filePath, image.toPNG(), (err) => {
        if (err) {
          console.error("[Screenshot] Failed to save:", err);
        } else {
          console.log("[Screenshot] Saved to:", filePath);
          clipboard.writeImage(image);
          console.log("[Screenshot] Also copied to clipboard");
        }
      });
    }).catch((err) => {
      console.error("[Screenshot] Failed to capture:", err);
    });
  });
  
  register("F4", () => {
    const documentsPath = app.getPath('documents');
    const ubuntuFolder = path.join(documentsPath, 'Ubuntu');
    const settingsPath = path.join(ubuntuFolder, 'settings.txt');
    let proxyUrl = 'https://kirka.io/';
    
    try {
      if (fs.existsSync(settingsPath)) {
        const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (settingsData.proxy) proxyUrl = settingsData.proxy;
      }
    } catch (e) {
      console.log('[Shortcuts] Error reading settings:', e);
    }
    
    window.loadURL(proxyUrl);
  });
  
  register("F5", () => {
    window.reload();
  });
  
  register("F12", () => window.webContents.toggleDevTools());
};

module.exports = { registerShortcuts };