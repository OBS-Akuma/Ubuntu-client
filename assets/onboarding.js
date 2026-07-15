(function () {

    const ONBOARD_FLAG = 'hasBeen';



    const DEV_MODE = true;

    const SWAPPER_GIF_PATH = 'assets/swapper-demo.gif';

    function shouldShowOnboarding() {
        if (DEV_MODE) {
            localStorage.removeItem(ONBOARD_FLAG);
            return true;
        }
        const flag = localStorage.getItem(ONBOARD_FLAG);
        return flag !== 'true';
    }

    function markOnboardingComplete() {
        localStorage.setItem(ONBOARD_FLAG, 'true');
    }

    let draftSettings = null;
    let pendingKeybind = null;

    const steps = [
        {
            id: 'welcome',
            title: 'Welcome to Ubuntu Client',
            body: () => `
                <p class="ob-p">Ubuntu Client is a custom Kirka.io client built for deep UI customization
                and features the base game doesn't give you. Here's a quick rundown before you jump in:</p>
                <div class="ob-grid">
                    <div class="ob-item"><i class="fas fa-play"></i><div><b>Launch</b><span>Start the game from here.</span></div></div>
                    <div class="ob-item"><i class="fas fa-code"></i><div><b>Scripts</b><span>Script support (coming soon).</span></div></div>
                    <div class="ob-item"><i class="fas fa-chart-line"></i><div><b>Activity</b><span>Your kill stats, tracked per weapon.</span></div></div>
                    <div class="ob-item"><i class="fas fa-star"></i><div><b>Features</b><span>Everything the client can do, in one list.</span></div></div>
                    <div class="ob-item"><i class="fas fa-wrench"></i><div><b>Tools</b><span>Handy external resources.</span></div></div>
                    <div class="ob-item"><i class="fas fa-layer-group"></i><div><b>Other Clients</b><span>See what else is out there.</span></div></div>
                    <div class="ob-item"><i class="fas fa-handshake"></i><div><b>Trade Logs</b><span>Track your trades.</span></div></div>
                    <div class="ob-item"><i class="fas fa-cog"></i><div><b>Settings</b><span>Everything below lives here too — you can change it anytime.</span></div></div>
                </div>
            `
        },
        {
            id: 'proxy',
            title: 'Choose a Proxy',
            body: (s) => `
                <p class="ob-p">Pick which endpoint the client connects through. If you're not sure, leave this on <b>kirka.io</b>.</p>
                <select id="ob_base_url" class="ob-select">
                    <option value="https://kirka.io/">kirka.io</option>
                    <option value="https://snipers.io/">snipers.io</option>
                    <option value="https://ask101math.com/">ask101math.com</option>
                    <option value="https://fpsiogame.com/">fpsiogame.com</option>
                    <option value="https://cloudconverts.com/">cloudconverts.com</option>
                </select>
            `,
            bind: (container, s) => {
                const sel = container.querySelector('#ob_base_url');
                if (sel) sel.value = s.proxy || 'https://kirka.io/';
            },
            commit: (s, container) => {
                const sel = container.querySelector('#ob_base_url');
                if (sel) s.proxy = sel.value;
            }
        },
        {
            id: 'badges',
            title: 'Badges & Gradients',
            body: (s) => `
                <p class="ob-p">This decides whose badges / name-gradients you see in lobby, profiles, and in-game.</p>
                <select id="ob_badge_api" class="ob-select">
                    <option value="https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json">Smudgy</option>
                    <option value="https://raw.githubusercontent.com/zVipexx/dawn-client/refs/heads/main/badges.json">Dawn</option>
                    <option value="https://redline.tricko.pro/get_data">Redline</option>
                    <option value="/">None</option>
                </select>
                <p class="ob-p ob-sub">Or point it at your own JSON:</p>
                <input type="text" id="ob_badge_custom" class="ob-input" placeholder="https://.../badges.json">
            `,
            bind: (container, s) => {
                const sel = container.querySelector('#ob_badge_api');
                const custom = container.querySelector('#ob_badge_custom');
                if (sel) sel.value = s.badgeApi || 'https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json';
                if (custom) custom.value = s.customBadgeApi || '';
            },
            commit: (s, container) => {
                const sel = container.querySelector('#ob_badge_api');
                const custom = container.querySelector('#ob_badge_custom');
                if (sel) s.badgeApi = sel.value;
                if (custom) s.customBadgeApi = custom.value.trim();
            }
        },
        {
            id: 'news',
            title: 'News Preferences',
            body: (s) => `
                <p class="ob-p">Choose what shows up in the Notification Center on the Launch tab.</p>
                <div class="ob-toggle-row">
                    <span>Enable News</span>
                    <div class="checkbox"><input type="checkbox" id="ob_news_enabled" checked><label for="ob_news_enabled"></label></div>
                </div>
                <div class="ob-toggle-row"><span>General</span><div class="checkbox"><input type="checkbox" id="ob_news_general" checked><label for="ob_news_general"></label></div></div>
                <div class="ob-toggle-row"><span>Promotional</span><div class="checkbox"><input type="checkbox" id="ob_news_promotional"><label for="ob_news_promotional"></label></div></div>
                <div class="ob-toggle-row"><span>Event</span><div class="checkbox"><input type="checkbox" id="ob_news_event"><label for="ob_news_event"></label></div></div>
                <div class="ob-toggle-row"><span>Alerts</span><div class="checkbox"><input type="checkbox" id="ob_news_alert"><label for="ob_news_alert"></label></div></div>
            `,
            bind: (container, s) => {
                const cats = s.newsCategories || { general: true, event: true, alert: true, promotional: true };
                const enabledCheck = container.querySelector('#ob_news_enabled');
                const generalCheck = container.querySelector('#ob_news_general');
                const promoCheck = container.querySelector('#ob_news_promotional');
                const eventCheck = container.querySelector('#ob_news_event');
                const alertCheck = container.querySelector('#ob_news_alert');
                
                if (enabledCheck) enabledCheck.checked = s.newsEnabled !== undefined ? s.newsEnabled : true;
                if (generalCheck) generalCheck.checked = cats.general !== false;
                if (promoCheck) promoCheck.checked = cats.promotional === true;
                if (eventCheck) eventCheck.checked = cats.event === true;
                if (alertCheck) alertCheck.checked = cats.alert === true;
            },
            commit: (s, container) => {
                const enabledCheck = container.querySelector('#ob_news_enabled');
                const generalCheck = container.querySelector('#ob_news_general');
                const promoCheck = container.querySelector('#ob_news_promotional');
                const eventCheck = container.querySelector('#ob_news_event');
                const alertCheck = container.querySelector('#ob_news_alert');
                
                if (enabledCheck) s.newsEnabled = enabledCheck.checked;
                s.newsCategories = {
                    general: generalCheck ? generalCheck.checked : true,
                    promotional: promoCheck ? promoCheck.checked : false,
                    event: eventCheck ? eventCheck.checked : false,
                    alert: alertCheck ? alertCheck.checked : false
                };
            }
        },
        {
            id: 'keybind',
            title: 'Menu Keybind',
            body: (s) => `
                <p class="ob-p">Set the key that opens the in-game menu overlay. You can change this later in Settings.</p>
                <button class="ob-keybind-btn" id="ob_keybind_btn">Click to set</button>
            `,
            bind: (container, s) => {
                pendingKeybind = s.menu_keybind || null;
                const btn = container.querySelector('#ob_keybind_btn');
                if (!btn) return;
                if (pendingKeybind) {
                    btn.textContent = formatKeybindDisplay(pendingKeybind);
                    btn.classList.add('ob-set');
                }
                let listening = false;
                let timeoutId = null;
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (listening) {
                        listening = false;
                        clearTimeout(timeoutId);
                        btn.textContent = pendingKeybind ? formatKeybindDisplay(pendingKeybind) : 'Click to set';
                        btn.classList.remove('ob-listening');
                        return;
                    }
                    listening = true;
                    btn.textContent = 'Press a key...';
                    btn.classList.add('ob-listening');
                    const keydownHandler = function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        const key = event.code;
                        const allowed =
                            key === 'ShiftLeft' || key === 'ShiftRight' ||
                            key === 'ControlLeft' || key === 'ControlRight' ||
                            key === 'AltLeft' || key === 'AltRight' ||
                            key === 'MetaLeft' || key === 'MetaRight' ||
                            key === 'CapsLock' || key === 'NumLock' || key === 'ScrollLock' ||
                            (key.startsWith('F') && key.length <= 3) ||
                            key.startsWith('Key') || key.startsWith('Digit') ||
                            key === 'Space' || key === 'Escape';
                        if (!allowed) return;
                        pendingKeybind = key;
                        btn.textContent = formatKeybindDisplay(key);
                        btn.classList.remove('ob-listening');
                        btn.classList.add('ob-set');
                        document.removeEventListener('keydown', keydownHandler);
                        clearTimeout(timeoutId);
                        listening = false;
                    };
                    document.addEventListener('keydown', keydownHandler);
                    timeoutId = setTimeout(() => {
                        if (listening) {
                            listening = false;
                            document.removeEventListener('keydown', keydownHandler);
                            btn.textContent = pendingKeybind ? formatKeybindDisplay(pendingKeybind) : 'Click to set';
                            btn.classList.remove('ob-listening');
                        }
                    }, 5000);
                });
            },
            commit: (s) => {
                if (pendingKeybind) s.menu_keybind = pendingKeybind;
            }
        },
        {
            id: 'swapper',
            title: 'Using the Assets Swapper',
            body: () => `
                <p class="ob-p">Want custom weapon skins or textures? Drop your image into your Documents folder and the
                client will swap it in automatically:</p>
                <code class="ob-code">Documents\\Ubuntu\\assets\\img</code>
                <p class="ob-p ob-sub">Name the file to match the texture you're replacing. Here's a quick look:</p>
                <div class="ob-gif-wrap">
                    <img src="${SWAPPER_GIF_PATH}" alt="Assets Swapper demo"
                         onerror="this.parentElement.innerHTML='<div class=\\'ob-gif-fallback\\'>Akuma what did you do wrong this time gng</div>'">
                </div>
            `
        },
        {
            id: 'done',
            title: "You're all set",
            body: () => `
                <p class="ob-p">That's everything to get started. Every setting you just touched — proxy, badges,
                news, and your keybind — lives in the Settings tab if you ever want to change it.</p>
                <p class="ob-p">Jump in and have fun.</p>
            `
        }
    ];

    let currentStep = 0;
    let overlayEl = null;

    function injectStyles() {
        if (document.getElementById('onboarding-styles')) return;
        const style = document.createElement('style');
        style.id = 'onboarding-styles';
        style.textContent = `
            #onboardingOverlay {
                position: fixed;
                inset: 0;
                z-index: 9999;
                background: rgba(8, 8, 8, 0.92);
                backdrop-filter: blur(12px);
                display: flex;
                align-items: center;
                justify-content: center;
                animation: obFadeIn 0.3s ease;
                font-family: "Inter", sans-serif;
            }
            @keyframes obFadeIn {
                from { opacity: 0; backdrop-filter: blur(0); }
                to { opacity: 1; backdrop-filter: blur(12px); }
            }
            
            .ob-box {
                width: 520px;
                max-width: 92vw;
                max-height: 85vh;
                background: #0d0d0d;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 30px 80px rgba(0,0,0,0.8);
                animation: obSlideUp 0.3s ease;
            }
            @keyframes obSlideUp {
                from { transform: translateY(20px) scale(0.98); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
            
            .ob-header {
                padding: 18px 24px 14px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #0d0d0d;
            }
            .ob-title {
                font-family: "Permanent Marker", cursive;
                font-size: 1rem;
                font-weight: 700;
                color: #A2A6A2;
                letter-spacing: 0.1em;
                text-transform: uppercase;
            }
            .ob-skip {
                background: none;
                border: none;
                color: #444;
                font-size: 0.75rem;
                cursor: pointer;
                font-family: "Inter", sans-serif;
                transition: color 0.15s;
                padding: 4px 8px;
                border-radius: 4px;
            }
            .ob-skip:hover {
                color: #888;
                background: rgba(255,255,255,0.04);
            }
            
            .ob-body {
                padding: 24px 24px 16px;
                overflow-y: auto;
                flex: 1;
                background: #0d0d0d;
            }
            .ob-body::-webkit-scrollbar {
                width: 4px;
            }
            .ob-body::-webkit-scrollbar-track {
                background: transparent;
            }
            .ob-body::-webkit-scrollbar-thumb {
                background: #1e1e1e;
                border-radius: 2px;
            }
            
            .ob-p {
                color: #A2A6A2;
                font-size: 0.85rem;
                line-height: 1.6;
                margin: 0 0 14px;
                font-weight: 400;
            }
            .ob-p b {
                color: #ccc;
            }
            .ob-sub {
                color: #555;
                font-size: 0.78rem;
                margin-top: 16px;
            }
            
            .ob-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-top: 4px;
            }
            .ob-item {
                display: flex;
                gap: 10px;
                align-items: flex-start;
                background: #111111;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 6px;
                padding: 10px 12px;
                transition: border-color 0.15s;
            }
            .ob-item:hover {
                border-color: rgba(26,142,80,0.2);
            }
            .ob-item i {
                color: #1A8E50;
                margin-top: 2px;
                width: 14px;
                font-size: 0.8rem;
            }
            .ob-item b {
                display: block;
                font-size: 0.78rem;
                color: #ddd;
                font-weight: 600;
            }
            .ob-item span {
                display: block;
                font-size: 0.68rem;
                color: #555;
                margin-top: 2px;
                line-height: 1.4;
            }
            
            .ob-select,
            .ob-input {
                width: 100%;
                background: #111111;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 6px;
                padding: 9px 12px;
                color: #ddd;
                font-size: 0.82rem;
                font-family: "Inter", sans-serif;
                transition: border-color 0.15s;
                outline: none;
            }
            .ob-select:focus,
            .ob-input:focus {
                border-color: #1A8E50;
            }
            .ob-select option {
                background: #0d0d0d;
                color: #ddd;
            }
            
            .ob-toggle-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid rgba(255,255,255,0.04);
                font-size: 0.82rem;
                color: #A2A6A2;
            }
            .ob-toggle-row:last-child {
                border-bottom: none;
            }
            
            .ob-keybind-btn {
                background: #111111;
                border: 1px solid rgba(255,255,255,0.07);
                color: #A2A6A2;
                border-radius: 6px;
                padding: 12px 16px;
                cursor: pointer;
                font-size: 0.82rem;
                font-family: "Inter", sans-serif;
                width: 100%;
                transition: all 0.15s;
                text-align: center;
            }
            .ob-keybind-btn:hover {
                border-color: rgba(255,255,255,0.15);
                color: #ddd;
            }
            .ob-keybind-btn.ob-listening {
                border-color: #1A8E50;
                background: rgba(26,142,80,0.08);
                color: #1A8E50;
            }
            .ob-keybind-btn.ob-set {
                color: #ddd;
                border-color: rgba(26,142,80,0.3);
            }
            
            .ob-code {
                display: block;
                background: #080808;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 6px;
                padding: 10px 12px;
                color: #1A8E50;
                font-size: 0.78rem;
                font-family: 'Courier New', monospace;
                margin: 4px 0 10px;
                word-break: break-all;
            }
            
            .ob-gif-wrap {
                margin-top: 12px;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,0.06);
                background: #080808;
                min-height: 120px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .ob-gif-wrap img {
                width: 100%;
                display: block;
            }
            .ob-gif-fallback {
                padding: 24px;
                color: #444;
                font-size: 0.75rem;
                text-align: center;
            }
            
            .ob-footer {
                padding: 14px 24px 18px;
                border-top: 1px solid rgba(255,255,255,0.07);
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #0d0d0d;
            }
            .ob-dots {
                display: flex;
                gap: 6px;
            }
            .ob-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #1e1e1e;
                transition: background 0.2s;
            }
            .ob-dot.active {
                background: #1A8E50;
                box-shadow: 0 0 12px rgba(26,142,80,0.3);
            }
            
            .ob-btns {
                display: flex;
                gap: 8px;
            }
            .ob-btn {
                padding: 8px 18px;
                border-radius: 6px;
                font-size: 0.8rem;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid rgba(255,255,255,0.07);
                background: transparent;
                color: #A2A6A2;
                font-family: "Inter", sans-serif;
                transition: all 0.15s;
            }
            .ob-btn:hover:not(:disabled) {
                background: rgba(255,255,255,0.04);
                color: #ddd;
            }
            .ob-btn:disabled {
                opacity: 0.3;
                cursor: default;
            }
            .ob-btn.primary {
                background: #1A8E50;
                border-color: #1A8E50;
                color: #04140a;
                font-weight: 600;
            }
            .ob-btn.primary:hover:not(:disabled) {
                background: #1fa860;
                border-color: #1fa860;
                transform: translateY(-1px);
                box-shadow: 0 4px 16px rgba(26,142,80,0.25);
            }
            
            .checkbox {
                position: relative;
                width: 38px;
                height: 20px;
                flex-shrink: 0;
            }
            .checkbox input {
                opacity: 0;
                width: 0;
                height: 0;
                position: absolute;
            }
            .checkbox label {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: #1c1c1c;
                transition: 0.25s;
                border-radius: 30px;
                border: 1px solid rgba(255,255,255,0.06);
            }
            .checkbox label:before {
                position: absolute;
                content: "";
                height: 14px;
                width: 14px;
                left: 2px;
                bottom: 2px;
                background: #444;
                transition: 0.25s;
                border-radius: 50%;
            }
            .checkbox input:checked + label {
                background: #1A8E50;
                border-color: #1A8E50;
            }
            .checkbox input:checked + label:before {
                transform: translateX(18px);
                background: #fff;
            }
            
            .ob-keybind-btn:focus-visible,
            .ob-btn:focus-visible,
            .ob-skip:focus-visible,
            .ob-select:focus-visible,
            .ob-input:focus-visible {
                outline: 2px solid #1A8E50 !important;
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    function renderStep() {
        const step = steps[currentStep];
        const body = overlayEl.querySelector('.ob-body');
        const title = overlayEl.querySelector('.ob-title');
        const dots = overlayEl.querySelector('.ob-dots');
        const backBtn = overlayEl.querySelector('#obBackBtn');
        const nextBtn = overlayEl.querySelector('#obNextBtn');

        title.textContent = step.title;
        body.innerHTML = step.body(draftSettings);
        if (step.bind) step.bind(body, draftSettings);

        dots.innerHTML = steps.map((_, i) =>
            `<div class="ob-dot${i === currentStep ? ' active' : ''}"></div>`
        ).join('');

        backBtn.disabled = currentStep === 0;
        nextBtn.textContent = currentStep === steps.length - 1 ? 'Get Started' : 'Next';
    }

    function commitCurrentStep() {
        const step = steps[currentStep];
        const body = overlayEl.querySelector('.ob-body');
        if (step.commit) step.commit(draftSettings, body);
    }

    async function finishOnboarding() {
        commitCurrentStep();
        try {
            await saveSettings(draftSettings);
            if (typeof applySettingsToUI === 'function') {
                applySettingsToUI(draftSettings);
            }
        } catch (e) {
            console.error('[Onboarding] Failed to save settings:', e);
        }
        markOnboardingComplete();
        closeOverlay();
    }

    function closeOverlay() {
        if (!overlayEl) return;
        overlayEl.style.opacity = '0';
        overlayEl.style.transition = 'opacity 0.2s ease';
        setTimeout(() => {
            if (overlayEl && overlayEl.parentNode) {
                overlayEl.remove();
            }
            overlayEl = null;
        }, 200);
    }

    async function buildOverlay() {
        try {
            draftSettings = await loadSettings();
        } catch (e) {
            console.warn('[Onboarding] Failed to load settings, using defaults:', e);
            draftSettings = {};
        }
        currentStep = 0;

        overlayEl = document.createElement('div');
        overlayEl.id = 'onboardingOverlay';
        overlayEl.innerHTML = `
            <div class="ob-box">
                <div class="ob-header">
                    <span class="ob-title"></span>
                    <button class="ob-skip" id="obSkipBtn">Skip setup</button>
                </div>
                <div class="ob-body"></div>
                <div class="ob-footer">
                    <div class="ob-dots"></div>
                    <div class="ob-btns">
                        <button class="ob-btn" id="obBackBtn">Back</button>
                        <button class="ob-btn primary" id="obNextBtn">Next</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlayEl);

        overlayEl.querySelector('#obSkipBtn').addEventListener('click', () => {
            markOnboardingComplete();
            closeOverlay();
        });

        overlayEl.querySelector('#obBackBtn').addEventListener('click', () => {
            if (currentStep === 0) return;
            commitCurrentStep();
            currentStep--;
            renderStep();
        });

        overlayEl.querySelector('#obNextBtn').addEventListener('click', async () => {
            commitCurrentStep();
            if (currentStep === steps.length - 1) {
                await finishOnboarding();
                return;
            }
            currentStep++;
            renderStep();
        });

        renderStep();
    }

    function startOnboarding() {
        if (typeof loadSettings !== 'function' || typeof saveSettings !== 'function') {
            console.warn('[Onboarding] loadSettings/saveSettings not found — make sure MoreSplach.js is loaded before onboarding.js');
            if (typeof loadSettings === 'undefined') {
                window.loadSettings = function() { return {}; };
            }
            if (typeof saveSettings === 'undefined') {
                window.saveSettings = function() { return Promise.resolve(); };
            }
            if (typeof formatKeybindDisplay === 'undefined') {
                window.formatKeybindDisplay = function(key) { return key; };
            }
        }
        
        if (!shouldShowOnboarding()) return;
        injectStyles();
        buildOverlay();
    }

    window.resetOnboarding = function () {
        localStorage.removeItem(ONBOARD_FLAG);
        console.log('[Onboarding] Flag cleared, reload the window to see it again.');
    };

    function initOnboarding() {
        setTimeout(startOnboarding, 400);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOnboarding);
    } else {
        initOnboarding();
    }

})();