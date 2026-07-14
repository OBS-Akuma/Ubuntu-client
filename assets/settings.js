

(function() {
    'use strict';

    console.log('[Settings] Initializing settings module...');




    const SETTINGS_KEYS = {
        BADGE_API: 'Badge_api',
        CUSTOM_BADGE_API: 'Badge-gradient-api-inout',

    };


    const DEFAULT_SETTINGS = {
        [SETTINGS_KEYS.BADGE_API]: 'https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json',
        [SETTINGS_KEYS.CUSTOM_BADGE_API]: ''
    };





    /**
     * Send settings to main process to save to settings.txt
     */
    async function saveSettingsToMain(settings) {
        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                const result = await ipcRenderer.invoke('save-settings', settings);
                if (result && result.success) {
                    console.log('[Settings]  Saved to settings.txt via main process');
                    return true;
                } else {
                    console.error('[Settings]  Failed to save to settings.txt:', result?.error);
                    return false;
                }
            }
        } catch (error) {
            console.error('[Settings]  Error saving to main process:', error);
            return false;
        }
    }

    /**
     * Load settings from main process
     */
    async function loadSettingsFromMain() {
        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                const result = await ipcRenderer.invoke('load-settings');
                if (result && result.success && result.settings) {
                    console.log('[Settings]  Loaded settings from settings.txt');
                    return result.settings;
                }
            }
        } catch (error) {
            console.error('[Settings]  Error loading from main process:', error);
        }
        return null;
    }





    /**
     * Save a setting to localStorage AND settings.txt
     * @param {string} key - The setting key
     * @param {*} value - The value to save
     */
    async function saveSetting(key, value) {
        try {

            const toStore = typeof value === 'string' ? value : JSON.stringify(value);
            localStorage.setItem(key, toStore);
            console.log(`[Settings]  Saved ${key} to localStorage:`, value);
            


            const currentSettings = await loadAllSettings();
            currentSettings[key] = value;
            

            if (key === SETTINGS_KEYS.BADGE_API || key === SETTINGS_KEYS.CUSTOM_BADGE_API) {


                const mainSettings = await loadSettingsFromMain() || {};
                mainSettings[key] = value;
                await saveSettingsToMain(mainSettings);
            }
            

            document.dispatchEvent(new CustomEvent('settings-changed', {
                detail: { key: key, value: value }
            }));
            
            return true;
        } catch (error) {
            console.error(`[Settings]  Failed to save ${key}:`, error);
            return false;
        }
    }

    /**
     * Load a setting from localStorage
     * @param {string} key - The setting key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} The saved value or default
     */
    function loadSetting(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            if (value === null || value === undefined) {
                return defaultValue;
            }

            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        } catch (error) {
            console.error(`[Settings]  Failed to load ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Save all settings at once
     * @param {Object} settings - Object containing all settings
     */
    async function saveAllSettings(settings) {
        let success = true;
        for (const [key, value] of Object.entries(settings)) {
            const result = await saveSetting(key, value);
            if (!result) success = false;
        }
        return success;
    }

    /**
     * Load all settings from localStorage
     * @returns {Object} All settings
     */
    function loadAllSettings() {
        const settings = {};
        for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
            settings[key] = loadSetting(key, defaultValue);
        }
        return settings;
    }





    /**
     * Get the current badge API setting
     * @returns {string} The selected badge API URL
     */
    function getBadgeApi() {
        const value = loadSetting(SETTINGS_KEYS.BADGE_API, DEFAULT_SETTINGS[SETTINGS_KEYS.BADGE_API]);
        console.log(`[Settings]  Loaded Badge_api:`, value);
        return value;
    }

    /**
     * Set the badge API
     * @param {string} value - The badge API URL
     * @returns {Promise<boolean>} Success status
     */
    async function setBadgeApi(value) {
        console.log(`[Settings]  Setting Badge_api to:`, value);
        return await saveSetting(SETTINGS_KEYS.BADGE_API, value);
    }

    /**
     * Get the custom badge API URL
     * @returns {string} The custom badge API URL
     */
    function getCustomBadgeApi() {
        const value = loadSetting(SETTINGS_KEYS.CUSTOM_BADGE_API, DEFAULT_SETTINGS[SETTINGS_KEYS.CUSTOM_BADGE_API]);
        console.log(`[Settings]  Loaded Custom badge API:`, value);
        return value;
    }

    /**
     * Set the custom badge API URL
     * @param {string} value - The custom badge API URL
     * @returns {Promise<boolean>} Success status
     */
    async function setCustomBadgeApi(value) {
        console.log(`[Settings]  Setting custom badge API to:`, value);
        return await saveSetting(SETTINGS_KEYS.CUSTOM_BADGE_API, value);
    }

    /**
     * Check if badges are enabled
     * @returns {boolean} True if badges are enabled
     */
    function areBadgesEnabled() {
        const api = getBadgeApi();
        const customApi = getCustomBadgeApi();
        const enabled = (customApi && customApi !== '/' && customApi !== '') || (api && api !== '/');
        console.log(`[Settings]  Badges enabled:`, enabled);
        return enabled;
    }

    /**
     * Get the active badge source
     * @returns {string} 'smudgy', 'dawn', 'redline', 'custom', or 'none'
     */
    function getActiveBadgeSource() {
        const customApi = getCustomBadgeApi();
        if (customApi && customApi !== '/' && customApi !== '') {
            return 'custom';
        }

        const api = getBadgeApi();
        if (api === 'https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json') {
            return 'smudgy';
        } else if (api === 'https://raw.githubusercontent.com/zVipexx/dawn-client/refs/heads/main/badges.json') {
            return 'dawn';
        } else if (api === '/') {
            return 'none';
        }
        return 'smudgy';
    }





    /**
     * Bind settings UI elements to localStorage
     */
    function bindSettingsUI() {
        console.log('[Settings]  Binding UI elements...');


        setTimeout(() => {

            const badgeSelect = document.getElementById('Badge_api');
            if (badgeSelect) {
                const savedValue = getBadgeApi();
                console.log('[Settings]  Badge select found, saved value:', savedValue);
                

                let found = false;
                for (const option of badgeSelect.options) {
                    if (option.value === savedValue) {
                        option.selected = true;
                        found = true;
                        break;
                    }
                }
                if (!found && badgeSelect.options.length > 0) {
                    badgeSelect.selectedIndex = 0;
                }
                

                badgeSelect.removeEventListener('change', badgeSelect._changeHandler);
                

                badgeSelect._changeHandler = async function() {
                    const value = this.value;
                    console.log('[Settings]  Badge API select changed to:', value);
                    await setBadgeApi(value);
                    

                    const customBadgeInput = document.getElementById('Badge-gradient-api-inout');
                    if (customBadgeInput) {
                        if (value === '/') {
                            customBadgeInput.style.opacity = '0.5';
                            customBadgeInput.style.cursor = 'not-allowed';
                        } else {
                            customBadgeInput.style.opacity = '1';
                            customBadgeInput.style.cursor = 'text';
                        }
                    }
                };
                badgeSelect.addEventListener('change', badgeSelect._changeHandler);
                

                badgeSelect._changeHandler();
                
                console.log('[Settings]  Badge API select bound');
            } else {
                console.warn('[Settings]  Badge API select not found');
            }


            const customBadgeInput = document.getElementById('Badge-gradient-api-inout');
            if (customBadgeInput) {
                const savedValue = getCustomBadgeApi();
                console.log('[Settings]  Custom badge input found, saved value:', savedValue);
                customBadgeInput.value = savedValue || '';
                

                customBadgeInput.removeEventListener('input', customBadgeInput._inputHandler);
                customBadgeInput.removeEventListener('change', customBadgeInput._changeHandler);
                customBadgeInput.removeEventListener('blur', customBadgeInput._blurHandler);
                

                customBadgeInput._inputHandler = function() {
                    const value = this.value.trim();
                    console.log('[Settings]  Custom badge input changed (input):', value);
                };
                customBadgeInput.addEventListener('input', customBadgeInput._inputHandler);
                

                customBadgeInput._changeHandler = async function() {
                    const value = this.value.trim();
                    console.log('[Settings]  Custom badge input changed (change):', value);
                    await setCustomBadgeApi(value);
                };
                customBadgeInput.addEventListener('change', customBadgeInput._changeHandler);
                

                customBadgeInput._blurHandler = async function() {
                    const value = this.value.trim();
                    const saved = getCustomBadgeApi();
                    if (value !== saved) {
                        console.log('[Settings]  Custom badge input saved on blur:', value);
                        await setCustomBadgeApi(value);
                    }
                };
                customBadgeInput.addEventListener('blur', customBadgeInput._blurHandler);
                
                console.log('[Settings]  Custom Badge API input bound');
            } else {
                console.warn('[Settings]  Custom Badge API input not found');
            }


            console.log('[Settings]  Current settings:');
            console.log('  Badge API:', getBadgeApi());
            console.log('  Custom API:', getCustomBadgeApi());
            console.log('  Badges enabled:', areBadgesEnabled());
            console.log('  Active source:', getActiveBadgeSource());

        }, 100);
    }





    /**
     * Set up a listener for storage changes from other tabs/windows
     */
    function setupStorageListener() {
        window.addEventListener('storage', function(e) {
            if (e.key === SETTINGS_KEYS.BADGE_API || e.key === SETTINGS_KEYS.CUSTOM_BADGE_API) {
                console.log('[Settings]  Storage changed:', e.key, 'new value:', e.newValue);
                

                if (e.key === SETTINGS_KEYS.BADGE_API) {
                    const badgeSelect = document.getElementById('Badge_api');
                    if (badgeSelect) {
                        let found = false;
                        for (const option of badgeSelect.options) {
                            if (option.value === e.newValue) {
                                option.selected = true;
                                found = true;
                                break;
                            }
                        }
                        if (!found && badgeSelect.options.length > 0) {
                            badgeSelect.selectedIndex = 0;
                        }
                    }
                }
                
                if (e.key === SETTINGS_KEYS.CUSTOM_BADGE_API) {
                    const customBadgeInput = document.getElementById('Badge-gradient-api-inout');
                    if (customBadgeInput) {
                        customBadgeInput.value = e.newValue || '';
                    }
                }
                
                document.dispatchEvent(new CustomEvent('settings-changed', {
                    detail: { key: e.key, value: e.newValue }
                }));
            }
        });
        console.log('[Settings]  Storage listener set up');
    }





    /**
     * Test function to verify settings are working
     */
    async function testSettings() {
        console.log('[Settings]  Running settings test...');
        

        const mainSettings = await loadSettingsFromMain();
        console.log('[Settings]  Settings from main process:', mainSettings);
        

        const currentApi = getBadgeApi();
        console.log('[Settings]  Current Badge API:', currentApi);
        

        const currentCustom = getCustomBadgeApi();
        console.log('[Settings]  Current Custom API:', currentCustom);
        
        console.log('[Settings]  Test complete');
    }






    window.Settings = {

        saveSetting,
        loadSetting,
        saveAllSettings,
        loadAllSettings,
        

        getBadgeApi,
        setBadgeApi,
        getCustomBadgeApi,
        setCustomBadgeApi,
        areBadgesEnabled,
        getActiveBadgeSource,
        

        saveSettingsToMain,
        loadSettingsFromMain,
        

        bindSettingsUI,
        

        testSettings,
        

        SETTINGS_KEYS,
        DEFAULT_SETTINGS
    };


    window.getBadgeApi = getBadgeApi;
    window.setBadgeApi = setBadgeApi;
    window.getCustomBadgeApi = getCustomBadgeApi;
    window.setCustomBadgeApi = setCustomBadgeApi;
    window.areBadgesEnabled = areBadgesEnabled;
    window.getActiveBadgeSource = getActiveBadgeSource;

    console.log('[Settings]  Settings module initialized');
    console.log('[Settings]  Current badge API:', getBadgeApi());
    console.log('[Settings]  Current custom badge API:', getCustomBadgeApi());
    console.log('[Settings]  Badges enabled:', areBadgesEnabled());
    console.log('[Settings]  Active source:', getActiveBadgeSource());






    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('[Settings]  DOM ready, binding UI...');
            bindSettingsUI();
            setupStorageListener();

            setTimeout(testSettings, 500);
        });
    } else {
        console.log('[Settings]  DOM already ready, binding UI...');
        bindSettingsUI();
        setupStorageListener();
        setTimeout(testSettings, 500);
    }

})();