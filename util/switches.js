const { app } = require("electron");

function applySwitches(settings) {

  const config = settings || {};
  
  console.log(' Applying switches with config:', config);
  

  if (config.unlimited_fps) {
    app.commandLine.appendSwitch("disable-frame-rate-limit");
    app.commandLine.appendSwitch("disable-gpu-vsync");
    console.log(' Unlimited FPS enabled');
  } else {
    console.log(' Unlimited FPS disabled');
  }
  

  if (config.in_process_gpu) {
    app.commandLine.appendSwitch("in-process-gpu");
    console.log(' In-process GPU enabled');
  } else {
    console.log(' In-process GPU disabled');
  }
  

  if (config.enable_gpu_rasterization) {
    app.commandLine.appendSwitch("enable-gpu-rasterization");
    console.log(' GPU Rasterization enabled');
  } else {
    console.log(' GPU Rasterization disabled');
  }
  

  if (config.enable_zero_copy) {
    app.commandLine.appendSwitch("enable-zero-copy");
    console.log(' Zero-Copy enabled');
  } else {
    console.log(' Zero-Copy disabled');
  }
  

  if (config.ignore_gpu_blacklist) {
    app.commandLine.appendSwitch("ignore-gpu-blacklist");
    console.log(' Ignore GPU Blacklist enabled');
  } else {
    console.log(' Ignore GPU Blacklist disabled');
  }
  

  app.commandLine.appendSwitch("high-dpi-support", "1");
  console.log(' High DPI Support enabled');
  

  app.allowRendererProcessReuse = true;
  

  app.commandLine.appendSwitch("enable-features", "SharedArrayBuffer");
  app.commandLine.appendSwitch("enable-webgl2-compute-context");
  
  console.log(' All switches applied');
}

module.exports = {
  applySwitches,
};