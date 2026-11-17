/**
 * Restyles the social cards in the game to show Hydrogen client branding
 * and replaces Reddit with Discord invite.
 * 
 * - Changes "CLIENT" card to Hydrogen with gradient styling
 * - Replaces Reddit card with Discord invite
 * - Adds continuous slow spinning Hydrogen icon (only on Hydrogen card)
 */
const socialCardsAddon = () => {
  const { shell } = require('electron');

  const HYDROGEN_ICON_URL = 'https://raw.githubusercontent.com/OBS-Akuma/Ubuntu-client/refs/heads/main/assets/HYD.png';
  const HYDROGEN_URL = 'https://www.yxzoi.xyz/Hydrogen';
  const DISCORD_INVITE = 'https://discord.gg/PM9zNcZYPe';
  const ICON_SIZE = 48; // px

  // Continuous spin stylesheet for Hydrogen card only, injected once
  if (!document.getElementById('hydrogen-icon-spin-style')) {
    const style = document.createElement('style');
    style.id = 'hydrogen-icon-spin-style';
    style.textContent = `
      @keyframes slowSpin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
      .hydrogen-card .soc-icon {
        animation: slowSpin 8s linear infinite !important;
        display: inline-block !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Track if cards are already set up
  let hydrogenCardSetup = false;
  let discordCardSetup = false;

  // ---- Hydrogen client card ----
  const setupHydrogenCard = () => {
    const card = [...document.querySelectorAll('.soc-group')].find(el =>
      el.textContent.includes('CLIENT') || el.textContent.includes('Hydrogen')
    );
    if (!card) return;

    // Check if this card is already set up
    if (card.dataset.hydrogenSetup === 'true') {
      return;
    }

    // Mark as set up
    card.dataset.hydrogenSetup = 'true';
    hydrogenCardSetup = true;

    card.classList.add('hydrogen-card', 'restyled-soc-card');
    card.style.setProperty('background', 'linear-gradient(135deg, #0D4728 0%, #1A8E50 50%, #23BF6C 100%)', 'important');
    card.style.setProperty('box-shadow', '0 4px 15px rgba(26, 142, 80, 0.3)', 'important');
    card.style.setProperty('transition', 'all 0.3s ease', 'important');
    card.style.setProperty('border-color', '#0D4728', 'important');
    card.style.cursor = 'pointer';

    const nameDiv = card.querySelector('.discord-name');
    if (nameDiv) nameDiv.innerText = 'Hydrogen';

    const svg = card.querySelector('.soc-icon');
    if (svg && !svg.dataset.replaced) {
      const replacement = document.createElement('img');
      replacement.src = HYDROGEN_ICON_URL;
      replacement.className = 'soc-icon';
      if (svg.className) {
        const extraClasses = svg.className.baseVal ? svg.className.baseVal.split(' ') : [];
        extraClasses.forEach(cls => {
          if (cls && cls !== 'soc-icon') {
            replacement.classList.add(cls);
          }
        });
      }
      replacement.style.width = `${ICON_SIZE}px`;
      replacement.style.height = `${ICON_SIZE}px`;
      replacement.style.display = 'inline-block';
      replacement.style.objectFit = 'contain';
      replacement.dataset.replaced = 'true';
      svg.replaceWith(replacement);
    }

    // Remove any existing corner icons
    card.querySelectorAll('.corner-icon').forEach(el => el.remove());

    // Only set onclick once
    if (!card._onclickSet) {
      card._onclickSet = true;
      card.onclick = () => shell.openExternal(HYDROGEN_URL);
    }
  };

  // ---- Reddit -> Discord card (no spin) ----
  const setupDiscordCard = () => {
    const card = [...document.querySelectorAll('.card-cont.soc-group.orange')].find(el =>
      el.querySelector('.svg-icon--__reddit__') || el.querySelector('.svg-icon--__discord__')
    );
    if (!card) return;

    // Check if this card is already set up
    if (card.dataset.discordSetup === 'true') {
      return;
    }

    // Mark as set up
    card.dataset.discordSetup = 'true';
    discordCardSetup = true;

    card.classList.remove('orange', 'hydrogen-card', 'restyled-soc-card');
    card.style.setProperty('background', 'linear-gradient(135deg, #0D4728 0%, #1A8E50 50%, #23BF6C 100%)', 'important');
    card.style.setProperty('box-shadow', '0 4px 15px rgba(26, 142, 80, 0.3)', 'important');
    card.style.setProperty('transition', 'all 0.3s ease', 'important');
    card.style.setProperty('border-color', '#0D4728', 'important');

    const svg = card.querySelector('.soc-icon');
    if (svg) {
      svg.style.animation = 'none';
      svg.style.transform = 'none';
      
      svg.classList.remove('svg-icon--__reddit__');
      svg.classList.add('svg-icon--__discord__');
      const use = svg.querySelector('use');
      if (use) {
        use.setAttribute('xlink:href', '/img/icons.3f174ec9.svg#__discord__');
        use.setAttribute('href', '/img/icons.3f174ec9.svg#__discord__');
      }
    }

    card.style.cursor = 'pointer';
    
    // Only set onclick once
    if (!card._onclickSet) {
      card._onclickSet = true;
      card.onclick = () => shell.openExternal(DISCORD_INVITE);
    }
  };

  const applyAll = () => {
    setupHydrogenCard();
    setupDiscordCard();
  };

  // Initial setup
  applyAll();

  // Only watch for new cards being added, but don't reapply to existing ones
  let timeoutId;
  const observer = new MutationObserver(() => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      // Only run if we haven't set up both cards yet
      if (!hydrogenCardSetup || !discordCardSetup) {
        applyAll();
      } else {
        // Just check for new cards without resetting existing ones
        const hydrogenCard = [...document.querySelectorAll('.soc-group')].find(el =>
          el.textContent.includes('CLIENT') || el.textContent.includes('Hydrogen')
        );
        if (hydrogenCard && !hydrogenCard.dataset.hydrogenSetup) {
          setupHydrogenCard();
        }
        
        const discordCard = [...document.querySelectorAll('.card-cont.soc-group.orange')].find(el =>
          el.querySelector('.svg-icon--__reddit__') || el.querySelector('.svg-icon--__discord__')
        );
        if (discordCard && !discordCard.dataset.discordSetup) {
          setupDiscordCard();
        }
      }
    }, 100);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Cleanup observer on page unload
  window.addEventListener('unload', () => {
    observer.disconnect();
  });

  console.log('[Social Cards] Hydrogen (with spinning icon) + Discord cards set up.');
};

// Export for use in main file
module.exports = { socialCardsAddon };