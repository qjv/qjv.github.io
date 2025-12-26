/**
 * GW2 Armory Embeds - Data Fetcher
 * Handles fetching and caching data from GW2 API
 */

(function(window) {
    'use strict';

    class DataFetcher {
        constructor(config) {
            this.config = config;
            this.apiBase = config.api.base;
            this.cacheEnabled = config.cache.enabled;
            this.cachePrefix = config.cache.prefix;
            this.cacheDuration = config.cache.duration;
            this.lang = config.lang;
            this.pendingRequests = new Map(); // Prevent duplicate requests
        }

        /**
         * Get cache key for a type and ID
         */
        getCacheKey(type, id) {
            return `${this.cachePrefix}${type}_${id}_${this.lang}`;
        }

        /**
         * Get data from cache
         */
        getFromCache(type, id) {
            if (!this.cacheEnabled) return null;

            try {
                const key = this.getCacheKey(type, id);
                const cached = localStorage.getItem(key);

                if (!cached) return null;

                const data = JSON.parse(cached);
                const now = Date.now();

                // Check if cache is expired
                if (now - data.timestamp > this.cacheDuration) {
                    localStorage.removeItem(key);
                    return null;
                }

                this.log(`Cache hit: ${type}/${id}`);
                return data.value;
            } catch (error) {
                this.log(`Cache read error: ${error.message}`, 'error');
                return null;
            }
        }

        /**
         * Save data to cache
         */
        saveToCache(type, id, value) {
            if (!this.cacheEnabled) return;

            try {
                const key = this.getCacheKey(type, id);
                const data = {
                    value: value,
                    timestamp: Date.now()
                };
                localStorage.setItem(key, JSON.stringify(data));
                this.log(`Cached: ${type}/${id}`);
            } catch (error) {
                // Quota exceeded or other error - just log it
                this.log(`Cache write error: ${error.message}`, 'error');
            }
        }

        /**
         * Fetch single item from API
         */
        async fetchSingle(type, id) {
            const cached = this.getFromCache(type, id);
            if (cached) return cached;

            // Check if there's already a pending request for this
            const requestKey = `${type}_${id}`;
            if (this.pendingRequests.has(requestKey)) {
                return this.pendingRequests.get(requestKey);
            }

            const url = `${this.apiBase}/${type}/${id}?lang=${this.lang}`;
            this.log(`Fetching: ${url}`);

            const promise = fetch(url, { timeout: this.config.api.timeout })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    this.saveToCache(type, id, data);
                    this.pendingRequests.delete(requestKey);
                    return data;
                })
                .catch(error => {
                    this.log(`Fetch error ${type}/${id}: ${error.message}`, 'error');
                    this.pendingRequests.delete(requestKey);
                    throw error;
                });

            this.pendingRequests.set(requestKey, promise);
            return promise;
        }

        /**
         * Fetch multiple items from API (batch)
         */
        async fetchBatch(type, ids) {
            // Filter out IDs we already have cached
            const uncachedIds = [];
            const cachedData = {};

            ids.forEach(id => {
                const cached = this.getFromCache(type, id);
                if (cached) {
                    cachedData[id] = cached;
                } else {
                    uncachedIds.push(id);
                }
            });

            if (uncachedIds.length === 0) {
                this.log(`All ${ids.length} ${type} from cache`);
                return cachedData;
            }

            // Batch API request for uncached items
            const url = `${this.apiBase}/${type}?ids=${uncachedIds.join(',')}&lang=${this.lang}`;
            this.log(`Batch fetching ${uncachedIds.length} ${type}`);

            try {
                const response = await fetch(url, { timeout: this.config.api.timeout });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                // Cache each item individually
                data.forEach(item => {
                    this.saveToCache(type, item.id, item);
                    cachedData[item.id] = item;
                });

                this.log(`Fetched ${data.length} ${type}`, 'success');
                return cachedData;
            } catch (error) {
                this.log(`Batch fetch error ${type}: ${error.message}`, 'error');
                throw error;
            }
        }

        /**
         * Get items by IDs
         */
        async getItems(ids) {
            if (ids.length === 1) {
                const data = await this.fetchSingle('items', ids[0]);
                return { [ids[0]]: data };
            }
            return this.fetchBatch('items', ids);
        }

        /**
         * Get skills by IDs
         */
        async getSkills(ids) {
            if (ids.length === 1) {
                const data = await this.fetchSingle('skills', ids[0]);
                return { [ids[0]]: data };
            }
            return this.fetchBatch('skills', ids);
        }

        /**
         * Get traits by IDs
         */
        async getTraits(ids) {
            if (ids.length === 1) {
                const data = await this.fetchSingle('traits', ids[0]);
                return { [ids[0]]: data };
            }
            return this.fetchBatch('traits', ids);
        }

        /**
         * Get specializations by IDs
         */
        async getSpecializations(ids) {
            if (ids.length === 1) {
                const data = await this.fetchSingle('specializations', ids[0]);
                return { [ids[0]]: data };
            }
            return this.fetchBatch('specializations', ids);
        }

        /**
         * Resolve palette IDs to skill IDs
         * Uses professions API with v=latest to get skills_by_palette mapping
         */
        async resolvePaletteIds(paletteIds, professionId) {
            try {
                this.log(`Resolving ${paletteIds.length} palette IDs for profession ${professionId}: ${paletteIds.join(', ')}`);

                // Fetch profession data to get skills_by_palette
                // v=latest is required to get the skills_by_palette field
                const url = `${this.apiBase}/professions/${professionId}?v=latest&lang=${this.lang}`;
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const profession = await response.json();
                this.log(`Fetched profession ${professionId}, has skills_by_palette: ${!!profession.skills_by_palette}`);

                const resolved = {};

                if (!profession.skills_by_palette) {
                    this.log(`Profession ${professionId} has no skills_by_palette field`, 'error');
                    // Fallback to palette ID = skill ID
                    paletteIds.forEach(pid => resolved[pid] = pid > 0 ? pid : null);
                    return resolved;
                }

                // Debug: log first few entries
                if (profession.skills_by_palette.length > 0) {
                    this.log(`Sample palette entries: ${JSON.stringify(profession.skills_by_palette.slice(0, 3))}`);
                }

                // Map palette IDs to skill IDs using profession's palette mapping
                // skills_by_palette is an array of [paletteId, skillId] pairs
                paletteIds.forEach(paletteId => {
                    if (paletteId === 0) {
                        resolved[paletteId] = null;
                        return;
                    }

                    // Find the [paletteId, skillId] pair in the mapping
                    const entry = profession.skills_by_palette.find(pair =>
                        Array.isArray(pair) && pair[0] === paletteId
                    );

                    if (entry && entry[1]) {
                        resolved[paletteId] = entry[1];
                        this.log(`Palette ${paletteId} → Skill ${entry[1]}`);
                    } else {
                        // Fallback: try using palette ID as skill ID
                        resolved[paletteId] = paletteId;
                        this.log(`Palette ${paletteId} not in mapping, using as skill ID (fallback)`);
                    }
                });

                return resolved;
            } catch (error) {
                this.log(`Palette resolution error: ${error.message}`, 'error');
                // Return palette IDs as-is as fallback
                const resolved = {};
                paletteIds.forEach(pid => resolved[pid] = pid > 0 ? pid : null);
                return resolved;
            }
        }

        /**
         * Get pets by IDs
         */
        async getPets(ids) {
            if (ids.length === 1) {
                const data = await this.fetchSingle('pets', ids[0]);
                return { [ids[0]]: data };
            }
            return this.fetchBatch('pets', ids);
        }

        /**
         * Get amulets by IDs
         */
        async getAmulets(ids) {
            if (ids.length === 1) {
                const data = await this.fetchSingle('pvp/amulets', ids[0]);
                return { [ids[0]]: data };
            }
            return this.fetchBatch('pvp/amulets', ids);
        }

        /**
         * Clear all cache for this library
         */
        clearCache() {
            try {
                const keys = Object.keys(localStorage);
                const removed = keys.filter(k => k.startsWith(this.cachePrefix));
                removed.forEach(k => localStorage.removeItem(k));
                this.log(`Cleared ${removed.length} cache entries`, 'success');
                return removed.length;
            } catch (error) {
                this.log(`Cache clear error: ${error.message}`, 'error');
                return 0;
            }
        }

        /**
         * Get cache statistics
         */
        getCacheStats() {
            try {
                const keys = Object.keys(localStorage);
                const cacheKeys = keys.filter(k => k.startsWith(this.cachePrefix));
                return {
                    entries: cacheKeys.length,
                    totalSize: cacheKeys.reduce((size, key) => {
                        return size + (localStorage.getItem(key)?.length || 0);
                    }, 0)
                };
            } catch (error) {
                return { entries: 0, totalSize: 0 };
            }
        }

        /**
         * Logger
         */
        log(message, type = 'info') {
            if (window.GW2Armory && window.GW2Armory.log) {
                window.GW2Armory.log(`[DataFetcher] ${message}`, type);
            }
        }
    }

    // Export to global scope
    window.DataFetcher = DataFetcher;

})(window);
