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

      const response = await fetch('https://api2.kirka.io/api/WwMwnNmW/wmMwWnN', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          WnWwwM: userId,
          wmwNnWW: true
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
    // Check if user is banned first (key may not exist in new API)
    if (userData.wwMmWnNW === 'wnMNwWm') {
      return { text: 'BANNED', isBanned: true };
    }

    // Role code lives at wnMNmWw in the new API response
    const roleCode = userData.wnMNmWw || null;

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
    const roleColor = userData.wmnNM || userData.wmwNWM || null;

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
      // Clear out everything (including the ? popover) and just set the label
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
