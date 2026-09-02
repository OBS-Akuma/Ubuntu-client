/**
 * Enhances the Kirka friend list with role-based grouping, online status,
 * streamer mode, better icons, and various toggle options.
 *
 * - Groups friends by role (Admin, Moderator, etc.)
 * - Shows online friends at top of each group
 * - Blur in-game status option
 * - Streamer mode (blur/abbreviate names)
 * - Better icons for online/busy/away status
 * - Lock unfriend option
 * - Role dividers with color accents
 *
 * Fix notes (2026-09):
 * - reorganizeFriends() now disconnects/reconnects the item-level observer
 *   around its own DOM writes, so it no longer triggers itself in an
 *   infinite reorganize loop.
 * - The observer now treats any attribute change on a descendant of
 *   `.friend` (not just the `.friend` node itself) as reorganize-worthy,
 *   so online/away/busy/in-game status swaps on nested dots/status spans
 *   are picked up in real time.
 * - getBadgeMap() now retries with backoff, and init() keeps retrying in
 *   the background if the first fetch fails, so a single network hiccup
 *   doesn't permanently disable the addon for the rest of the session.
 * - Reinitialization is now keyed off whether the `.friends .list` DOM
 *   node itself has been replaced (SPA re-render), rather than a single
 *   isInitialized flag, so leaving and coming back reliably re-attaches
 *   everything.
 */
