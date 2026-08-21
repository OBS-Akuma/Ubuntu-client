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

  function getPlayerScore() {
    // Try HUD first
    const keyElement = document.querySelector('.key[style*="color: rgb(255, 185, 20);"]');
    if (keyElement) {
      const playerContainer = keyElement.closest('.player-cont');
      if (playerContainer) {
        const scoreElements = playerContainer.querySelectorAll('.player-value');
        if (scoreElements.length >= 3) {
          return scoreElements[2].textContent.trim();
        }
      }
    }

    // Try team info
    const teamInfo = document.querySelector('.tab-team-info');
    if (teamInfo) {
      const playerContainers = teamInfo.querySelectorAll('.player-cont');
      for (const container of playerContainers) {
        const keyElement = container.querySelector('.key');
        if (keyElement) {
          const style = keyElement.getAttribute('style') || '';
          if (style.includes('color: rgb(255, 185, 20)') || 
              style.includes('color: #ffb914')) {
            const scoreElements = container.querySelectorAll('.player-value');
            if (scoreElements.length >= 3) {
              return scoreElements[2].textContent.trim();
            }
          }
        }
        const nickname = container.querySelector('.nickname');
        if (nickname && nickname.classList.contains('bolder')) {
          const scoreElements = container.querySelectorAll('.player-value');
          if (scoreElements.length >= 3) {
            return scoreElements[2].textContent.trim();
          }
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