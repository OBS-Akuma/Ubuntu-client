// assets/profilehead.js
// Extracts the face from a skin texture using Canvas API in Electron renderer

const SKINS_API = "https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/AllItemData.json";
const SMUDGY_INVENTORY_API = "https://www.smudgy.store/api/getinventory";

const HEAD_SIZE = 128;
const FACE_UV_X = 8;
const FACE_UV_Y = 8;
const FACE_SIZE = 8;
const HAT_UV_X = 40;
const HAT_UV_Y = 8;
const HAT_SIZE = 8;

// ── Cache ─────────────────────────────────────────────────────────────────────

let _skinsCache = null;
const imageCheckTracker = {};

// ── Settings helpers (with fallbacks) ──────────────────────────────────────

// These will be set by main.js
let _loadSettings = null;
let _saveSettings = null;

function setSettingsHandlers(loadFn, saveFn) {
    console.log('[profilehead] Settings handlers set');
    _loadSettings = loadFn;
    _saveSettings = saveFn;
}

async function loadSettings() {
    if (_loadSettings) {
        return await _loadSettings();
    }
    console.warn('[profilehead] loadSettings not set, using empty object');
    return {};
}

async function saveSettings(settings) {
    if (_saveSettings) {
        return await _saveSettings(settings);
    }
    console.warn('[profilehead] saveSettings not set, skipping save');
    return false;
}

// ── Load skins database ──────────────────────────────────────────────────────

async function loadSkinsDatabase() {
    if (_skinsCache) {
        console.log('[profilehead] Using cached skins data');
        return _skinsCache;
    }
    
    console.log('[profilehead] Loading skins data from:', SKINS_API);
    try {
        const res = await fetch(SKINS_API);
        if (!res.ok) throw new Error(`Skins API ${res.status}`);
        _skinsCache = await res.json();
        console.log(`[profilehead] Skins cache loaded: ${_skinsCache.length} entries`);
        return _skinsCache;
    } catch (err) {
        console.error('[profilehead] Failed to load skins:', err);
        throw err;
    }
}

// ── Fetch user inventory from Smudgy ────────────────────────────────────────

async function fetchUserInventory(userId) {
    console.log(`[profilehead] Fetching inventory for ${userId}`);
    
    try {
        const res = await fetch(SMUDGY_INVENTORY_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                userId: userId, 
                isShortId: true 
            }),
        });
        
        if (!res.ok) {
            throw new Error(`Smudgy API ${res.status}: ${res.statusText}`);
        }
        
        const json = await res.json();
        console.log('[profilehead] Smudgy API success:', json.success);
        
        if (!json || typeof json !== 'object') {
            throw new Error(`Invalid response for ${userId}`);
        }
        
        if (!json.success) {
            throw new Error(`API returned error: ${json.message || 'Unknown error'}`);
        }
        
        console.log(`[profilehead] Found ${json.data?.length || 0} items for ${userId}`);
        return json;
    } catch (err) {
        console.error(`[profilehead] Failed to fetch for ${userId}:`, err);
        throw err;
    }
}

// ── Get selected body skin from inventory ──────────────────────────────────

function getSelectedBodySkin(inventory) {
    console.log('[profilehead] Looking for selected body skin...');
    
    if (!inventory || !inventory.data || !Array.isArray(inventory.data)) {
        console.log('[profilehead] No inventory data found');
        return null;
    }
    
    // Find a body skin that is selected
    const selectedSkin = inventory.data.find(item => 
        item.isSelected === true && 
        item.item && 
        (item.item.type === 'BODY_SKIN' || item.item.type === 'SKIN')
    );
    
    if (selectedSkin) {
        console.log(`[profilehead] Found selected skin: ${selectedSkin.item.name} (${selectedSkin.item.id})`);
        return selectedSkin.item;
    }
    
    // If no selected skin, try to find any body skin
    console.log('[profilehead] No selected skin, looking for any body skin...');
    const anySkin = inventory.data.find(item => 
        item.item && 
        (item.item.type === 'BODY_SKIN' || item.item.type === 'SKIN')
    );
    
    if (anySkin) {
        console.log(`[profilehead] Found body skin: ${anySkin.item.name} (${anySkin.item.id})`);
        return anySkin.item;
    }
    
    console.log('[profilehead] No body skins found in inventory');
    return null;
}

// ── Get texture URL for a skin ID ──────────────────────────────────────────

async function getSkinTextureUrl(skinId) {
    console.log(`[profilehead] Looking up texture for skin ID: ${skinId}`);
    const skins = await loadSkinsDatabase();
    
    const skin = skins.find(s => s.id === skinId);
    if (!skin) {
        console.log(`[profilehead] Skin ${skinId} not found in database`);
        return null;
    }
    
    console.log(`[profilehead] Skin found: ${skin.name}`);
    const source = skin.textureUrl ?? skin.renderUrl;
    if (!source) {
        console.log(`[profilehead] Skin has no textureUrl or renderUrl`);
        return null;
    }
    
    console.log(`[profilehead] Texture found, isDataUrl: ${source.startsWith('data:image/')}`);
    return source;
}

