/**
 * Fetches live Twitch streamers from the Kirka API and displays them
 * as news cards in the lobby interface.
 * 
 * - Fetches live streamer data from Kirka API
 * - Fetches all active Kirka drops from the Twitch drops API
 * - Displays streamers as news cards with profile images
 * - Shows viewer count badge on active streamers
 * - Shows "DROPS" badge for streamers with active Kirka drops
 * - Displays one card per active Kirka drop
 * - Uses the REWARD benefit image for each drop
 * - Shows "EXCLUSIVE" badge (same corner as DROPS) when a drop has one channel
 * - Clicking a card opens the Twitch stream
 * - Removes duplicate streamers
 * - Uses MutationObserver to persist through DOM changes
 *
 * Reliability fixes (news panel randomly disappearing and not returning):
 *  1. debouncedCreateNewsCards now caps how long it can be pushed back by
 *     repeated mutations (MAX_DEBOUNCE_WAIT). Previously every mutation
 *     reset the 2s timer from scratch, so a page with any ongoing DOM
 *     churn (chat, other overlays, animations) could starve it forever.
 *  2. createNewsCards no longer silently drops an attempt blocked by
 *     MIN_FETCH_INTERVAL. It now queues a retry for when the interval
 *     clears, so a container removed shortly after the last render still
 *     gets rebuilt instead of staying gone until another mutation happens
 *     to fire.
 *  3. The two near-identical MutationObservers were merged into one.
 *  4. Added a lightweight watchdog interval as a safety net in case the
 *     news container disappears without the MutationObserver ever firing
 *     again (e.g. mutations elsewhere on the page stop entirely).
 */
