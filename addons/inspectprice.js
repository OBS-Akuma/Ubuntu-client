/**
 * Displays item values, rank, date added, owner counts, obtainable-by info, Fate value,
 * Bros price, and color swatches in the inspect modal by fetching price data from a
 * Google Sheets API, rank data from the rank API, date-added data from the Kirka
 * skin-art API, color/owned data from the Kirka wmnwWNMW API, Fate values from a
 * second Google Sheets API, and Bros prices from a third Google Sheets API.
 * 
 * - Fetches skin prices from Google Sheets
 * - Fetches skin rank from rank API
 * - Fetches skin date-added from Kirka skin-art API
 * - Fetches skin colors and owned counts from Kirka wmnwWNMW API
 * - Fetches Fate values from a Google Sheets API
 * - Fetches Bros prices from a Google Sheets API
 * - Shows item value, rank, date added, color swatches, and green owned count in the inspect modal
 * - Shows "Obtainable By" badge at the bottom-left of the card
 * - Shows Fate and Bros badges below the Bolt value
 * - Updates automatically when switching items
 * - Persists through modal reopenings
 * - Call window.__inspectPriceAddon.stop() to unload
 */
const inspectPriceAddon = () => {
  // ===== CONFIG =====
  const PRICE_SHEET_URL = "https://opensheet.elk.sh/1pxMSoaSo8FYv-OIJ26HpSj8EDy7EDRmatHyQW24o6E4/Sorted+View";
  const RANK_API_URL = "https://rank.daymian.xyz/api/skins/";
  const DATE_API_URL = "https://api2.kirka.io/api/skin-art";
  const COLOR_API_URL = "https://api2.kirka.io/api/wmnwWNMW";
  const FATE_SHEET_URL = "https://opensheet.elk.sh/19UpuXlaSltQlAa8rLDn2Na3lAB9ySdWDy_8vu4nOCYQ/1";
  const BROS_SHEET_URL = "https://opensheet.elk.sh/1tzHjKpu2gYlHoCePjp6bFbKBGvZpwDjiRzT9ZUfNwbY/4";

  // ===== CLEANUP OLD RUN =====
  if (window.__inspectPriceAddon) {
    window.__inspectPriceAddon.observer?.disconnect();
    if (window.__inspectPriceAddon.intervalId) clearInterval(window.__inspectPriceAddon.intervalId);
    document.querySelectorAll(".inspect-value, .inspect-rank, .inspect-date, .inspect-colors, .inspect-owned, .inspect-fate, .inspect-bros, .obtainable-by-badge")
      .forEach(el => el.remove());
    document.querySelectorAll("#inspect-modal .name .owned[data-owned-modified]").forEach(el => {
      if (el.dataset.originalText) el.textContent = el.dataset.originalText;
      delete el.dataset.ownedModified;
      delete el.dataset.originalText;
    });
  }

  // ===== STATE =====
  const state = {
    priceMap: null,
    dateMap: null,
    colorMap: null,
    ownedMap: null,
    obtainMap: null,
    fateMap: null,
    brosMap: null,
    observer: null,
    intervalId: null,
    rankCache: new Map(),
  };

  // ===== HELPERS =====
  function parseValue(raw) {
    if (raw == null) return 0;
    const s = String(raw).trim();
    if (!s || s.toUpperCase() === "TBD" || s.toLowerCase().includes("owners price")) return 0;
    const num = parseFloat(s.replace(/[, ]/g, ""));
    return isNaN(num) ? 0 : num;
  }

  function getHighestTier(tierPercentages) {
    if (!tierPercentages) return null;
    let highestTier = null;
    let highestPercentage = -1;
    const tierOrder = { 'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1 };
    for (const [tier, percentage] of Object.entries(tierPercentages)) {
      if (percentage > highestPercentage ||
          (percentage === highestPercentage && tierOrder[tier] > tierOrder[highestTier])) {
        highestPercentage = percentage;
        highestTier = tier;
      }
    }
    return highestTier;
  }

  function getTierColor(tier) {
    const colors = {
      'S': '#ff6b6b', 'A': '#ffa94d', 'B': '#ffd43b',
      'C': '#a9e34b', 'D': '#63e6be', 'F': '#74c0fc'
    };
    return colors[tier] || null;
  }

  function formatDateAdded(timestampMs) {
    if (!timestampMs) return null;
    const d = new Date(timestampMs);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  // ===== DATA LOADERS =====
  async function loadPriceData() {
    if (state.priceMap) return true;
    try {
      const rows = await (await fetch(PRICE_SHEET_URL)).json();
      state.priceMap = new Map();
      state.obtainMap = new Map();
      for (const row of rows) {
        if (!row || !row["Skin Name"]) continue;
        const name = row["Skin Name"].trim().toLowerCase();
        const value = parseValue(row["Base Value"]);
        if (value > 0 && !state.priceMap.has(name)) state.priceMap.set(name, value);
        const obtain = row["Obtainable By"];
        if (obtain && String(obtain).trim() && !state.obtainMap.has(name)) {
          state.obtainMap.set(name, String(obtain).trim());
        }
      }
      return true;
    } catch { return false; }
  }

  async function loadDateData() {
    if (state.dateMap) return true;
    try {
      const rows = await (await fetch(DATE_API_URL)).json();
      state.dateMap = new Map();
      for (const row of rows) {
        if (!row || !row["n"]) continue;
        const name = row["n"].trim().toLowerCase();
        if (row["v"] && !state.dateMap.has(name)) state.dateMap.set(name, row["v"]);
      }
      return true;
    } catch { return false; }
  }

  async function loadColorData() {
    if (state.colorMap) return true;
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const rows = await (await fetch(COLOR_API_URL, { headers })).json();
      state.colorMap = new Map();
      state.ownedMap = new Map();
      for (const entry of rows) {
        const n = entry?.wwMmnWNW;
        if (!n || !n.wwMmWnW) continue;
        const name = n.wwMmWnW.trim().toLowerCase();
        if (!state.colorMap.has(name)) state.colorMap.set(name, Array.isArray(n.wnMwWN) ? n.wnMwWN : []);
        const count = Number(entry?.wnMwWmW) || 0;
        state.ownedMap.set(name, (state.ownedMap.get(name) || 0) + count);
      }
      return true;
    } catch { return false; }
  }

  // Fate: uses "Name" and "Base Value" columns
  async function loadFateData() {
    if (state.fateMap) return true;
    try {
      const rows = await (await fetch(FATE_SHEET_URL)).json();
      state.fateMap = new Map();
      for (const row of rows) {
        if (!row || !row["Name"]) continue;
        const name = String(row["Name"]).trim().toLowerCase();
        const value = parseValue(row["Base Value"]);
        if (value > 0 && !state.fateMap.has(name)) state.fateMap.set(name, value);
      }
      return true;
    } catch { return false; }
  }

  // Bros: uses "Skin Name" and "Price" columns
  async function loadBrosData() {
    if (state.brosMap) return true;
    try {
      const rows = await (await fetch(BROS_SHEET_URL)).json();
      state.brosMap = new Map();
      for (const row of rows) {
        if (!row || !row["Skin Name"]) continue;
        const name = String(row["Skin Name"]).trim().toLowerCase();
        const value = parseValue(row["Price"]);
        if (value > 0 && !state.brosMap.has(name)) state.brosMap.set(name, value);
      }
      return true;
    } catch { return false; }
  }

  // ===== LOOKUPS =====
  function getSkinValue(name) {
    return state.priceMap?.get(name.trim().toLowerCase()) || 0;
  }
  function getSkinDateAdded(name) {
    return state.dateMap?.get(name.trim().toLowerCase()) || null;
  }
  function getSkinColors(name) {
    return state.colorMap?.get(name.trim().toLowerCase()) || [];
  }
  function getSkinOwned(name) {
    return state.ownedMap?.get(name.trim().toLowerCase()) || 0;
  }
  function getSkinObtainable(name) {
    return state.obtainMap?.get(name.trim().toLowerCase()) || null;
  }
  function getSkinFate(name) {
    return state.fateMap?.get(name.trim().toLowerCase()) || 0;
  }
  function getSkinBros(name) {
    return state.brosMap?.get(name.trim().toLowerCase()) || 0;
  }

  async function fetchSkinRank(skinName) {
    const key = skinName.trim().toLowerCase();
    if (state.rankCache.has(key)) return state.rankCache.get(key);
    try {
      const slug = key.replace(/\s+/g, '-');
      const res = await fetch(`${RANK_API_URL}${encodeURIComponent(slug)}`);
      if (!res.ok) {
        state.rankCache.set(key, null);
        return null;
      }
      const data = await res.json();
      const result = {
        rank: getHighestTier(data.tierPercentages),
        overallRank: data.overallRank,
        totalSkins: data.totalSkins,
        avgScore: data.avgScore,
        voteCount: data.voteCount,
        tierPercentages: data.tierPercentages,
      };
      state.rankCache.set(key, result);
      return result;
    } catch {
      state.rankCache.set(key, null);
      return null;
    }
  }

  // ===== DOM BUILDERS =====
  // Same structure/styling as the native `.owned` badge
  function makeOwnedBadge(className) {
    const el = document.createElement("div");
    el.className = `owned ${className}`;
    el.setAttribute("data-v-391bc0ba", "");
    el.setAttribute("data-v-a1eaaeac", "");
    el.style.cssText = `
      right: 1rem;
      top: 0;
      height: auto;
      display: flex;
      padding: 0 .7rem;
      border-radius: 1rem;
      background: rgba(0,0,0,.25);
      font-weight: 600;
      color: #fff;
      align-items: center;
      position: absolute;
      text-shadow: -1px -1px 0 #0f0f0f, 1px -1px 0 #0f0f0f, -1px 1px 0 #0f0f0f, 1px 1px 0 #0f0f0f, 0 0.13rem 1px rgba(0,0,0,.486);
    `;
    return el;
  }

  function makeColorBar(colors) {
    const wrapper = makeOwnedBadge("inspect-colors");
    wrapper.style.padding = ".3rem .5rem";
    wrapper.style.gap = "4px";

    const grid = document.createElement("div");
    grid.style.cssText = `
      display: flex;
      flex-wrap: nowrap;
      justify-content: flex-start;
      gap: 4px;
      pointer-events: auto;
    `;

    const valid = (colors || []).filter(c => typeof c === "string" && c.startsWith("#"));

    for (const hex of valid) {
      const sw = document.createElement("span");
      sw.setAttribute("data-v-4b3b02ca", "");
      sw.className = "swatch";
      sw.title = hex;
      sw.style.cssText = `
        background: ${hex};
        display: block;
        width: 22px;
        height: 22px;
        border-radius: 5px;
        border: 1px solid rgba(255,255,255,0.25);
        cursor: pointer;
        pointer-events: auto;
        flex: 0 0 auto;
      `;
      sw.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(hex).then(() => {
          const prev = sw.style.outline;
          sw.style.outline = "2px solid #fff";
          setTimeout(() => { sw.style.outline = prev; }, 150);
        });
      });
      grid.appendChild(sw);
    }

    if (!grid.children.length) return null;
    wrapper.appendChild(grid);
    return wrapper;
  }

  // ===== MAIN =====
  async function addValueToInspect() {
    const nameEl = document.querySelector("#inspect-modal .name");
    if (!nameEl) return;

    nameEl.querySelectorAll(".inspect-value, .inspect-rank, .inspect-date, .inspect-colors, .inspect-owned, .inspect-fate, .inspect-bros")
      .forEach(el => el.remove());

    const ownedEl = nameEl.querySelector(".owned");
    if (!ownedEl) return;

    const clone = nameEl.cloneNode(true);
    clone.querySelector(".owned")?.remove();
    let name = clone.textContent.trim().replace(/^Inspect:\s*/i, "").trim();

    // Green owned count, rest stays original text
    const ownedCount = getSkinOwned(name);
    if (ownedCount > 0) {
      if (!ownedEl.dataset.originalText) {
        ownedEl.dataset.originalText = ownedEl.textContent.trim();
      }
      ownedEl.dataset.ownedModified = "1";

      const original = ownedEl.dataset.originalText;
      const match = original.match(/^(\d+)(.*)$/);
      if (match) {
        const [, total, rest] = match;
        ownedEl.innerHTML = "";

        const ownedSpan = document.createElement("span");
        ownedSpan.textContent = `${ownedCount}`;
        ownedSpan.style.color = "#8aff8a";

        const restSpan = document.createElement("span");
        restSpan.textContent = `/${total}${rest}`;

        ownedEl.appendChild(ownedSpan);
        ownedEl.appendChild(restSpan);
      }
    }

    const badges = [];

    const value = getSkinValue(name);
    if (value > 0) {
      const valueEl = makeOwnedBadge("inspect-value");
      valueEl.textContent = `Bolt: ${Math.round(value).toLocaleString()}`;
      badges.push(valueEl);
    }

    // Fate badge directly below Bolt
    const fateValue = getSkinFate(name);
    if (fateValue > 0) {
      const fateEl = makeOwnedBadge("inspect-fate");
      fateEl.textContent = `Fate: ${Math.round(fateValue).toLocaleString()}`;
      badges.push(fateEl);
    }

    // Bros badge directly below Fate
    const brosValue = getSkinBros(name);
    if (brosValue > 0) {
      const brosEl = makeOwnedBadge("inspect-bros");
      brosEl.textContent = `Bros: ${Math.round(brosValue).toLocaleString()}`;
      badges.push(brosEl);
    }

    const formattedDate = formatDateAdded(getSkinDateAdded(name));
    if (formattedDate) {
      const dateEl = makeOwnedBadge("inspect-date");
      dateEl.textContent = formattedDate;
      badges.push(dateEl);
    }

    const rankData = await fetchSkinRank(name);
    if (rankData && rankData.rank) {
      const rankEl = makeOwnedBadge("inspect-rank");
      const tierColor = getTierColor(rankData.rank);
      const txt = document.createTextNode("Ranked: ");
      const span = document.createElement("span");
      span.textContent = rankData.rank;
      if (tierColor) span.style.color = tierColor;
      rankEl.appendChild(txt);
      rankEl.appendChild(span);
      badges.push(rankEl);
    }

    const colorBar = makeColorBar(getSkinColors(name));
    if (colorBar) badges.push(colorBar);

    let anchor = ownedEl;
    let top = 5.5;
    for (const badge of badges) {
      badge.style.top = `${top}rem`;
      anchor.after(badge);
      anchor = badge;
      top += 3;
    }

    // ===== Obtainable By — bottom-left of the card, same badge style =====
    const modal = document.querySelector("#inspect-modal");
    if (!modal) return;

    const card = modal.querySelector(".container-card") || modal;

    document.querySelectorAll(".obtainable-by-badge").forEach(el => el.remove());

    const obtain = getSkinObtainable(name);
    if (obtain) {
      if (getComputedStyle(card).position === "static") {
        card.style.position = "relative";
      }

      // Same markup as the native `.owned` badge — no custom styles
      const badge = document.createElement("div");
      badge.className = "owned obtainable-by-badge";
      badge.setAttribute("data-v-391bc0ba", "");
      badge.setAttribute("data-v-a1eaaeac", "");
      badge.textContent = obtain;

      // Only positioning overrides; everything else comes from the class styles
      badge.style.cssText = `
        left: 1rem;
        right: auto;
        bottom: 1rem;
        top: auto;
        position: absolute;
        z-index: 10;
      `;

      card.appendChild(badge);
    }
  }

  function checkAndAddValue() {
    const modal = document.querySelector("#inspect-modal");
    if (!modal) return false;
    const style = window.getComputedStyle(modal);
    if (style.display !== "none" && style.visibility !== "hidden") {
      setTimeout(addValueToInspect, 100);
      return true;
    }
    return false;
  }

  function setupObserver() {
    checkAndAddValue();

    state.observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const m of mutations) {
        if (m.type === "childList" && m.addedNodes.length) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.id === "inspect-modal" || node.querySelector?.("#inspect-modal")) {
                shouldCheck = true;
                break;
              }
            }
          }
        }
        if (m.type === "childList" && m.target.id === "inspect-modal") shouldCheck = true;
        if (m.type === "attributes" && m.target.id === "inspect-modal") shouldCheck = true;
      }
      if (shouldCheck) checkAndAddValue();
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    state.intervalId = setInterval(() => {
      const modal = document.querySelector("#inspect-modal");
      if (!modal) return;
      const style = window.getComputedStyle(modal);
      if (style.display !== "none" && style.visibility !== "hidden" && !modal.querySelector(".inspect-value")) {
        addValueToInspect();
      }
    }, 1000);
  }

  function stop() {
    state.observer?.disconnect();
    state.observer = null;
    if (state.intervalId) { clearInterval(state.intervalId); state.intervalId = null; }
    document.querySelectorAll(".inspect-value, .inspect-rank, .inspect-date, .inspect-colors, .inspect-owned, .inspect-fate, .inspect-bros, .obtainable-by-badge")
      .forEach(el => el.remove());
    document.querySelectorAll("#inspect-modal .name .owned[data-owned-modified]").forEach(el => {
      if (el.dataset.originalText) el.textContent = el.dataset.originalText;
      delete el.dataset.ownedModified;
      delete el.dataset.originalText;
    });
    delete window.__inspectPriceAddon;
    console.log("[inspect-addon] stopped");
  }

  // ===== INIT =====
  async function init() {
    await Promise.all([
      loadPriceData(),
      loadDateData(),
      loadColorData(),
      loadFateData(),
      loadBrosData(),
    ]);
    console.log(`[inspect-addon] prices: ${state.priceMap?.size ?? 0}, dates: ${state.dateMap?.size ?? 0}, colors: ${state.colorMap?.size ?? 0}, owned: ${state.ownedMap?.size ?? 0}, obtainable: ${state.obtainMap?.size ?? 0}, fate: ${state.fateMap?.size ?? 0}, bros: ${state.brosMap?.size ?? 0}`);

    setupObserver();

    window.__inspectPriceAddon = { state, addValueToInspect, stop };
    console.log("[inspect-addon] running — call window.__inspectPriceAddon.stop() to unload");
  }

  init();
};

// Export for use in main file
module.exports = { inspectPriceAddon };