// ── Extract face from skin texture using Canvas API ────────────────────────

function extractFaceFromTexture(textureSource) {
    console.log('[profilehead] Extracting face from texture...');
    
    return new Promise((resolve, reject) => {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = function() {
                try {
                    console.log('[profilehead] Image loaded:', img.width, 'x', img.height);
                    const scale = img.width / 64;
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = HEAD_SIZE;
                    canvas.height = HEAD_SIZE;
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false;
                    
                    // White background
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, HEAD_SIZE, HEAD_SIZE);
                    
                    // Draw face layer (UV: 8,8)
                    ctx.drawImage(
                        img,
                        FACE_UV_X * scale, FACE_UV_Y * scale,
                        FACE_SIZE * scale, FACE_SIZE * scale,
                        0, 0,
                        HEAD_SIZE, HEAD_SIZE
                    );
                    
                    // Draw hat layer (UV: 40,8)
                    ctx.drawImage(
                        img,
                        HAT_UV_X * scale, HAT_UV_Y * scale,
                        HAT_SIZE * scale, HAT_SIZE * scale,
                        0, 0,
                        HEAD_SIZE, HEAD_SIZE
                    );
                    
                    const dataUrl = canvas.toDataURL('image/png');
                    console.log('[profilehead] Face extracted, length:', dataUrl.length);
                    resolve(dataUrl);
                    
                } catch (err) {
                    console.error('[profilehead] Error processing image:', err);
                    reject(err);
                }
            };
            
            img.onerror = function(err) {
                console.error('[profilehead] Failed to load image:', err);
                reject(new Error('Failed to load image'));
            };
            
            // Load the image
            if (textureSource.startsWith('data:image/')) {
                img.src = textureSource;
            } else {
                img.src = textureSource + (textureSource.includes('?') ? '&' : '?') + '_t=' + Date.now();
            }
            
        } catch (err) {
            console.error('[profilehead] Error in extractFaceFromTexture:', err);
            reject(err);
        }
    });
}

// ── Get profile image data ─────────────────────────────────────────────────

async function getProfileImageData(tag) {
    console.log(`[profilehead] Getting profile data for ${tag}`);
    if (!tag) return null;
    
    try {
        const inventory = await fetchUserInventory(tag);
        const skin = getSelectedBodySkin(inventory);
        if (!skin) {
            console.log(`[profilehead] No skin found for ${tag}`);
            return null;
        }
        
        const textureUrl = await getSkinTextureUrl(skin.id);
        if (!textureUrl) {
            console.log(`[profilehead] No texture URL for ${tag}`);
            return null;
        }
        
        return {
            skinId: skin.id,
            skinName: skin.name,
            textureUrl: textureUrl,
            isDataUrl: textureUrl.startsWith('data:image/')
        };
    } catch (err) {
        console.error(`[profilehead] Error getting profile data:`, err);
        return null;
    }
}

// ── Get the face from texture ──────────────────────────────────────────────

async function fetchAndExtractFace(tag) {
    console.log(`[profilehead] Fetching and extracting face for ${tag}`);
    try {
        const data = await getProfileImageData(tag);
        if (!data || !data.textureUrl) {
            console.log('[profilehead] No texture found');
            return null;
        }
        
        const faceDataUrl = await extractFaceFromTexture(data.textureUrl);
        return faceDataUrl;
        
    } catch (err) {
        console.error('[profilehead] Error fetching/extracting face:', err);
        return null;
    }
}

// ── Caching functions ──────────────────────────────────────────────────────

async function getCachedProfileImage(tag) {
    try {
        const settings = await loadSettings();
        if (settings && settings.profileImages && settings.profileImages[tag]) {
            return settings.profileImages[tag];
        }
        return null;
    } catch (e) {
        console.error('[profilehead] Error getting cached image:', e);
        return null;
    }
}

async function saveCachedProfileImage(tag, base64Data) {
    try {
        const settings = await loadSettings();
        if (!settings.profileImages) {
            settings.profileImages = {};
        }
        settings.profileImages[tag] = {
            data: base64Data,
            timestamp: Date.now()
        };
        await saveSettings(settings);
        console.log('[profilehead] Cached image saved for:', tag);
        return true;
    } catch (e) {
        console.error('[profilehead] Error saving cached image:', e);
        return false;
    }
}

function getImageHash(base64Data) {
    if (!base64Data) return null;
    const base64String = base64Data.split(',')[1] || base64Data;
    if (base64String.length <= 200) {
        return base64String;
    }
    return base64String.substring(0, 100) + base64String.substring(base64String.length - 100);
}

