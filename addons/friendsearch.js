/**
 * Adds a search bar to the friends list for filtering friends by username or shortid.
 * 
 * - Real-time filtering as you type
 * - Enter key to confirm search
 * - Escape key to clear search
 * - MutationObserver to re-add if DOM changes
 * - Seamlessly integrates with the friend list UI
 */
const friendSearchAddon = () => {
  'use strict';

  function createSearch() {
    // Don't duplicate if it's already there
    if (document.querySelector(".search-friends")) return;

    const addFriendButton = Array.from(
      document.querySelectorAll("button.button.btn")
    ).find((btn) => btn.querySelector(".text")?.innerText.trim() === "ADD FRIEND");
    const addFriendContainer = addFriendButton?.closest("div.input");

    // If the friends list isn't on screen right now, bail — the observer will retry
    if (!addFriendContainer) return;

    const searchFriends = document.createElement("div");
    searchFriends.className = "search-friends";
    searchFriends.style.cssText = "display: flex; flex-direction: column; align-items: flex-start; margin-top: 1.5rem; padding: 0 1rem;";
    searchFriends.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: .5rem; width: 100%;">
        <span class="search-text" style="color: #f2f2f2; font-weight: 600;">Search</span>
        <span style="color: #8892a8; font-size: 0.8rem;">Press Enter to search</span>
      </div>
      <input type="text" placeholder="Enter username or shortid" class="search-input" style="border: .125rem solid #202639; outline: none; background: #2f3957; width: 100%; height: 2.875rem; padding-left: .5rem; box-sizing: border-box; font-weight: 600; font-size: 1rem; color: #f2f2f2; box-shadow: 0 1px 2px rgba(0,0,0,.4), inset 0 0 8px rgba(0,0,0,.4); border-radius: .25rem;"/>`;

    addFriendContainer.insertAdjacentElement("afterend", searchFriends);

    const searchInput = searchFriends.querySelector(".search-input");
    
    // Real-time filtering on input
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll(".friend").forEach((friend) => {
        const nickname = friend.querySelector(".nickname")?.innerText.toLowerCase() || "";
        const shortId = friend.querySelector(".friend-id")?.innerText.toLowerCase() || "";
        const displayName = friend.querySelector(".display-name")?.innerText.toLowerCase() || "";
        
        const match = nickname.includes(query) || shortId.includes(query) || displayName.includes(query);
        friend.style.display = match ? "flex" : "none";
      });
    });

    // Enter key to trigger search
    searchInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        const event = new Event('input');
        this.dispatchEvent(event);
      }
    });

    // Clear search on Escape key
    searchInput.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        this.value = "";
        this.dispatchEvent(new Event('input'));
        this.blur();
      }
    });
  }

  // Try immediately
  createSearch();

  // Re-inject whenever the friends panel (re)appears after DOM changes
  const observer = new MutationObserver(() => {
    createSearch();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Expose so you can stop it later from console
  window.__stopFriendSearch = () => observer.disconnect();
};

// Export for use in main file
module.exports = { friendSearchAddon };