const twitchNewsAddon = () => {
  let observer = null;
  let watchdogInterval = null;
  let isRunning = false;
  let retryCount = 0;
  const MAX_RETRIES = 5;
  let dropsChannels = [];
  let dropsList = [];
  let hasDropData = false;

  let debounceTimer = null;
  let rateLimitRetryTimer = null;
  const DEBOUNCE_DELAY = 2000;
  const MAX_DEBOUNCE_WAIT = 4000; // guarantees a run even under a mutation storm
  const WATCHDOG_INTERVAL = 4000;
  let missingSince = null;

  let isFetching = false;
  let lastFetchTime = 0;
  const MIN_FETCH_INTERVAL = 5000;

  const TWITCH_FAVICON = "https://assets.twitch.tv/assets/favicon-32-e29e246c157142c94346.png";
  const MAX_STREAMERS = 3;

  async function fetchDropsData() {
    hasDropData = false;
    dropsChannels = [];
    dropsList = [];

    try {
      const response = await fetch("https://twitch-drops-api.sunkwi.com/drops");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      const campaigns = Array.isArray(data) ? data : [data];

      for (const campaign of campaigns) {
        const gameName = campaign.gameDisplayName || "";
        const isKirka =
          gameName === "Kirka.io" || gameName.toLowerCase().includes("kirka");

        if (!isKirka) continue;

        const rewards = Array.isArray(campaign.rewards) ? campaign.rewards : [];

        for (const reward of rewards) {
          if (reward.status && reward.status !== "ACTIVE") continue;
          if (!reward.allow || !reward.allow.isEnabled) continue;

          hasDropData = true;

          const rewardChannels = [];
          if (
            reward.allow &&
            reward.allow.isEnabled &&
            Array.isArray(reward.allow.channels)
          ) {
            for (const channel of reward.allow.channels) {
              if (channel.name) {
                const ch = channel.name.toLowerCase();
                rewardChannels.push(ch);
                dropsChannels.push(ch);
              }
            }
          }

          const isExclusive = rewardChannels.length === 1;

          const dropEntry = {
            endTime: reward.endAt
              ? new Date(reward.endAt)
              : campaign.endAt
              ? new Date(campaign.endAt)
              : null,
            name: reward.name || campaign.name || "Kirka Drop",
            description: reward.description || "",
            imageURL: null,
            channels: rewardChannels,
            accountLinkURL:
              reward.accountLinkURL || "https://kirka.io/connectTwitch=1",
            isExclusive: isExclusive
          };

          if (
            reward.timeBasedDrops &&
            Array.isArray(reward.timeBasedDrops)
          ) {
            for (const timeDrop of reward.timeBasedDrops) {
              if (
                timeDrop.benefitEdges &&
                Array.isArray(timeDrop.benefitEdges)
              ) {
                for (const edge of timeDrop.benefitEdges) {
                  if (edge.benefit && edge.benefit.imageAssetURL) {
                    dropEntry.imageURL = edge.benefit.imageAssetURL;
                    break;
                  }
                }
              }
              if (dropEntry.imageURL) break;
            }
          }

          if (!dropEntry.imageURL && reward.imageURL) {
            dropEntry.imageURL = reward.imageURL;
          }

          dropsList.push(dropEntry);
        }
      }

      dropsChannels = [...new Set(dropsChannels)];

      const seenDrops = new Set();
      dropsList = dropsList.filter((d) => {
        const key = `${d.name}|${d.endTime ? d.endTime.toISOString() : ""}`;
        if (seenDrops.has(key)) return false;
        seenDrops.add(key);
        return true;
      });

      return { hasDropData, dropsChannels, dropsList };
    } catch (error) {
      return { hasDropData: false, dropsChannels: [], dropsList: [] };
    }
  }

  function getTimeRemaining(endTime) {
    if (!endTime) return null;

    const now = new Date();
    const diff = endTime - now;

    if (diff <= 0) return "Drops ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h ${minutes}m left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  }

  function hasDrops(streamerName) {
    if (!dropsChannels.length) return false;
    return dropsChannels.includes(streamerName.toLowerCase());
  }

  function formatViewers(count) {
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  }

  async function createNewsCards(force = false) {
    const now = Date.now();

    if (!force && now - lastFetchTime < MIN_FETCH_INTERVAL) {
      // Previously this just returned false and dropped the attempt on the
      // floor. If the container had been removed within 5s of the last
      // render, nothing would ever rebuild it unless another mutation
      // happened to fire later. Queue a single retry for when the window
      // clears instead.
      if (!rateLimitRetryTimer) {
        const remaining = MIN_FETCH_INTERVAL - (now - lastFetchTime);
        rateLimitRetryTimer = setTimeout(() => {
          rateLimitRetryTimer = null;
          createNewsCards(false);
        }, remaining + 50);
      }
      return false;
    }

    if (isFetching) return false;
    if (!document.querySelector("#app > .interface")) return false;

    const existingNews = document.querySelector(".lobby-news");
    if (existingNews) existingNews.remove();

    try {
      isFetching = true;

      const dropData = await fetchDropsData();
      hasDropData = dropData.hasDropData;
      dropsChannels = dropData.dropsChannels;
      dropsList = dropData.dropsList;

      const response = await fetch("https://api2.kirka.io/api/wnMwWWNm/wnWmMwN");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

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

        return {
          title: displayName,
          content: `${formatViewers(viewerCount)} viewers`,
          img: profileImage,
          imgType: "icon",
          link: twitchUrl,
          category: "event",
          live: true,
          liveText: "LIVE",
          hasDrops: hasDrops(displayName),
          viewerCount: viewerCount,
          twitchIcon: TWITCH_FAVICON,
          updatedAt: Date.now()
        };
      });

      streamerCards.sort((a, b) => b.viewerCount - a.viewerCount);
      streamerCards = streamerCards.slice(0, MAX_STREAMERS);

      let allCards = [];

      if (hasDropData && dropsList.length) {
        for (const drop of dropsList) {
          const timeLeft = getTimeRemaining(drop.endTime);
          if (timeLeft && timeLeft !== "Drops ended") {
            allCards.push({
              title: drop.name || "Kirka Drop",
              content: `Ends in ${timeLeft}`,
              img: drop.imageURL || "",
              imgType: "icon",
              link: drop.accountLinkURL || "https://kirka.io/connectTwitch=1",
              category: "event",
              live: false,
              liveText: "",
              hasDrops: false,
              viewerCount: 0,
              isDropCard: true,
              isExclusive: !!drop.isExclusive,
              twitchIcon: TWITCH_FAVICON,
              updatedAt: Date.now()
            });
          }
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
            color: #ffb914;
            margin: 0;
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
        if (newsItem.hasDrops) addBadge("DROPS", "#4CAF50", "bottom-right");
        if (newsItem.isExclusive) addBadge("EXCLUSIVE", "#9147ff", "bottom-right");
        addContent();

        div.onclick = () => {
          if (newsItem.link) window.open(newsItem.link, "_blank");
        };
      };

      allCards.forEach((newsItem) => createNewsCard(newsItem));
      retryCount = 0;
      lastFetchTime = Date.now();
      missingSince = null;
      isFetching = false;
      return true;

    } catch (error) {
      isFetching = false;
      return false;
    }
  }

  const debouncedCreateNewsCards = (force = false) => {
    if (force) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      missingSince = null;
      createNewsCards(true);
      return;
    }

    const now = Date.now();
    if (!missingSince) missingSince = now;

    // If continuous, unrelated DOM mutations keep re-triggering this
    // function, the timer below would get reset forever and never fire.
    // Once we've been waiting too long since the container first went
    // missing, force a run now instead of pushing it back again.
    if (now - missingSince >= MAX_DEBOUNCE_WAIT) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      missingSince = null;
      createNewsCards(false);
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      missingSince = null;
      createNewsCards(false);
    }, DEBOUNCE_DELAY);
  };

  function isLobbyMissingNews() {
    const isLobby = document.querySelector("#app > .interface");
    const leftInterface = document.querySelector("#app #left-interface");
    const newsContainer = document.querySelector(".lobby-news");
    return !!(isLobby && leftInterface && !newsContainer);
  }

  async function init() {
    if (isRunning) return;
    isRunning = true;

    let success = await createNewsCards(true);
    while (!success && retryCount < MAX_RETRIES) {
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
      success = await createNewsCards(true);
    }

    // A single observer covers both "left-interface re-rendered" and
    // "SPA navigated to lobby" cases — the two separate observers in the
    // original version watched the same target with the same check.
    observer = new MutationObserver(() => {
      if (isLobbyMissingNews()) {
        debouncedCreateNewsCards(false);
      }
    });

    const targetNode = document.querySelector("#app") || document.body;
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: false
    });

    // Safety net: catches the case where the container disappears but no
    // further mutation ever fires the observer above (e.g. the rest of the
    // page goes quiet), so it doesn't get stuck missing indefinitely.
    watchdogInterval = setInterval(() => {
      if (isLobbyMissingNews()) {
        debouncedCreateNewsCards(false);
      }
    }, WATCHDOG_INTERVAL);

    if (window.twitchNewsObserver && window.twitchNewsObserver !== observer) {
      window.twitchNewsObserver.disconnect();
    }
    window.twitchNewsObserver = observer;

    if (window.twitchNewsWatchdog) {
      clearInterval(window.twitchNewsWatchdog);
    }
    window.twitchNewsWatchdog = watchdogInterval;
  }

  function cleanup() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (rateLimitRetryTimer) {
      clearTimeout(rateLimitRetryTimer);
      rateLimitRetryTimer = null;
    }
    if (watchdogInterval) {
      clearInterval(watchdogInterval);
      watchdogInterval = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (window.twitchNewsObserver) window.twitchNewsObserver.disconnect();
    if (window.twitchNewsWatchdog) clearInterval(window.twitchNewsWatchdog);
    isRunning = false;
    isFetching = false;
    missingSince = null;
  }

  init();
  return { cleanup };
};

module.exports = { twitchNewsAddon };