// Cache Service for Pilot App
// ============================
// Handles offline data storage and cache management

import {
  Airport,
  AirportOverview,
  PiRep,
  GroundTrack,
  SituationSummary,
  CachedData
} from '@/types';

const CACHE_PREFIX = 'pilot-app-';
const CACHE_VERSION = '1.0';

export interface CacheConfig {
  maxAge: number; // seconds
  key: string;
}

export const CACHE_CONFIGS = {
  airports: { key: 'airports', maxAge: 300 }, // 5 minutes
  airportOverview: { key: 'airport-overview', maxAge: 180 }, // 3 minutes
  pireps: { key: 'pireps', maxAge: 60 }, // 1 minute
  tracks: { key: 'tracks', maxAge: 120 }, // 2 minutes
  summary: { key: 'summary', maxAge: 180 }, // 3 minutes
} as const;

class CacheService {
  private getKey(baseKey: string, id?: string): string {
    const key = id ? `${baseKey}-${id}` : baseKey;
    return `${CACHE_PREFIX}${CACHE_VERSION}-${key}`;
  }

  private isExpired(cachedData: CachedData<unknown>): boolean {
    const now = new Date().getTime();
    const cacheTime = cachedData.timestamp.getTime();
    const maxAge = cachedData.maxAge * 1000; // convert to milliseconds

    return (now - cacheTime) > maxAge;
  }

  private serialize<T>(data: CachedData<T>): string {
    return JSON.stringify({
      ...data,
      timestamp: data.timestamp.toISOString(),
    });
  }

  private deserialize<T>(serialized: string): CachedData<T> | null {
    try {
      const parsed = JSON.parse(serialized);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };
    } catch (error) {
      console.error('Failed to deserialize cached data:', error);
      return null;
    }
  }

  /**
   * Store data in cache with expiration
   */
  set<T>(config: CacheConfig, data: T, id?: string): void {
    try {
      const key = this.getKey(config.key, id);
      const cachedData: CachedData<T> = {
        data,
        timestamp: new Date(),
        maxAge: config.maxAge,
        source: 'cache',
      };

      localStorage.setItem(key, this.serialize(cachedData));
    } catch (error) {
      console.error('Failed to cache data:', error);
      // Storage might be full, try to clear old entries
      this.cleanup();
    }
  }

  /**
   * Get data from cache if not expired
   */
  get<T>(config: CacheConfig, id?: string): CachedData<T> | null {
    try {
      const key = this.getKey(config.key, id);
      const serialized = localStorage.getItem(key);

      if (!serialized) return null;

      const cachedData = this.deserialize<T>(serialized);
      if (!cachedData) return null;

      if (this.isExpired(cachedData)) {
        localStorage.removeItem(key);
        return null;
      }

      return cachedData;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * Get data from cache even if expired (stale data)
   */
  getStale<T>(config: CacheConfig, id?: string): CachedData<T> | null {
    try {
      const key = this.getKey(config.key, id);
      const serialized = localStorage.getItem(key);

      if (!serialized) return null;

      const cachedData = this.deserialize<T>(serialized);
      if (!cachedData) return null;

      // Return data regardless of expiration
      return cachedData;
    } catch (error) {
      console.error('Failed to get stale cached data:', error);
      return null;
    }
  }

  /**
   * Get data age in seconds
   */
  getAge(config: CacheConfig, id?: string): number | null {
    const cachedData = this.get(config, id);
    if (!cachedData) return null;

    const now = new Date().getTime();
    const cacheTime = cachedData.timestamp.getTime();
    return Math.floor((now - cacheTime) / 1000);
  }

  /**
   * Check if cached data exists and is valid
   */
  isValid(config: CacheConfig, id?: string): boolean {
    const cachedData = this.get(config, id);
    return cachedData !== null;
  }

  /**
   * Clear specific cache entry
   */
  clear(config: CacheConfig, id?: string): void {
    try {
      const key = this.getKey(config.key, id);
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Clear all pilot app cache entries
   */
  clearAll(): void {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} cache entries`);
    } catch (error) {
      console.error('Failed to clear all cache:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanup(): void {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          const serialized = localStorage.getItem(key);
          if (serialized) {
            const cachedData = this.deserialize(serialized);
            if (cachedData && this.isExpired(cachedData)) {
              keysToRemove.push(key);
            }
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      if (keysToRemove.length > 0) {
        console.log(`Cleaned up ${keysToRemove.length} expired cache entries`);
      }
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    totalSize: string;
    entriesByType: Record<string, number>;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    let totalEntries = 0;
    let totalSize = 0;
    const entriesByType: Record<string, number> = {};
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          totalEntries++;
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += value.length;

            // Extract cache type from key
            const typeMatch = key.match(new RegExp(`^${CACHE_PREFIX}${CACHE_VERSION}-(.*?)(-|$)`));
            if (typeMatch) {
              const type = typeMatch[1];
              entriesByType[type] = (entriesByType[type] || 0) + 1;
            }

            // Track oldest/newest entries
            const cachedData = this.deserialize(value);
            if (cachedData) {
              if (!oldestEntry || cachedData.timestamp < oldestEntry) {
                oldestEntry = cachedData.timestamp;
              }
              if (!newestEntry || cachedData.timestamp > newestEntry) {
                newestEntry = cachedData.timestamp;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    }

    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
      return `${Math.round(bytes / (1024 * 1024))}MB`;
    };

    return {
      totalEntries,
      totalSize: formatSize(totalSize),
      entriesByType,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Export cache data for backup/debugging
   */
  exportCache(): Record<string, unknown> {
    const cache: Record<string, unknown> = {};

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            cache[key] = this.deserialize(value);
          }
        }
      }
    } catch (error) {
      console.error('Failed to export cache:', error);
    }

    return cache;
  }
}

export const cacheService = new CacheService();
