const { app } = require("electron");

function applySwitches(settings) {

  

  if (settings.unlimited_fps !== false) {
    app.commandLine.appendSwitch("disable-frame-rate-limit");
    app.commandLine.appendSwitch("disable-gpu-vsync");
    console.log('[Switches] Uncapped FPS enabled');
  }
  

  if (settings.in_process_gpu !== false) {
    app.commandLine.appendSwitch("in-process-gpu");
    console.log('[Switches] In-process GPU enabled');
  }


  

  app.commandLine.appendSwitch("high-dpi-support", "1");
  

  app.commandLine.appendSwitch("ignore-gpu-blacklist");
  

  app.commandLine.appendSwitch("enable-gpu-rasterization");
  

  app.commandLine.appendSwitch("enable-zero-copy");
  

  app.commandLine.appendSwitch("enable-accelerated-2d-canvas");
  app.commandLine.appendSwitch("enable-accelerated-video");
  

  app.commandLine.appendSwitch("disable-smooth-scrolling");
  

  app.commandLine.appendSwitch("disable-pinch");
  

  

  app.commandLine.appendSwitch("force-gpu-mem-available-mb", "4096");
  

  app.commandLine.appendSwitch("disable-software-rasterizer");
  

  

  app.commandLine.appendSwitch("renderer-process-limit", "1");
  

  app.commandLine.appendSwitch("js-flags", "--max-old-space-size=2048 --expose-gc");
  

  app.commandLine.appendSwitch("disable-background-networking");
  app.commandLine.appendSwitch("disable-client-side-phishing-detection");
  app.commandLine.appendSwitch("disable-default-apps");
  app.commandLine.appendSwitch("disable-domain-reliability");
  app.commandLine.appendSwitch("disable-extensions");
  app.commandLine.appendSwitch("disable-plugins");
  app.commandLine.appendSwitch("disable-speech-api");
  app.commandLine.appendSwitch("disable-sync");
  

  

  app.commandLine.appendSwitch("enable-gpu");
  

  app.commandLine.appendSwitch("enable-webgl-draft-extensions");
  app.commandLine.appendSwitch("enable-webgl2-compute-context");
  

  

  app.commandLine.appendSwitch("enable-experimental-canvas-features");
  

  app.commandLine.appendSwitch("enable-quic");
  

  app.allowRendererProcessReuse = true;
  
  console.log('[Switches] All performance switches applied successfully');
}


function applyWindowSettings(win, settings) {
  if (!win || win.isDestroyed()) return;
  
  try {

    if (settings.unlimited_fps !== false) {

      if (typeof win.webContents.setFrameRate === 'function') {
        win.webContents.setFrameRate(0);
        console.log('[Switches] Window FPS set to unlimited');
      }
      

      if (typeof win.webContents.setBackgroundThrottling === 'function') {
        win.webContents.setBackgroundThrottling(false);
        console.log('[Switches] Background throttling disabled');
      }
    }
    

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