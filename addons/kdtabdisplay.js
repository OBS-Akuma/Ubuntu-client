/**
 * Adds a KD (kills/deaths) column to the "Players" tab-info list,
 * positioned before kills, and keeps it live-updated.
 */
const kdDisplayAddon = () => {
  'use strict';

  const HEADER_SELECTOR = '.tab-info .players-wrap > .list';
  const PLAYER_LIST_SELECTOR = '.tab-info .players-wrap > .player-list';
  const PLAYER_ROW_SELECTOR = '.player-cont';

  function zeroSpacing(el) {
    if (!el) return;
    el.style.gap = '0';
    el.style.columnGap = '0';
    el.style.rowGap = '0';
    el.style.margin = '0';
    el.style.padding = '0';
  }

  function ensureHeaderKD() {
    const headerRow = document.querySelector(HEADER_SELECTOR);
    if (!headerRow) return;

    zeroSpacing(headerRow);

    const values = headerRow.querySelectorAll('.list-value');
    values.forEach(zeroSpacing);

    if (headerRow.querySelector('.kd-header-value')) {
      const existing = headerRow.querySelector('.kd-header-value');
      existing.style.marginRight = '16px';
      existing.style.transform = 'translateX(-8px)';
      return;
    }
    if (values.length < 1) return;

    values[0].style.order = '2';
    if (values[1]) values[1].style.order = '3';
    if (values[2]) values[2].style.order = '4';

    const kdHeader = document.createElement('div');
    kdHeader.className = 'list-value kd-header-value';
    kdHeader.textContent = 'kd';
    kdHeader.style.order = '1';
    zeroSpacing(kdHeader);
    kdHeader.style.marginRight = '16px';
    kdHeader.style.transform = 'translateX(-8px)';

    values[0].insertAdjacentElement('beforebegin', kdHeader);
  }

  function parseNumber(text) {
    const n = parseFloat((text || '').trim());
    return isNaN(n) ? 0 : n;
  }

  function computeKD(kills, deaths) {
    if (deaths === 0) {
      return kills > 0 ? kills.toFixed(2) : '0.00';
    }
    return (kills / deaths).toFixed(2);
  }

  function updatePlayerRow(playerCont) {
    const rightSide = playerCont.querySelector('.player-right');
    if (!rightSide) return;

    zeroSpacing(rightSide);

    const values = rightSide.querySelectorAll('.player-value:not(.kd-player-value)');
    values.forEach(zeroSpacing);

    if (values.length < 2) return;

    const kills = parseNumber(values[0].textContent);
    const deaths = parseNumber(values[1].textContent);
    const kd = computeKD(kills, deaths);

    values[0].style.order = '2';
    if (values[1]) values[1].style.order = '3';
    if (values[2]) values[2].style.order = '4';

    let kdElement = rightSide.querySelector('.kd-player-value');
    if (!kdElement) {
      kdElement = document.createElement('div');
      kdElement.className = 'player-value kd-player-value';
      kdElement.style.order = '1';
      values[0].insertAdjacentElement('beforebegin', kdElement);
    }
    zeroSpacing(kdElement);
    kdElement.style.marginRight = '16px';
    kdElement.style.transform = 'translateX(20px)';

    if (kdElement.textContent !== kd) {
      kdElement.textContent = kd;
    }
  }

  function updateAllRows() {
    const playerList = document.querySelector(PLAYER_LIST_SELECTOR);
    if (!playerList) return;

    ensureHeaderKD();

    const rows = playerList.querySelectorAll(PLAYER_ROW_SELECTOR);
    rows.forEach(updatePlayerRow);
  }

  // Initial setup
  updateAllRows();
  setTimeout(updateAllRows, 100);
  setTimeout(updateAllRows, 500);

  // Watch for changes
  const observer = new MutationObserver(() => {
    updateAllRows();
  });

  observer.observe(document, {
    subtree: true,
    childList: true,
    characterData: true
  });

  // Periodic updates
  setInterval(updateAllRows, 500);
};

module.exports = { kdDisplayAddon };