import NodeCache from 'node-cache';
import crypto from 'crypto';
import { query } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

const CACHE_TTL_MEMORY = parseInt(process.env.CACHE_TTL_MEMORY || '300', 10); // 5 min
const CACHE_TTL_DB = parseInt(process.env.CACHE_TTL_DB || '86400', 10); // 24 hours

// L1: In-memory cache (hot data, very fast)
const memoryCache = new NodeCache({
  stdTTL: CACHE_TTL_MEMORY,
  checkperiod: 60,
  useClones: false
});

/**
 * Generate a unique cache key from parameters
 */
export function generateCacheKey(
  apiSource: 'scb' | 'booli' | 'lantmateriet',
  endpoint: string,
  params: Record<string, any>
): string {
  const paramsString = JSON.stringify(params, Object.keys(params).sort());
  const hash = crypto
    .createHash('md5')
    .update(`${apiSource}:${endpoint}:${paramsString}`)
    .digest('hex');
  return `${apiSource}:${hash}`;
}

/**
 * Get data from cache (checks memory first, then database)
 */
export async function getFromCache<T>(cacheKey: string): Promise<T | null> {
  // L1: Check memory cache
  const memData = memoryCache.get<T>(cacheKey);
  if (memData) {
    console.log(`[Cache L1 HIT] ${cacheKey}`);
    return memData;
  }

  // L2: Check database cache
  try {
    const result = await query(
      `SELECT response_data, expires_at
       FROM api_cache
       WHERE cache_key = $1 AND expires_at > NOW()`,
      [cacheKey]
    );

    if (result.rows.length > 0) {
      const data = result.rows[0].response_data as T;
      console.log(`[Cache L2 HIT] ${cacheKey}`);

      // Promote to L1 cache
      memoryCache.set(cacheKey, data);
      return data;
    }
  } catch (error) {
    console.error('[Cache L2 ERROR]', error);
  }

  console.log(`[Cache MISS] ${cacheKey}`);
  return null;
}

/**
 * Store data in both memory and database cache
 */
export async function setInCache(
  cacheKey: string,
  apiSource: 'scb' | 'booli' | 'lantmateriet',
  data: any,
  ttlSeconds: number = CACHE_TTL_DB
): Promise<void> {
  // L1: Store in memory
  memoryCache.set(cacheKey, data, CACHE_TTL_MEMORY);

  // L2: Store in database
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await query(
      `INSERT INTO api_cache (cache_key, api_source, response_data, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cache_key)
       DO UPDATE SET
         response_data = EXCLUDED.response_data,
         expires_at = EXCLUDED.expires_at,
         created_at = NOW()`,
      [cacheKey, apiSource, JSON.stringify(data), expiresAt]
    );

    console.log(`[Cache WRITE] ${cacheKey} (TTL: ${ttlSeconds}s)`);
  } catch (error) {
    console.error('[Cache WRITE ERROR]', error);
  }
}

/**
 * Get or fetch data with automatic caching
 */
export async function getCachedOrFetch<T>(
  cacheKey: string,
  apiSource: 'scb' | 'booli' | 'lantmateriet',
  fetchFunction: () => Promise<T>,
  ttlSeconds: number = CACHE_TTL_DB
): Promise<T> {
  // Try cache first
  const cached = await getFromCache<T>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from API
  console.log(`[Cache FETCH] Calling API for ${cacheKey}`);
  const data = await fetchFunction();

  // Store in cache
  await setInCache(cacheKey, apiSource, data, ttlSeconds);

  return data;
}

/**
 * Invalidate cache for a specific key or pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  // L1: Clear from memory
  const keys = memoryCache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  memoryCache.del(matchingKeys);

  // L2: Delete from database
  try {
    await query(
      `DELETE FROM api_cache WHERE cache_key LIKE $1`,
      [`%${pattern}%`]
    );
    console.log(`[Cache INVALIDATE] Pattern: ${pattern}`);
  } catch (error) {
    console.error('[Cache INVALIDATE ERROR]', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    memory: {
      keys: memoryCache.keys().length,
      hits: memoryCache.getStats().hits,
      misses: memoryCache.getStats().misses,
      ksize: memoryCache.getStats().ksize,
      vsize: memoryCache.getStats().vsize
    }
  };
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  memoryCache.flushAll();
  await query('DELETE FROM api_cache');
  console.log('[Cache CLEAR] All caches cleared');
}

export default {
  generateCacheKey,
  getFromCache,
  setInCache,
  getCachedOrFetch,
  invalidateCache,
  getCacheStats,
  clearAllCaches
};
