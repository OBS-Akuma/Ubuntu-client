// Wait for DOM and TradeLogs to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for TradeLogs to be defined
    function waitForTradeLogs() {
        if (typeof window.TradeLogs !== 'undefined' && window.TradeLogs !== null) {
            console.log('[TradeLogs] Ready to load trades');
            setupTradeLogs();
        } else {
            console.log('[TradeLogs] Waiting for TradeLogs to load...');
            setTimeout(waitForTradeLogs, 100);
        }
    }
    
    function setupTradeLogs() {
        const TradeLogs = window.TradeLogs;
        
        // Listen for account switch events
        document.addEventListener('account-switched', function(e) {
            console.log('[TradeLogs] Account switched detected! Clearing cache...');
            TradeLogs.clearCache();
            // Force reload if tradelogs tab is active
            if (document.getElementById('tradelogs-tab')?.classList.contains('active')) {
                console.log('[TradeLogs] Reloading trades for new account...');
                setTimeout(loadTradeLogs, 300);
            }
        });
        
        // Listen for token updates
        if (window.ipcRenderer) {
            window.ipcRenderer.on('token-updated', function() {
                console.log('[TradeLogs] Token updated, clearing cache...');
                TradeLogs.clearCache();
                if (document.getElementById('tradelogs-tab')?.classList.contains('active')) {
                    setTimeout(loadTradeLogs, 300);
                }
            });
            
            window.ipcRenderer.on('accounts-updated', function() {
                console.log('[TradeLogs] Accounts updated, clearing cache...');
                TradeLogs.clearCache();
                if (document.getElementById('tradelogs-tab')?.classList.contains('active')) {
                    setTimeout(loadTradeLogs, 300);
                }
            });
        }
        
        async function loadTradeLogs() {
            const tradeGrid = document.getElementById('TradeGrid');
            if (!tradeGrid) return;
            
            tradeGrid.innerHTML = '<div class="no-results"><i class="fas fa-spinner fa-pulse"></i> Loading trades...</div>';
            
            try {
                // Clear cache before loading to ensure fresh data
                TradeLogs.clearCache();
                
                const user = await TradeLogs.getActiveUser();
                const userInfoEl = document.getElementById('tradeUserInfo');
                
                if (!user) {
                    userInfoEl.innerHTML = `
                        <div class="user-info-loaded" style="color:var(--text-muted);">
                            <i class="fas fa-user-circle" style="font-size:1.5rem;opacity:0.4;"></i>
                            <span>No active account found. Please log in to view trade history.</span>
                        </div>
                    `;
                    document.getElementById('tradeStats').style.display = 'none';
                    document.getElementById('tradeTopItems').style.display = 'none';
                    tradeGrid.innerHTML = `
                        <div class="no-trades">
                            <i class="fas fa-handshake"></i>
                            <p>Log in to see your trade history</p>
                        </div>
                    `;
                    return;
                }

                userInfoEl.innerHTML = `
                    <div class="user-info-loaded">
                        <div class="user-details">
                            <div>
                                <div class="user-name-large">${user.fullName}</div>
                            </div>
                        </div>
                    </div>
                `;

                const trades = await TradeLogs.getActiveUserTrades(25);
                
                if (!trades || trades.length === 0) {
                    tradeGrid.innerHTML = `
                        <div class="no-trades">
                            <i class="fas fa-exchange-alt"></i>
                            <p>No trades found for ${user.fullName}</p>
                            <p style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">Start trading to see your history here!</p>
                        </div>
                    `;
                    document.getElementById('tradeStats').style.display = 'none';
                    document.getElementById('tradeTopItems').style.display = 'none';
                    return;
                }

                const stats = await TradeLogs.getActiveUserStatistics(7);
                
                if (stats) {
                    document.getElementById('tradeStats').style.display = 'block';
                    document.getElementById('statTotalTrades').textContent = stats.totalTrades;
                    document.getElementById('statAsOfferer').textContent = stats.tradesAsOfferer;
                    document.getElementById('statAsAccepter').textContent = stats.tradesAsAccepter;
                    document.getElementById('statAvgRatio').textContent = stats.averageRatio.toFixed(2);
                    document.getElementById('statBestRatio').textContent = stats.bestRatio.toFixed(2);
                    
                    document.getElementById('tradeTopItems').style.display = 'block';
                    
                    const offeredEl = document.getElementById('topItemsOffered');
                    const wantedEl = document.getElementById('topItemsWanted');
                    
                    offeredEl.innerHTML = Object.entries(stats.topItemsOffered || {})
                        .slice(0, 5)
                        .map(([name, count]) => 
                            `<div class="top-item"><span class="item-name">${name}</span><span class="item-count">×${count}</span></div>`
                        ).join('') || '<div class="top-item" style="color:var(--text-muted);font-size:0.7rem;">No items</div>';
                    
                    wantedEl.innerHTML = Object.entries(stats.topItemsWanted || {})
                        .slice(0, 5)
                        .map(([name, count]) => 
                            `<div class="top-item"><span class="item-name">${name}</span><span class="item-count">×${count}</span></div>`
                        ).join('') || '<div class="top-item" style="color:var(--text-muted);font-size:0.7rem;">No items</div>';
                }

                let html = '';
                const shortId = user.shortId || user.tag;
                
                for (const trade of trades) {
                    const formatted = TradeLogs.formatTrade(trade, shortId);
                    const isOfferer = formatted.isOfferer;
                    
                    html += `
                        <div class="trade-item ${isOfferer ? 'trade-offerer' : 'trade-accepter'}">
                            <div class="trade-header">
                                <span class="trade-id">#${formatted.id}</span>
                                <span class="trade-time">${formatted.timestamp}</span>
                                <span class="trade-role">${isOfferer ? '📤 Offered' : '📥 Received'}</span>
                            </div>
                            <div class="trade-details">
                                <span class="trade-offerer">${formatted.offerer}</span>
                                <span class="trade-arrow">→</span>
                                <span class="trade-accepter">${formatted.accepter}</span>
                            </div>
                            <div class="trade-items">
                                <div class="trade-offered">
                                    <span class="item-label">Offered:</span>
                                    ${formatted.offeredItems.map(item => 
                                        `<span class="item-tag">${item.name} ×${item.quantity}</span>`
                                    ).join('')}
                                    <span class="item-total">(${formatted.offeredTotal})</span>
                                </div>
                                <div class="trade-wanted">
                                    <span class="item-label">Wanted:</span>
                                    ${formatted.wantedItems.map(item => 
                                        `<span class="item-tag">${item.name} ×${item.quantity}</span>`
                                    ).join('')}
                                    <span class="item-total">(${formatted.wantedTotal})</span>
                                </div>
                            </div>
                            <div class="trade-values">
                                <span>Ratio: ${formatted.ratio.toFixed(2)}</span>
                                <span>Diff: ${formatted.difference}</span>
                            </div>
                        </div>
                    `;
                }
                
                tradeGrid.innerHTML = html;
                
            } catch (error) {
                console.error('[TradeLogs] Error loading trades:', error);
                tradeGrid.innerHTML = `
                    <div class="no-trades">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Failed to load trades</p>
                        <p style="font-size:0.7rem;color:var(--text-muted);">${error.message}</p>
                    </div>
                `;
            }
        }

        document.querySelector('[data-tab="tradelogs"]')?.addEventListener('click', () => {
            setTimeout(loadTradeLogs, 100);
        });

        document.getElementById('refreshTradesBtn')?.addEventListener('click', loadTradeLogs);

        if (document.getElementById('tradelogs-tab')?.classList.contains('active')) {
            loadTradeLogs();
        }

        const observer = new MutationObserver(() => {
            if (document.getElementById('tradelogs-tab')?.classList.contains('active')) {
                loadTradeLogs();
            }
        });
        observer.observe(document.getElementById('tradelogs-tab'), { attributes: true, attributeFilter: ['class'] });
    }
    
    waitForTradeLogs();
});