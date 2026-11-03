/**
 * Injects an ACCEPT FRIEND REQUEST button into the profile card for users
 * who have sent you a friend request.
 *
 * - Fetches the friend request list from Kirka API
 * - Clones the existing CLAN button so styling matches exactly
 * - Accepts the request when clicked (posts the long UUID)
 * - Refreshes periodically and updates when profiles change
 */
const acceptFriendRequestAddon = () => {
  'use strict';

  if (window.__acceptBtn) window.__acceptBtn.stop();

  // ===== CONFIG =====
  const CONFIG = {
    url: 'https://api2.kirka.io/api/WwMWm',                    // friend request list (GET)
    acceptUrl: 'https://api2.kirka.io/api/WwMWm/wWMwWnm',      // accept request (POST)
    acceptBodyKey: 'wNnWmw',                                   // body: { wNnWmw: <long id> }

    // Obfuscated keys from the response. If the game rotates them, change them here.
    listKey: 'wWnWNm',      // array of users who sent you a request
    idKey: 'WnWwwNmM',      // long ID (uuid), sent when accepting
    shortIdKey: 'wnMmwWN',  // short ID, e.g. "UYP9ZG", used to match the profile card
    nameKey: 'WwMWmn',

    // CSRF header value. Edit this if requests return 403.
    csrf: () => localStorage.csrf || localStorage.csrfToken || localStorage['csrf-token'] || '',

    refreshMs: 15000,
    label: ' ACCEPT FRIEND REQUEST ',

    // Space between ACCEPT and CLAN, in px. Use 'auto' to match the CLAN -> FRIEND gap.
    gap: 6,
    fallbackGap: 6,

    // Same four values the game's buttons use: background-color, --hover-color, --top, --bottom
    colors: {
      bg: '#16a34a',
      hover: '#22c55e',
      top: '#22c55e',
      bottom: '#166534',
    },
  };

  // ===== STATE =====
  let requests = new Map(); // SHORTID -> { id, shortId, name }
  let busy = false;

  const token = () => String(localStorage.token || '').replace(/^"|"$/g, '');
  const norm = (s) => String(s || '').replace('#', '').trim().toUpperCase();

  const authHeaders = (json) => {
    const headers = {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      authorization: `Bearer ${token()}`,
    };
    if (json) headers['content-type'] = 'application/json';
    const csrf = CONFIG.csrf();
    if (csrf) headers.csrf = csrf;
    return headers;
  };

  // ===== FETCH FRIEND REQUESTS =====
  const loadRequests = async () => {
    if (busy) return;
    busy = true;
    try {
      const res = await fetch(CONFIG.url, {
        headers: authHeaders(false),
        referrer: 'https://kirka.io/',
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const list = Array.isArray(data[CONFIG.listKey]) ? data[CONFIG.listKey] : [];

      requests = new Map();
      for (const u of list) {
        const shortId = norm(u[CONFIG.shortIdKey]);
        if (!shortId) continue;
        requests.set(shortId, {
          id: u[CONFIG.idKey],
          shortId,
          name: u[CONFIG.nameKey],
        });
      }
      console.log(`[acceptBtn] ${requests.size} friend request(s)`);
    } catch (err) {
      console.warn('[acceptBtn] fetch failed:', err);
    } finally {
      busy = false;
      inject();
    }
  };

  // ===== ACCEPT REQUEST (sends the long ID) =====
  const acceptRequest = async (user) => {
    if (!user.id) throw new Error('missing long id for ' + user.shortId);
    const res = await fetch(CONFIG.acceptUrl, {
      headers: authHeaders(true),
      referrer: 'https://kirka.io/',
      body: JSON.stringify({ [CONFIG.acceptBodyKey]: user.id }),
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    return res;
  };

  // ===== SPACING =====
  const measureGap = (clanBtn) => {
    const friendBtn = clanBtn.parentElement.querySelector('.btn-friend');
    if (!friendBtn) return 0;
    const g = friendBtn.getBoundingClientRect().left - clanBtn.getBoundingClientRect().right;
    return Number.isFinite(g) ? g : 0;
  };

  const fixSpacing = (btn, clanBtn) => {
    let gap;
    if (typeof CONFIG.gap === 'number') {
      gap = CONFIG.gap;
    } else {
      gap = measureGap(clanBtn);
      if (!(gap >= 1)) gap = CONFIG.fallbackGap;
    }
    gap = Math.round(gap * 100) / 100;
    btn.style.setProperty('margin', `0 ${gap}px 0 0`, 'important');
  };

  // ===== BUTTON (1:1 clone of the CLAN button) =====
  const makeButton = (clanBtn, user) => {
    const btn = clanBtn.cloneNode(true); // same classes, same data-v-* attributes, same children
    btn.setAttribute('data-accept-request', user.shortId);

    const c = CONFIG.colors;
    btn.setAttribute(
      'style',
      `background-color: ${c.bg}; --hover-color: ${c.hover}; --top: ${c.top}; --bottom: ${c.bottom};`
    );

    const text = btn.querySelector('.text');
    if (text) text.textContent = CONFIG.label;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.dataset.done) return;
      btn.dataset.done = '1';
      if (text) text.textContent = ' ACCEPTING... ';

      try {
        await acceptRequest(user);
        if (text) text.textContent = ' ACCEPTED ';
        console.log('[acceptBtn] accepted', user.name, user.id);
        setTimeout(loadRequests, 1000);
      } catch (err) {
        console.warn('[acceptBtn] accept failed:', err);
        delete btn.dataset.done;
        if (text) text.textContent = ' FAILED, RETRY ';
      }
    });

    return btn;
  };

  // ===== INJECT INTO PROFILE CARD =====
  const inject = () => {
    document.querySelectorAll('.profile-cont .bottom').forEach((bottom) => {
      const clanBtn = bottom.querySelector('.btn-clan:not([data-accept-request])');
      const existing = bottom.querySelector('[data-accept-request]');
      if (!clanBtn) return;

      const card = bottom.closest('.profile-cont') || document;
      const idEl = card.querySelector('.card-profile .value');
      const shortId = norm(idEl && idEl.textContent);
      const user = requests.get(shortId);

      if (!user) {
        if (existing) existing.remove();
        return;
      }
      if (existing && existing.getAttribute('data-accept-request') === shortId) return;
      if (existing) existing.remove();

      const btn = makeButton(clanBtn, user);
      bottom.insertBefore(btn, clanBtn);
      fixSpacing(btn, clanBtn);
      requestAnimationFrame(() => requestAnimationFrame(() => fixSpacing(btn, clanBtn)));
    });
  };

  // ===== OBSERVER =====
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; inject(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const timer = setInterval(loadRequests, CONFIG.refreshMs);
  loadRequests();

  // ===== CONTROLS =====
  window.__acceptBtn = {
    config: CONFIG,
    refresh: loadRequests,
    list: () => [...requests.values()],
    accept: (shortId) => {
      const u = requests.get(norm(shortId));
      return u ? acceptRequest(u) : Promise.reject(new Error('no request from ' + shortId));
    },
    setGap(px) { // number in px, or 'auto'
      CONFIG.gap = px;
      document.querySelectorAll('[data-accept-request]').forEach((b) => {
        const clan = b.parentElement.querySelector('.btn-clan:not([data-accept-request])');
        if (clan) fixSpacing(b, clan);
      });
    },
    stop() {
      observer.disconnect();
      clearInterval(timer);
      document.querySelectorAll('[data-accept-request]').forEach((el) => el.remove());
      delete window.__acceptBtn;
    },
  };

  console.log('Accept button active. __acceptBtn.list(), .accept(shortId), .refresh(), .setGap(px), .stop()');
};

// Export for use in main file
module.exports = { acceptFriendRequestAddon };
