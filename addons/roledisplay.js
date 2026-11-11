/**
 * Displays the user's role in the profile modal by fetching role data
 * from the API and mapping it to a display name.
 *
 * - Fetches role mapping from GitHub (supports both role-code and color keys)
 * - Fetches user data from Kirka API
 * - Displays role as a new KLO-style card
 * - Shows BANNED status with red color and strikethrough
 * - Shows role color if available
 * - Falls back to color lookup when the role code has no mapping
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

      const response = await fetch('https://api2.kirka.io/api/WwMWm/wmMwWn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          WnWwwNmM: userId,
          wMWnwm: true
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

  // ---- Normalize a color to lowercase #rrggbb ----
  function normColor(color) {
    if (!color) return null;
    const s = String(color).trim().toLowerCase();
    if (!s) return null;
    return s.startsWith('#') ? s : '#' + s;
  }

  // ---- Get display role name from mapping ----
  function getDisplayRole(userData, roleMapping) {
    // Banned is flagged by WwMWmnwN === "wNmWnMwW"
    if (userData.WwMWmnwN === 'wNmWnMwW') {
      return { text: 'BANNED', isBanned: true };
    }

    const roleCode = userData.wnMwWmN || null;
    const roleColor = normColor(userData.wmwNWW);

    // 1. Try role code lookup first
    if (roleCode && roleMapping && roleMapping[roleCode]) {
      return { text: roleMapping[roleCode], isBanned: false };
    }

    // 2. Fall back to color lookup
    if (roleColor && roleMapping && roleMapping[roleColor]) {
      return { text: roleMapping[roleColor], isBanned: false };
    }

    // 3. No code at all and no color match -> USER
    if (!roleCode) return { text: 'USER', isBanned: false };

    // 4. Otherwise show the raw role code
    return { text: roleCode, isBanned: false };
  }

  // ---- Create new KLO card with role ----
  function createKloCard(userData, roleMapping) {
    if (!userData) return;

    const roleInfo = getDisplayRole(userData, roleMapping);
    const displayRole = roleInfo.text;
    const isBanned = roleInfo.isBanned;
    // Role color lives at wmwNWW in the new response
    const roleColor = userData.wmwNWW || null;

    // Find the KLO card to clone
    const kloCard = document.querySelector('.card.k-d');
    if (!kloCard) {
      return;
    }

    // Check if role card already exists
    if (document.querySelector('.role-klo-card')) return;

    // Clone the KLO card
    const newCard = kloCard.cloneNode(true);
    newCard.className = 'card k-d role-klo-card';

    // --- stat-name: rebuild without the info-icon popover ---
    const statName = newCard.querySelector('.stat-name');
    if (statName) {
      statName.className = 'stat-name text-2 klo';
      statName.textContent = 'ROLE';
    }

    // --- stat-value: set role text + styling ---
    const statValue = newCard.querySelector('.stat-value');
    if (statValue) {
      statValue.className = 'stat-value stat-value-kd text-2';
      statValue.textContent = displayRole;

      if (isBanned) {
        statValue.style.color = 'var(--red-3)';
        statValue.style.textDecoration = 'line-through';
        statValue.style.fontSize = '';
      } else {
        statValue.style.textDecoration = 'none';
        statValue.style.fontSize = '';
        if (roleColor) {
          statValue.style.color = roleColor;
        } else {
          statValue.style.color = '';
        }
      }
    }

    // Insert the new card after the existing KLO card
    const parentContainer = kloCard.parentElement;
    if (parentContainer) {
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
    const kloCard = document.querySelector('.card.k-d');
    if (kloCard && !document.querySelector('.role-klo-card')) {
      init();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
};

// Export for use in main file
module.exports = { roleDisplayAddon };
