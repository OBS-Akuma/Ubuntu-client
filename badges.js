// ubuntu-badges.js - Badge processing for Redline, Dawn, and Smudgy with Settings Integration

const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

// Cache for badge data to avoid repeated fetches
const badgeCache = {
    redline: null,
    dawn: null,
    smudgy: null,
    custom: null,
    lastFetch: {
        redline: 0,
        dawn: 0,
        smudgy: 0,
        custom: 0
    }
};

const CACHE_DURATION = 60000; // 1 minute cache

// Default badge sources
const BADGE_SOURCES = {
    SMUDGY: 'https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json',
    DAWN: 'https://raw.githubusercontent.com/zVipexx/dawn-client/refs/heads/main/badges.json',
    REDLINE: null, // Passed in directly
    NONE: null
};

// Badge source names for display
const SOURCE_NAMES = {
    smudgy: 'Smudgy',
    dawn: 'Dawn',
    redline: 'Redline',
    custom: 'Custom API'
};

// This will be populated with the settings from the main client
let clientSettings = null;

/**
 * Get the current badge API setting from localStorage
 * @returns {string} - The selected badge source URL or '/'
 */
function getBadgeApiSetting() {
    try {
        // First try to get from clientSettings if available
        if (clientSettings && clientSettings.badge_api !== undefined) {
            return clientSettings.badge_api;
        }
        // Fallback to localStorage
        return localStorage.getItem('Ubuntu_Badge_api') || 'https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json';
    } catch {
        return 'https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json';
    }
}

/**
 * Get the custom badge API URL from localStorage
 * @returns {string} - The custom badge API URL or empty string
 */
function getCustomBadgeApi() {
    try {
        if (clientSettings && clientSettings.custom_badge_api !== undefined) {
            return clientSettings.custom_badge_api;
        }
        return localStorage.getItem('Ubuntu_Badge_custom_api') || '';
    } catch {
        return '';
    }
}

/**
 * Check if badges should be enabled
 * @returns {boolean}
 */
function areBadgesEnabled() {
    try {
        if (clientSettings && clientSettings.badges_enabled !== undefined) {
            return clientSettings.badges_enabled;
        }
        const api = getBadgeApiSetting();
        const customApi = getCustomBadgeApi();
        return (customApi && customApi !== '/' && customApi !== '') || (api && api !== '/');
    } catch {
        return true;
    }
}

/**
 * Get the active badge source
 * @returns {string} - 'smudgy', 'dawn', 'redline', 'custom', or 'none'
 */
function getActiveBadgeSource() {
    try {
        if (clientSettings && clientSettings.active_badge_source !== undefined) {
            return clientSettings.active_badge_source;
        }
        const customApi = getCustomBadgeApi();
        if (customApi && customApi !== '/' && customApi !== '') {
            return 'custom';
        }
        const api = getBadgeApiSetting();
        if (api === BADGE_SOURCES.SMUDGY) {
            return 'smudgy';
        } else if (api === BADGE_SOURCES.DAWN) {
            return 'dawn';
        } else if (api === '/') {
            return 'none';
        }
        return 'smudgy';
    } catch {
        return 'smudgy';
    }
}

/**
 * Set client settings from the main application
 * @param {Object} settings - Settings object from ipcRenderer
 */
function setClientSettings(settings) {
    clientSettings = settings;
}

/**
 * Fetches badge data from the appropriate source based on settings
 * @param {string} source - 'redline', 'dawn', 'smudgy', or 'custom'
 * @param {Array} redlineData - Redline data (passed in)
 * @returns {Promise<Array>} - Array of badge data
 */