// ── Check if image changed ─────────────────────────────────────────────────

async function checkImageChanged(tag, cachedBase64) {
    console.log(`[profilehead] Checking if image changed for ${tag}`);
    try {
        const newFace = await fetchAndExtractFace(tag);
        if (!newFace) {
            return { changed: false, newBase64: null };
        }
        
        const oldHash = getImageHash(cachedBase64);
        const newHash = getImageHash(newFace);
        const hasChanged = oldHash !== newHash;
        console.log('[profilehead] Image changed:', hasChanged);
        
        return {
            changed: hasChanged,
            newBase64: newFace
        };
    } catch (error) {
        console.error('[profilehead] Error checking if image changed:', error);
        return { changed: false, newBase64: null };
    }
}

// ── Get profile image (with caching) ───────────────────────────────────────

async function getProfileImage(tag, forceRefresh = false) {
    console.log(`[profilehead] getProfileImage called for ${tag}, forceRefresh: ${forceRefresh}`);
    if (!tag) return null;
    
    // Check cache first
    if (!forceRefresh) {
        const cached = await getCachedProfileImage(tag);
        if (cached && cached.data) {
            const lastCheck = imageCheckTracker[tag] || 0;
            const shouldCheckChange = (Date.now() - lastCheck) > 3600000;
            
            if (shouldCheckChange) {
                console.log('[profilehead] Cache old, checking for changes...');
                const result = await checkImageChanged(tag, cached.data);
                imageCheckTracker[tag] = Date.now();
                
                if (result.changed && result.newBase64) {
                    await saveCachedProfileImage(tag, result.newBase64);
                    console.log('[profilehead] Updated cached image for:', tag);
                    return result.newBase64;
                } else if (!result.changed) {
                    const settings = await loadSettings();
                    if (settings && settings.profileImages && settings.profileImages[tag]) {
                        settings.profileImages[tag].timestamp = Date.now();
                        await saveSettings(settings);
                    }
                }
            }
            
            console.log('[profilehead] Using cached image for:', tag);
            return cached.data;
        }
    }
    
    // Fetch fresh
    try {
        console.log('[profilehead] Fetching fresh image for:', tag);
        const faceDataUrl = await fetchAndExtractFace(tag);
        
        if (!faceDataUrl) {
            console.log('[profilehead] No face extracted, creating placeholder');
            return createPlaceholderHead(tag);
        }
        
        await saveCachedProfileImage(tag, faceDataUrl);
        imageCheckTracker[tag] = Date.now();
        console.log('[profilehead] Cached new image for:', tag);
        return faceDataUrl;
    } catch (error) {
        console.error('[profilehead] Error fetching image:', error);
        const cached = await getCachedProfileImage(tag);
        if (cached && cached.data) {
            console.log('[profilehead] Using cached image as fallback');
            return cached.data;
        }
        return createPlaceholderHead(tag);
    }
}

async function refreshProfileImage(tag) {
    if (!tag) return null;
    console.log('[profilehead] Manual refresh for:', tag);
    return await getProfileImage(tag, true);
}

// ── Create placeholder head ────────────────────────────────────────────────

function createPlaceholderHead(tag) {
    console.log('[profilehead] Creating placeholder head for:', tag);
    try {
        const canvas = document.createElement('canvas');
        canvas.width = HEAD_SIZE;
        canvas.height = HEAD_SIZE;
        const ctx = canvas.getContext('2d');
        
        // Dark background
        ctx.fillStyle = '#22222a';
        ctx.fillRect(0, 0, HEAD_SIZE, HEAD_SIZE);
        
        // Border
        ctx.strokeStyle = '#2ECC71';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, HEAD_SIZE - 4, HEAD_SIZE - 4);
        
        // Text
        ctx.fillStyle = '#8888a0';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayTag = tag && tag.length > 8 ? tag.substring(0, 8) : (tag || '???');
        ctx.fillText(displayTag, HEAD_SIZE / 2, HEAD_SIZE / 2 - 6);
        ctx.fillStyle = '#555568';
        ctx.font = '14px Arial';
        ctx.fillText('No skin', HEAD_SIZE / 2, HEAD_SIZE / 2 + 20);
        
        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error('[profilehead] Failed to create placeholder:', err);
        return null;
    }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    getProfileImage,
    refreshProfileImage,
    getProfileImageData,
    getCachedProfileImage,
    saveCachedProfileImage,
    checkImageChanged,
    getImageHash,
    fetchUserInventory,
    getSelectedBodySkin,
    getSkinTextureUrl,
    loadSkinsDatabase,
    extractFaceFromTexture,
    fetchAndExtractFace,
    createPlaceholderHead,
    setSettingsHandlers,
    imageCheckTracker,
    HEAD_SIZE,
};

console.log('[profilehead] Module loaded successfully');