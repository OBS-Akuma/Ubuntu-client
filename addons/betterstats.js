/**
 * Injects a "Better Stats" tab into the profile modal that displays
 * enhanced statistics using the exact same styling as the profile.
 * 
 * Run this in the devtools console while the profile modal is open.
 */
const betterStatsAddon = () => {
  // Cache for stats data
  let cachedStats = null;
  let cachedInventory = null;
  let statsPanel = null;
  let statsList = null;
  let isFetchingInventory = false;
  let currentUserId = null;

  // ---- Get user ID ----
  function getUserId() {
    const usernameEl = document.querySelector('.copy-cont .value');
    if (usernameEl) {
      return usernameEl.textContent.trim();
    }
    return null;
  }

  // ---- Fetch inventory ----
  async function fetchInventory(userId) {
    if (!userId) return null;
    
    try {
      const response = await fetch('https://www.smudgy.store/api/getinventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          isShortId: true
        })
      });
      
      if (!response.ok) {
        console.error('[Better Stats] Inventory fetch failed:', response.status);
        return null;
      }
      
      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
      return null;
    } catch (err) {
      console.error('[Better Stats] Inventory fetch error:', err);
      return null;
    }
  }

  // ---- Extract stats from DOM ----
  function extractStatsFromDOM() {
    const stats = {
      kills: 0,
      deaths: 0,
      headshots: 0,
      games: 0,
      win: 0,
      scores: 0,
      klo: 0,
      level: 0,
      kdRatio: 0,
      headshotRate: 0,
      winRate: 0,
      losses: 0,
      wlRatio: 0,
      killsPerGame: 0,
      scorePerGame: 0
    };
    
    const statisticElements = document.querySelectorAll('.statistic');
    statisticElements.forEach(el => {
      const nameEl = el.querySelector('.stat-name');
      const valueEl = el.querySelector('.stat-value');
      if (nameEl && valueEl) {
        const name = nameEl.textContent.trim().toLowerCase();
        const value = valueEl.textContent.trim().replace(/,/g, '');
        const numValue = parseInt(value) || 0;
        
        switch(name) {
          case 'kills':
            stats.kills = numValue;
            break;
          case 'deaths':
            stats.deaths = numValue;
            break;
          case 'headshots':
            stats.headshots = numValue;
            break;
          case 'games':
            stats.games = numValue;
            break;
          case 'win':
            stats.win = numValue;
            break;
          case 'scores':
            stats.scores = numValue;
            break;
        }
      }
    });

    const kloValue = document.querySelector('.card.k-d .stat-value-kd');
    if (kloValue) {
      stats.klo = parseInt(kloValue.textContent.trim().replace(/,/g, '')) || 0;
    }

    const levelEl = document.querySelector('.progress-level-value');
    if (levelEl) {
      stats.level = parseInt(levelEl.textContent.trim()) || 0;
    }

    // Calculate derived stats (all default to 0 if missing)
    stats.kdRatio = stats.deaths > 0 ? (stats.kills / stats.deaths) : stats.kills > 0 ? stats.kills : 0;
    stats.headshotRate = stats.kills > 0 ? (stats.headshots / stats.kills) * 100 : 0;
    stats.winRate = stats.games > 0 ? (stats.win / stats.games) * 100 : 0;
    stats.losses = stats.games > 0 ? (stats.games - stats.win) : 0;
    stats.wlRatio = stats.losses > 0 ? (stats.win / stats.losses) : stats.win > 0 ? stats.win : 0;
    stats.killsPerGame = stats.games > 0 ? (stats.kills / stats.games) : 0;
    stats.scorePerGame = stats.games > 0 ? (stats.scores / stats.games) : 0;

    return stats;
  }

  // ---- Clear cache ----
  function clearCache() {
    cachedStats = null;
    cachedInventory = null;
    currentUserId = null;
    if (statsList) {
      statsList.innerHTML = '';
    }
  }

  // ---- Build a statistic item ----
  function createStatistic(name, value) {
    const div = document.createElement('div');
    div.setAttribute('data-v-7f0e55d0', '');
    div.className = 'statistic';
    
    const nameDiv = document.createElement('div');
    nameDiv.setAttribute('data-v-7f0e55d0', '');
    nameDiv.className = 'stat-name text-2';
    nameDiv.textContent = name;
    
    const valueDiv = document.createElement('div');
    valueDiv.setAttribute('data-v-7f0e55d0', '');
    valueDiv.className = 'stat-value text-2';
    valueDiv.textContent = value;
    
    div.appendChild(nameDiv);
    div.appendChild(valueDiv);
    return div;
  }

  // ---- Build inventory card ----
  function buildInventoryCard(inventory) {
    const card = document.createElement('div');
    card.setAttribute('data-v-7f0e55d0', '');
    card.className = 'card statistics';

    // Always show all rarities
    const allRarities = ['PARANORMAL', 'MYTHICAL', 'LEGENDARY', 'EPIC', 'RARE', 'COMMON'];
    const rarityGroups = {};
    
    // Initialize all rarities to 0
    allRarities.forEach(rarity => {
      rarityGroups[rarity] = 0;
    });

    // If inventory exists, count the items
    if (inventory && inventory.length > 0) {
      inventory.forEach(item => {
        const rarity = item.item.rarity || 'UNKNOWN';
        if (rarityGroups[rarity] !== undefined) {
          rarityGroups[rarity] += item.amount || 1;
        } else {
          rarityGroups[rarity] = item.amount || 1;
        }
      });
    }

    // Sort rarities
    const rarityOrder = ['PARANORMAL', 'MYTHICAL', 'LEGENDARY', 'EPIC', 'RARE', 'COMMON'];
    const sortedRarities = Object.keys(rarityGroups).sort((a, b) => {
      const indexA = rarityOrder.indexOf(a);
      const indexB = rarityOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    sortedRarities.forEach(rarity => {
      const stat = document.createElement('div');
      stat.setAttribute('data-v-7f0e55d0', '');
      stat.className = 'statistic';
      
      const name = document.createElement('div');
      name.setAttribute('data-v-7f0e55d0', '');
      name.className = 'stat-name text-2';
      name.textContent = rarity.charAt(0) + rarity.slice(1).toLowerCase();
      
      const value = document.createElement('div');
      value.setAttribute('data-v-7f0e55d0', '');
      value.className = 'stat-value text-2';
      value.textContent = rarityGroups[rarity] || 0;
      
      stat.appendChild(name);
      stat.appendChild(value);
      card.appendChild(stat);
    });

    return card;
  }

  // ---- Build custom stats ----
  function buildCustomStats(stats, inventory) {
    const container = document.createElement('div');
    container.setAttribute('data-v-7f0e55d0', '');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.padding = '16px';
    container.style.overflowY = 'auto';
    container.style.boxSizing = 'border-box';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = '1fr 1fr';
    container.style.gap = '16px';
    container.style.alignContent = 'start';

    const formatNum = (num) => (num || 0).toLocaleString();
    const formatDecimal = (num, decimals = 2) => (num || 0).toFixed(decimals);

    // Card 1: Combat Stats
    const card1 = document.createElement('div');
    card1.setAttribute('data-v-7f0e55d0', '');
    card1.className = 'card statistics';
    card1.appendChild(createStatistic('K/D Ratio', formatDecimal(stats.kdRatio || 0)));
    card1.appendChild(createStatistic('Headshot Rate', formatDecimal(stats.headshotRate || 0, 1) + '%'));
    card1.appendChild(createStatistic('Kills/Game', formatDecimal(stats.killsPerGame || 0)));
    card1.appendChild(createStatistic('KLO', formatNum(stats.klo || 0)));
    container.appendChild(card1);

    // Card 2: Match Stats
    const card2 = document.createElement('div');
    card2.setAttribute('data-v-7f0e55d0', '');
    card2.className = 'card statistics';
    card2.appendChild(createStatistic('Win Rate', formatDecimal(stats.winRate || 0, 1) + '%'));
    card2.appendChild(createStatistic('W/L Ratio', formatDecimal(stats.wlRatio || 0)));
    card2.appendChild(createStatistic('Total Games', formatNum(stats.games || 0)));
    card2.appendChild(createStatistic('Score/Game', formatNum(Math.round(stats.scorePerGame || 0))));
    container.appendChild(card2);

    // Card 3: Performance Summary
    const card3 = document.createElement('div');
    card3.setAttribute('data-v-7f0e55d0', '');
    card3.className = 'card statistics';
    card3.appendChild(createStatistic('Total Kills', formatNum(stats.kills || 0)));
    card3.appendChild(createStatistic('Total Deaths', formatNum(stats.deaths || 0)));
    card3.appendChild(createStatistic('Headshots', formatNum(stats.headshots || 0)));
    card3.appendChild(createStatistic('Total Scores', formatNum(stats.scores || 0)));
    container.appendChild(card3);

    // Card 4: Inventory
    const card4 = document.createElement('div');
    card4.setAttribute('data-v-7f0e55d0', '');
    card4.className = 'card statistics';
    
    if (inventory === null) {
      // Still loading
      card4.appendChild(createStatistic('Inventory', 'Loading...'));
    } else {
      // Build inventory card with all rarities (values will be 0 if none exist)
      const inventoryCard = buildInventoryCard(inventory || []);
      // Copy children from inventoryCard to card4
      while (inventoryCard.firstChild) {
        card4.appendChild(inventoryCard.firstChild);
      }
    }
    container.appendChild(card4);

    return container;
  }

  // ---- Update stats display ----
  function updateStatsDisplay(stats, inventory) {
    if (!statsList) return;
    statsList.innerHTML = '';
    const statsContainer = buildCustomStats(stats, inventory);
    statsList.appendChild(statsContainer);
  }

  // ---- Get stats ----
  function getStats() {
    const userId = getUserId();
    
    // If user changed, clear cache
    if (userId && userId !== currentUserId) {
      clearCache();
      currentUserId = userId;
    }
    
    if (cachedStats) {
      return cachedStats;
    }
    const stats = extractStatsFromDOM();
    // Always return stats even if no games (all values will be 0)
    cachedStats = stats;
    return stats;
  }

  // ---- Main injection ----
  function injectBetterStatsTab() {
    const tabHeader = document.querySelector('.tab-header');
    if (!tabHeader) return;

    const existingNotificationsTab = tabHeader.querySelector('.notifications-tab-btn');
    if (existingNotificationsTab) {
      existingNotificationsTab.remove();
    }

    if (tabHeader.querySelector('.better-stats-tab-btn')) return;

    const tabBtn = document.createElement('div');
    tabBtn.setAttribute('data-v-d1073b42', '');
    tabBtn.className = 'text-2 tab better-stats-tab-btn';
    tabBtn.textContent = 'Better Stats';
    tabHeader.appendChild(tabBtn);

    statsList = document.createElement('div');
    statsList.setAttribute('data-v-f1b686f2', '');
    statsList.setAttribute('data-v-a1eaaeac', '');
    statsList.className = 'list';
    statsList.style.width = '100%';
    statsList.style.height = '100%';

    function deactivateOurTab() {
      tabBtn.classList.remove('active');
      const tabContent = document.querySelector('.tab-content');
      if (!tabContent) return;
      Array.from(tabContent.children).forEach(child => {
        if (child.classList.contains('stats-panel')) {
          child.style.display = 'none';
        } else {
          child.style.display = '';
        }
      });
    }

    tabHeader.addEventListener('click', (e) => {
      if (e.target === tabBtn) return;
      deactivateOurTab();
    });

    tabBtn.addEventListener('click', async () => {
      const tabContent = document.querySelector('.tab-content');
      if (!tabContent) return;

      tabHeader.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tabBtn.classList.add('active');

      Array.from(tabContent.children).forEach(child => {
        if (!child.classList.contains('stats-panel')) {
          child.style.display = 'none';
        }
      });

      statsPanel = tabContent.querySelector('.stats-panel');
      if (!statsPanel) {
        statsPanel = document.createElement('div');
        statsPanel.setAttribute('data-v-d1073b42', '');
        statsPanel.className = 'stats-panel';
        statsPanel.style.width = '916px';
        statsPanel.style.height = '514.19px';
        statsPanel.style.overflow = 'hidden';
        statsPanel.style.position = 'relative';
        
        const innerWrapper = document.createElement('div');
        innerWrapper.style.width = '100%';
        innerWrapper.style.height = '100%';
        innerWrapper.style.overflowY = 'auto';
        innerWrapper.style.overflowX = 'hidden';
        innerWrapper.appendChild(statsList);
        statsPanel.appendChild(innerWrapper);
        
        tabContent.appendChild(statsPanel);
      } else if (!statsPanel.contains(statsList)) {
        const innerWrapper = statsPanel.querySelector('div');
        if (innerWrapper) {
          innerWrapper.appendChild(statsList);
        } else {
          statsPanel.appendChild(statsList);
        }
      }
      statsPanel.style.display = '';

      // Check if user changed and clear cache if needed
      const userId = getUserId();
      if (userId && userId !== currentUserId) {
        clearCache();
        currentUserId = userId;
      }

      const stats = getStats();
      
      // Always show stats, even if all values are 0
      updateStatsDisplay(stats, cachedInventory);

      // Fetch inventory if not already fetched or fetching
      if (!cachedInventory && !isFetchingInventory) {
        if (userId) {
          isFetchingInventory = true;
          const inventory = await fetchInventory(userId);
          if (inventory) {
            cachedInventory = inventory;
          }
          isFetchingInventory = false;
          
          // Update display with inventory
          updateStatsDisplay(stats, cachedInventory);
        }
      }
    });

    const initialStats = extractStatsFromDOM();
    const userId = getUserId();
    if (userId) {
      currentUserId = userId;
      cachedStats = initialStats;
      if (!cachedInventory && !isFetchingInventory) {
        isFetchingInventory = true;
        fetchInventory(userId).then(inventory => {
          if (inventory) {
            cachedInventory = inventory;
          }
          isFetchingInventory = false;
          // Update display if statsList exists
          if (statsList && statsList.children.length === 0 && cachedStats) {
            updateStatsDisplay(cachedStats, cachedInventory);
          }
        });
      }
    }
  }

  injectBetterStatsTab();

  // Observe for profile changes
  const observer = new MutationObserver(() => {
    const tabHeader = document.querySelector('.tab-header');
    if (tabHeader && !tabHeader.querySelector('.better-stats-tab-btn')) {
      injectBetterStatsTab();
    }
    
    // Check if user changed
    const userId = getUserId();
    if (userId && userId !== currentUserId) {
      clearCache();
      currentUserId = userId;
      
      // Refresh stats for new user if our tab is active
      if (statsList && document.querySelector('.better-stats-tab-btn.active')) {
        const stats = extractStatsFromDOM();
        cachedStats = stats;
        // Fetch inventory for new user
        if (!cachedInventory && !isFetchingInventory) {
          isFetchingInventory = true;
          fetchInventory(userId).then(inventory => {
            if (inventory) {
              cachedInventory = inventory;
            }
            isFetchingInventory = false;
            updateStatsDisplay(cachedStats, cachedInventory);
          });
        }
        updateStatsDisplay(stats, cachedInventory);
      }
    }
    
    if (statsList && statsList.children.length === 0 && cachedStats) {
      updateStatsDisplay(cachedStats, cachedInventory);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[Better Stats] Script loaded - all rarities shown with 0 if user has none.');
};

// Export for use in main file
module.exports = { betterStatsAddon };