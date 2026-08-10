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
  let isRunning = false;
  let retryCount = 0;
  const MAX_RETRIES = 5;
  let dropsChannels = [];
  let dropsEndTime = null;
  let dropsImageURL = null;
  let dropsName = null;
  let dropsDescription = null;
  let hasDropData = false;

  const TWITCH_FAVICON = "https://assets.twitch.tv/assets/favicon-32-e29e246c157142c94346.png";
  const MAX_STREAMERS = 3;

  // Function to fetch drops data from the API
  async function fetchDropsData() {
    try {
      const response = await fetch("https://twitch-drops-api.sunkwi.com/drops");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("[Twitch News] Drops API Response:", data);
      
      // Find Kirka.io drops
      for (const drop of data) {
        const gameName = drop.gameDisplayName || "";
        // Check for Kirka.io
        if (gameName === "Kirka.io" || gameName.toLowerCase().includes("kirka")) {
          hasDropData = true;
          console.log("[Twitch News] Found Kirka drops data:", drop);
          
          // Store the end time from the drop (top level)
          if (drop.endAt) {
            dropsEndTime = new Date(drop.endAt);
            console.log(`[Twitch News] Drops end at: ${dropsEndTime}`);
          }
          
          // Store name and description
          if (drop.name) {
            dropsName = drop.name;
            console.log(`[Twitch News] Drops name: ${dropsName}`);
          }
          
          if (drop.description) {
            dropsDescription = drop.description;
            console.log(`[Twitch News] Drops description: ${dropsDescription}`);
          }
          
          // Get image from timeBasedDrops benefitEdges
          if (drop.rewards && Array.isArray(drop.rewards)) {
            for (const reward of drop.rewards) {
              // Check timeBasedDrops for imageAssetURL
              if (reward.timeBasedDrops && Array.isArray(reward.timeBasedDrops)) {
                for (const timeDrop of reward.timeBasedDrops) {
                  if (timeDrop.benefitEdges && Array.isArray(timeDrop.benefitEdges)) {
                    for (const edge of timeDrop.benefitEdges) {
                      if (edge.benefit && edge.benefit.imageAssetURL) {
                        dropsImageURL = edge.benefit.imageAssetURL;
                        console.log(`[Twitch News] Found imageAssetURL: ${dropsImageURL}`);
                        break;
                      }
                    }
                  }
                  if (dropsImageURL) break;
                }
              }
              // Also check if there's an imageURL at reward level
              if (!dropsImageURL && reward.imageURL) {
                dropsImageURL = reward.imageURL;
                console.log(`[Twitch News] Found reward imageURL: ${dropsImageURL}`);
              }
              if (dropsImageURL) break;
            }
          }
          
          // Extract channels from rewards array
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
          console.log(`[Twitch News] Found ${dropsChannels.length} channels with drops from API`);
          break;
        }
      }
      
      if (!hasDropData) {
        console.log("[Twitch News] No Kirka drops found in API response");
        const games = data.map(d => d.gameDisplayName);
        console.log("[Twitch News] Available games:", games);
      }
      
      return { hasDropData, dropsChannels, dropsEndTime, dropsImageURL, dropsName, dropsDescription };
    } catch (error) {
      console.error("[Twitch News] Failed to fetch drops data:", error);
      return { hasDropData: false, dropsChannels: [], dropsEndTime: null, dropsImageURL: null, dropsName: null, dropsDescription: null };
    }
  }

  // Function to calculate time remaining until drops end
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

  // Function to check if a streamer has drops
  function hasDrops(streamerName) {
    if (!dropsChannels.length) return false;
    const lowerName = streamerName.toLowerCase();
    return dropsChannels.includes(lowerName);
  }

  // Function to format viewer count
  function formatViewers(count) {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  }

  // Function to create the news cards
  async function createNewsCards() {
    // Check if we're on the lobby page
    if (!document.querySelector("#app > .interface")) {
      console.log("[Twitch News] Not on lobby page");
      return false;
    }

    // Remove existing news container if it exists
    const existingNews = document.querySelector(".lobby-news");
    if (existingNews) {
      existingNews.remove();
    }

    try {
      console.log("[Twitch News] Fetching streamers...");
      
      // Fetch drops data from API
      const dropData = await fetchDropsData();
      
      // Update variables from API response
      hasDropData = dropData.hasDropData;
      dropsChannels = dropData.dropsChannels;
      dropsEndTime = dropData.dropsEndTime;
      dropsImageURL = dropData.dropsImageURL;
      dropsName = dropData.dropsName;
      dropsDescription = dropData.dropsDescription;
      
      console.log(`[Twitch News] Has drop data: ${hasDropData}`);
      console.log(`[Twitch News] Drop name: ${dropsName}`);
      console.log(`[Twitch News] Drop image: ${dropsImageURL}`);
      
      // Fetch streamer data from the API
      const response = await fetch("https://api2.kirka.io/api/wnMwWWNm/wnWmMwN");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const apiData = await response.json();
      console.log("[Twitch News] API Response:", apiData);
      
      let newsData = apiData.WwMw || [];
      
      if (!newsData.length) {
        console.log("[Twitch News] No streamers found in API response");
        return false;
      }
      
      console.log(`[Twitch News] Found ${newsData.length} streamers in API`);
      
      // Remove duplicates based on name
      const seenNames = new Set();
      const uniqueNews = [];
      
      for (const item of newsData) {
        const name = item.wNwWnWmM || item.wwMmWnW || "";
        if (name && !seenNames.has(name)) {
          seenNames.add(name);
          uniqueNews.push(item);
        }
      }
      
      console.log(`[Twitch News] ${uniqueNews.length} unique streamers after deduplication`);
      
      // Transform the API data to match the expected news format
      let streamerCards = uniqueNews.map(item => {
        const displayName = item.wNwWnWmM || item.wwMmWnW || "Twitch Streamer";
        const twitchUrl = item.WwMwW || `https://twitch.tv/${displayName}`;
        const profileImage = item.wnNWmwMW || "";
        const viewerCount = item.wNwWmnW || 0;
        const liveText = `${formatViewers(viewerCount)} viewers`;
        
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

      // Sort streamers by viewer count (highest to lowest)
      streamerCards.sort((a, b) => b.viewerCount - a.viewerCount);
      
      // Limit to MAX_STREAMERS
      streamerCards = streamerCards.slice(0, MAX_STREAMERS);
      console.log(`[Twitch News] Limited to ${streamerCards.length} streamers (top ${MAX_STREAMERS})`);

      // Create a separate array for all cards
      let allCards = [];

      // Add drop card at the top if we have data
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
          console.log(`[Twitch News] Added drop card: "${dropsName}" at the top`);
        } else {
          console.log("[Twitch News] Drop has ended, not showing card");
        }
      } else {
        console.log("[Twitch News] No drop data from API, skipping drop card");
      }

      // Then add all streamer cards after the drop card
      allCards = allCards.concat(streamerCards);

      if (!allCards.length) {
        console.log("[Twitch News] No cards to display");
        return false;
      }

      // Wait for left interface to be ready
      let leftInterface = document.querySelector("#app #left-interface");
      let attempts = 0;
      while (!leftInterface && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        leftInterface = document.querySelector("#app #left-interface");
        attempts++;
      }

      if (!leftInterface) {
        console.log("[Twitch News] Left interface not found");
        return false;
      }

      // Create the news container
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

          // Title with Twitch icon
          const titleWrapper = document.createElement("div");
          titleWrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.5rem;
          `;

          // Add Twitch icon
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
      console.log(`[Twitch News] Successfully created ${allCards.length} cards (${allCards.filter(c => c.isDropCard).length} drop card + ${streamerCards.length} streamers)`);
      retryCount = 0;
      return true;

    } catch (error) {
      console.error("[Twitch News] Failed to fetch streamers:", error);
      return false;
    }
  }

  // Initialize the addon
  async function init() {
    if (isRunning) {
      console.log("[Twitch News] Already running");
      return;
    }
    
    isRunning = true;
    console.log("[Twitch News] Initializing...");

    let success = await createNewsCards();
    
    while (!success && retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`[Twitch News] Retry ${retryCount}/${MAX_RETRIES}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      success = await createNewsCards();
    }

    observer = new MutationObserver(async () => {
      const newsContainer = document.querySelector(".lobby-news");
      const leftInterface = document.querySelector("#app #left-interface");
      const isLobby = document.querySelector("#app > .interface");
      
      if (!newsContainer && leftInterface && isLobby) {
        console.log("[Twitch News] News container missing, recreating...");
        await createNewsCards();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log("[Twitch News] Observer started - watching for changes");
    
    const urlObserver = new MutationObserver(() => {
      const isLobby = document.querySelector("#app > .interface");
      const newsContainer = document.querySelector(".lobby-news");
      
      if (isLobby && !newsContainer) {
        console.log("[Twitch News] Lobby detected, creating news...");
        createNewsCards();
      }
    });
    
    urlObserver.observe(document.querySelector("#app") || document.body, {
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
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (window.twitchNewsObserver) {
      window.twitchNewsObserver.disconnect();
    }
    if (window.twitchUrlObserver) {
      window.twitchUrlObserver.disconnect();
    }
    isRunning = false;
    console.log("[Twitch News] Cleaned up");
  }

  init();
  return { cleanup };
};

module.exports = { twitchNewsAddon };