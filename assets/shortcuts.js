const { app, screen, dialog, clipboard } = require("electron");
const shortcut = require("electron-localshortcut");
const fs = require("fs");
const path = require("path");

const registerShortcuts = (window) => {
  const register = (key, action) => shortcut.register(window, key, action);
  
  // F2 - Save screenshot to Documents/Ubuntu/screenshots AND copy to clipboard
  register("F2", () => {
    const { x, y, width, height } = screen.getPrimaryDisplay().bounds;
    window.capturePage({ x, y, width, height }).then((image) => {
      // Create the directory if it doesn't exist
      const documentsPath = app.getPath('documents');
      const saveDir = path.join(documentsPath, "Ubuntu", "screenshots");
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = path.join(saveDir, `screenshot-${timestamp}.png`);
      
      // Save the image
      fs.writeFile(filePath, image.toPNG(), (err) => {
        if (err) {
          console.error("[Screenshot] Failed to save:", err);
        } else {
          console.log("[Screenshot] Saved to:", filePath);
          // Copy to clipboard as well
          clipboard.writeImage(image);
          console.log("[Screenshot] Also copied to clipboard");
        }
      });
    }).catch((err) => {
      console.error("[Screenshot] Failed to capture:", err);
    });
  });
  
  register("F4", () => {
    // Read settings from the same file as your main code
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