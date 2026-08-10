/**
 * Adds a Notifications tab to the friends panel that displays
 * a log of alerts and notifications.
 * 
 * - Adds "NOTIFICATIONS" tab next to friends tabs
 * - Stores notifications in localStorage
 * - Shows timestamps (now, Xm ago, Xh ago, date)
 * - Delete individual notifications
 * - Empty state when no notifications
 * - Persists through DOM changes with observer
 */
const notificationsAddon = () => {
  'use strict';

  const STORAGE_KEY = 'alertLog';

  function addNotificationsTab() {
    const friendsContainer = document.querySelector('[data-v-27bb6a1a][data-v-a5e75d1c].friends');
    if (!friendsContainer) return;
    if (friendsContainer.querySelector('.tab-notifications')) return;

    const tabsContainer = friendsContainer.querySelector('.tabs.text-2');
    if (!tabsContainer) return;

    const leftTabs = tabsContainer.querySelector('.left');
    if (!leftTabs) return;

    const requestTab = leftTabs.querySelector('.tab:last-child');
    const nativeTabs = Array.from(leftTabs.querySelectorAll('.tab'));

    // Our tab — attrs cloned once, real tabs never touched/replaced
    const notifTab = document.createElement('div');
    if (requestTab) {
      for (let attr of requestTab.attributes) {
        notifTab.setAttribute(attr.name, attr.value);
      }
      notifTab.className = requestTab.className;
    } else {
      notifTab.setAttribute('data-v-27bb6a1a', '');
    }
    notifTab.textContent = ' NOTIFICATIONS ';
    notifTab.classList.add('tab-notifications');
    notifTab.classList.remove('active-tab');
    leftTabs.appendChild(notifTab);

    function getCurrentAllo() {
      return friendsContainer.querySelector('.allo');
    }

    // Plain, self-contained pane — NOT copying .allo's class/attrs,
    // since .allo uses absolute positioning tied to Vue's own
    // show/hide logic. Inheriting that class without Vue managing
    // it is what caused the "stuck at top" bug. Instead we just
    // give it static styles that sit in normal flow.
    const notifPane = document.createElement('div');
    notifPane.id = 'notifications-pane';
    notifPane.style.cssText = 'display:none;position:relative;width:100%;flex:1;overflow-y:auto;padding:0.5rem;box-sizing:border-box;';
    tabsContainer.insertAdjacentElement('afterend', notifPane);

    const listWrapper = document.createElement('div');
    listWrapper.className = 'list';
    notifPane.appendChild(listWrapper);

    notifTab.addEventListener('click', (e) => {
      e.stopPropagation();
      nativeTabs.forEach(t => t.classList.remove('active-tab'));
      notifTab.classList.add('active-tab');

      const allo = getCurrentAllo();
      if (allo) allo.style.display = 'none';
      notifPane.style.display = '';
      renderNotifications(listWrapper);
    });

    nativeTabs.forEach(t => {
      t.addEventListener('click', () => {
        notifTab.classList.remove('active-tab');
        notifPane.style.display = 'none';
        setTimeout(() => {
          const allo = getCurrentAllo();
          if (allo) allo.style.display = '';
        }, 0);
      });
    });
  }

  // ============================================
  // NOTIFICATION ENTRY BUILDING
  // ============================================

  function loadLog() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLog(log) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch (e) {
      // Silent fail
    }
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const diffMin = Math.floor((Date.now() - d) / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString();
  }

  function textFor(entry) {
    if (entry.text) return entry.text;
    if (typeof entry.data === 'string') return entry.data;
    if (entry.data) return JSON.stringify(entry.data);
    return '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function createNotificationEntry(entry, listWrapper, index) {
    const friendDiv = document.createElement('div');
    friendDiv.setAttribute('data-v-97c118c6', '');
    friendDiv.className = 'friend is-online v-enter-to';

    const text = textFor(entry);
    const timeAgo = formatTime(entry.timestamp);

    friendDiv.innerHTML = `
      <div data-v-97c118c6="" class="friend-left">
        <div data-v-97c118c6="" class="level-cont">
          <span data-v-97c118c6="" class="level-amount">${index}</span>
          <div data-v-97c118c6="" class="level-label">new</div>
        </div>
        <div data-v-97c118c6="" class="friend-desc">
          <div data-v-97c118c6="" class="nickname">
            ${escapeHtml(text)}
            <!---->
          </div>
        </div>
      </div>
      <div data-v-97c118c6="" class="friend-right">
        <div data-v-97c118c6="" class="online">
          <span data-v-97c118c6="" class="online-dot dot-online" style="background: none;">●</span>
          <span class="in-game-text">${escapeHtml(timeAgo)}</span>
        </div>
        <div data-v-97c118c6="" class="add-delete">
          <div data-v-97c118c6="" class="delete" style="cursor: pointer;">
            <svg data-v-2b44d870="" data-v-97c118c6="" xmlns="http://www.w3.org/2000/svg" class="close-icon svg-icon svg-icon--__close__">
              <!---->
              <use data-v-2b44d870="" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="/img/icons.3f174ec9.svg#__close__"></use>
            </svg>
          </div>
        </div>
      </div>
    `;

    const deleteBtn = friendDiv.querySelector('.delete');
    deleteBtn.addEventListener('click', function (e) {
      e.stopPropagation();

      const remaining = loadLog().filter(it => it.timestamp !== entry.timestamp);
      saveLog(remaining);

      friendDiv.style.cssText = 'transition: all 0.3s ease; opacity: 0; transform: scale(0.9);';

      setTimeout(() => {
        friendDiv.remove();
        const remainingEls = listWrapper.querySelectorAll('.friend');
        if (remainingEls.length === 0) {
          showEmptyState(listWrapper);
        }
      }, 300);
    });

    return friendDiv;
  }

  function showEmptyState(listWrapper) {
    listWrapper.innerHTML = `
      <div data-v-97c118c6="" class="friend" style="padding: 20px; text-align: center; color: #8a8fa8;">
        <div data-v-97c118c6="" class="friend-left" style="width: 100%; justify-content: center;">
          <div data-v-97c118c6="" class="friend-desc" style="width: 100%; text-align: center;">
            <div data-v-97c118c6="" class="nickname" style="font-size: 16px;">No notifications yet</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderNotifications(listWrapper) {
    const log = loadLog().slice().reverse();

    if (log.length === 0) {
      showEmptyState(listWrapper);
      return;
    }

    listWrapper.innerHTML = '';
    log.forEach((entry, i) => {
      const entryEl = createNotificationEntry(entry, listWrapper, i + 1);
      listWrapper.appendChild(entryEl);
    });
  }

  // ============================================
  // EXECUTION / PERSISTENCE
  // ============================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addNotificationsTab);
  } else {
    addNotificationsTab();
  }

  let lastUrl = location.href;
  let reAddScheduled = false;

  function scheduleReAdd(delay) {
    if (reAddScheduled) return;
    reAddScheduled = true;
    setTimeout(() => {
      reAddScheduled = false;
      const friendsContainer = document.querySelector('[data-v-27bb6a1a][data-v-a5e75d1c].friends');
      if (friendsContainer && !friendsContainer.querySelector('.tab-notifications')) {
        addNotificationsTab();
      }
    }, delay);
  }

  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleReAdd(500);
    } else {
      scheduleReAdd(150);
    }
  });

  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: false
  });

  window.addEventListener('alertLogUpdated', () => {
    const notifPane = document.getElementById('notifications-pane');
    if (!notifPane) return;
    const listWrapper = notifPane.querySelector('.list');
    if (listWrapper && notifPane.style.display !== 'none') {
      renderNotifications(listWrapper);
    }
  });
};

// Export for use in main file
module.exports = { notificationsAddon };