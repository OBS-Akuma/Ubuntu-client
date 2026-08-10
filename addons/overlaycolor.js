/**
 * Adds "SmudgyClient" text to the overlay and colors FPS/Ping values
 * based on performance thresholds.
 * 
 * - FPS: Green >= 120, Yellow >= 90, Orange >= 60, Red < 60
 * - Ping: Green <= 50, Yellow <= 80, Orange <= 120, Red > 120
 */
const overlayColorAddon = () => {
  function getColor(value, type) {
    if (type === "fps") {
      if (value >= 120) return "limegreen";
      if (value >= 90) return "yellow";
      if (value >= 60) return "orange";
      return "red";
    }

    if (type === "ping") {
      if (value <= 50) return "limegreen";
      if (value <= 80) return "yellow";
      if (value <= 120) return "orange";
      return "red";
    }
  }

  function addSmudgyClient() {
    if (document.getElementById("smudgyClient")) return;

    const overlay = document.getElementById("overlay");

    if (overlay) {
      const div = document.createElement("div");
      const span = document.createElement("span");

      span.id = "wowza";
      span.textContent = "";
      span.style.color = "white";

      div.appendChild(span);
      overlay.appendChild(div);
    }
  }

  function updateColors() {
    const fps = document.getElementById("fps");
    const ping = document.getElementById("ping");

    if (fps) {
      const match = fps.textContent.match(/[\d.]+/);
      if (match) {
        fps.style.color = getColor(parseFloat(match[0]), "fps");
      }
    }

    if (ping) {
      const match = ping.textContent.match(/[\d.]+/);
      if (match) {
        ping.style.color = getColor(parseFloat(match[0]), "ping");
      }
    }
  }

  addSmudgyClient();
  updateColors();

  setInterval(() => {
    addSmudgyClient();
    updateColors();
  }, 500);
};

// Export for use in main file
module.exports = { overlayColorAddon };