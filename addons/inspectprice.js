/**
 * Displays item values, rank, and date added in the inspect modal by fetching
 * price data from a Google Sheets API, rank data from the rank API, and
 * date-added data from the Kirka skin-art API.
 * 
 * - Fetches skin prices from Google Sheets
 * - Fetches skin rank from rank API
 * - Fetches skin date-added from Kirka skin-art API
 * - Shows item value, rank, and date added in the inspect modal
 * - Updates automatically when switching items
 * - Persists through modal reopenings
 */
const inspectPriceAddon = () => {
  // Configuration
  const PRICE_SHEET_URL = "https://opensheet.elk.sh/1pxMSoaSo8FYv-OIJ26HpSj8EDy7EDRmatHyQW24o6E4/Sorted+View";
  const RANK_API_URL = "https://rank.daymian.xyz/api/skins/";
  const DATE_API_URL = "https://api2.kirka.io/api/skin-art";
  
  let priceMap = null;
  let dateMap = null;
  let observer = null;
  let intervalId = null;
  let rankCache = new Map();
  
  // Helper functions
  function parseValue(raw) {
    if (raw == null) return 0;
    const s = String(raw).trim();
    if (!s || s.toUpperCase() === "TBD" || s.toLowerCase().includes("owners price")) return 0;
    const num = parseFloat(s.replace(/[, ]/g, ""));
    return isNaN(num) ? 0 : num;
  }
  
  // Get the highest tier from tier percentages
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
  
  // Get tier color
  function getTierColor(tier) {
    const colors = {
      'S': '#ff6b6b',
      'A': '#ffa94d',
      'B': '#ffd43b',
      'C': '#a9e34b',
      'D': '#63e6be',
      'F': '#74c0fc'
    };
    return colors[tier] || null;
  }
  
  // Format a timestamp into a short readable date
  function formatDateAdded(timestampMs) {
    if (!timestampMs) return null;
    const d = new Date(timestampMs);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  
  // Load price data
  async function loadPriceData() {
    if (priceMap) return true;
    
    try {
      const response = await fetch(PRICE_SHEET_URL);
      const rows = await response.json();
      
      priceMap = new Map();
      for (const row of rows) {
        if (!row || !row["Skin Name"]) continue;
        const name = row["Skin Name"].trim().toLowerCase();
        const value = parseValue(row["Base Value"]);
        if (value > 0 && !priceMap.has(name)) {
          priceMap.set(name, value);
        }
      }
      
      return true;
    } catch (err) {
      return false;
    }
  }
  
  // Load date-added data
  async function loadDateData() {
    if (dateMap) return true;
    
    try {
      const response = await fetch(DATE_API_URL);
      const rows = await response.json();
      
      dateMap = new Map();
      for (const row of rows) {
        if (!row || !row["n"]) continue;
        const name = row["n"].trim().toLowerCase();
        const timestamp = row["v"];
        if (timestamp && !dateMap.has(name)) {
          dateMap.set(name, timestamp);
        }
      }
      
      return true;
    } catch (err) {
      return false;
    }
  }
  
  function getSkinValue(name) {
    if (!priceMap) return 0;
    return priceMap.get(name.trim().toLowerCase()) || 0;
  }
  
  function getSkinDateAdded(name) {
    if (!dateMap) return null;
    return dateMap.get(name.trim().toLowerCase()) || null;
  }
  
  // Fetch rank data for a skin
  async function fetchSkinRank(skinName) {
    const cacheKey = skinName.trim().toLowerCase();
    if (rankCache.has(cacheKey)) {
      return rankCache.get(cacheKey);
    }
    
    try {
      const slug = skinName.trim().toLowerCase().replace(/\s+/g, '-');
      const url = `${RANK_API_URL}${encodeURIComponent(slug)}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          rankCache.set(cacheKey, null);
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const rank = getHighestTier(data.tierPercentages);
      
      const result = {
        rank: rank,
        overallRank: data.overallRank,
        totalSkins: data.totalSkins,
        avgScore: data.avgScore,
        voteCount: data.voteCount,
        tierPercentages: data.tierPercentages
      };
      
      rankCache.set(cacheKey, result);
      return result;
    } catch (err) {
      rankCache.set(cacheKey, null);
      return null;
    }
  }
  
  function makeBadgeElement(className, top) {
    const el = document.createElement("div");
    el.className = `owned ${className}`;
    el.setAttribute("data-v-391bc0ba", "");
    el.setAttribute("data-v-a1eaaeac", "");
    
    el.style.cssText = `
      right: 1rem;
      top: ${top};
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
  
  async function addValueToInspect() {
    const nameEl = document.querySelector("#inspect-modal .name");
    if (!nameEl) return;

    const existingValue = nameEl.querySelector(".inspect-value");
    if (existingValue) existingValue.remove();
    const existingRank = nameEl.querySelector(".inspect-rank");
    if (existingRank) existingRank.remove();
    const existingDate = nameEl.querySelector(".inspect-date");
    if (existingDate) existingDate.remove();

    const ownedEl = nameEl.querySelector(".owned");
    if (!ownedEl) return;

    const clone = nameEl.cloneNode(true);
    const ownedClone = clone.querySelector(".owned");
    if (ownedClone) ownedClone.remove();
    let name = clone.textContent.trim();
    name = name.replace(/^Inspect:\s*/i, "").trim();

    const value = getSkinValue(name);
    
    // Create value element
    const valueEl = makeBadgeElement("inspect-value", "5.5rem");
    const formattedValue = Math.round(value).toLocaleString();
    valueEl.textContent = `Value: ${formattedValue}`;
    ownedEl.after(valueEl);
    
    // Display date added
    const timestamp = getSkinDateAdded(name);
    const formattedDate = formatDateAdded(timestamp);
    
    const dateEl = makeBadgeElement("inspect-date", "8.5rem");
    if (formattedDate) {
      dateEl.textContent = `${formattedDate}`;
    } else {
      dateEl.textContent = 'N/A';
      dateEl.style.color = '#888';
    }
    
    valueEl.after(dateEl);
    
    // Fetch and display rank
    const rankData = await fetchSkinRank(name);
    
    const rankEl = makeBadgeElement("inspect-rank", "11.5rem");
    
    if (rankData && rankData.rank) {
      const tierColor = getTierColor(rankData.rank);
      
      const rankText = document.createTextNode('Ranked: ');
      const rankSpan = document.createElement('span');
      rankSpan.textContent = rankData.rank;
      if (tierColor) {
        rankSpan.style.color = tierColor;
      }
      
      rankEl.appendChild(rankText);
      rankEl.appendChild(rankSpan);
    } else {
      rankEl.textContent = 'Ranked: N/A';
      rankEl.style.color = '#888';
    }
    
    dateEl.after(rankEl);
  }

  function checkAndAddValue() {
    const modal = document.querySelector("#inspect-modal");
    if (modal) {
      const style = window.getComputedStyle(modal);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        setTimeout(addValueToInspect, 100);
        return true;
      }
    }
    return false;
  }

  function setupObserver() {
    checkAndAddValue();

    observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.id === "inspect-modal") {
                shouldCheck = true;
                break;
              } else if (node.querySelector && node.querySelector("#inspect-modal")) {
                shouldCheck = true;
                break;
              }
            }
          }
        }
        
        if (mutation.type === "childList" && mutation.target.id === "inspect-modal") {
          shouldCheck = true;
        }
        
        if (mutation.type === "attributes" && mutation.target.id === "inspect-modal") {
          shouldCheck = true;
        }
      }
      
      if (shouldCheck) {
        checkAndAddValue();
      }
    });

    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    intervalId = setInterval(() => {
      const modal = document.querySelector("#inspect-modal");
      if (modal) {
        const style = window.getComputedStyle(modal);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          if (!modal.querySelector(".inspect-value")) {
            addValueToInspect();
          }
        }
      }
    }, 1000);
  }

  function removeInspectPrice() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    document.querySelectorAll(".inspect-value, .inspect-rank, .inspect-date").forEach(el => el.remove());
  }

  async function init() {
    const [priceLoaded] = await Promise.all([loadPriceData(), loadDateData()]);
    if (priceLoaded) {
      setupObserver();
      
      window.addValueToInspect = addValueToInspect;
      window.removeInspectPrice = removeInspectPrice;
      window.rankCache = rankCache;
    }
  }

  init();
};

// Export for use in main file
module.exports = { inspectPriceAddon };