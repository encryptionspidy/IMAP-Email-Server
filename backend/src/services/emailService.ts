import { WorkingImapClient } from './workingImapClient';
import { CacheService } from './cacheService';
import { AiService } from './aiService';
import { 
  ImapConfig, 
  EmailFolder,
  EmailSearchQuery,
  EmailOperation,
  EmailOperationResponse,
  ListEmailsResponse,
  GetEmailResponse,
  EmailSummary,
  ImapConnectionError,
  EmailNotFoundError 
} from '../types';

export class EmailService {
  private imapClient: WorkingImapClient;
  private cacheService: CacheService;
  private aiService: AiService;
  private currentConfig: ImapConfig | null = null;

  constructor() {
    this.imapClient = new WorkingImapClient();
    this.cacheService = new CacheService();
    this.aiService = new AiService();
  }

  /**
   * Connect to IMAP server with caching
   */
  async connect(config: ImapConfig): Promise<void> {
    try {
      await this.imapClient.connect(config);
      this.currentConfig = config;
      console.log('✅ EmailService: Connected to IMAP server');
    } catch (error) {
      console.error('❌ EmailService: Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Disconnect from IMAP server
   */
  async disconnect(): Promise<void> {
    try {
      await this.imapClient.disconnect();
      await this.cacheService.disconnect();
      this.currentConfig = null;
      console.log('✅ EmailService: Disconnected');
    } catch (error) {
      console.warn('EmailService: Disconnect error:', error);
    }
  }

  /**
   * List emails with intelligent caching
   */
  async listEmails(
    folder: string = 'INBOX',
    limit: number = 50,
    offset: number = 0,
    sortOrder: 'asc' | 'desc' = 'desc',
    useCache: boolean = true
  ): Promise<ListEmailsResponse> {
    try {
      if (!this.currentConfig) {
        throw new ImapConnectionError('Not connected to IMAP server');
      }

      // Cache key generated automatically by cacheEmailList

      // Try cache first
      if (useCache) {
        const cached = await this.cacheService.getCachedEmailList('list', { 
          folder, 
          limit, 
          offset, 
          sortOrder,
          host: this.currentConfig.host,
          username: this.currentConfig.username 
        });
        
        if (cached) {
          console.log('📦 EmailService: Using cached email list');
          return {
            success: true,
            emails: cached,
            total: cached.length,
            hasMore: cached.length === limit
          };
        }
      }

      // Fetch from IMAP
      console.log('🔄 EmailService: Fetching emails from IMAP server');
      const result = await this.imapClient.listEmails(folder, limit, offset, sortOrder, true);
      
      // Cache the result
      if (useCache && result.emails.length > 0) {
        await this.cacheService.cacheEmailList('list', { 
          folder, 
          limit, 
          offset, 
          sortOrder,
          host: this.currentConfig.host,
          username: this.currentConfig.username 
        }, result.emails);
      }

      return {
        success: true,
        emails: result.emails,
        total: result.total,
        hasMore: result.hasMore
      };

    } catch (error) {
      console.error('❌ EmailService: Error listing emails:', error);
      return {
        success: false,
        emails: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Failed to list emails'
      };
    }
  }

  /**
   * Get single email with caching and AI enhancement
   */
  async getEmail(
    uid: string, 
    folder: string = 'INBOX',
    useCache: boolean = true,
    includeAiSummary: boolean = false
  ): Promise<GetEmailResponse> {
    try {
      if (!this.currentConfig) {
        throw new ImapConnectionError('Not connected to IMAP server');
      }

      // Try cache first
      if (useCache) {
        const cached = await this.cacheService.getCachedEmail(uid, folder);
        if (cached) {
          console.log('📦 EmailService: Using cached email');
          
          // Add AI summary if requested and not cached
          if (includeAiSummary && this.aiService.isAvailable()) {
            const summary = await this.aiService.summarizeEmail(cached.subject, cached.textBody || cached.body);
            (cached as any).aiSummary = summary;
          }
          
          return {
            success: true,
            email: cached
          };
        }
      }

      // Fetch from IMAP
      console.log('🔄 EmailService: Fetching email from IMAP server');
      const email = await this.imapClient.getEmail(uid, folder);
      
      // Add AI summary if requested
      let aiSummary: EmailSummary | null = null;
      if (includeAiSummary && this.aiService.isAvailable()) {
        aiSummary = await this.aiService.summarizeEmail(email.subject, email.textBody || email.body);
        (email as any).aiSummary = aiSummary;
      }

      // Cache the result
      if (useCache) {
        await this.cacheService.cacheEmail(uid, folder, email);
      }

      return {
        success: true,
        email
      };

    } catch (error) {
      console.error('❌ EmailService: Error getting email:', error);
      
      if (error instanceof EmailNotFoundError) {
        return {
          success: false,
          error: `Email with UID ${uid} not found`
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get email'
      };
    }
  }

  /**
   * Search emails with enhanced capabilities
   */
  async searchEmails(
    searchQuery: EmailSearchQuery,
    folder: string = 'INBOX',
    limit: number = 50,
    offset: number = 0,
    useCache: boolean = true
  ): Promise<ListEmailsResponse> {
    try {
      if (!this.currentConfig) {
        throw new ImapConnectionError('Not connected to IMAP server');
      }

      // Cache key generated automatically by cacheEmailList

      // Try cache first for complex searches
      if (useCache && this.isSearchCacheable(searchQuery)) {
        const cached = await this.cacheService.getCachedEmailList('search', { 
          searchQuery, 
          folder, 
          limit, 
          offset,
          host: this.currentConfig.host,
          username: this.currentConfig.username 
        });
        
        if (cached) {
          console.log('📦 EmailService: Using cached search results');
          return {
            success: true,
            emails: cached,
            total: cached.length,
            hasMore: cached.length === limit
          };
        }
      }

      // Fetch from IMAP
      console.log('🔍 EmailService: Searching emails on IMAP server');
      const result = await this.imapClient.searchEmails(searchQuery, folder, limit, offset);
      
      // Cache the result if it's cacheable
      if (useCache && this.isSearchCacheable(searchQuery) && result.emails.length > 0) {
        await this.cacheService.cacheEmailList('search', { 
          searchQuery, 
          folder, 
          limit, 
          offset,
          host: this.currentConfig.host,
          username: this.currentConfig.username 
        }, result.emails);
      }

      return {
        success: true,
        emails: result.emails,
        total: result.total,
        hasMore: result.hasMore
      };

    } catch (error) {
      console.error('❌ EmailService: Error searching emails:', error);
      return {
        success: false,
        emails: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Failed to search emails'
      };
    }
  }

  /**
   * List folders with caching
   */
  async listFolders(useCache: boolean = true): Promise<{ success: boolean; folders?: EmailFolder[]; error?: string }> {
    try {
      if (!this.currentConfig) {
        throw new ImapConnectionError('Not connected to IMAP server');
      }

      const accountId = `${this.currentConfig.host}:${this.currentConfig.username}`;

      // Try cache first
      if (useCache) {
        const cached = await this.cacheService.getCachedFolders(accountId);
        if (cached) {
          console.log('📦 EmailService: Using cached folders');
          return {
            success: true,
            folders: cached
          };
        }
      }

      // Fetch from IMAP
      console.log('🔄 EmailService: Fetching folders from IMAP server');
      const folders = await this.imapClient.listFolders();
      
      // Cache the result
      if (useCache) {
        await this.cacheService.cacheFolders(accountId, folders);
      }

      return {
        success: true,
        folders
      };

    } catch (error) {
      console.error('❌ EmailService: Error listing folders:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list folders'
      };
    }
  }

  /**
   * Perform email operations with cache invalidation
   */
  async performEmailOperation(
    operation: EmailOperation,
    folder: string = 'INBOX'
  ): Promise<EmailOperationResponse> {
    try {
      if (!this.currentConfig) {
        throw new ImapConnectionError('Not connected to IMAP server');
      }

      console.log('🔧 EmailService: Performing email operation:', operation.type);
      
      // Perform the operation
      const result = await this.imapClient.performEmailOperation(operation, folder);
      
      // Invalidate related caches
      if (result.success && this.currentConfig) {
        await this.invalidateCache(operation, folder);
      }

      return result;

    } catch (error) {
      console.error('❌ EmailService: Error performing operation:', error);
      return {
        success: false,
        processed: 0,
        error: error instanceof Error ? error.message : 'Operation failed'
      };
    }
  }

  /**
   * Get folder information with caching
   */
  async getFolderInfo(folder: string = 'INBOX'): Promise<{
    success: boolean;
    folderInfo?: { 
      name: string; 
      path: string; 
      unreadCount: number; 
      totalCount: number; 
      flags: string[] 
    };
    error?: string;
  }> {
    try {
      if (!this.currentConfig) {
        throw new ImapConnectionError('Not connected to IMAP server');
      }

      // For folder info, we generally want fresh data due to changing counts
      const folderInfo = await this.imapClient.getFolderInfo(folder);
      
      return {
        success: true,
        folderInfo
      };

    } catch (error) {
      console.error('❌ EmailService: Error getting folder info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get folder info'
      };
    }
  }

  /**
   * Batch email operations for performance
   */
  async batchEmailOperations(
    operations: EmailOperation[],
    folder: string = 'INBOX'
  ): Promise<{ 
    success: boolean; 
    results: EmailOperationResponse[]; 
    totalProcessed: number;
    error?: string;
  }> {
    try {
      const results: EmailOperationResponse[] = [];
      let totalProcessed = 0;

      for (const operation of operations) {
        const result = await this.performEmailOperation(operation, folder);
        results.push(result);
        if (result.success) {
          totalProcessed += result.processed;
        }
      }

      return {
        success: true,
        results,
        totalProcessed
      };

    } catch (error) {
      console.error('❌ EmailService: Error in batch operations:', error);
      return {
        success: false,
        results: [],
        totalProcessed: 0,
        error: error instanceof Error ? error.message : 'Batch operations failed'
      };
    }
  }

  /**
   * Clear cache for account
   */
  async clearCache(): Promise<void> {
    if (this.currentConfig) {
      const accountId = `${this.currentConfig.host}:${this.currentConfig.username}`;
      await this.cacheService.clearAccountCache(accountId);
      console.log('🗑️ EmailService: Cache cleared for account');
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    connected: boolean;
    cache: { type: string; size: number; memoryUsage?: number };
    ai: { available: boolean; provider: string };
  } {
    return {
      connected: this.currentConfig !== null,
      cache: this.cacheService.getStats(),
      ai: this.aiService.getStatus()
    };
  }

  // Private helper methods

  private isSearchCacheable(searchQuery: EmailSearchQuery): boolean {
    // Only cache simple, non-time-sensitive searches
    return !searchQuery.dateFrom && !searchQuery.dateTo && !searchQuery.isRead;
  }

  private async invalidateCache(operation: EmailOperation, folder: string): Promise<void> {
    if (!this.currentConfig) return;

    const accountId = `${this.currentConfig.host}:${this.currentConfig.username}`;
    
    // Invalidate affected email caches
    if (operation.uids && operation.uids.length > 0) {
      for (const uid of operation.uids) {
        await this.cacheService.delete(`email:${folder}:${uid}`);
      }
    }

    // Invalidate list caches for the folder
    await this.cacheService.clearPattern(`emails:list:*${folder}*`);
    await this.cacheService.clearPattern(`emails:search:*${folder}*`);
    
    // For move/delete operations, also clear folder caches
    if (['move', 'delete'].includes(operation.type)) {
      await this.cacheService.clearPattern(`folders:${accountId}*`);
    }
  }
}