async function fetchBadgeData(source, redlineData = null) {
    // Check if badges are disabled
    if (!areBadgesEnabled()) {
        return [];
    }

    const now = Date.now();
    const badgeApi = getBadgeApiSetting();
    const customApi = getCustomBadgeApi();

    // Determine which URL to use based on source and settings
    let url;
    let cacheKey = source;

    switch (source) {
        case 'redline':
            return redlineData || [];
        case 'dawn':
            url = badgeApi === BADGE_SOURCES.DAWN ? badgeApi : BADGE_SOURCES.DAWN;
            break;
        case 'smudgy':
            url = badgeApi === BADGE_SOURCES.SMUDGY ? badgeApi : BADGE_SOURCES.SMUDGY;
            break;
        case 'custom':
            url = customApi;
            cacheKey = 'custom';
            break;
        default:
            // Use the selected API from settings
            if (badgeApi === BADGE_SOURCES.SMUDGY) {
                url = BADGE_SOURCES.SMUDGY;
                cacheKey = 'smudgy';
            } else if (badgeApi === BADGE_SOURCES.DAWN) {
                url = BADGE_SOURCES.DAWN;
                cacheKey = 'dawn';
            } else {
                return [];
            }
    }

    // Check cache for custom or specific sources
    if (badgeCache[cacheKey] && (now - badgeCache.lastFetch[cacheKey] < CACHE_DURATION)) {
        return badgeCache[cacheKey];
    }

    // Don't fetch if no URL
    if (!url || url === '/') {
        return [];
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        badgeCache[cacheKey] = data;
        badgeCache.lastFetch[cacheKey] = now;
        return data;
    } catch (error) {
        console.error(`Failed to fetch badge data from ${source}:`, error);
        return badgeCache[cacheKey] || [];
    }
}

/**
 * Process Redline badges
 * @param {Array} redlineData - Array of { linked_at, short_id } objects
 * @param {string} shortId - User's short ID
 * @returns {Object} - Badge configuration
 */
function processRedlineBadges(redlineData, shortId) {
    if (!redlineData || !Array.isArray(redlineData)) {
        return null;
    }

    const hasBadge = redlineData.some(item => item.short_id === shortId);
    
    if (hasBadge) {
        return {
            gradient: null,
            badges: ['https://raw.githubusercontent.com/robertpakalns/redline-client/refs/heads/main/assets/icons/badges/linked.png'],
            source: 'redline',
            sourceName: 'Redline'
        };
    }
    
    return null;
}

/**
 * Process Dawn badges
 * @param {Array} dawnData - Array of badge objects with shortId, gradient, badges
 * @param {string} shortId - User's short ID
 * @returns {Object|null} - Badge configuration with gradient and badges
 */
function processDawnBadges(dawnData, shortId) {
    if (!dawnData || !Array.isArray(dawnData)) {
        return null;
    }

    const entry = dawnData.find(item => item.shortId === shortId);
    
    if (!entry) {
        return null;
    }

    return {
        gradient: entry.gradient || null,
        badges: entry.badges || [],
        source: 'dawn',
        sourceName: 'Dawn'
    };
}

/**
 * Process Smudgy badges
 * @param {Array} smudgyData - Array of badge objects with discord, shortId, font, booster, gradient, badges
 * @param {string} shortId - User's short ID
 * @returns {Object|null} - Badge configuration with gradient and badges
 */
function processSmudgyBadges(smudgyData, shortId) {
    if (!smudgyData || !Array.isArray(smudgyData)) {
        return null;
    }

    const entry = smudgyData.find(item => item.shortId === shortId);
    
    if (!entry) {
        return null;
    }

    const badges = [];

    // Add linked badge if discord is present
    if (entry.discord) {
        badges.push('https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/img/linked.webp');
    }

    // Add booster badge if booster is true
    if (entry.booster === true) {
        badges.push('https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/img/booster.webp');
    }

    // Add the rest of the badges
    if (entry.badges && Array.isArray(entry.badges)) {
        badges.push(...entry.badges);
    }

    return {
        gradient: entry.gradient || null,
        badges: badges,
        font: entry.font || null,
        source: 'smudgy',
        sourceName: 'Smudgy',
        discord: entry.discord,
        booster: entry.booster
    };
}

/**
 * Process custom badge data (for custom API)
 * @param {Array} customData - Array of badge objects
 * @param {string} shortId - User's short ID
 * @returns {Object|null} - Badge configuration
 */