const friendListAddon = () => {
  'use strict';

  const BADGE_JSON_URL = 'https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/rb.json';
  const STORAGE_KEY = 'kirka_friend_list_settings';
  let isOrganizing = false;
  let badgeMap = null;
  let badgeMapFetchInFlight = false;
  let roleOrder = [];
  let observer = null;
  let friendListObserver = null;
  let blurInGame = true;
  let showRoleDividers = false;
  let streamerMode = 'none';
  let betterIcons = false;
  let originalFriendOrder = [];
  let originalOrderSaved = false;
  let lockUnfriend = false;
  let roleColorMap = new Map();
  let currentListEl = null;
  let reorganizeTimeout = null;
  let badgeRetryTimeout = null;

  const ICON_URLS = {
    busy: 'https://cdn.discordapp.com/role-icons/851443382353133579/7ff49c28f5ab9ccb2acb2d5b9391a793.webp',
    online: 'https://cdn.discordapp.com/role-icons/851443556127997993/25805d772e0ce04dc302969fb94014fa.webp',
    away: 'https://cdn.discordapp.com/role-icons/979567532757381160/468e77e6df68bafc719ea3e7d9409d84.webp'
  };

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        blurInGame = settings.blurInGame !== undefined ? settings.blurInGame : false;
        showRoleDividers = settings.showRoleDividers !== undefined ? settings.showRoleDividers : true;
        streamerMode = settings.streamerMode || 'none';
        betterIcons = settings.betterIcons !== undefined ? settings.betterIcons : false;
        lockUnfriend = settings.lockUnfriend !== undefined ? settings.lockUnfriend : false;
      }
    } catch (error) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ blurInGame, showRoleDividers, streamerMode, betterIcons, lockUnfriend }));
    } catch (error) {}
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Retries with backoff so a single failed fetch doesn't kill the addon
  // for the rest of the session.
  async function getBadgeMap(retries = 3, baseDelayMs = 1000) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(BADGE_JSON_URL);
        if (!response.ok) throw new Error(`bad response: ${response.status}`);
        const data = await response.json();
        const map = new Map();

        data.forEach(item => {
          const colorKey = Object.keys(item)[0];
          const roleName = item[colorKey];
          map.set(colorKey, roleName);

          const rgbMatch = colorKey.match(/(\d+),\s*(\d+),\s*(\d+)/);
          if (rgbMatch) {
            const rgb = `rgb(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]})`;
            roleColorMap.set(roleName, rgb);
          }
        });

        roleOrder = [];
        const seenRoles = new Set();
        data.forEach(item => {
          const colorKey = Object.keys(item)[0];
          const roleName = item[colorKey];
          if (!seenRoles.has(roleName)) {
            seenRoles.add(roleName);
            roleOrder.push(roleName);
          }
        });

        if (!roleOrder.includes('User')) {
          roleOrder.push('User');
          roleColorMap.set('User', '#8a8a8a');
        }

        return map;
      } catch (error) {
        if (attempt < retries - 1) {
          await sleep(baseDelayMs * (attempt + 1));
        }
      }
    }
    return null;
  }

  // Keeps trying in the background (slow interval) until the badge map
  // loads successfully, instead of giving up forever after one failure.
  function scheduleBadgeMapRetry() {
    if (badgeMap || badgeMapFetchInFlight || badgeRetryTimeout) return;
    badgeRetryTimeout = setTimeout(async () => {
      badgeRetryTimeout = null;
      if (badgeMap) return;
      badgeMapFetchInFlight = true;
      const map = await getBadgeMap();
      badgeMapFetchInFlight = false;
      if (map) {
        badgeMap = map;
        currentListEl = null; // force a fresh reorganize pass
        ensureInitialized();
      } else {
        scheduleBadgeMapRetry();
      }
    }, 15000);
  }

  function changeAddFriendText() {
    const headText = document.querySelector('.add-friends .head-text');
    if (headText && headText.textContent.trim() === 'ADD FRIEND') {
      headText.textContent = 'ADD FRIENDS';
    }
  }

  function getBadgeColor(badgeElement) {
    if (!badgeElement) return null;
    const bgColor = badgeElement.style.backgroundColor;
    if (!bgColor) return null;
    const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    return match ? `${match[1]}, ${match[2]}, ${match[3]}` : null;
  }

  function isFriendOnline(friendElement) {
    if (friendElement.classList.contains('is-online')) return true;
    if (friendElement.querySelector('.online-circle')) return true;
    const onlineDot = friendElement.querySelector('.online-dot');
    return onlineDot && onlineDot.classList.contains('dot-online');
  }

  function getFriendLevel(friendElement) {
    const levelElement = friendElement.querySelector('.level-amount');
    if (levelElement) {
      const levelText = levelElement.textContent.trim();
      const level = parseInt(levelText);
      return isNaN(level) ? 0 : level;
    }
    return 0;
  }

  function getFriendRole(friendElement, map) {
    const badgeElement = friendElement.querySelector('.role-badge');
    if (badgeElement) {
      const colorKey = getBadgeColor(badgeElement);
      if (colorKey && map.has(colorKey)) {
        return map.get(colorKey);
      }
    }
    return 'User';
  }

  function isFriendInGame(friendElement) {
    const statusElement = friendElement.querySelector('.status');
    if (statusElement) {
      const statusText = statusElement.textContent.trim().toLowerCase();
      if (statusText.includes('in game') || statusText.includes('ingame') || statusText.includes('in-game')) {
        return true;
      }
    }
    const onlineElement = friendElement.querySelector('.online');
    if (onlineElement) {
      const onlineText = onlineElement.textContent.trim().toLowerCase();
      if (onlineText.includes('in game') || onlineText.includes('ingame') || onlineText.includes('in-game')) {
        return true;
      }
    }
    return false;
  }

  function toggleInGameBlur(friendElement, shouldBlur) {
    const statusElement = friendElement.querySelector('.status');
    if (statusElement) {
      const statusText = statusElement.textContent.trim().toLowerCase();
      if (statusText.includes('in game') || statusText.includes('ingame') || statusText.includes('in-game')) {
        statusElement.style.filter = shouldBlur ? 'blur(5px)' : 'none';
        statusElement.style.transition = 'filter 0.3s ease';
      }
    }

    const onlineElement = friendElement.querySelector('.online');
    if (onlineElement) {
      const onlineText = onlineElement.textContent.trim().toLowerCase();
      if (onlineText.includes('in game') || onlineText.includes('ingame') || onlineText.includes('in-game')) {
        const dotElement = onlineElement.querySelector('.online-dot');
        if (dotElement) {
          const textNodes = [];
          let currentNode = dotElement.nextSibling;
          while (currentNode) {
            if (currentNode.nodeType === Node.TEXT_NODE) {
              textNodes.push(currentNode);
            }
            currentNode = currentNode.nextSibling;
          }

          if (textNodes.length > 0) {
            let textWrapper = onlineElement.querySelector('.in-game-text');
            if (!textWrapper) {
              textWrapper = document.createElement('span');
              textWrapper.className = 'in-game-text';
              textWrapper.style.transition = 'filter 0.3s ease';
              textNodes.forEach(node => {
                textWrapper.appendChild(node.cloneNode(true));
                node.remove();
              });
              if (dotElement.nextSibling) {
                dotElement.parentNode.insertBefore(textWrapper, dotElement.nextSibling);
              } else {
                dotElement.parentNode.appendChild(textWrapper);
              }
            }
            textWrapper.style.filter = shouldBlur ? 'blur(5px)' : 'none';
          }
        }
      }
    }
  }

  function applyInGameBlur() {
    const friends = document.querySelectorAll('.friends .list .friend');
    if (friends.length === 0) return;
    friends.forEach(friendElement => {
      if (isFriendInGame(friendElement)) {
        toggleInGameBlur(friendElement, blurInGame);
      }
    });
  }

  function saveOriginalOrder(friendElements) {
    if (!originalOrderSaved) {
      originalFriendOrder = Array.from(friendElements);
      originalOrderSaved = true;
    }
  }

  function restoreOriginalOrder() {
    const friendContainer = document.querySelector('.friends .list');
    if (!friendContainer || originalFriendOrder.length === 0) return;
    withObserverPaused(() => {
      friendContainer.querySelectorAll('.role-divider').forEach(div => div.remove());
      friendContainer.innerHTML = '';
      originalFriendOrder.forEach(friend => friendContainer.appendChild(friend));
    });
    if (blurInGame) applyInGameBlur();
  }

  function applyBetterIcons() {
    const friendDots = document.querySelectorAll('.friends .list .friend .online-dot');
    const statusDots = document.querySelectorAll('.wrapper-input.status-select .prefix-dot');

    if (friendDots.length === 0 && statusDots.length === 0) return;

    friendDots.forEach(dot => {
      const existingImg = dot.parentNode.querySelector('.status-icon-img');
      if (existingImg) {
        existingImg.remove();
      }

      if (!betterIcons) {
        dot.style.display = '';
        dot.style.background = 'none';
        dot.style.width = '';
        dot.style.height = '';
        dot.style.borderRadius = '';
        return;
      }

      const classes = Array.from(dot.classList);
      let iconUrl = null;

      if (classes.some(c => c.includes('dot-online'))) {
        iconUrl = ICON_URLS.online;
      } else if (classes.some(c => c.includes('dot-busy'))) {
        iconUrl = ICON_URLS.busy;
      } else if (classes.some(c => c.includes('dot-away'))) {
        iconUrl = ICON_URLS.away;
      }

      if (iconUrl) {
        dot.style.display = 'none';

        const img = document.createElement('img');
        img.className = 'status-icon-img';
        img.style.cssText = 'width:16px;height:16px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:4px;';
        img.src = iconUrl;
        dot.parentNode.insertBefore(img, dot);
      }
    });

    statusDots.forEach(dot => {
      const existingImg = dot.parentNode.querySelector('.status-icon-img');
      if (existingImg) {
        existingImg.remove();
      }

      if (!betterIcons) {
        dot.style.display = '';
        dot.style.background = 'none';
        dot.style.width = '';
        dot.style.height = '';
        dot.style.borderRadius = '';
        return;
      }

      const classes = Array.from(dot.classList);
      let iconUrl = null;

      if (classes.some(c => c.includes('dot-online'))) {
        iconUrl = ICON_URLS.online;
      } else if (classes.some(c => c.includes('dot-busy'))) {
        iconUrl = ICON_URLS.busy;
      } else if (classes.some(c => c.includes('dot-away'))) {
        iconUrl = ICON_URLS.away;
      }

      if (iconUrl) {
        dot.style.display = 'none';

        const img = document.createElement('img');
        img.className = 'status-icon-img';
        img.style.cssText = 'width:14px;height:14px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:4px;';
        img.src = iconUrl;
        dot.parentNode.insertBefore(img, dot);
      }
    });
  }

  function applyStreamerMode() {
    const shouldBlur = streamerMode === 'blur' || streamerMode === 'abbrev_blur';
    const shouldAbbrev = streamerMode === 'abbrev' || streamerMode === 'abbrev_blur';

    document.querySelectorAll('.friends .list .friend .nickname').forEach(nicknameElement => {
      const badge = nicknameElement.querySelector('.role-badge');

      let textContent = '';
      let child = nicknameElement.firstChild;
      while (child) {
        if (child.nodeType === Node.TEXT_NODE) {
          textContent += child.textContent;
        }
        child = child.nextSibling;
      }
      textContent = textContent.trim();

      if (!nicknameElement.getAttribute('data-original-text')) {
        nicknameElement.setAttribute('data-original-text', textContent);
      }

      const textNodes = [];
      child = nicknameElement.firstChild;
      while (child) {
        if (child.nodeType === Node.TEXT_NODE) {
          textNodes.push(child);
        }
        child = child.nextSibling;
      }
      textNodes.forEach(node => node.remove());

      let displayText = nicknameElement.getAttribute('data-original-text');
      if (shouldAbbrev) {
        const firstChar = displayText.trim().charAt(0);
        displayText = firstChar ? `${firstChar}...` : '...';
      }
      const textNode = document.createTextNode(displayText);

      if (badge) {
        nicknameElement.insertBefore(textNode, badge);
      } else {
        nicknameElement.appendChild(textNode);
      }

      if (shouldBlur) {
        nicknameElement.style.filter = 'blur(5px)';
        nicknameElement.style.transition = 'filter 0.3s ease';
      } else {
        nicknameElement.style.filter = 'none';
      }
    });

    document.querySelectorAll('.friends .list .friend .friend-id').forEach(idElement => {
      const textContent = idElement.textContent.trim();

      if (!idElement.getAttribute('data-original-text')) {
        idElement.setAttribute('data-original-text', textContent);
      }

      let displayText = idElement.getAttribute('data-original-text');
      if (shouldAbbrev) {
        const firstChar = displayText.trim().charAt(0);
        displayText = firstChar ? `${firstChar}...` : '...';
      }
      idElement.textContent = displayText;

      if (shouldBlur) {
        idElement.style.filter = 'blur(5px)';
        idElement.style.transition = 'filter 0.3s ease';
      } else {
        idElement.style.filter = 'none';
      }
    });

    document.querySelectorAll('.short-id-clipboard').forEach(idElement => {
      if (idElement.closest('.add-friends') || idElement.closest('.your-id-copy')) {
        const textContent = idElement.textContent.trim();

        if (!idElement.getAttribute('data-original-text')) {
          idElement.setAttribute('data-original-text', textContent);
        }

        let displayText = idElement.getAttribute('data-original-text');
        if (shouldAbbrev) {
          const firstChar = displayText.trim().charAt(0);
          displayText = firstChar ? `${firstChar}...` : '...';
        }
        idElement.textContent = displayText;

        if (shouldBlur) {
          idElement.style.filter = 'blur(5px)';
          idElement.style.transition = 'filter 0.3s ease';
        } else {
          idElement.style.filter = 'none';
        }
      }
    });
  }

  function applyLockUnfriend() {
    const friendElements = document.querySelectorAll('.friend');
    friendElements.forEach(friend => {
      const deleteBtn = friend.querySelector('.delete');
      if (deleteBtn) {
        if (lockUnfriend) {
          deleteBtn.style.cssText = 'display:none;visibility:hidden;opacity:0;pointer-events:none;width:0;height:0;overflow:hidden;margin:0;padding:0;';
        } else {
          deleteBtn.style.cssText = '';
        }
      }
    });
  }

  function createStreamerDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'bottom-row streamer-dropdown-container';
    dropdown.setAttribute('data-v-6631cc61', '');
    dropdown.style.paddingBottom = '8px';
    dropdown.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';

    const label = document.createElement('div');
    label.className = 'bottom-label';
    label.setAttribute('data-v-6631cc61', '');
    label.textContent = 'STREAMER MODE';

    const selectWrapper = document.createElement('label');
    selectWrapper.className = 'wrapper-input status-select';
    selectWrapper.setAttribute('data-v-4d0573bf', '');
    selectWrapper.setAttribute('data-v-6631cc61', '');

    const inputDiv = document.createElement('div');
    inputDiv.className = 'input';
    inputDiv.setAttribute('data-v-4d0573bf', '');
    inputDiv.setAttribute('tabindex', '0');

    const selected = document.createElement('div');
    selected.className = 'selected';
    selected.setAttribute('data-v-4d0573bf', '');
    const modeLabels = {
      'none': 'None',
      'blur': 'Blur',
      'abbrev': 'A...',
      'abbrev_blur': 'A... + Blur'
    };
    selected.textContent = modeLabels[streamerMode] || 'None';

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'items selectHide drop-up';
    itemsDiv.setAttribute('data-v-4d0573bf', '');

    const options = [
      ['none', 'None'],
      ['blur', 'Blur'],
      ['abbrev', 'A...'],
      ['abbrev_blur', 'A... + Blur']
    ];

    options.forEach(([mode, label2]) => {
      const opt = document.createElement('div');
      opt.setAttribute('data-v-4d0573bf', '');
      opt.textContent = label2;
      opt.style.cursor = 'pointer';
      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        streamerMode = mode;
        saveSettings();
        selected.textContent = label2;
        itemsDiv.classList.add('selectHide');
        applyStreamerMode();
      });
      itemsDiv.appendChild(opt);
    });

    inputDiv.appendChild(selected);
    inputDiv.appendChild(itemsDiv);
    selectWrapper.appendChild(inputDiv);
    dropdown.appendChild(label);
    dropdown.appendChild(selectWrapper);

    inputDiv.addEventListener('click', function (e) {
      e.stopPropagation();
      itemsDiv.classList.toggle('selectHide');
    });

    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target)) {
        itemsDiv.classList.add('selectHide');
      }
    });

    return dropdown;
  }

  function createToggles() {
    const addFriendsContainer = document.querySelector('.add-friends');
    if (!addFriendsContainer) return;
    if (addFriendsContainer.querySelector('.toggle-container')) {
      updateToggleStates();
      return;
    }
    const sidebarBottom = addFriendsContainer.querySelector('.sidebar-bottom');
    if (!sidebarBottom) return;
    const dndRow = sidebarBottom.querySelector('.bottom-row:first-child');
    if (!dndRow) return;

    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'toggle-container';
    toggleContainer.setAttribute('data-v-6631cc61', '');
    toggleContainer.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const blurToggleRow = dndRow.cloneNode(true);
    blurToggleRow.className = 'bottom-row blur-toggle-container';
    blurToggleRow.setAttribute('data-v-6631cc61', '');
    const blurCheckbox = blurToggleRow.querySelector('input[type="checkbox"]');
    if (blurCheckbox) {
      blurCheckbox.checked = blurInGame;
      blurCheckbox.setAttribute('data-v-730c0c40', '');
      blurCheckbox.addEventListener('change', function () {
        blurInGame = this.checked;
        saveSettings();
        applyInGameBlur();
      });
    }
    const blurLabelDiv = blurToggleRow.querySelector('.bottom-label');
    if (blurLabelDiv) {
      blurLabelDiv.setAttribute('data-v-6631cc61', '');
      blurLabelDiv.innerHTML = '';
      blurLabelDiv.appendChild(document.createTextNode('Blur In-Game Status'));
    }
    toggleContainer.appendChild(blurToggleRow);

    const dividerToggleRow = dndRow.cloneNode(true);
    dividerToggleRow.className = 'bottom-row divider-toggle-container';
    dividerToggleRow.setAttribute('data-v-6631cc61', '');
    const dividerCheckbox = dividerToggleRow.querySelector('input[type="checkbox"]');
    if (dividerCheckbox) {
      dividerCheckbox.checked = showRoleDividers;
      dividerCheckbox.setAttribute('data-v-730c0c40', '');
      dividerCheckbox.addEventListener('change', function () {
        showRoleDividers = this.checked;
        saveSettings();
        if (badgeMap) {
          if (showRoleDividers) {
            originalOrderSaved = false;
            reorganizeFriends(badgeMap);
          } else {
            restoreOriginalOrder();
          }
        }
      });
    }
    const dividerLabelDiv = dividerToggleRow.querySelector('.bottom-label');
    if (dividerLabelDiv) {
      dividerLabelDiv.setAttribute('data-v-6631cc61', '');
      dividerLabelDiv.innerHTML = '';
      dividerLabelDiv.appendChild(document.createTextNode('Show Role Dividers'));
    }
    toggleContainer.appendChild(dividerToggleRow);

    const betterIconsRow = dndRow.cloneNode(true);
    betterIconsRow.className = 'bottom-row better-icons-container';
    betterIconsRow.setAttribute('data-v-6631cc61', '');
    const betterIconsCheckbox = betterIconsRow.querySelector('input[type="checkbox"]');
    if (betterIconsCheckbox) {
      betterIconsCheckbox.checked = betterIcons;
      betterIconsCheckbox.setAttribute('data-v-730c0c40', '');
      betterIconsCheckbox.addEventListener('change', function () {
        betterIcons = this.checked;
        saveSettings();
        applyBetterIcons();
      });
    }
    const betterIconsLabelDiv = betterIconsRow.querySelector('.bottom-label');
    if (betterIconsLabelDiv) {
      betterIconsLabelDiv.setAttribute('data-v-6631cc61', '');
      betterIconsLabelDiv.innerHTML = '';
      betterIconsLabelDiv.appendChild(document.createTextNode('Better Icons'));
    }
    toggleContainer.appendChild(betterIconsRow);

    const lockUnfriendRow = dndRow.cloneNode(true);
    lockUnfriendRow.className = 'bottom-row lock-unfriend-container';
    lockUnfriendRow.setAttribute('data-v-6631cc61', '');
    const lockUnfriendCheckbox = lockUnfriendRow.querySelector('input[type="checkbox"]');
    if (lockUnfriendCheckbox) {
      lockUnfriendCheckbox.checked = lockUnfriend;
      lockUnfriendCheckbox.setAttribute('data-v-730c0c40', '');
      lockUnfriendCheckbox.addEventListener('change', function () {
        lockUnfriend = this.checked;
        saveSettings();
        applyLockUnfriend();
      });
    }
    const lockUnfriendLabelDiv = lockUnfriendRow.querySelector('.bottom-label');
    if (lockUnfriendLabelDiv) {
      lockUnfriendLabelDiv.setAttribute('data-v-6631cc61', '');
      lockUnfriendLabelDiv.innerHTML = '';
      lockUnfriendLabelDiv.appendChild(document.createTextNode('Lock Unfriend'));
    }
    toggleContainer.appendChild(lockUnfriendRow);

    const streamerRow = createStreamerDropdown();
    toggleContainer.appendChild(streamerRow);

    const spacer = document.createElement('div');
    spacer.setAttribute('data-v-6631cc61', '');
    spacer.style.cssText = 'height:12px;border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:8px;';
    toggleContainer.appendChild(spacer);

    dndRow.parentNode.insertBefore(toggleContainer, dndRow.nextSibling);
  }

  function updateToggleStates() {
    const toggleContainer = document.querySelector('.toggle-container');
    if (!toggleContainer) return;
    const blurCheckbox = toggleContainer.querySelector('.blur-toggle-container input[type="checkbox"]');
    if (blurCheckbox) blurCheckbox.checked = blurInGame;
    const dividerCheckbox = toggleContainer.querySelector('.divider-toggle-container input[type="checkbox"]');
    if (dividerCheckbox) dividerCheckbox.checked = showRoleDividers;
    const betterIconsCheckbox = toggleContainer.querySelector('.better-icons-container input[type="checkbox"]');
    if (betterIconsCheckbox) betterIconsCheckbox.checked = betterIcons;
    const lockUnfriendCheckbox = toggleContainer.querySelector('.lock-unfriend-container input[type="checkbox"]');
    if (lockUnfriendCheckbox) lockUnfriendCheckbox.checked = lockUnfriend;
    const streamerSelected = toggleContainer.querySelector('.streamer-dropdown-container .selected');
    if (streamerSelected) {
      const modeLabels = {
        'none': 'None',
        'blur': 'Blur',
        'abbrev': 'A...',
        'abbrev_blur': 'A... + Blur'
      };
      streamerSelected.textContent = modeLabels[streamerMode] || 'None';
    }
  }

  function createDivider(title, count = 0, roleName = '') {
    const divider = document.createElement('div');
    divider.className = 'role-divider';
    divider.setAttribute('data-v-6631cc61', '');
    divider.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 16px 4px 16px;';

    const accentColor = roleColorMap.get(roleName) || '#666666';

    const accent = document.createElement('span');
    accent.setAttribute('data-v-6631cc61', '');
    accent.style.cssText = `width:3px;height:12px;border-radius:2px;background:${accentColor};flex-shrink:0;`;

    const titleText = document.createElement('span');
    titleText.setAttribute('data-v-6631cc61', '');
    titleText.textContent = title;
    titleText.style.cssText = 'font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#999999;white-space:nowrap;';

    const countBadge = document.createElement('span');
    countBadge.setAttribute('data-v-6631cc61', '');
    countBadge.textContent = count;
    countBadge.style.cssText = 'font-size:10px;font-weight:600;color:#aaaaaa;background:rgba(255,255,255,0.06);border-radius:8px;padding:1px 6px;flex-shrink:0;';

    const line = document.createElement('span');
    line.setAttribute('data-v-6631cc61', '');
    line.style.cssText = 'flex:1;height:1px;background:linear-gradient(to right,rgba(255,255,255,0.12),rgba(255,255,255,0));';

    divider.appendChild(accent);
    divider.appendChild(titleText);
    divider.appendChild(countBadge);
    divider.appendChild(line);
    return divider;
  }

  function sortFriendsByOnlineAndLevel(friendElements) {
    return Array.from(friendElements).sort((a, b) => {
      const aOnline = isFriendOnline(a);
      const bOnline = isFriendOnline(b);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;

      const aLevel = getFriendLevel(a);
      const bLevel = getFriendLevel(b);
      return bLevel - aLevel;
    });
  }

  // Runs `fn` with the item-level observer disconnected so our own DOM
  // writes don't get picked up as "friends changed" and re-trigger us.
  function withObserverPaused(fn) {
    const wasObserving = !!observer;
    if (observer) observer.disconnect();
    try {
      fn();
    } finally {
      if (wasObserving) setupObserver();
    }
  }

  function reorganizeFriends(map) {
    if (isOrganizing) return;
    isOrganizing = true;
    try {
      const friendContainer = document.querySelector('.friends .list');
      if (!friendContainer) return;
      let friendElements = friendContainer.querySelectorAll('.friend');
      if (friendElements.length === 0) return;

      if (!originalOrderSaved || originalFriendOrder.length !== friendElements.length) {
        saveOriginalOrder(friendElements);
      }
      if (!showRoleDividers) {
        restoreOriginalOrder();
        return;
      }

      withObserverPaused(() => {
        friendContainer.querySelectorAll('.role-divider').forEach(div => div.remove());
        friendElements = friendContainer.querySelectorAll('.friend');

        const roleGroups = new Map();
        for (const role of roleOrder) {
          roleGroups.set(role, { online: [], offline: [] });
        }
        if (!roleGroups.has('User')) {
          roleGroups.set('User', { online: [], offline: [] });
          if (!roleOrder.includes('User')) roleOrder.push('User');
        }

        friendElements.forEach(friendElement => {
          const isOnline = isFriendOnline(friendElement);
          const role = getFriendRole(friendElement, map);

          let group = roleGroups.get(role);
          if (!group) {
            const roleName = role || 'User';
            if (!roleGroups.has(roleName)) {
              roleGroups.set(roleName, { online: [], offline: [] });
              if (!roleOrder.includes(roleName)) roleOrder.push(roleName);
            }
            group = roleGroups.get(roleName);
          }

          if (isOnline) {
            group.online.push(friendElement);
          } else {
            group.offline.push(friendElement);
          }
        });

        for (const [, group] of roleGroups) {
          group.online = sortFriendsByOnlineAndLevel(group.online);
          group.offline = sortFriendsByOnlineAndLevel(group.offline);
        }

        friendContainer.innerHTML = '';
        let hasContent = false;
        for (const role of roleOrder) {
          const group = roleGroups.get(role);
          if (!group || (group.online.length === 0 && group.offline.length === 0)) continue;
          if (hasContent) {
            const spacer = document.createElement('div');
            spacer.setAttribute('data-v-6631cc61', '');
            spacer.style.height = '2px';
            friendContainer.appendChild(spacer);
          }
          const totalCount = group.online.length + group.offline.length;
          friendContainer.appendChild(createDivider(role, totalCount, role));
          group.online.forEach(friend => friendContainer.appendChild(friend));
          group.offline.forEach(friend => friendContainer.appendChild(friend));
          hasContent = true;
        }
      });

      if (blurInGame) applyInGameBlur();
      applyStreamerMode();
      applyBetterIcons();
      applyLockUnfriend();
    } catch (error) {
      // Silent fail
    } finally {
      isOrganizing = false;
    }
  }

  function setupObserver() {
    if (observer) observer.disconnect();
    const friendContainer = document.querySelector('.friends .list');
    if (!friendContainer) return;
    observer = new MutationObserver((mutations) => {
      let shouldReorganize = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 &&
                ((node.classList && node.classList.contains('friend')) ||
                 (node.querySelector && node.querySelector('.friend')))) {
              shouldReorganize = true;
              break;
            }
          }
          if (!shouldReorganize) {
            for (const node of mutation.removedNodes) {
              if (node.nodeType === 1 &&
                  ((node.classList && node.classList.contains('friend')) ||
                   (node.querySelector && node.querySelector('.friend')))) {
                shouldReorganize = true;
                break;
              }
            }
          }
        } else if (mutation.type === 'attributes') {
          // Catches status/online-dot class changes on children of a
          // .friend element too, not just the .friend node itself, so
          // online/away/busy/in-game changes are picked up live.
          const target = mutation.target;
          if (target.nodeType === 1 && target.closest && target.closest('.friend')) {
            shouldReorganize = true;
          }
        }
        if (shouldReorganize) break;
      }
      if (shouldReorganize && badgeMap) {
        clearTimeout(reorganizeTimeout);
        reorganizeTimeout = setTimeout(() => {
          originalOrderSaved = false;
          originalFriendOrder = [];
          reorganizeFriends(badgeMap);
        }, 250);
      }
    });
    observer.observe(friendContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function initializeFriendList() {
    const friendContainer = document.querySelector('.friends .list');
    if (!friendContainer) return;
    originalOrderSaved = false;
    originalFriendOrder = [];
    changeAddFriendText();
    createToggles();
    const friends = friendContainer.querySelectorAll('.friend');
    if (friends.length > 0 && badgeMap) {
      saveOriginalOrder(friends);
      reorganizeFriends(badgeMap);
    }
    setupObserver();
    setTimeout(() => {
      applyStreamerMode();
      applyBetterIcons();
      applyLockUnfriend();
    }, 100);
  }

  // Single entry point used by both the polling loop and the body-level
  // watcher. Reinitializes whenever the `.friends .list` DOM node is a
  // different node than last time (covers SPA route changes and Vue
  // re-renders that swap the container out from under us), and otherwise
  // just makes sure the toggles/observer are still attached.
  function ensureInitialized() {
    const listEl = document.querySelector('.friends .list');
    if (!listEl) return;

    if (listEl !== currentListEl) {
      currentListEl = listEl;
      initializeFriendList();
      return;
    }

    if (!document.querySelector('.toggle-container')) {
      createToggles();
    }
    if (!observer) {
      setupObserver();
    }
    if (badgeMap && listEl.querySelectorAll('.friend').length > 0 && !listEl.querySelector('.role-divider') && showRoleDividers) {
      reorganizeFriends(badgeMap);
    }
  }

  function waitForFriendList() {
    if (document.querySelector('.friends .list')) {
      ensureInitialized();
      return;
    }
    const checkInterval = setInterval(() => {
      if (document.querySelector('.friends .list')) {
        clearInterval(checkInterval);
        ensureInitialized();
      }
    }, 100);
    setTimeout(() => clearInterval(checkInterval), 10000);
  }

  function setupFriendListWatcher() {
    if (friendListObserver) friendListObserver.disconnect();
    friendListObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          const found =
            (node.classList && node.classList.contains('friends') && node.querySelector('.list')) ||
            (node.querySelector && node.querySelector('.friends .list'));
          if (found) {
            setTimeout(() => waitForFriendList(), 100);
            return;
          }
        }
      }
    });
    friendListObserver.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    loadSettings();
    if (!badgeMap) {
      badgeMapFetchInFlight = true;
      badgeMap = await getBadgeMap();
      badgeMapFetchInFlight = false;
      if (!badgeMap) {
        scheduleBadgeMapRetry();
      }
    }

    setupFriendListWatcher();
    waitForFriendList();

    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(() => waitForFriendList(), 500);
      }
    });
    urlObserver.observe(document, { subtree: true, childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
};

// Export for use in main file
module.exports = { friendListAddon };