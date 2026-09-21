/**
 * Applies red strikethrough styling to friends with the role "wnMNwWm"
 * (banned/restricted users) in the friends list.
 * 
 * - Fetches friends list from API
 * - Filters friends by target role
 * - Applies red color and strikethrough to matching friends
 * - Uses MutationObserver to persist through DOM changes
 * - Re-styles when friends list updates
 */
const friendStylerAddon = () => {
  'use strict';

  let observer = null;
  let styledFriends = new Set();
  let targetRole = 'wnMNwWm';
  let filteredFriends = [];

  async function fetchFriendsList() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return [];
      }

      const response = await fetch('https://api2.kirka.io/api/wwMmWW', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const friendsList = data.wMwmnNWW || [];
      
      // Filter friends by target role
      filteredFriends = friendsList.filter(friend => friend.wwMmWnNW === targetRole);
      
      return filteredFriends;
    } catch (error) {
      return [];
    }
  }

  function applyStylesToFriends() {
    if (filteredFriends.length === 0) {
      return;
    }

    // Get all friend elements on the page
    const friendElements = document.querySelectorAll('[data-v-97c118c6][data-v-15958624].friend, .friend');
    
    if (friendElements.length === 0) {
      return;
    }

    let styledCount = 0;

    // Loop through each friend element on the page
    friendElements.forEach(friendElement => {
      // Get the username from the friend element
      const nicknameDiv = friendElement.querySelector('.nickname');
      if (!nicknameDiv) return;
      
      const username = nicknameDiv.textContent.trim();
      
      // Check if this username is in our filtered list
      const matchedFriend = filteredFriends.find(f => f.wwMmWnW === username);
      
      if (matchedFriend) {
        // Apply red strikethrough style
        nicknameDiv.style.color = 'var(--red-3)';
        nicknameDiv.style.textDecoration = 'line-through';
        styledFriends.add(username);
        styledCount++;
      } else {
        // If it was previously styled but no longer in the list, remove styling
        if (styledFriends.has(username)) {
          nicknameDiv.style.color = '';
          nicknameDiv.style.textDecoration = '';
          styledFriends.delete(username);
        }
      }
    });

    return styledCount;
  }

  async function refreshStyles() {
    await fetchFriendsList();
    applyStylesToFriends();
  }

  function setupObserver() {
    if (observer) {
      observer.disconnect();
    }

    // Watch for DOM changes that might add/remove friends
    observer = new MutationObserver((mutations) => {
      let shouldRefresh = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Check if friends were added or removed
          if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
            // Check if any added/removed nodes are friends or contain friends
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1) {
                if (node.classList && node.classList.contains('friend')) {
                  shouldRefresh = true;
                  break;
                }
                if (node.querySelector && node.querySelector('.friend')) {
                  shouldRefresh = true;
                  break;
                }
              }
            }
            if (!shouldRefresh) {
              for (const node of mutation.removedNodes) {
                if (node.nodeType === 1) {
                  if (node.classList && node.classList.contains('friend')) {
                    shouldRefresh = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }
      
      if (shouldRefresh) {
        clearTimeout(window._friendStylerTimeout);
        window._friendStylerTimeout = setTimeout(() => {
          refreshStyles();
        }, 300);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }

  // Watch for friend list container changes specifically
  function setupFriendListWatcher() {
    const friendListContainer = document.querySelector('[data-v-27bb6a1a][data-v-a5e75d1c].friends');
    if (friendListContainer) {
      const listObserver = new MutationObserver(() => {
        refreshStyles();
      });
      listObserver.observe(friendListContainer, {
        childList: true,
        subtree: true
      });
    }
  }

  async function init() {
    await fetchFriendsList();
    applyStylesToFriends();
    setupObserver();
    setupFriendListWatcher();

    // Also refresh when navigating between pages
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(refreshStyles, 500);
      }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    // Refresh periodically to catch any updates
    setInterval(refreshStyles, 5000);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
};

// Export for use in main file
module.exports = { friendStylerAddon };