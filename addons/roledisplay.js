/**
 * Displays the user's role in the profile modal by fetching role data
 * from the API and mapping it to a display name.
 * 
 * - Fetches role mapping from GitHub
 * - Fetches user data from Kirka API
 * - Displays role as a new KLO-style card
 * - Shows BANNED status with red color and strikethrough
 * - Shows role color if available
 * - Updates when profile changes
 */
const roleDisplayAddon = () => {
  'use strict';

  // ---- Get user ID and remove # if present ----
  function getUserId() {
    const usernameEl = document.querySelector('.copy-cont .value');
    if (usernameEl) {
      let userId = usernameEl.textContent.trim();
      if (userId.startsWith('#')) {
        userId = userId.substring(1);
      }
      return userId;
    }
    return null;
  }

  // ---- Fetch role mapping data ----
  async function fetchRoleMapping() {
    try {
      const response = await fetch('https://raw.githubusercontent.com/OBS-Akuma/Ubuntu-client/refs/heads/main/assets/roledata.json');
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data;
    } catch (err) {
      return null;
    }
  }

  // ---- Fetch user data ----
  async function fetchUserData(userId) {
    if (!userId) return null;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return null;
      }

      const response = await fetch('https://api2.kirka.io/api/wwMmWW/wmWNn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          WwwnmW: userId,
          wmnwWM: true
        })
      });
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data;
    } catch (err) {
      return null;
    }
  }

  // ---- Get display role name from mapping ----
  function getDisplayRole(userData, roleMapping) {
    // Check if user is banned first
    if (userData.wwMmWnNW === 'wnMNwWm') {
      return { text: 'BANNED', isBanned: true };
    }
    
    const roleCode = userData.wMwnm || null;
    
    // If no role code, default to USER
    if (!roleCode) return { text: 'USER', isBanned: false };
    
    // If we have the mapping and the role exists, return the mapped name
    if (roleMapping && roleMapping[roleCode]) {
      return { text: roleMapping[roleCode], isBanned: false };
    }
    
    // If the role code is "000000" (owner), return "OWNER"
    if (roleCode === '000000') {
      return { text: 'OWNER', isBanned: false };
    }
    
    // If mapping doesn't have it, return the original code
    if (roleMapping) {
      return { text: roleCode, isBanned: false };
    }
    
    // If no mapping at all, return USER as fallback
    return { text: 'USER', isBanned: false };
  }

  // ---- Create new KLO card with role ----
  function createKloCard(userData, roleMapping) {
    if (!userData) return;

    const roleInfo = getDisplayRole(userData, roleMapping);
    const displayRole = roleInfo.text;
    const isBanned = roleInfo.isBanned;
    const roleColor = userData.wmnNM || null;

    // Find the KLO card
    const kloCard = document.querySelector('.card.k-d');
    if (!kloCard) {
      return;
    }

    // Check if role card already exists
    if (document.querySelector('.role-klo-card')) return;

    // Clone the KLO card
    const newCard = kloCard.cloneNode(true);
    newCard.className = 'card k-d role-klo-card';
    
    // Get the stat-name and stat-value elements
    const statName = newCard.querySelector('.stat-name');
    const statValue = newCard.querySelector('.stat-value');

    // Update stat-name - remove the info icon
    if (statName) {
      // Create new stat-name without the info icon
      const newStatName = document.createElement('div');
      newStatName.setAttribute('data-v-7f0e55d0', '');
      newStatName.className = 'stat-name text-2';
      newStatName.textContent = 'Role';
      
      // Replace the old stat-name with the new one
      statName.parentNode.replaceChild(newStatName, statName);
    }

    // Update stat-value with display role
    if (statValue) {
      statValue.textContent = displayRole;
      
      if (isBanned) {
        // Banned styling - keep font size default
        statValue.style.color = 'var(--red-3)';
        statValue.style.textDecoration = 'line-through';
        // Remove any font size override
        statValue.style.fontSize = '';
      } else {
        // Normal role styling - use default font size
        statValue.style.textDecoration = 'none';
        statValue.style.fontSize = '';
        // Only apply color if roleColor exists
        if (roleColor) {
          statValue.style.color = roleColor;
        } else {
          // Remove any color styling to use default
          statValue.style.color = '';
        }
      }
    }

    // Find the parent container
    const parentContainer = kloCard.parentElement;
    if (parentContainer) {
      // Insert the new card after the existing one
      kloCard.after(newCard);
    }
  }

  // ---- Main function ----
  async function init() {
    const userId = getUserId();
    if (!userId) {
      return;
    }

    // Check if role card already exists
    if (document.querySelector('.role-klo-card')) {
      return;
    }

    // Fetch role mapping and user data in parallel
    const [roleMapping, userData] = await Promise.all([
      fetchRoleMapping(),
      fetchUserData(userId)
    ]);

    if (userData) {
      createKloCard(userData, roleMapping);
    }
  }

  // Run the script
  init();

  // Setup observer for profile changes
  const observer = new MutationObserver(() => {
    // Check if KLO card exists and role card is not displayed
    const kloCard = document.querySelector('.card.k-d');
    if (kloCard && !document.querySelector('.role-klo-card')) {
      init();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
};

// Export for use in main file
module.exports = { roleDisplayAddon };