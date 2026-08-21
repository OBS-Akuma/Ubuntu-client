/**
 * Fetches live Twitch streamers from the Kirka API and displays them
 * as news cards in the lobby interface.
 * 
 * - Fetches live streamer data from Kirka API
 * - Displays streamers as news cards with profile images
 * - Shows viewer count badge on active streamers
 * - Shows "DROPS" badge for streamers with active Kirka drops
 * - Clicking a card opens the Twitch stream
 * - Removes duplicate streamers
 * - Uses MutationObserver to persist through DOM changes
 */
const twitchNewsAddon = () => {
  let observer = null;
  let urlObserver = null;
  let isRunning = false;
  let retryCount = 0;
  const MAX_RETRIES = 5;
  let dropsChannels = [];
  let dropsEndTime = null;
  let dropsImageURL = null;
  let dropsName = null;
  let dropsDescription = null;
  let hasDropData = false;
  
  let debounceTimer = null;
  const DEBOUNCE_DELAY = 2000;
  let isFetching = false;
  let lastFetchTime = 0;
  const MIN_FETCH_INTERVAL = 5000;

  const TWITCH_FAVICON = "https://assets.twitch.tv/assets/favicon-32-e29e246c157142c94346.png";
  const MAX_STREAMERS = 3;

  async function fetchDropsData() {
    try {
      const response = await fetch("https://twitch-drops-api.sunkwi.com/drops");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      for (const drop of data) {
        const gameName = drop.gameDisplayName || "";
        if (gameName === "Kirka.io" || gameName.toLowerCase().includes("kirka")) {
          hasDropData = true;
          
          if (drop.endAt) {
            dropsEndTime = new Date(drop.endAt);
          }
          
          if (drop.name) {
            dropsName = drop.name;
          }
          
          if (drop.description) {
            dropsDescription = drop.description;
          }
          
          if (drop.rewards && Array.isArray(drop.rewards)) {
            for (const reward of drop.rewards) {
              if (reward.timeBasedDrops && Array.isArray(reward.timeBasedDrops)) {
                for (const timeDrop of reward.timeBasedDrops) {
                  if (timeDrop.benefitEdges && Array.isArray(timeDrop.benefitEdges)) {
                    for (const edge of timeDrop.benefitEdges) {
                      if (edge.benefit && edge.benefit.imageAssetURL) {
                        dropsImageURL = edge.benefit.imageAssetURL;
                        break;
                      }
                    }
                  }
                  if (dropsImageURL) break;
                }
              }
              if (!dropsImageURL && reward.imageURL) {
                dropsImageURL = reward.imageURL;
              }
              if (dropsImageURL) break;
            }
          }
          
          if (drop.rewards && Array.isArray(drop.rewards)) {
            for (const reward of drop.rewards) {
              if (reward.allow && reward.allow.isEnabled && reward.allow.channels) {
                for (const channel of reward.allow.channels) {
                  if (channel.name) {
                    dropsChannels.push(channel.name.toLowerCase());
                  }
                }
              }
            }
          }
          break;
        }
      }
      
      return { hasDropData, dropsChannels, dropsEndTime, dropsImageURL, dropsName, dropsDescription };
    } catch (error) {
      return { hasDropData: false, dropsChannels: [], dropsEndTime: null, dropsImageURL: null, dropsName: null, dropsDescription: null };
    }
  }

  function getTimeRemaining() {
    if (!dropsEndTime) return null;
    
    const now = new Date();
    const diff = dropsEndTime - now;
    
    if (diff <= 0) {
      return "Drops ended";
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m left`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    } else {
      return `${minutes}m left`;
    }
  }

  function hasDrops(streamerName) {
    if (!dropsChannels.length) return false;
    const lowerName = streamerName.toLowerCase();
    return dropsChannels.includes(lowerName);
  }

  function formatViewers(count) {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  }

  async function createNewsCards(force = false) {
    const now = Date.now();
    if (!force && now - lastFetchTime < MIN_FETCH_INTERVAL) {
      return false;
    }
    
    if (isFetching) {
      return false;
    }
    
    if (!document.querySelector("#app > .interface")) {
      return false;
    }

    const existingNews = document.querySelector(".lobby-news");
    if (existingNews) {
      existingNews.remove();
    }

    try {
      isFetching = true;
      
      const dropData = await fetchDropsData();
      
      hasDropData = dropData.hasDropData;
      dropsChannels = dropData.dropsChannels;
      dropsEndTime = dropData.dropsEndTime;
      dropsImageURL = dropData.dropsImageURL;
      dropsName = dropData.dropsName;
      dropsDescription = dropData.dropsDescription;
      
      const response = await fetch("https://api2.kirka.io/api/wnMwWWNm/wnWmMwN");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const apiData = await response.json();
      let newsData = apiData.WwMw || [];
      
      if (!newsData.length) {
        isFetching = false;
        return false;
      }
      
      const seenNames = new Set();
      const uniqueNews = [];
      
      for (const item of newsData) {
        const name = item.wNwWnWmM || item.wwMmWnW || "";
        if (name && !seenNames.has(name)) {
          seenNames.add(name);
          uniqueNews.push(item);
        }
      }
      
      let streamerCards = uniqueNews.map(item => {
        const displayName = item.wNwWnWmM || item.wwMmWnW || "Twitch Streamer";
        const twitchUrl = item.WwMwW || `https://twitch.tv/${displayName}`;
        const profileImage = item.wnNWmwMW || "";
        const viewerCount = item.wNwWmnW || 0;
        
        const hasActiveDrops = hasDrops(displayName);
        
        return {
          title: displayName,
          content: `${formatViewers(viewerCount)} viewers`,
          img: profileImage,
          imgType: "icon",
          link: twitchUrl,
          category: "event",
          live: true,
          liveText: "LIVE",
          hasDrops: hasActiveDrops,
          viewerCount: viewerCount,
          twitchIcon: TWITCH_FAVICON,
          updatedAt: Date.now()
        };
      });

      streamerCards.sort((a, b) => b.viewerCount - a.viewerCount);
      streamerCards = streamerCards.slice(0, MAX_STREAMERS);

      let allCards = [];

      if (hasDropData && dropsImageURL) {
        const timeLeft = getTimeRemaining();
        if (timeLeft && timeLeft !== "Drops ended") {
          const dropCard = {
            title: dropsName || "Kirka Drop",
            content: `Ends in ${timeLeft}`,
            img: dropsImageURL,
            imgType: "icon",
            link: "https://kirka.io/connectTwitch=1",
            category: "event",
            live: false,
            liveText: "",
            hasDrops: false,
            viewerCount: 0,
            isDropCard: true,
            twitchIcon: TWITCH_FAVICON,
            updatedAt: Date.now()
          };
          allCards.push(dropCard);
        }
      }

      allCards = allCards.concat(streamerCards);

      if (!allCards.length) {
        isFetching = false;
        return false;
      }

      let leftInterface = document.querySelector("#app #left-interface");
      let attempts = 0;
      while (!leftInterface && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        leftInterface = document.querySelector("#app #left-interface");
        attempts++;
      }

      if (!leftInterface) {
        isFetching = false;
        return false;
      }

      const lobbyNewsContainer = document.createElement("div");
      lobbyNewsContainer.id = "lobby-news";
      lobbyNewsContainer.className = "lobby-news";
      lobbyNewsContainer.style.cssText = `
        width: 250px;
        position: absolute;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        top: 240px;
        left: 148px;
        pointer-events: auto;
      `;
      
      leftInterface.appendChild(lobbyNewsContainer);

      const createNewsCard = (newsItem) => {
        const div = document.createElement("div");
        div.className = "news-card";
        div.style.cssText = `
          width: 100%;
          border: 4px solid #3e4d7c;
          border-bottom: solid 4px #26335b;
          border-top: 4px solid #4d5c8b;
          background-color: #3b4975;
          display: flex;
          position: relative;
          ${newsItem.link ? "cursor: pointer;" : ""}
          ${newsItem.imgType === "banner" ? "flex-direction: column;" : ""}
        `;
        lobbyNewsContainer.appendChild(div);

        const addImage = () => {
          if (!newsItem.img || newsItem.img === "") return;
          
          const img = document.createElement("img");
          img.className = `news-img ${newsItem.imgType}`;
          img.src = newsItem.img;
          img.style.cssText = `
            width: ${newsItem.imgType === "banner" ? "100%" : "4rem"};
            max-height: ${newsItem.imgType === "banner" ? "7.5rem" : "4rem"};
            object-fit: cover;
            object-position: center;
          `;
          div.appendChild(img);
        };

        const addBadge = (text, color, position = "top-right") => {
          const badgeSpan = document.createElement("span");
          badgeSpan.className = "badge";
          badgeSpan.innerText = text;
          const isTopRight = position === "top-right";
          badgeSpan.style.cssText = `
            position: absolute;
            ${isTopRight ? 'top: 0; right: 0;' : 'bottom: 0; right: 0;'}
            background-color: ${color};
            color: #fff;
            padding: 0.15rem 0.25rem;
            font-size: 0.75rem;
            font-weight: 600;
            border-radius: ${isTopRight ? '0 0 0 0.25rem' : '0.25rem 0 0 0'};
          `;
          div.appendChild(badgeSpan);
        };

        const addContent = () => {
          const content = document.createElement("div");
          content.className = "news-container";
          content.style.cssText = `
            padding: 0.5rem;
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
            text-align: left;
          `;

          const titleWrapper = document.createElement("div");
          titleWrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.5rem;
          `;

          if (newsItem.twitchIcon) {
            const icon = document.createElement("img");
            icon.src = newsItem.twitchIcon;
            icon.style.cssText = `
              width: 20px;
              height: 20px;
              border-radius: 4px;
              flex-shrink: 0;
            `;
            titleWrapper.appendChild(icon);
          }

          const title = document.createElement("span");
          title.className = "news-title";
          title.innerText = newsItem.title;
          title.style.cssText = `
            font-size: 1.2rem;
            font-weight: 600;
            color: #fff;
            margin: 0;
            color: #ffb914;
          `;
          titleWrapper.appendChild(title);
          content.appendChild(titleWrapper);

          const text = document.createElement("span");
          text.className = "news-content";
          text.innerText = newsItem.content;
          text.style.cssText = `
            font-size: 0.7rem;
            color: #fff;
            margin: 0;
            opacity: 0.8;
          `;

          if (newsItem.content) content.appendChild(text);
          div.appendChild(content);
        };

        addImage();
        if (newsItem.live) addBadge(newsItem.liveText, "#e24f4f", "top-right");
        if (newsItem.hasDrops) {
          addBadge("DROPS", "#4CAF50", "bottom-right");
        }
        addContent();

        div.onclick = () => {
          if (newsItem.link) {
            window.open(newsItem.link, "_blank");
          }
        };
      };

      allCards.forEach((newsItem) => createNewsCard(newsItem));
      retryCount = 0;
      lastFetchTime = Date.now();
      isFetching = false;
      return true;

    } catch (error) {
      isFetching = false;
      return false;
    }
  }

  const debouncedCreateNewsCards = (force = false) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    
    if (force) {
      createNewsCards(true);
      return;
    }
    
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      createNewsCards(false);
    }, DEBOUNCE_DELAY);
  };

  async function init() {
    if (isRunning) {
      return;
    }
    
    isRunning = true;

    let success = await createNewsCards(true);
    
    while (!success && retryCount < MAX_RETRIES) {
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
      success = await createNewsCards(true);
    }

    observer = new MutationObserver(() => {
      const newsContainer = document.querySelector(".lobby-news");
      const leftInterface = document.querySelector("#app #left-interface");
      const isLobby = document.querySelector("#app > .interface");
      
      if (!newsContainer && leftInterface && isLobby) {
        debouncedCreateNewsCards(false);
      }
    });

    const targetNode = document.querySelector("#app") || document.body;
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: false
    });
    
    urlObserver = new MutationObserver(() => {
      const isLobby = document.querySelector("#app > .interface");
      const newsContainer = document.querySelector(".lobby-news");
      
      if (isLobby && !newsContainer) {
        debouncedCreateNewsCards(false);
      }
    });
    
    urlObserver.observe(targetNode, {
      childList: true,
      subtree: true
    });

    window.twitchNewsObserver = observer;
    window.twitchUrlObserver = urlObserver;

    if (window.twitchNewsObserver && window.twitchNewsObserver !== observer) {
      window.twitchNewsObserver.disconnect();
    }
  }

  function cleanup() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (urlObserver) {
      urlObserver.disconnect();
      urlObserver = null;
    }
    if (window.twitchNewsObserver) {
      window.twitchNewsObserver.disconnect();
    }
    if (window.twitchUrlObserver) {
      window.twitchUrlObserver.disconnect();
    }
    isRunning = false;
    isFetching = false;
  }

  init();
  return { cleanup };
};

module.exports = { twitchNewsAddon };