function processCustomBadges(customData, shortId) {
    if (!customData || !Array.isArray(customData)) {
        return null;
    }

    // Try to find entry by shortId (supports multiple key formats)
    const entry = customData.find(item => 
        item.shortId === shortId || 
        item.short_id === shortId ||
        item.id === shortId ||
        item.userId === shortId ||
        item.user_id === shortId
    );
    
    if (!entry) {
        return null;
    }

    const badges = [];

    // Check for discord-like linked badge
    if (entry.discord || entry.linked || entry.discord_id || entry.discordId) {
        badges.push('https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/img/linked.webp');
    }

    // Check for booster
    if (entry.booster === true) {
        badges.push('https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/img/booster.webp');
    }

    // Add custom badges
    if (entry.badges && Array.isArray(entry.badges)) {
        badges.push(...entry.badges);
    }

    return {
        gradient: entry.gradient || null,
        badges: badges,
        font: entry.font || null,
        source: 'custom',
        sourceName: 'Custom API'
    };
}

/**
 * Get badge configuration for a user from all sources based on settings
 * @param {string} shortId - User's short ID
 * @param {Object} options - Configuration options
 * @param {Array} options.redlineData - Redline badge data (passed in from game.js)
 * @param {string} options.forceSource - Force a specific source ('redline', 'dawn', 'smudgy', 'custom')
 * @param {Array} options.existingBadges - Existing badges to merge (from local customizations)
 * @param {Object} options.existingGradient - Existing gradient (from local customizations)
 * @returns {Promise<Object>} - Combined badge configuration
 */
async function getUserBadges(shortId, options = {}) {
    const { redlineData = null, forceSource = null, existingBadges = [], existingGradient = null } = options;
    
    // Check if badges are enabled
    if (!areBadgesEnabled()) {
        return null;
    }

    const badgeApi = getBadgeApiSetting();
    const customApi = getCustomBadgeApi();

    // Determine which sources to fetch based on settings
    let result = null;

    // If forceSource is specified, only use that source
    if (forceSource) {
        switch (forceSource) {
            case 'redline':
                const redlineConfig = processRedlineBadges(redlineData, shortId);
                if (redlineConfig) result = redlineConfig;
                break;
            case 'dawn':
                const dawnData = await fetchBadgeData('dawn');
                const dawnConfig = processDawnBadges(dawnData, shortId);
                if (dawnConfig) result = dawnConfig;
                break;
            case 'smudgy':
                const smudgyData = await fetchBadgeData('smudgy');
                const smudgyConfig = processSmudgyBadges(smudgyData, shortId);
                if (smudgyConfig) result = smudgyConfig;
                break;
            case 'custom':
                if (customApi && customApi !== '/') {
                    const customData = await fetchBadgeData('custom');
                    const customConfig = processCustomBadges(customData, shortId);
                    if (customConfig) result = customConfig;
                }
                break;
        }
        
        // Merge with existing badges if any
        if (result && (existingBadges.length > 0 || existingGradient)) {
            result = mergeBadgeConfigs(result, { badges: existingBadges, gradient: existingGradient });
        }
        
        return result;
    }

    // Priority order based on settings
    // 1. Custom API (if set)
    // 2. Selected API from dropdown
    // 3. Fallback to Smudgy

    // Check custom API first
    if (customApi && customApi !== '/') {
        const customData = await fetchBadgeData('custom');
        const customConfig = processCustomBadges(customData, shortId);
        if (customConfig) {
            result = customConfig;
        }
    }

    // Check selected API
    if (!result && badgeApi === BADGE_SOURCES.SMUDGY) {
        const smudgyData = await fetchBadgeData('smudgy');
        const smudgyConfig = processSmudgyBadges(smudgyData, shortId);
        if (smudgyConfig) result = smudgyConfig;
    }

    if (!result && badgeApi === BADGE_SOURCES.DAWN) {
        const dawnData = await fetchBadgeData('dawn');
        const dawnConfig = processDawnBadges(dawnData, shortId);
        if (dawnConfig) result = dawnConfig;
    }

    // Fallback: Try all sources in order
    if (!result) {
        const smudgyData = await fetchBadgeData('smudgy');
        const smudgyConfig = processSmudgyBadges(smudgyData, shortId);
        if (smudgyConfig) result = smudgyConfig;
    }

    if (!result) {
        const dawnData = await fetchBadgeData('dawn');
        const dawnConfig = processDawnBadges(dawnData, shortId);
        if (dawnConfig) result = dawnConfig;
    }

    if (!result) {
        const redlineConfig = processRedlineBadges(redlineData, shortId);
        if (redlineConfig) result = redlineConfig;
    }

    // Merge with existing badges if any
    if (result && (existingBadges.length > 0 || existingGradient)) {
        result = mergeBadgeConfigs(result, { badges: existingBadges, gradient: existingGradient });
    }

    return result;
}

