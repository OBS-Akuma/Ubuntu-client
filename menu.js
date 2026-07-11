const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");

class Menu {
  constructor() {
    // Load HTML and CSS from local files
    this.menuCSS = fs.readFileSync(
      path.join(__dirname, "./assets/menu.css"),
      "utf8"
    );
    this.menuHTML = fs.readFileSync(
      path.join(__dirname, "./assets/menu.html"),
      "utf8"
    );
    
    this.menu = this.createMenu();
    this.menuVisible = false;
    this.root = this.menu;
  }

  createMenu() {
    const menu = document.createElement("div");
    menu.innerHTML = this.menuHTML;
    menu.id = "ubuntu-menu";
    menu.style.cssText =
      "z-index: 99999999; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.95); display: none; opacity: 0; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);";
    
    const menuCSS = document.createElement("style");
    menuCSS.innerHTML = this.menuCSS;
    menu.prepend(menuCSS);
    
    document.body.appendChild(menu);
    return menu;
  }

  show() {
    if (!this.menu) return;
    
    this.menuVisible = true;
    this.menu.style.display = "block";
    
    requestAnimationFrame(() => {
      this.menu.style.opacity = "1";
      this.menu.style.transform = "translate(-50%, -50%) scale(1)";
    });
    
    document.body.style.overflow = "hidden";
  }

  hide() {
    if (!this.menu) return;
    
    this.menuVisible = false;
    this.menu.style.opacity = "0";
    this.menu.style.transform = "translate(-50%, -50%) scale(0.95)";
    
    setTimeout(() => {
      this.menu.style.display = "none";
      document.body.style.overflow = "";
    }, 300);
  }

  toggle() {
    if (this.menuVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  init() {
    const root = this.root;
    
    // ── KEYBINDS ──
    // Right-click to toggle
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
      return false;
    });

    // Right Shift key to toggle
    document.addEventListener("keydown", (e) => {
      // Check for Right Shift
      if (e.code === "ShiftRight" || (e.shiftKey && e.code === "ShiftRight")) {
        e.preventDefault();
        e.stopPropagation();
        console.log("[Menu] Right Shift pressed - toggling menu");
        this.toggle();
        return false;
      }
      
      // Escape key to close
      if (e.key === "Escape" && this.menuVisible) {
        e.preventDefault();
        this.hide();
      }
    });

    // ── CLOSE BUTTON ──
    const closeBtn = root.querySelector(".menu-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hide());
    }

    // ── SETTING INPUTS ──
    const inputs = root.querySelectorAll(".setting-input");
    inputs.forEach((input) => {
      input.addEventListener("change", () => {
        const setting = input.id;
        const value = input.value;
        console.log(`[Menu] Setting ${setting} = ${value}`);
        localStorage.setItem(`menu_${setting}`, value);
        
        if (window.api && window.api.updateSetting) {
          window.api.updateSetting(setting, value);
        }
      });
    });

    // ── SELECT DROPDOWNS ──
    const selects = root.querySelectorAll(".setting-select");
    selects.forEach((select) => {
      select.addEventListener("change", () => {
        const setting = select.id;
        const value = select.value;
        console.log(`[Menu] Setting ${setting} = ${value}`);
        localStorage.setItem(`menu_${setting}`, value);
        
        if (window.api && window.api.updateSetting) {
          window.api.updateSetting(setting, value);
        }
      });
    });

    // ── ZOOM CONTROLS ──
    let zoomLevel = 100;
    const zoomDisplay = root.querySelector("#zoom-display");
    const zoomIn = root.querySelector("#zoom-in");
    const zoomOut = root.querySelector("#zoom-out");
    const zoomReset = root.querySelector("#zoom-reset");

    function updateZoom() {
      if (zoomDisplay) {
        zoomDisplay.textContent = `${zoomLevel}%`;
      }
      // Apply zoom to the game content
      document.body.style.zoom = `${zoomLevel / 100}`;
      localStorage.setItem("menu_zoom", zoomLevel);
    }

    if (zoomIn) {
      zoomIn.addEventListener("click", () => {
        if (zoomLevel < 200) {
          zoomLevel += 10;
          updateZoom();
        }
      });
    }

    if (zoomOut) {
      zoomOut.addEventListener("click", () => {
        if (zoomLevel > 50) {
          zoomLevel -= 10;
          updateZoom();
        }
      });
    }

    if (zoomReset) {
      zoomReset.addEventListener("click", () => {
        zoomLevel = 100;
        updateZoom();
      });
    }

    // Load saved zoom level
    const savedZoom = localStorage.getItem("menu_zoom");
    if (savedZoom) {
      zoomLevel = parseInt(savedZoom, 10);
      updateZoom();
    }

    // ── LOAD SAVED SETTINGS ──
    inputs.forEach((input) => {
      const saved = localStorage.getItem(`menu_${input.id}`);
      if (saved) {
        input.value = saved;
      }
    });

    selects.forEach((select) => {
      const saved = localStorage.getItem(`menu_${select.id}`);
      if (saved) {
        select.value = saved;
      }
    });

    // ── MENU ITEMS WITH DATA-ACTION ──
    const menuItems = root.querySelectorAll("[data-action]");
    menuItems.forEach((item) => {
      item.addEventListener("click", () => {
        const action = item.dataset.action;
        this.handleAction(action);
      });
    });

    console.log("[Menu] Initialized - Right click or Right Shift to open");
  }

  handleAction(action) {
    switch (action) {
      case "close":
        this.hide();
        break;
      case "reload":
        location.reload();
        break;
      case "about":
        alert("Ubuntu Client v1.0.0\nCreated by OBS-Akuma");
        break;
      case "discord":
        window.open("https://discord.gg/r6S3mMyT4K", "_blank");
        break;
      default:
        console.log("[Menu] Unknown action:", action);
    }
  }
}

module.exports = Menu;