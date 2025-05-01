/**
 * LRU (Least Recently Used) Cache Implementation
 * Provides efficient caching with automatic expiration of old items
 */

interface CacheItem<T> {
  value: T;
  timestamp: number;
}

export class LRUCache<K extends string, V> {
  private cache: Map<K, CacheItem<V>>;
  private readonly maxSize: number;
  private readonly ttl: number;

  /**
   * Create a new LRU cache
   * @param maxSize Maximum number of items to store
   * @param ttl Time to live in milliseconds (default: 5 minutes)
   */
  constructor(maxSize: number, ttl: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Get a value from the cache
   * @param key The cache key
   * @returns The cached value or undefined if not found or expired
   */
  get(key: K): V | undefined {
    const item = this.cache.get(key);
    
    // Return undefined if item doesn't exist
    if (!item) {
      return undefined;
    }
    
    // Check if the item has expired
    const now = Date.now();
    if (now - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Update the item's position in the cache (mark as recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  /**
   * Add or update a value in the cache
   * @param key The cache key
   * @param value The value to cache
   */
  set(key: K, value: V): void {
    // Remove the oldest entry if we're at capacity
    if (this.cache.size >= this.maxSize) {
      // Get the first key (oldest) from the map
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    // Add the new item
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Remove a value from the cache
   * @param key The cache key
   * @returns True if the item was found and removed
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of items in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if the cache contains a non-expired item with the given key
   * @param key The cache key
   */
  has(key: K): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }
    
    // Check expiration
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clean up expired entries from the cache
   * @returns Number of entries removed
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Get all valid (non-expired) keys in the cache
   */
  keys(): K[] {
    this.cleanup(); // Remove expired entries
    return Array.from(this.cache.keys());
  }

  /**
   * Get all valid (non-expired) values in the cache
   */
  values(): V[] {
    this.cleanup(); // Remove expired entries
    return Array.from(this.cache.values()).map(item => item.value);
  }
}