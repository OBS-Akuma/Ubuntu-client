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
    scoreDiv.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="16" height="16" style="display:inline-block;vertical-align:middle;margin-right:4px;">
        <polygon points="50,5 61,38 95,38 67,58 78,92 50,72 22,92 33,58 5,38 39,38" fill="#f3ba00ff"/>
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