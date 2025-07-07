import { EmailMetadata, EmailMessage } from '../types';

export class PerformanceOptimizer {
  private static readonly MAX_CONCURRENT_OPERATIONS = 5;
  private static readonly BATCH_SIZE = 10;
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Batch process emails in chunks to avoid memory issues
   */
  static async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = this.BATCH_SIZE
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Process operations with concurrency limit
   */
  static async processWithLimit<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    limit: number = this.MAX_CONCURRENT_OPERATIONS
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += limit) {
      const batch = items.slice(i, i + limit);
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Optimize email metadata for transfer (remove large fields)
   */
  static optimizeEmailMetadata(email: EmailMetadata): EmailMetadata {
    const optimized = { ...email };
    
    // Remove or truncate large fields
    if (optimized.subject && optimized.subject.length > 200) {
      optimized.subject = optimized.subject.substring(0, 200) + '...';
    }
    
    return optimized;
  }

  /**
   * Optimize email message for transfer
   */
  static optimizeEmailMessage(email: EmailMessage, includeFullBody: boolean = false): EmailMessage {
    const optimized = { ...email };
    
    if (!includeFullBody) {
      // Truncate body for list views
      if (optimized.body && optimized.body.length > 500) {
        optimized.body = optimized.body.substring(0, 500) + '...';
      }
      
      if (optimized.htmlBody && optimized.htmlBody.length > 1000) {
        optimized.htmlBody = optimized.htmlBody.substring(0, 1000) + '...';
      }
      
      // Remove large attachments content for list views
      if (optimized.attachments) {
        optimized.attachments = optimized.attachments.map(att => ({
          ...att,
          content: Buffer.alloc(0), // Use empty buffer instead of undefined
        }));
      }
    }
    
    return optimized;
  }

  /**
   * Create a debounced function
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        func(...args);
      }, wait);
    };
  }

  /**
   * Create a throttled function
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Memory usage monitor
   */
  static getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
    warning: boolean;
  } {
    const usage = process.memoryUsage();
    const totalHeap = usage.heapTotal;
    const usedHeap = usage.heapUsed;
    const percentage = (usedHeap / totalHeap) * 100;
    
    return {
      used: Math.round(usedHeap / 1024 / 1024), // MB
      total: Math.round(totalHeap / 1024 / 1024), // MB
      percentage: Math.round(percentage),
      warning: percentage > 80,
    };
  }

  /**
   * Cleanup old cache entries
   */
  static cleanupCache(cache: Map<string, any>, maxAge: number = this.CACHE_TTL * 1000): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, value] of cache.entries()) {
      if (value.timestamp && (now - value.timestamp) > maxAge) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => cache.delete(key));
  }

  /**
   * Estimate response size
   */
  static estimateResponseSize(data: any): {
    sizeBytes: number;
    sizeMB: number;
    shouldCompress: boolean;
  } {
    const jsonString = JSON.stringify(data);
    const sizeBytes = Buffer.byteLength(jsonString, 'utf8');
    const sizeMB = sizeBytes / (1024 * 1024);
    
    return {
      sizeBytes,
      sizeMB: Math.round(sizeMB * 100) / 100,
      shouldCompress: sizeBytes > 1024, // Compress if > 1KB
    };
  }

  /**
   * Smart pagination based on response size
   */
  static calculateOptimalPageSize(
    estimatedItemSize: number,
    targetResponseSizeKB: number = 100
  ): number {
    const targetSizeBytes = targetResponseSizeKB * 1024;
    const optimalPageSize = Math.floor(targetSizeBytes / estimatedItemSize);
    
    // Ensure reasonable bounds
    return Math.max(5, Math.min(100, optimalPageSize));
  }

  /**
   * Connection pool manager for IMAP connections
   */
  static createConnectionPool<T>(
    createConnection: () => Promise<T>,
    destroyConnection: (conn: T) => Promise<void>,
    maxSize: number = 3
  ) {
    const pool: T[] = [];
    const inUse = new Set<T>();
    
    return {
      async acquire(): Promise<T> {
        // Try to get from pool
        const connection = pool.pop();
        if (connection) {
          inUse.add(connection);
          return connection;
        }
        
        // Create new connection if pool is empty and under limit
        if (inUse.size < maxSize) {
          const newConnection = await createConnection();
          inUse.add(newConnection);
          return newConnection;
        }
        
        // Wait for a connection to become available
        throw new Error('Connection pool exhausted');
      },
      
      async release(connection: T): Promise<void> {
        inUse.delete(connection);
        
        // Return to pool if not at capacity
        if (pool.length < maxSize) {
          pool.push(connection);
        } else {
          // Destroy excess connections
          await destroyConnection(connection);
        }
      },
      
      async destroy(): Promise<void> {
        // Destroy all connections
        const allConnections = [...pool, ...inUse];
        await Promise.all(
          allConnections.map(conn => destroyConnection(conn))
        );
        pool.length = 0;
        inUse.clear();
      },
      
      getStats() {
        return {
          poolSize: pool.length,
          inUse: inUse.size,
          total: pool.length + inUse.size,
        };
      }
    };
  }

  /**
   * Retry mechanism with exponential backoff
   */
  static async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Request deduplication
   */
  static createDeduplicator<T>() {
    const pending = new Map<string, Promise<T>>();
    
    return {
      async dedupe(key: string, operation: () => Promise<T>): Promise<T> {
        // If request is already pending, return the existing promise
        if (pending.has(key)) {
          return pending.get(key)!;
        }
        
        // Start new operation
        const promise = operation().finally(() => {
          pending.delete(key);
        });
        
        pending.set(key, promise);
        return promise;
      },
      
      clear(): void {
        pending.clear();
      }
    };
  }

  /**
   * Email preview optimization with content extraction
   */
  static extractEmailPreview(email: EmailMessage, maxLength: number = 150): string {
    let content = '';
    
    // Prefer text body for preview
    if (email.textBody) {
      content = email.textBody;
    } else if (email.htmlBody) {
      // Strip HTML tags for preview
      content = this.stripHtmlTags(email.htmlBody);
    } else if (email.body) {
      content = email.body;
    }
    
    // Clean up whitespace and extract preview
    content = content
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, maxLength);
    
    return content || email.subject || 'No preview available';
  }

  /**
   * Strip HTML tags for plain text extraction
   */
  private static stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&lt;/g, '<')  // Replace HTML entities
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * Intelligent caching strategy based on email characteristics
   */
  static calculateCacheTTL(email: EmailMetadata): number {
    let baseTTL = 30 * 60; // 30 minutes default
    
    // Reduce TTL for recent emails (they might change)
    const emailAge = Date.now() - new Date(email.date).getTime();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (emailAge < dayInMs) {
      baseTTL = 10 * 60; // 10 minutes for recent emails
    } else if (emailAge < 7 * dayInMs) {
      baseTTL = 60 * 60; // 1 hour for week-old emails
    } else {
      baseTTL = 4 * 60 * 60; // 4 hours for older emails
    }
    
    // Reduce TTL for unread emails
    if (!email.isRead) {
      baseTTL = Math.max(baseTTL / 2, 5 * 60); // At least 5 minutes
    }
    
    return baseTTL;
  }

  /**
   * Batch email metadata optimization
   */
  static optimizeEmailBatch(emails: EmailMetadata[]): EmailMetadata[] {
    return emails.map(email => {
      const optimized = this.optimizeEmailMetadata(email);
      
      // Add computed preview if not present
      if (!(optimized as any).preview && email.subject) {
        (optimized as any).preview = email.subject.substring(0, 100);
      }
      
      return optimized;
    });
  }

  /**
   * Smart prefetching based on user behavior patterns
   */
  static createPrefetchManager() {
    const accessPatterns = new Map<string, number[]>();
    const MAX_PATTERN_HISTORY = 50;
    
    return {
      recordAccess(emailUid: string): void {
        const now = Date.now();
        const pattern = accessPatterns.get(emailUid) || [];
        
        pattern.push(now);
        
        // Keep only recent access patterns
        if (pattern.length > MAX_PATTERN_HISTORY) {
          pattern.splice(0, pattern.length - MAX_PATTERN_HISTORY);
        }
        
        accessPatterns.set(emailUid, pattern);
      },
      
      getPrefetchCandidates(currentEmailUid: string, allEmails: EmailMetadata[]): string[] {
        const candidates: Array<{ uid: string; score: number }> = [];
        
        allEmails.forEach(email => {
          if (email.uid === currentEmailUid) return;
          
          let score = 0;
          
          // Score based on access frequency
          const pattern = accessPatterns.get(email.uid);
          if (pattern) {
            score += pattern.length * 2;
          }
          
          // Score based on email characteristics
          if (!email.isRead) score += 10;
          if (email.hasAttachments) score += 5;
          if (email.isStarred) score += 15;
          
          // Score based on recency
          const emailAge = Date.now() - new Date(email.date).getTime();
          const dayInMs = 24 * 60 * 60 * 1000;
          if (emailAge < dayInMs) score += 8;
          else if (emailAge < 7 * dayInMs) score += 4;
          
          candidates.push({ uid: email.uid, score });
        });
        
        // Return top candidates
        return candidates
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(c => c.uid);
      },
      
      clearPatterns(): void {
        accessPatterns.clear();
      }
    };
  }

  /**
   * Performance monitoring and alerting
   */
  static createPerformanceMonitor() {
    const metrics = new Map<string, {
      count: number;
      totalTime: number;
      errors: number;
      lastRun: number;
    }>();
    
    return {
      startOperation(operationName: string): () => void {
        const startTime = Date.now();
        
        return () => {
          const duration = Date.now() - startTime;
          this.recordOperation(operationName, duration, false);
        };
      },
      
      recordOperation(operationName: string, duration: number, isError: boolean): void {
        const existing = metrics.get(operationName) || {
          count: 0,
          totalTime: 0,
          errors: 0,
          lastRun: 0
        };
        
        existing.count++;
        existing.totalTime += duration;
        existing.lastRun = Date.now();
        
        if (isError) {
          existing.errors++;
        }
        
        metrics.set(operationName, existing);
        
        // Log slow operations
        if (duration > 5000) { // 5 seconds
          console.warn(`🐌 Slow operation detected: ${operationName} took ${duration}ms`);
        }
      },
      
      getMetrics(): { [operation: string]: {
        averageTime: number;
        count: number;
        errorRate: number;
        lastRun: Date;
      } } {
        const result: any = {};
        
        for (const [operation, data] of metrics.entries()) {
          result[operation] = {
            averageTime: Math.round(data.totalTime / data.count),
            count: data.count,
            errorRate: Math.round((data.errors / data.count) * 100),
            lastRun: new Date(data.lastRun)
          };
        }
        
        return result;
      },
      
      getHealthScore(): {
        score: number;
        status: 'excellent' | 'good' | 'warning' | 'critical';
        issues: string[];
      } {
        const metricsData = this.getMetrics();
        let score = 100;
        const issues: string[] = [];
        
        Object.entries(metricsData).forEach(([operation, data]) => {
          if (data.errorRate > 10) {
            score -= 20;
            issues.push(`High error rate for ${operation}: ${data.errorRate}%`);
          }
          
          if (data.averageTime > 3000) {
            score -= 15;
            issues.push(`Slow performance for ${operation}: ${data.averageTime}ms average`);
          }
        });
        
        const memUsage = PerformanceOptimizer.getMemoryUsage();
        if (memUsage.percentage > 80) {
          score -= 25;
          issues.push(`High memory usage: ${memUsage.percentage}%`);
        }
        
        let status: 'excellent' | 'good' | 'warning' | 'critical';
        if (score >= 90) status = 'excellent';
        else if (score >= 70) status = 'good';
        else if (score >= 50) status = 'warning';
        else status = 'critical';
        
        return { score: Math.max(0, score), status, issues };
      },
      
      clearMetrics(): void {
        metrics.clear();
      }
    };
  }

  /**
   * Response compression and optimization
   */
  static optimizeResponse(data: any, options: {
    stripNullValues?: boolean;
    compressStrings?: boolean;
    maxDepth?: number;
  } = {}): any {
    const {
      stripNullValues = true,
      compressStrings = true,
      maxDepth = 10
    } = options;
    
    const optimize = (obj: any, depth: number = 0): any => {
      if (depth > maxDepth || obj === null || obj === undefined) {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(item => optimize(item, depth + 1));
      }
      
      if (typeof obj === 'object') {
        const optimized: any = {};
        
        Object.entries(obj).forEach(([key, value]) => {
          // Skip null/undefined values if requested
          if (stripNullValues && (value === null || value === undefined)) {
            return;
          }
          
          // Compress long strings
          if (compressStrings && typeof value === 'string' && value.length > 1000) {
            optimized[key] = value.substring(0, 997) + '...';
          } else {
            optimized[key] = optimize(value, depth + 1);
          }
        });
        
        return optimized;
      }
      
      return obj;
    };
    
    return optimize(data);
  }
}
