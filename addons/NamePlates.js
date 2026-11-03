/**
 * Applies Discord-based nameplates (colors, gradients, videos, outlines)
 * to friend rows in the friends list.
 *
 * - Loads Kirka ID -> Discord ID mapping from badge.json
 * - Looks up nameplate data for visible friends via the Smudgy API
 * - Uses Discord profile colors when no nameplate exists
 * - Supports video nameplates with static image fallback
 * - Updates when the friends list changes
 */
const nameplatesAddon = () => {
  'use strict';

  if (window.__nameplates) window.__nameplates.stop();

  // ===== CONFIG =====
  const CONFIG = {
    api: 'https://www.smudgy.store/api/nameplate',
    badgesUrl: 'https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json',

    generatedFallback: false, // false = default accounts get NO style. true = generated colors for them
    mode: 'auto',             // only used when generatedFallback is true
    useProfileColors: true,   // use Discord profile colors when there's no nameplate
    alpha: 0.5,
    accentAlpha: 0.85,
    videoAccent: 'rgba(0,0,0,0.45)',

    outline: true,            // outline the card in the friend's color
    outlineWidth: 2,          // px
    outlineGlow: true,        // soft glow around the outline
    videoOutline: 'rgba(255,255,255,0.7)', // outline for video nameplates with no profile colors

    cacheMs: 60 * 60 * 1000,
    retryMs: 60 * 1000,

    rowSelector: '.friend',
    idSelector: '.friend-id',

    // Manual per-friend overrides: { bg, accent, video, outline }
    custom: {},
  };

  // ===== HELPERS =====
  const hash = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const hsla = (h, s, l, a) => `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;
  const hexa = (hex, a) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    return m ? '#' + m[1] + Math.round(a * 255).toString(16).padStart(2, '0') : null;
  };
  const TYPES = ['solid', 'gradient', 'fade', 'fadeReverse', 'fadeBoth'];
  const norm = (s) => String(s || '').trim().toUpperCase();

  // ===== STATE =====
  const badgeMap = {};            // SHORTID -> discordId
  const CACHE_KEY = '__np_discord_cache_v2';
  const readCache = () => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; }
  };
  const writeCache = () => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
  };
  let cache = readCache();        // discordId -> { t, v }
  const retryAt = {};
  const inflight = new Set();

  const discordOf = (kirkaId) => badgeMap[norm(kirkaId)] || null;
  const nameplateOf = (kirkaId) => {
    const did = discordOf(kirkaId);
    return did && cache[did] ? cache[did].v : null;
  };

  // Returns null when the friend should get no style
  const build = (id) => {
    const o = CONFIG.custom[id] || {};
    const r = nameplateOf(id) || {};
    const video = o.video || r.video || null;
    const image = o.video ? null : r.image || null;
    const hasColors = CONFIG.useProfileColors && r.colors && (r.colors.banner || r.colors.accent);

    if (!video && !hasColors && !o.bg && !CONFIG.generatedFallback) return null;

    const n = hash(id);
    const hue = n % 360;
    const hue2 = hue + 40 + (n >> 8) % 120;
    const hue3 = hue2 + 40 + (n >> 16) % 80;
    const a = CONFIG.alpha;
    const type = CONFIG.mode === 'auto' ? TYPES[(n >> 4) % TYPES.length] : CONFIG.mode;

    const c1 = hsla(hue, 80, 50, a);
    const c2 = hsla(hue2, 80, 55, a);
    const c3 = hsla(hue3, 80, 55, a);
    const clear = hsla(hue, 80, 50, 0);

    let bg;
    switch (type) {
      case 'gradient':    bg = `linear-gradient(90deg, ${c1}, ${c2}, ${c3})`; break;
      case 'fade':        bg = `linear-gradient(90deg, ${c1}, ${clear})`; break;
      case 'fadeReverse': bg = `linear-gradient(90deg, ${clear}, ${c1})`; break;
      case 'fadeBoth':    bg = `linear-gradient(90deg, ${clear}, ${c1}, ${clear})`; break;
      default:            bg = c1;
    }
    let accent = hsla(hue, 80, 45, CONFIG.accentAlpha);
    let outline = hsla(hue, 80, 55, 1);

    if (hasColors) {
      const main = r.colors.banner || r.colors.accent;
      const second = r.colors.banner && r.colors.accent && r.colors.banner !== r.colors.accent
        ? r.colors.accent : null;
      const c = hexa(main, a);
      if (c) {
        if (!video && !o.bg) {
          bg = second
            ? `linear-gradient(90deg, ${c}, ${hexa(second, a)})`
            : `linear-gradient(90deg, ${c}, ${hexa(main, 0)})`;
          accent = hexa(r.colors.accent || main, CONFIG.accentAlpha) || accent;
        }
        outline = hexa(main, 1);
      }
    } else if (video) {
      outline = CONFIG.videoOutline;
    }

    if (video) accent = CONFIG.videoAccent;
    if (o.accent) accent = o.accent;
    if (o.outline) outline = o.outline;
    else if (o.bg && o.accent && !hasColors && !video) outline = o.accent;
    return { bg: o.bg || bg, accent, outline, video, image };
  };

  // ===== STYLE =====
  const R = CONFIG.rowSelector;
  const style = document.createElement('style');
  style.id = '__nameplate_style';
  style.textContent = `
    ${R}[data-np] {
      background: var(--np-bg) !important;
      border-radius: 6px;
      position: relative;
    }
    ${R}[data-np]::after {
      content: '';
      position: absolute;
      inset: 0;
      border: var(--np-ow, 2px) solid var(--np-outline, transparent);
      border-radius: inherit;
      box-shadow: var(--np-glow, none);
      pointer-events: none;
      z-index: 2;
    }
    ${R}[data-np] .friend-left,
    ${R}[data-np] .friend-right,
    ${R}[data-np] .friend-desc,
    ${R}[data-np] .add-delete {
      background: transparent !important;
    }
    ${R}[data-np] .level-cont,
    ${R}[data-np] .invite-btn,
    ${R}[data-np] .add,
    ${R}[data-np] .delete {
      background: var(--np-accent) !important;
      border-color: transparent !important;
      color: #fff !important;
      border-radius: 6px;
    }
    ${R}[data-np] .delete svg,
    ${R}[data-np] .delete use {
      fill: #fff !important;
      color: #fff !important;
    }
    ${R}[data-np] .add.is-disabled { opacity: .45; }
    ${R}[data-np] .nickname,
    ${R}[data-np] .friend-id,
    ${R}[data-np] .level-cont,
    ${R}[data-np] .online {
      text-shadow: 0 1px 3px rgba(0,0,0,.8);
    }

    /* Video nameplates */
    ${R}[data-np-video] {
      overflow: hidden !important;
      background: #000 !important;
    }
    ${R}[data-np-video] > :not(.np-video) {
      position: relative;
      z-index: 1;
    }
    ${R} > .np-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
      pointer-events: none;
    }
    /* Static fallback if the video can't load */
    ${R}[data-np-img] {
      background: var(--np-img) center / cover no-repeat !important;
    }
  `;
  document.head.appendChild(style);

  // ===== VIDEO =====
  const setVideo = (row, src, image) => {
    let v = row.querySelector(':scope > .np-video');

    if (!src) {
      if (v) v.remove();
      row.removeAttribute('data-np-video');
      row.removeAttribute('data-np-img');
      row.style.removeProperty('--np-img');
      return;
    }
    if (v && v.dataset.src === src) return;
    if (row.getAttribute('data-np-img') === src) return;
    if (v) v.remove();

    v = document.createElement('video');
    v.className = 'np-video';
    v.dataset.src = src;
    v.src = src;
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.addEventListener('error', () => {
      console.warn('[nameplates] video failed:', src, v.error);
      v.remove();
      row.removeAttribute('data-np-video');
      if (image) {
        row.style.setProperty('--np-img', `url("${image}")`);
        row.setAttribute('data-np-img', src);
      }
    });
    row.prepend(v);
    row.setAttribute('data-np-video', '');
    row.removeAttribute('data-np-img');
    v.play().catch(() => {});
  };

  // ===== APPLY =====
  const clearRow = (row) => {
    if (!row.hasAttribute('data-np')) return;
    const v = row.querySelector(':scope > .np-video');
    if (v) v.remove();
    row.removeAttribute('data-np');
    row.removeAttribute('data-np-video');
    row.removeAttribute('data-np-img');
    ['--np-bg', '--np-accent', '--np-outline', '--np-ow', '--np-glow', '--np-img']
      .forEach((p) => row.style.removeProperty(p));
  };

  const setVar = (row, k, val) => {
    if (row.style.getPropertyValue(k) !== val) row.style.setProperty(k, val);
  };

  const apply = () => {
    document.querySelectorAll(R).forEach((row) => {
      const idEl = row.querySelector(CONFIG.idSelector);
      if (!idEl) return;
      const id = idEl.textContent.trim();
      if (!id) return;

      const s = build(id);
      if (!s) { clearRow(row); return; }

      setVar(row, '--np-bg', s.bg);
      setVar(row, '--np-accent', s.accent);
      setVar(row, '--np-outline', s.outline);
      setVar(row, '--np-ow', CONFIG.outline ? CONFIG.outlineWidth + 'px' : '0px');
      setVar(row, '--np-glow', CONFIG.outline && CONFIG.outlineGlow ? `0 0 8px ${s.outline}` : 'none');
      if (!row.hasAttribute('data-np')) row.setAttribute('data-np', '');
      setVideo(row, s.video, s.image);
    });
  };

  // ===== BADGE.JSON (Kirka ID -> Discord ID) =====
  const loadBadgeMap = async () => {
    try {
      const res = await fetch(CONFIG.badgesUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const list = Array.isArray(json) ? json
        : Array.isArray(json.data) ? json.data
        : Object.values(json);

      for (const k of Object.keys(badgeMap)) delete badgeMap[k];
      for (const entry of list) {
        if (entry && entry.shortId && entry.discord) {
          badgeMap[norm(entry.shortId)] = String(entry.discord);
        }
      }
      console.log(`[nameplates] loaded ${Object.keys(badgeMap).length} Discord links from badge.json`);
    } catch (err) {
      console.warn('[nameplates] badge.json failed:', err);
    }
  };

  // ===== DISCORD LOOKUP (only for friends currently shown) =====
  const lookupVisible = async () => {
    const now = Date.now();
    const need = new Set();

    document.querySelectorAll(R).forEach((row) => {
      const idEl = row.querySelector(CONFIG.idSelector);
      const id = idEl && idEl.textContent.trim();
      const did = id && discordOf(id);
      if (!did || inflight.has(did)) return;
      if (retryAt[did] && now < retryAt[did]) return;
      const hit = cache[did];
      if (hit && now - hit.t < CONFIG.cacheMs) return;
      need.add(did);
    });

    if (!need.size) return;
    const ids = [...need];
    ids.forEach((d) => inflight.add(d));

    for (let i = 0; i < ids.length; i += 20) {
      const chunk = ids.slice(i, i + 20);
      try {
        const res = await fetch(`${CONFIG.api}?ids=${chunk.join(',')}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        for (const did of chunk) {
          const r = data[did];
          if (r && r.error) {
            console.warn('[nameplates] lookup error for', did, r.error);
            retryAt[did] = Date.now() + CONFIG.retryMs;
          } else {
            cache[did] = { t: Date.now(), v: r || null };
          }
        }
      } catch (err) {
        console.warn('[nameplates] lookup failed:', err);
        chunk.forEach((did) => { retryAt[did] = Date.now() + CONFIG.retryMs; });
      }
    }

    ids.forEach((d) => inflight.delete(d));
    writeCache();
    apply();
  };

  // ===== OBSERVER =====
  const tick = () => { apply(); lookupVisible(); };

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; tick(); });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = setInterval(tick, 1500);

  apply();
  loadBadgeMap().then(() => { cache = {}; writeCache(); tick(); });

  // ===== CONTROLS =====
  window.__nameplates = {
    config: CONFIG,
    refresh: tick,
    async reload() {
      cache = {};
      Object.keys(retryAt).forEach((k) => delete retryAt[k]);
      writeCache();
      await loadBadgeMap();
      tick();
    },
    setMode(m) { CONFIG.mode = m; apply(); },
    generatedFallback(on) { CONFIG.generatedFallback = !!on; apply(); },
    useProfileColors(on) { CONFIG.useProfileColors = !!on; apply(); },
    outline(on, width) {
      CONFIG.outline = !!on;
      if (width) CONFIG.outlineWidth = width;
      apply();
    },
    glow(on) { CONFIG.outlineGlow = !!on; apply(); },
    set(id, bg, accent, outline) {
      CONFIG.custom[id] = { ...CONFIG.custom[id], bg, accent, ...(outline ? { outline } : {}) };
      apply();
    },
    setVideo(id, url, accent) {
      CONFIG.custom[id] = { ...CONFIG.custom[id], video: url, ...(accent ? { accent } : {}) };
      apply();
    },
    link(kirkaId, discordId) {
      // No base links; store manual links on the fly so .link() still works
      badgeMap[norm(kirkaId)] = String(discordId);
      tick();
    },
    stop() {
      observer.disconnect();
      clearInterval(timer);
      style.remove();
      document.querySelectorAll(R).forEach(clearRow);
      delete window.__nameplates;
    },
  };

  console.log('Nameplates active. __nameplates.outline(false), .glow(false), .reload(), .link(kirkaId, discordId), .stop()');
};

// Export for use in main file
module.exports = { nameplatesAddon };