/**
 * Merge two badge configurations
 * @param {Object} primary - Primary badge config
 * @param {Object} secondary - Secondary badge config to merge
 * @returns {Object} - Merged configuration
 */
function mergeBadgeConfigs(primary, secondary) {
    if (!primary) return secondary;
    if (!secondary) return primary;

    const merged = { ...primary };
    
    // Merge badges (deduplicate)
    const badgeSet = new Set();
    if (primary.badges) primary.badges.forEach(b => badgeSet.add(b));
    if (secondary.badges) secondary.badges.forEach(b => badgeSet.add(b));
    merged.badges = Array.from(badgeSet);
    
    // Prefer primary gradient, but use secondary if primary doesn't have one
    if (!merged.gradient && secondary.gradient) {
        merged.gradient = secondary.gradient;
    }
    
    // Prefer primary font
    if (!merged.font && secondary.font) {
        merged.font = secondary.font;
    }
    
    return merged;
}

/**
 * Apply badges to a DOM element (player name container)
 * @param {HTMLElement} element - The element to apply badges to
 * @param {Object} badgeConfig - Badge configuration from getUserBadges
 * @param {Object} settings - Settings object for animations etc.
 */
function applyBadgesToElement(element, badgeConfig, settings = {}) {
    if (!element || !badgeConfig) return;
    
    // Clear existing badges
    const existingBadges = element.querySelector('.ubuntu-badges');
    if (existingBadges) {
        existingBadges.remove();
    }
    
    // Get the text node (player name) or nickname span
    const textNode = [...element.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
    const nameSpan = element.querySelector('.nickname-span') || textNode || element;
    
    // Apply gradient if present
    if (badgeConfig.gradient && nameSpan) {
        nameSpan.style.display = 'inline-block';
        nameSpan.style.background = `linear-gradient(${badgeConfig.gradient.rot}, ${badgeConfig.gradient.stops.join(', ')})`;
        nameSpan.style.backgroundClip = 'text';
        nameSpan.style.webkitBackgroundClip = 'text';
        nameSpan.style.color = 'transparent';
        nameSpan.style.fontWeight = '700';
        nameSpan.style.textShadow = badgeConfig.gradient.shadow || '0 0 0 transparent';
        
        if (settings.animations && badgeConfig.animated) {
            nameSpan.style.backgroundSize = '200% 200%';
            nameSpan.style.animation = 'animated-gradient 3s linear infinite';
        }
    }
    
    // Apply font if present (Smudgy/Custom)
    if (badgeConfig.font) {
        const fontFamily = badgeConfig.font.split('family=')[1]?.split('&')[0] || 'Rubik Storm';
        element.style.fontFamily = `'${fontFamily}', sans-serif`;
    }
    
    // Create badges container
    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'ubuntu-badges';
    badgesContainer.style.cssText = 'display: flex; gap: 0.25rem; align-items: center; margin-left: 0.25rem;';
    
    // Add badges
    if (badgeConfig.badges && badgeConfig.badges.length > 0) {
        const badgeStyle = 'height: 24px; width: auto;';
        
        badgeConfig.badges.forEach((badgeUrl) => {
            const img = document.createElement('img');
            
            // Handle file paths
            if (badgeUrl.startsWith('/') || badgeUrl.match(/^[A-Za-z]:\\/)) {
                const filePath = badgeUrl.replace(/\\/g, '/');
                img.src = `file://${filePath.startsWith('/') ? '' : '/'}${filePath}`;
            } else {
                img.src = badgeUrl;
            }
            
            img.style.cssText = badgeStyle;
            img.loading = 'lazy';
            
            // Handle image load errors gracefully
            img.onerror = () => {
                console.warn('Failed to load badge:', badgeUrl);
                img.style.display = 'none';
            };
            
            badgesContainer.appendChild(img);
        });
    }
    
    // Insert badges after the name
    if (nameSpan) {
        if (nameSpan.parentNode) {
            nameSpan.parentNode.insertBefore(badgesContainer, nameSpan.nextSibling);
        } else {
            element.appendChild(badgesContainer);
        }
    } else {
        element.appendChild(badgesContainer);
    }
}

/**
 * Remove badges from an element
 * @param {HTMLElement} element - The element to clean
 */
function removeBadgesFromElement(element) {
    if (!element) return;
    
    const badges = element.querySelector('.ubuntu-badges');
    if (badges) {
        badges.remove();
    }
    
    // Reset styles
    element.style.background = '';
    element.style.backgroundClip = '';
    element.style.webkitBackgroundClip = '';
    element.style.color = '';
    element.style.fontWeight = '';
    element.style.textShadow = '';
    element.style.fontFamily = '';
    element.style.backgroundSize = '';
    element.style.animation = '';
}

/**
 * Check if a user has any badges
 * @param {string} shortId - User's short ID
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - True if user has badges
 */
async function userHasBadges(shortId, options = {}) {
    const config = await getUserBadges(shortId, options);
    return config !== null && config.badges && config.badges.length > 0;
}

/**
 * Clear the badge cache for a specific source or all sources
 * @param {string} source - 'redline', 'dawn', 'smudgy', 'custom', or null for all
 */
function clearBadgeCache(source) {
    if (source) {
        badgeCache[source] = null;
        badgeCache.lastFetch[source] = 0;
    } else {
        // Clear all caches
        Object.keys(badgeCache).forEach(key => {
            if (key !== 'lastFetch') {
                badgeCache[key] = null;
                badgeCache.lastFetch[key] = 0;
            }
        });
    }
}

/**
 * Listen for settings changes and clear cache when badge settings change
 */
function setupSettingsListener() {
    if (typeof window !== 'undefined') {
        // Listen for storage events (cross-tab)
        window.addEventListener('storage', (e) => {
            if (e.key === 'Ubuntu_Badge_api' || e.key === 'Ubuntu_Badge_custom_api') {
                clearBadgeCache();
                console.log('[Ubuntu Badges] Cache cleared due to storage change');
            }
        });

        // Listen for custom events from Settings.js
        document.addEventListener('settings-changed', ({ detail }) => {
            if (detail.key === 'Ubuntu_Badge_api' || detail.key === 'Ubuntu_Badge_custom_api') {
                clearBadgeCache();
                console.log('[Ubuntu Badges] Cache cleared due to settings change:', detail.key);
            }
        });

        // Also listen for the Ubuntu settings event
        document.addEventListener('ubuntu-settings-changed', ({ detail }) => {
            if (detail.setting === 'Ubuntu_Badge_api' || detail.setting === 'Ubuntu_Badge_custom_api') {
                clearBadgeCache();
                console.log('[Ubuntu Badges] Cache cleared due to ubuntu-settings change');
            }
        });

        console.log('[Ubuntu Badges] Settings listeners initialized');
    }
}

// Initialize settings listener if in browser context
if (typeof window !== 'undefined' && document) {
    setupSettingsListener();
}

// Export functions for use in main client
module.exports = {
    fetchBadgeData,
    processRedlineBadges,
    processDawnBadges,
    processSmudgyBadges,
    processCustomBadges,
    getUserBadges,
    applyBadgesToElement,
    removeBadgesFromElement,
    userHasBadges,
    clearBadgeCache,
    getBadgeApiSetting,
    getCustomBadgeApi,
    areBadgesEnabled,
    getActiveBadgeSource,
    setupSettingsListener,
    setClientSettings,
    mergeBadgeConfigs,
    BADGE_SOURCES,
    SOURCE_NAMES
};