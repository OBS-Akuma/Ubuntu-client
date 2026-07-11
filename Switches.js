const { app } = require("electron");

function applySwitches(settings) {
  // === FPS & Performance Settings ===
  
  // Uncapped FPS - removes the 60fps limit
  if (settings.unlimited_fps !== false) {
    app.commandLine.appendSwitch("disable-frame-rate-limit");
    app.commandLine.appendSwitch("disable-gpu-vsync");
    console.log('[Switches] Uncapped FPS enabled');
  }
  
  // GPU Process
  if (settings.in_process_gpu !== false) {
    app.commandLine.appendSwitch("in-process-gpu");
    console.log('[Switches] In-process GPU enabled');
  }

  // === Performance Optimizations ===
  
  // High DPI support for better rendering
  app.commandLine.appendSwitch("high-dpi-support", "1");
  
  // Ignore GPU blacklist to use hardware acceleration
  app.commandLine.appendSwitch("ignore-gpu-blacklist");
  
  // Enable GPU rasterization for better performance
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  
  // Enable zero-copy for faster GPU memory access
  app.commandLine.appendSwitch("enable-zero-copy");
  
  // Enable hardware acceleration
  app.commandLine.appendSwitch("enable-accelerated-2d-canvas");
  app.commandLine.appendSwitch("enable-accelerated-video");
  
  // Disable smooth scrolling for better performance
  app.commandLine.appendSwitch("disable-smooth-scrolling");
  
  // Disable pinch zoom for better performance
  app.commandLine.appendSwitch("disable-pinch");
  
  // === Rendering Settings ===
  
  // Force GPU rendering with more memory
  app.commandLine.appendSwitch("force-gpu-mem-available-mb", "4096");
  
  // Disable software rendering fallback
  app.commandLine.appendSwitch("disable-software-rasterizer");
  
  // === Memory & CPU Optimizations ===
  
  // Limit renderer process to reduce memory usage
  app.commandLine.appendSwitch("renderer-process-limit", "1");
  
  // Enable aggressive garbage collection
  app.commandLine.appendSwitch("js-flags", "--max-old-space-size=2048 --expose-gc");
  
  // Disable unnecessary features
  app.commandLine.appendSwitch("disable-background-networking");
  app.commandLine.appendSwitch("disable-client-side-phishing-detection");
  app.commandLine.appendSwitch("disable-default-apps");
  app.commandLine.appendSwitch("disable-domain-reliability");
  app.commandLine.appendSwitch("disable-extensions");
  app.commandLine.appendSwitch("disable-plugins");
  app.commandLine.appendSwitch("disable-speech-api");
  app.commandLine.appendSwitch("disable-sync");
  
  // === GPU Settings ===
  
  // Enable GPU process
  app.commandLine.appendSwitch("enable-gpu");
  
  // Enable WebGL optimizations
  app.commandLine.appendSwitch("enable-webgl-draft-extensions");
  app.commandLine.appendSwitch("enable-webgl2-compute-context");
  
  // === Experimental Features ===
  
  // Enable experimental canvas features
  app.commandLine.appendSwitch("enable-experimental-canvas-features");
  
  // Enable QUIC protocol for faster networking
  app.commandLine.appendSwitch("enable-quic");
  
  // Allow renderer process reuse for better performance
  app.allowRendererProcessReuse = true;
  
  console.log('[Switches] All performance switches applied successfully');
}

// Optional: Function to apply settings to the window
function applyWindowSettings(win, settings) {
  if (!win || win.isDestroyed()) return;
  
  try {
    // Set unlimited FPS on the window
    if (settings.unlimited_fps !== false) {
      // Set frame rate to 0 for unlimited
      if (typeof win.webContents.setFrameRate === 'function') {
        win.webContents.setFrameRate(0);
        console.log('[Switches] Window FPS set to unlimited');
      }
      
      // Disable background throttling
      if (typeof win.webContents.setBackgroundThrottling === 'function') {
        win.webContents.setBackgroundThrottling(false);
        console.log('[Switches] Background throttling disabled');
      }
    }
    
    // Additional window optimizations
    if (typeof win.setResizable === 'function') {
      win.setResizable(true);
    }
    
    if (typeof win.setFullScreenable === 'function') {
      win.setFullScreenable(true);
    }
    
    console.log('[Switches] Window settings applied successfully');
  } catch (e) {
    console.error('[Switches] Error applying window settings:', e);
  }
}

// Function to get default settings
function getDefaultSettings() {
  return {
    unlimited_fps: true,
    in_process_gpu: true
  };
}

module.exports = {
  applySwitches,
  applyWindowSettings,
  getDefaultSettings
};