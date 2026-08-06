// Trade Logs Module - For use in browser/renderer
(function() {
    'use strict';
    
    const { ipcRenderer } = require('electron');

    const TradeLogs = {
        BASE_URL: 'https://kirka.lukeskywalk.com/tradehistory',
        activeUser: null,
        currentShortId: null,
        tradeCache: null,
        cacheTime: null,
        cacheDuration: 60000, // 1 minute cache

        /**
         * Gets the active user from the token file with detailed logging
         */
        async getActiveUser() {
            try {
                console.log('[TradeLogs] ===== getActiveUser START =====');
                
                // Check if we already have the user and it hasn't changed
                if (this.activeUser) {
                    console.log('[TradeLogs] Using cached active user:', this.activeUser);
                    return this.activeUser;
                }

                console.log('[TradeLogs] Calling ipcRenderer.invoke("get-token")...');
                const result = await ipcRenderer.invoke('get-token');
                console.log('[TradeLogs] get-token result:', JSON.stringify(result, null, 2));
                
                if (!result.success || !result.token) {
                    console.log('[TradeLogs] No active token found - success:', result.success, 'token:', !!result.token);
                    return null;
                }

                let account = null;

                // Check if we have activeAccount directly from the handler
                if (result.activeAccount) {
                    console.log('[TradeLogs] Found activeAccount in result:', result.activeAccount);
                    account = result.activeAccount;
                } 
                // Fallback: check accounts array
                else if (result.accounts && Array.isArray(result.accounts) && result.accounts.length > 0) {
                    console.log('[TradeLogs] Looking for active account in accounts array:', result.accounts);
                    account = result.accounts.find(a => a.active === true);
                    if (!account) {
                        account = result.accounts[0];
                        console.log('[TradeLogs] No active account found, using first:', account);
                    }
                }
                // Ultimate fallback: try to parse the token as JSON
                else {
                    try {
                        console.log('[TradeLogs] Trying to parse token as JSON...');
                        const parsed = JSON.parse(result.token);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            account = parsed.find(a => a.active === true) || parsed[0];
                            console.log('[TradeLogs] Found account from parsed token:', account);
                        }
                    } catch (e) {
                        console.log('[TradeLogs] Token is not JSON, treating as raw token');
                    }
                }

                if (!account) {
                    console.log('[TradeLogs] No account found in any format');
                    return null;
                }

                // Set the active user
                this.activeUser = {
                    name: account.name || 'Unknown',
                    tag: account.tag || '',
                    userId: account.userId || '',
                    shortId: account.tag || '',
                    fullName: account.tag ? `${account.name}#${account.tag}` : (account.name || 'Unknown')
                };
                
                this.currentShortId = this.activeUser.shortId;
                console.log('[TradeLogs] ===== Active user SET =====');
                console.log('[TradeLogs] Name:', this.activeUser.name);
                console.log('[TradeLogs] Tag/ShortId:', this.activeUser.shortId);
                console.log('[TradeLogs] Full Name:', this.activeUser.fullName);
                console.log('[TradeLogs] UserId:', this.activeUser.userId);
                console.log('[TradeLogs] ================================');
                
                return this.activeUser;
            } catch (error) {
                console.error('[TradeLogs] Error getting active user:', error);
                console.error('[TradeLogs] Stack:', error.stack);
                return null;
            }
        },

        /**
         * Fetches daily trades from the API with logging
         */
        async fetchDailyTrades() {
            try {
                console.log('[TradeLogs] ===== fetchDailyTrades START =====');
                const url = `${this.BASE_URL}/dailyTrades.json`;
                console.log('[TradeLogs] Fetching URL:', url);
                
                const response = await fetch(url);
                console.log('[TradeLogs] Response status:', response.status);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('[TradeLogs] Fetched', data.length, 'trades from dailyTrades.json');
                console.log('[TradeLogs] First trade sample:', data.length > 0 ? JSON.stringify(data[0], null, 2) : 'No trades');
                
                return data;
            } catch (error) {
                console.error('[TradeLogs] Error fetching daily trades:', error);
                console.error('[TradeLogs] Stack:', error.stack);
                throw error;
            }
        },

        /**
         * Checks if a trade involves the user by ShortId with logging
         */
        isTradeForUser(trade, shortId) {
            if (!trade || !shortId) {
                console.log('[TradeLogs] isTradeForUser: trade or shortId is null');
                return false;
            }
            
            const offererMatch = trade.offerer && trade.offerer.toLowerCase().includes(shortId.toLowerCase());
            const accepterMatch = trade.accepter && trade.accepter.toLowerCase().includes(shortId.toLowerCase());
            
            if (offererMatch || accepterMatch) {
                console.log('[TradeLogs] Match found! ShortId:', shortId, 'Offerer:', trade.offerer, 'Accepter:', trade.accepter);
            }
            
            return offererMatch || accepterMatch;
        },

        /**
         * Gets trades for the active user by ShortId with detailed logging
         */
        async getActiveUserTrades(limit = 50) {
            try {
                console.log('[TradeLogs] ===== getActiveUserTrades START =====');
                console.log('[TradeLogs] Limit:', limit);
                
                // Get fresh user data every time to handle account switching
                this.activeUser = null; // Clear cache to force fresh fetch
                const user = await this.getActiveUser();
                
                if (!user) {
                    console.log('[TradeLogs] No active user found - cannot fetch trades');
                    return [];
                }

                console.log('[TradeLogs] Current user:', user.fullName, 'ShortId:', user.shortId);

                // Check if we should use cache (only if same user and within time limit)
                const now = Date.now();
                const useCache = this.tradeCache && 
                                this.currentShortId === user.shortId && 
                                (now - this.cacheTime) < this.cacheDuration;
                
                if (useCache) {
                    console.log('[TradeLogs] Using cached trades for user:', user.fullName);
                    console.log('[TradeLogs] Cache age:', Math.round((now - this.cacheTime) / 1000), 'seconds');
                    return this.tradeCache.slice(0, limit);
                }

                console.log('[TradeLogs] Fetching fresh trades for user:', user.fullName);
                const dailyTrades = await this.fetchDailyTrades();
                
                console.log('[TradeLogs] Filtering trades for ShortId:', user.shortId);
                const userTrades = dailyTrades.filter(trade => 
                    this.isTradeForUser(trade, user.shortId)
                );

                console.log('[TradeLogs] Found', userTrades.length, 'trades for user:', user.fullName);
                
                // Log the first few matches
                if (userTrades.length > 0) {
                    console.log('[TradeLogs] First 3 matching trades:');
                    userTrades.slice(0, 3).forEach((t, i) => {
                        console.log(`[TradeLogs]   ${i+1}. Offerer: ${t.offerer}, Accepter: ${t.accepter}, ID: ${t.tradeId}`);
                    });
                } else {
                    console.log('[TradeLogs] No matching trades found for ShortId:', user.shortId);
                    // Log some sample offerer/accepter values from the data
                    if (dailyTrades.length > 0) {
                        console.log('[TradeLogs] Sample offerers from data:', dailyTrades.slice(0, 5).map(t => t.offerer));
                        console.log('[TradeLogs] Sample accepters from data:', dailyTrades.slice(0, 5).map(t => t.accepter));
                    }
                }

                // Sort by receivedAt timestamp (newest first)
                userTrades.sort((a, b) => (b.receivedAt || 0) - (a.receivedAt || 0));
                
                // Update cache
                this.tradeCache = userTrades;
                this.cacheTime = now;
                this.currentShortId = user.shortId;
                
                console.log('[TradeLogs] ===== getActiveUserTrades END =====');
                console.log('[TradeLogs] Returning', Math.min(userTrades.length, limit), 'trades');
                
                return userTrades.slice(0, limit);
            } catch (error) {
                console.error('[TradeLogs] Error getting active user trades:', error);
                console.error('[TradeLogs] Stack:', error.stack);
                return [];
            }
        },

        /**
         * Gets trade statistics for the active user with logging
         */
        async getActiveUserStatistics(days = 7) {
            try {
                console.log('[TradeLogs] ===== getActiveUserStatistics START =====');
                console.log('[TradeLogs] Days:', days);
                
                // Get fresh user data
                this.activeUser = null;
                const user = await this.getActiveUser();
                
                if (!user) {
                    console.log('[TradeLogs] No active user found for statistics');
                    return null;
                }

                console.log('[TradeLogs] Generating statistics for:', user.fullName);
                
                // Get trades (use fresh data for stats)
                const trades = await this.getActiveUserTrades(1000); // Get more for stats
                console.log('[TradeLogs] Got', trades.length, 'trades for statistics');

                const stats = {
                    user: user.fullName,
                    shortId: user.shortId,
                    totalTrades: trades.length,
                    totalOffered: 0,
                    totalWanted: 0,
                    totalDifference: 0,
                    averageRatio: 0,
                    bestRatio: 0,
                    worstRatio: Infinity,
                    tradesAsOfferer: 0,
                    tradesAsAccepter: 0,
                    topItemsOffered: {},
                    topItemsWanted: {},
                    dailyActivity: {}
                };

                console.log('[TradeLogs] Processing', trades.length, 'trades for stats...');
                
                for (const trade of trades) {
                    const offeredTotal = trade.trade?.offered?.total || 0;
                    const wantedTotal = trade.trade?.wanted?.total || 0;
                    
                    stats.totalOffered += offeredTotal;
                    stats.totalWanted += wantedTotal;
                    stats.totalDifference += trade.difference || 0;

                    if (trade.apiRatio > stats.bestRatio) {
                        stats.bestRatio = trade.apiRatio;
                    }
                    if (trade.apiRatio < stats.worstRatio) {
                        stats.worstRatio = trade.apiRatio;
                    }

                    if (trade.offerer && trade.offerer.includes(user.shortId)) {
                        stats.tradesAsOfferer++;
                    } else if (trade.accepter && trade.accepter.includes(user.shortId)) {
                        stats.tradesAsAccepter++;
                    }

                    if (trade.trade?.offered?.items) {
                        for (const item of trade.trade.offered.items) {
                            if (item.name) {
                                stats.topItemsOffered[item.name] = (stats.topItemsOffered[item.name] || 0) + parseInt(item.quantity || 1);
                            }
                        }
                    }

                    if (trade.trade?.wanted?.items) {
                        for (const item of trade.trade.wanted.items) {
                            if (item.name) {
                                stats.topItemsWanted[item.name] = (stats.topItemsWanted[item.name] || 0) + parseInt(item.quantity || 1);
                            }
                        }
                    }

                    if (trade.receivedAt) {
                        const date = new Date(trade.receivedAt).toLocaleDateString();
                        stats.dailyActivity[date] = (stats.dailyActivity[date] || 0) + 1;
                    }
                }

                stats.averageRatio = trades.length > 0 ? 
                    trades.reduce((sum, t) => sum + (t.apiRatio || 0), 0) / trades.length : 0;
                stats.worstRatio = stats.worstRatio === Infinity ? 0 : stats.worstRatio;

                stats.topItemsOffered = Object.entries(stats.topItemsOffered)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .reduce((obj, [key, value]) => {
                        obj[key] = value;
                        return obj;
                    }, {});

                stats.topItemsWanted = Object.entries(stats.topItemsWanted)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .reduce((obj, [key, value]) => {
                        obj[key] = value;
                        return obj;
                    }, {});

                console.log('[TradeLogs] Statistics generated successfully:');
                console.log('[TradeLogs]   Total Trades:', stats.totalTrades);
                console.log('[TradeLogs]   As Offerer:', stats.tradesAsOfferer);
                console.log('[TradeLogs]   As Accepter:', stats.tradesAsAccepter);
                console.log('[TradeLogs]   Avg Ratio:', stats.averageRatio.toFixed(2));
                console.log('[TradeLogs]   Best Ratio:', stats.bestRatio);
                console.log('[TradeLogs]   Total Diff:', stats.totalDifference);
                
                return stats;
            } catch (error) {
                console.error('[TradeLogs] Error getting active user statistics:', error);
                console.error('[TradeLogs] Stack:', error.stack);
                return null;
            }
        },

        /**
         * Formats a trade for display with logging
         */
        formatTrade(trade, userShortId = null) {
            const isOfferer = userShortId && trade.offerer && trade.offerer.includes(userShortId);
            const isAccepter = userShortId && trade.accepter && trade.accepter.includes(userShortId);
            
            return {
                id: trade.tradeId || 'N/A',
                offerer: trade.offerer || 'Unknown',
                accepter: trade.accepter || 'Unknown',
                ratio: trade.apiRatio || 0,
                difference: trade.difference || 0,
                timestamp: trade.receivedAt ? new Date(trade.receivedAt).toLocaleString() : 'Unknown',
                offeredItems: trade.trade?.offered?.items || [],
                wantedItems: trade.trade?.wanted?.items || [],
                offeredTotal: trade.trade?.offered?.total || 0,
                wantedTotal: trade.trade?.wanted?.total || 0,
                isOfferer: isOfferer,
                isAccepter: isAccepter
            };
        },

        /**
         * Clears the cache to force fresh data on next fetch
         */
        clearCache() {
            console.log('[TradeLogs] Clearing cache');
            this.tradeCache = null;
            this.cacheTime = null;
            this.activeUser = null;
            this.currentShortId = null;
        },

        /**
         * Refreshes data for the current user
         */
        async refresh() {
            console.log('[TradeLogs] Manual refresh requested');
            this.clearCache();
            return await this.getActiveUserTrades(50);
        }
    };

    // Make it globally available
    window.TradeLogs = TradeLogs;
    console.log('[TradeLogs] Module loaded successfully');

    // Export for Node.js if needed
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TradeLogs;
    }
})();