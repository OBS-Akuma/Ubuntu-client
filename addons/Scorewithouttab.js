/**
 * Displays the player's score next to kills/deaths in the HUD and team info.
 */
const scoreDisplayAddon = () => {
  'use strict';

  function createScoreElement() {
    const scoreDiv = document.createElement('div');
    scoreDiv.setAttribute('data-v-505b899c', '');
    scoreDiv.className = 'score bg text-1';
    scoreDiv.id = 'scoreelement';
    // display:inline-flex + align-items keeps the icon and number on one
    // baseline-aligned line without relying on the parent's own flex
    // context, which is what was squeezing the icon before.
    scoreDiv.style.display = 'inline-flex';
    scoreDiv.style.alignItems = 'center';
    scoreDiv.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16" style="display:inline-block;flex:0 0 16px;width:16px;height:16px;margin-right:4px;">
        <path d="M12.44 9.74a.825.825 0 0 0-.24.727l.667 3.69a.81.81 0 0 1-.338.81.826.826 0 0 1-.877.06L8.33 13.296a.847.847 0 0 0-.375-.098h-.203a.609.609 0 0 0-.203.067l-3.322 1.741c-.165.082-.35.112-.533.082a.834.834 0 0 1-.667-.953l.667-3.69a.84.84 0 0 0-.24-.734L.748 7.085a.81.81 0 0 1-.202-.848.842.842 0 0 1 .667-.562l3.727-.54a.834.834 0 0 0 .66-.457L7.242 1.31a.78.78 0 0 1 .15-.203l.067-.052a.503.503 0 0 1 .12-.097l.083-.03.127-.053h.316c.282.03.53.198.66.45l1.664 3.353c.12.245.353.415.623.456l3.727.541a.85.85 0 0 1 .683.563c.098.3.013.63-.218.847L12.44 9.74z" fill="#FFB914"/>
      </svg>
      <span id="scorevalue">0</span>
    `;
    return scoreDiv;
  }

  function injectScoreElement() {
    const killDeathContainer = document.querySelector('.kill-death');
    if (killDeathContainer && !document.getElementById('scoreelement')) {
      killDeathContainer.appendChild(createScoreElement());
    }
  }

  // Exclude any KD column another addon may have inserted into the same
  // row, so index-based lookups here stay locked to kills/deaths/score.
  const PLAYER_VALUE_SELECTOR = '.player-value:not(.kd-player-value)';

  // The gold/silver/bronze key color is a RANK indicator (1st/2nd/3rd
  // place), not a "this is you" indicator — don't use it as the primary
  // self-detection signal. .nickname.bolder is the reliable marker.
  function isSelfContainer(container) {
    const nickname = container.querySelector('.nickname');
    if (nickname && nickname.classList.contains('bolder')) {
      return true;
    }
    return false;
  }

  function getScoreFromContainer(container) {
    const scoreElements = container.querySelectorAll(PLAYER_VALUE_SELECTOR);
    if (scoreElements.length >= 3) {
      return scoreElements[2].textContent.trim();
    }
    return null;
  }

  function getPlayerScore() {
    // Try HUD first
    const hudPlayerConts = document.querySelectorAll('.player-cont');
    for (const container of hudPlayerConts) {
      if (isSelfContainer(container)) {
        const score = getScoreFromContainer(container);
        if (score !== null) return score;
      }
    }

    // Try team info specifically (in case selector scope differs there)
    const teamInfo = document.querySelector('.tab-team-info');
    if (teamInfo) {
      const playerContainers = teamInfo.querySelectorAll('.player-cont');
      for (const container of playerContainers) {
        if (isSelfContainer(container)) {
          const score = getScoreFromContainer(container);
          if (score !== null) return score;
        }
      }
    }

    return null;
  }

  function updateScore() {
    const score = getPlayerScore();
    if (score !== null) {
      const scoreValueSpan = document.getElementById('scorevalue');
      if (scoreValueSpan && scoreValueSpan.textContent !== score) {
        scoreValueSpan.textContent = score;
      }
    }
  }

  // Initial setup
  injectScoreElement();
  setTimeout(updateScore, 100);
  setTimeout(updateScore, 500);

  // Watch for changes
  const observer = new MutationObserver(() => {
    injectScoreElement();
    updateScore();
  });

  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  // Periodic updates
  setInterval(updateScore, 500);
};

module.exports = { scoreDisplayAddon };