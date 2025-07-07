import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EmailService } from './services/emailService';
import { ErrorHandler } from './middleware/errorHandler';
import { ImapConfig, ListEmailsRequest } from './types';

export class EnhancedHandler {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Main Lambda handler with enhanced error handling and performance
   */
  async handleRequest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log('📨 Enhanced Handler - Request:', JSON.stringify({
      path: event.path,
      method: event.httpMethod,
      headers: Object.keys(event.headers || {}),
      queryParams: Object.keys(event.queryStringParameters || {}),
      hasBody: !!event.body
    }, null, 2));

    const path = event.path;
    const method = event.httpMethod;
    const requestId = event.requestContext?.requestId;

    try {
      // Rate limiting check
      const clientIp = event.requestContext?.identity?.sourceIp || 'unknown';
      ErrorHandler.checkRateLimit(clientIp, 100, 60000); // 100 requests per minute

      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return ErrorHandler.handleCors();
      }

      // Route to appropriate handler
      switch (true) {
        case path === '/health' && method === 'GET':
          return await this.handleHealth();

        case path === '/test' && method === 'GET':
          return await this.handleTest();

        case path === '/emails/list' && method === 'POST':
          return await this.handleListEmails(event);

        case path?.match(/^\/emails\/[^\/]+$/) && method === 'GET':
          return await this.handleGetEmail(event);

        case path === '/emails/search' && method === 'POST':
          return await this.handleSearchEmails(event);

        case path === '/emails/operations' && method === 'POST':
          return await this.handleEmailOperations(event);

        case path === '/folders' && method === 'POST':
          return await this.handleListFolders(event);

        case path?.match(/^\/emails\/[^\/]+\/attachments\/\d+$/) && method === 'GET':
          return await this.handleDownloadAttachment(event);

        case path?.match(/^\/emails\/[^\/]+\/summarize$/) && method === 'GET':
          return await this.handleSummarizeEmail(event);

        case path === '/emails/send' && method === 'POST':
          return await this.handleSendEmail(event);

        case path === '/stats' && method === 'GET':
          return await this.handleGetStats();

        case path === '/cache/clear' && method === 'POST':
          return await this.handleClearCache(event);

        default:
          return ErrorHandler.createSuccessResponse({
            error: 'Endpoint not found',
            path,
            method,
            availableEndpoints: this.getAvailableEndpoints()
          }, 404);
      }

    } catch (error) {
      console.error('❌ Enhanced Handler - Unhandled error:', error);
      return ErrorHandler.handleError(error, requestId);
    }
  }

  /**
   * Health check endpoint
   */
  private async handleHealth(): Promise<APIGatewayProxyResult> {
    const stats = this.emailService.getStats();
    
    return ErrorHandler.createSuccessResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        email: stats.connected ? 'connected' : 'disconnected',
        cache: stats.cache.type,
        ai: stats.ai.available ? 'available' : 'unavailable'
      },
      version: process.env['VERSION'] || '1.0.0'
    });
  }

  /**
   * Test endpoint
   */
  private async handleTest(): Promise<APIGatewayProxyResult> {
    return ErrorHandler.createSuccessResponse({
      message: 'Enhanced email server is working!',
      features: [
        'Email listing with caching',
        'Enhanced search capabilities', 
        'AI-powered email summaries',
        'Attachment download',
        'Email operations',
        'Performance optimizations',
        'Comprehensive error handling'
      ]
    });
  }

  /**
   * List emails with enhanced performance
   */
  private async handleListEmails(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const body: ListEmailsRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    ErrorHandler.validateImapConfig(body);
    const { limit, offset } = ErrorHandler.validatePaginationParams(body);
    const { sortOrder } = ErrorHandler.validateSortParams(body);

    // Create IMAP config
    const config: ImapConfig = {
      host: body.host,
      port: body.port || 993,
      tls: body.tls !== false,
      username: body.username,
      password: body.password,
    };

    // Connect and fetch emails
    await this.emailService.connect(config);
    
    try {
      const result = await this.emailService.listEmails(
        body.folder || 'INBOX',
        limit,
        offset,
        sortOrder,
        true // use cache
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return ErrorHandler.createSuccessResponse({
        emails: result.emails,
        total: result.total,
        hasMore: result.hasMore,
        pagination: {
          limit,
          offset,
          nextOffset: result.hasMore ? offset + limit : null
        }
      });

    } finally {
      await this.emailService.disconnect();
    }
  }

  /**
   * Get single email with optional AI summary
   */
  private async handleGetEmail(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const uid = event.path.split('/emails/')[1];
    const queryParams = event.queryStringParameters || {};
    
    // Validate required parameters
    ErrorHandler.validateRequestBody(queryParams, ['host', 'username', 'password']);

    const config: ImapConfig = {
      host: queryParams['host']!,
      port: parseInt(queryParams['port'] || '993'),
      tls: queryParams['tls'] !== 'false',
      username: queryParams['username']!,
      password: queryParams['password']!,
    };

    const includeAiSummary = queryParams['includeAiSummary'] === 'true';

    await this.emailService.connect(config);
    
    try {
      const result = await this.emailService.getEmail(
        uid!,
        queryParams['folder'] || 'INBOX',
        true, // use cache
        includeAiSummary
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return ErrorHandler.createSuccessResponse({
        email: result.email
      });

    } finally {
      await this.emailService.disconnect();
    }
  }

  /**
   * Search emails with enhanced capabilities
   */
  private async handleSearchEmails(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const body = JSON.parse(event.body || '{}');
    
    // Validate request
    ErrorHandler.validateRequestBody(body, ['host', 'username', 'password']);
    const { limit, offset } = ErrorHandler.validatePaginationParams(body);

    const config: ImapConfig = {
      host: body.host,
      port: body.port || 993,
      tls: body.tls !== false,
      username: body.username,
      password: body.password,
    };

    await this.emailService.connect(config);
    
    try {
      const result = await this.emailService.searchEmails(
        body.search || {},
        body.folder || 'INBOX',
        limit,
        offset,
        true // use cache
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return ErrorHandler.createSuccessResponse({
        emails: result.emails,
        total: result.total,
        hasMore: result.hasMore,
        searchQuery: body.search
      });

    } finally {
      await this.emailService.disconnect();
    }
  }

  /**
   * Handle email operations with batch processing
   */
  private async handleEmailOperations(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const body = JSON.parse(event.body || '{}');
    
    // Validate request
    ErrorHandler.validateRequestBody(body, ['host', 'username', 'password']);

    const config: ImapConfig = {
      host: body.host,
      port: body.port || 993,
      tls: body.tls !== false,
      username: body.username,
      password: body.password,
    };

    await this.emailService.connect(config);
    
    try {
      // Support both single operation and batch operations
      if (body.operations && Array.isArray(body.operations)) {
        // Batch operations
        body.operations.forEach((op: any) => ErrorHandler.validateEmailOperation(op));
        
        const result = await this.emailService.batchEmailOperations(
          body.operations,
          body.folder || 'INBOX'
        );

        return ErrorHandler.createSuccessResponse({
          batchResults: result.results,
          totalProcessed: result.totalProcessed,
          success: result.success
        });

      } else if (body.operation) {
        // Single operation
        ErrorHandler.validateEmailOperation(body.operation);
        
        const result = await this.emailService.performEmailOperation(
          body.operation,
          body.folder || 'INBOX'
        );

        return ErrorHandler.createSuccessResponse(result);

      } else {
        throw new Error('Either "operation" or "operations" must be provided');
      }

    } finally {
      await this.emailService.disconnect();
    }
  }

  /**
   * List folders with caching
   */
  private async handleListFolders(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const body = JSON.parse(event.body || '{}');
    
    // Validate request
    ErrorHandler.validateRequestBody(body, ['host', 'username', 'password']);

    const config: ImapConfig = {
      host: body.host,
      port: body.port || 993,
      tls: body.tls !== false,
      username: body.username,
      password: body.password,
    };

    await this.emailService.connect(config);
    
    try {
      const result = await this.emailService.listFolders(true); // use cache

      if (!result.success) {
        throw new Error(result.error);
      }

      return ErrorHandler.createSuccessResponse({
        folders: result.folders
      });

    } finally {
      await this.emailService.disconnect();
    }
  }

  /**
   * Download attachment (delegated to original handler for now)
   */
  private async handleDownloadAttachment(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    // For now, delegate to the existing implementation in the original handler
    // This could be enhanced with caching in the future
    const { handler } = await import('./handler');
    return await handler(event);
  }

  /**
   * Summarize email with AI
   */
  private async handleSummarizeEmail(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const uid = event.path.split('/emails/')[1]?.split('/summarize')[0];
    const queryParams = event.queryStringParameters || {};
    
    // Validate required parameters
    ErrorHandler.validateRequestBody(queryParams, ['host', 'username', 'password']);

    const config: ImapConfig = {
      host: queryParams['host']!,
      port: parseInt(queryParams['port'] || '993'),
      tls: queryParams['tls'] !== 'false',
      username: queryParams['username']!,
      password: queryParams['password']!,
    };

    await this.emailService.connect(config);
    
    try {
      const result = await this.emailService.getEmail(
        uid!,
        queryParams['folder'] || 'INBOX',
        true, // use cache
        true  // include AI summary
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return ErrorHandler.createSuccessResponse({
        summary: (result.email as any)?.aiSummary,
        email: {
          uid: result.email?.uid,
          subject: result.email?.subject,
          from: result.email?.from
        }
      });

    } finally {
      await this.emailService.disconnect();
    }
  }

  /**
   * Send email (delegated to original handler for now)
   */
  private async handleSendEmail(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    // For now, delegate to the existing implementation in the original handler
    const { handler } = await import('./handler');
    return await handler(event);
  }

  /**
   * Get service statistics
   */
  private async handleGetStats(): Promise<APIGatewayProxyResult> {
    const stats = this.emailService.getStats();
    
    return ErrorHandler.createSuccessResponse({
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env['VERSION'] || '1.0.0'
      },
      services: stats,
      performance: {
        cacheType: stats.cache.type,
        cacheSize: stats.cache.size,
        aiProvider: stats.ai.provider
      }
    });
  }

  /**
   * Clear cache
   */
  private async handleClearCache(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const body = JSON.parse(event.body || '{}');
    
    // Validate request - need connection info to clear account-specific cache
    ErrorHandler.validateRequestBody(body, ['host', 'username', 'password']);

    const config: ImapConfig = {
      host: body.host,
      port: body.port || 993,
      tls: body.tls !== false,
      username: body.username,
      password: body.password,
    };

    await this.emailService.connect(config);
    
    try {
      await this.emailService.clearCache();
      
      return ErrorHandler.createSuccessResponse({
        message: 'Cache cleared successfully'
      });

    } finally {
      await this.emailService.disconnect();
    }
  }

  /**
   * Get available endpoints documentation
   */
  private getAvailableEndpoints(): any[] {
    return [
      { method: 'GET', path: '/health', description: 'Health check with service status' },
      { method: 'GET', path: '/test', description: 'Test endpoint with feature list' },
      { method: 'POST', path: '/emails/list', description: 'List emails with caching and pagination' },
      { method: 'GET', path: '/emails/{uid}', description: 'Get single email with optional AI summary' },
      { method: 'POST', path: '/emails/search', description: 'Search emails with enhanced capabilities' },
      { method: 'POST', path: '/emails/operations', description: 'Perform email operations (single or batch)' },
      { method: 'POST', path: '/folders', description: 'List folders with caching' },
      { method: 'GET', path: '/emails/{uid}/attachments/{index}', description: 'Download email attachment' },
      { method: 'GET', path: '/emails/{uid}/summarize', description: 'Get AI summary of email' },
      { method: 'POST', path: '/emails/send', description: 'Send email via SMTP' },
      { method: 'GET', path: '/stats', description: 'Get server and service statistics' },
      { method: 'POST', path: '/cache/clear', description: 'Clear cache for account' }
    ];
  }
}

// Export the enhanced handler function
const enhancedHandlerInstance = new EnhancedHandler();

export const enhancedHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return await enhancedHandlerInstance.handleRequest(event);
};
