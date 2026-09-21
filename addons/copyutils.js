/**
 * Adds keyboard shortcuts and click handlers for copying friend IDs and item names.
 * 
 * - Click friend: Copies their short ID (click any friend in the list)
 * - Press Tab after clicking friend: Copies "Name#ID" format
 * - Alt+Click friend: Opens their profile on Smudgy Store
 * - Click item: Copies the item name
 * - Tab after clicking item: Copies the item name
 * - Fallback clipboard support for older browsers
 */
const copyUtilsAddon = () => {
  'use strict';

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-9999px;';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  function openProfile(userId) {
    window.open('https://www.smudgy.store/kirka/profile?meow=' + userId, '_blank');
  }

  function getItemName(el) {
    const textSpan = el.querySelector('.text');
    if (textSpan && el.classList.contains('item-btn')) {
      return textSpan.textContent.trim();
    }
    return null;
  }

  function getFriendInfo(el) {
    const nameEl = el.querySelector('.nickname');
    const idEl = el.querySelector('.friend-id');
    if (nameEl && idEl) {
      return {
        name: nameEl.textContent.trim(),
        id: idEl.textContent.trim()
      };
    }
    return null;
  }

  function getFriendId(el) {
    const idEl = el.querySelector('.friend-id');
    return idEl ? idEl.textContent.trim() : null;
  }

  function findItemContainer(el) {
    return el.closest('.item-btn');
  }

  function findFriendContainer(el) {
    return el.closest('.friend');
  }

  let lastClickedElement = null;
  let lastClickedType = null;

  document.addEventListener('click', function(e) {
    if (e.altKey) return;

    let friendContainer = findFriendContainer(e.target);
    if (friendContainer) {
      lastClickedElement = friendContainer;
      lastClickedType = 'friend';
      const id = getFriendId(friendContainer);
      if (id) copyToClipboard(id);
      return;
    }

    let itemContainer = findItemContainer(e.target);
    if (itemContainer) {
      const name = getItemName(itemContainer);
      if (name) {
        lastClickedElement = itemContainer;
        lastClickedType = 'item';
      }
    }
  }, true);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();

      if (!lastClickedElement) return;

      if (lastClickedType === 'friend') {
        const info = getFriendInfo(lastClickedElement);
        if (info) {
          copyToClipboard(info.name + '#' + info.id);
        }
        return;
      }

      if (lastClickedType === 'item') {
        const name = getItemName(lastClickedElement);
        if (name) {
          copyToClipboard(name);
        }
      }
    }
  }, true);

  document.addEventListener('click', function(e) {
    if (!e.altKey || e.ctrlKey || e.shiftKey) return;

    let friendContainer = findFriendContainer(e.target);
    if (friendContainer) {
      const info = getFriendInfo(friendContainer);
      if (info && info.id) {
        openProfile(info.id);
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    let itemContainer = findItemContainer(e.target);
    if (itemContainer) {
      const name = getItemName(itemContainer);
      if (name) {
        navigator.clipboard.writeText(name).catch(function() {
          const textarea = document.createElement('textarea');
          textarea.value = name;
          textarea.style.cssText = 'position:fixed;left:-9999px;';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        });
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, true);
};

// Export for use in main file
module.exports = { copyUtilsAddon };