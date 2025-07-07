import { createClient, RedisClientType } from 'redis';
import { CacheItem, CacheConfig, EmailMetadata, EmailMessage, EmailFolder } from '../types';

export class CacheService {
  private client: RedisClientType | null = null;
  private memoryCache: Map<string, CacheItem<any>> = new Map();
  private config: CacheConfig;
  private useRedis: boolean = false;

  constructor() {
    this.config = {
      emailTtl: 30 * 60, // 30 minutes
      listTtl: 5 * 60,   // 5 minutes
      folderTtl: 60 * 60, // 1 hour
      maxSize: 1000,      // Max items in memory cache
    };

    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env['REDIS_URL'];
      if (redisUrl) {
        this.client = createClient({ url: redisUrl });
        this.client.on('error', (err) => {
          console.warn('Redis Client Error:', err);
          this.useRedis = false;
        });
        
        await this.client.connect();
        this.useRedis = true;
        console.log('Redis cache initialized');
      } else {
        console.log('Using memory cache (Redis not configured)');
      }
    } catch (error) {
      console.warn('Failed to initialize Redis, falling back to memory cache:', error);
      this.useRedis = false;
    }
  }

  /**
   * Get cached item
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.useRedis && this.client) {
        const cached = await this.client.get(key);
        if (cached) {
          const item: CacheItem<T> = JSON.parse(cached);
          if (Date.now() - item.createdAt < item.ttl * 1000) {
            return item.value;
          } else {
            await this.client.del(key);
          }
        }
      } else {
        // Use memory cache
        const item = this.memoryCache.get(key) as CacheItem<T> | undefined;
        if (item && Date.now() - item.createdAt < item.ttl * 1000) {
          return item.value;
        } else if (item) {
          this.memoryCache.delete(key);
        }
      }
    } catch (error) {
      console.warn('Cache get error:', error);
    }
    return null;
  }

  /**
   * Set cached item
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const actualTtl = ttl || this.config.emailTtl;
    const item: CacheItem<T> = {
      key,
      value,
      ttl: actualTtl,
      createdAt: Date.now(),
    };

    try {
      if (this.useRedis && this.client) {
        await this.client.setEx(key, actualTtl, JSON.stringify(item));
      } else {
        // Use memory cache with size limit
        if (this.memoryCache.size >= this.config.maxSize) {
          // Remove oldest entries
          const entries = Array.from(this.memoryCache.entries());
          entries
            .sort((a, b) => a[1].createdAt - b[1].createdAt)
            .slice(0, Math.floor(this.config.maxSize * 0.1))
            .forEach(([key]) => this.memoryCache.delete(key));
        }
        this.memoryCache.set(key, item as CacheItem<any>);
      }
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  /**
   * Delete cached item
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.useRedis && this.client) {
        await this.client.del(key);
      } else {
        this.memoryCache.delete(key);
      }
    } catch (error) {
      console.warn('Cache delete error:', error);
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearPattern(pattern: string): Promise<void> {
    try {
      if (this.useRedis && this.client) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } else {
        // For memory cache, simple pattern matching
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const keysToDelete = Array.from(this.memoryCache.keys()).filter(key => 
          regex.test(key)
        );
        keysToDelete.forEach(key => this.memoryCache.delete(key));
      }
    } catch (error) {
      console.warn('Cache clear pattern error:', error);
    }
  }

  /**
   * Generate cache key
   */
  generateKey(prefix: string, params: Record<string, any>): string {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${Buffer.from(paramString).toString('base64')}`;
  }

  /**
   * Cache email list
   */
  async cacheEmailList(
    prefix: string, 
    params: Record<string, any>, 
    emails: EmailMetadata[]
  ): Promise<void> {
    const key = this.generateKey(`emails:${prefix}`, params);
    await this.set(key, emails, this.config.listTtl);
  }

  /**
   * Get cached email list
   */
  async getCachedEmailList(
    prefix: string, 
    params: Record<string, any>
  ): Promise<EmailMetadata[] | null> {
    const key = this.generateKey(`emails:${prefix}`, params);
    return await this.get<EmailMetadata[]>(key);
  }

  /**
   * Cache single email
   */
  async cacheEmail(uid: string, folder: string, email: EmailMessage): Promise<void> {
    const key = `email:${folder}:${uid}`;
    await this.set<EmailMessage>(key, email, this.config.emailTtl);
  }

  /**
   * Get cached email
   */
  async getCachedEmail(uid: string, folder: string): Promise<EmailMessage | null> {
    const key = `email:${folder}:${uid}`;
    return await this.get<EmailMessage>(key);
  }

  /**
   * Cache folders list
   */
  async cacheFolders(account: string, folders: EmailFolder[]): Promise<void> {
    const key = `folders:${account}`;
    await this.set<EmailFolder[]>(key, folders, this.config.folderTtl);
  }

  /**
   * Get cached folders
   */
  async getCachedFolders(account: string): Promise<EmailFolder[] | null> {
    const key = `folders:${account}`;
    return await this.get<EmailFolder[]>(key);
  }

  /**
   * Clear all caches for an account
   */
  async clearAccountCache(account: string): Promise<void> {
    await Promise.all([
      this.clearPattern(`emails:*${account}*`),
      this.clearPattern(`email:*${account}*`),
      this.clearPattern(`folders:${account}*`),
    ]);
  }

  /**
   * Disconnect from cache
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.useRedis = false;
    }
    this.memoryCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { type: string; size: number; memoryUsage?: number } {
    if (this.useRedis) {
      return { type: 'redis', size: -1 }; // Redis size would need separate query
    } else {
      return {
        type: 'memory',
        size: this.memoryCache.size,
        memoryUsage: JSON.stringify(Array.from(this.memoryCache.values())).length,
      };
    }
  }
}
