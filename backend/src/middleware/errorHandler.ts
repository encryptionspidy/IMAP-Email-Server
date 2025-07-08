import { APIGatewayProxyResult } from 'aws-lambda';
import { 
  ImapConnectionError, 
  EmailNotFoundError, 
  AuthenticationError, 
  ValidationError, 
  RateLimitError 
} from '../types';

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
  requestId?: string | undefined;
}

export class ErrorHandler {
  private static readonly ERROR_CODES = {
    IMAP_CONNECTION_ERROR: 'IMAP_CONNECTION_ERROR',
    EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
  };

  private static readonly STATUS_CODES = {
    [this.ERROR_CODES.IMAP_CONNECTION_ERROR]: 503,
    [this.ERROR_CODES.EMAIL_NOT_FOUND]: 404,
    [this.ERROR_CODES.AUTHENTICATION_ERROR]: 401,
    [this.ERROR_CODES.VALIDATION_ERROR]: 400,
    [this.ERROR_CODES.RATE_LIMIT_ERROR]: 429,
    [this.ERROR_CODES.INTERNAL_SERVER_ERROR]: 500,
    [this.ERROR_CODES.TIMEOUT_ERROR]: 408,
    [this.ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 403,
    [this.ERROR_CODES.SERVICE_UNAVAILABLE]: 503
  };

  /**
   * Handle errors and return appropriate API Gateway response
   */
  static handleError(error: any, requestId?: string): APIGatewayProxyResult {
    console.error('Error occurred:', error);

    const errorResponse = this.createErrorResponse(error, requestId);
    const statusCode = this.getStatusCode(errorResponse.code);

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: JSON.stringify(errorResponse),
    };
  }

  /**
   * Create standardized error response
   */
  private static createErrorResponse(error: any, requestId?: string): ErrorResponse {
    const timestamp = new Date().toISOString();
    
    // Handle known error types
    if (error instanceof ImapConnectionError) {
      return {
        success: false,
        error: this.sanitizeErrorMessage(error.message),
        code: this.ERROR_CODES.IMAP_CONNECTION_ERROR,
        details: this.getErrorDetails(error),
        timestamp,
        requestId
      };
    }

    if (error instanceof EmailNotFoundError) {
      return {
        success: false,
        error: this.sanitizeErrorMessage(error.message),
        code: this.ERROR_CODES.EMAIL_NOT_FOUND,
        timestamp,
        requestId
      };
    }

    if (error instanceof AuthenticationError) {
      return {
        success: false,
        error: this.sanitizeErrorMessage(error.message),
        code: this.ERROR_CODES.AUTHENTICATION_ERROR,
        timestamp,
        requestId
      };
    }

    if (error instanceof ValidationError) {
      return {
        success: false,
        error: this.sanitizeErrorMessage(error.message),
        code: this.ERROR_CODES.VALIDATION_ERROR,
        details: { field: error.field },
        timestamp,
        requestId
      };
    }

    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: this.sanitizeErrorMessage(error.message),
        code: this.ERROR_CODES.RATE_LIMIT_ERROR,
        details: { retryAfter: error.retryAfter },
        timestamp,
        requestId
      };
    }

    // Handle timeout errors
    if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: 'Operation timed out. Please try again.',
        code: this.ERROR_CODES.TIMEOUT_ERROR,
        timestamp,
        requestId
      };
    }

    // Handle network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Unable to connect to email server. Please check your connection settings.',
        code: this.ERROR_CODES.IMAP_CONNECTION_ERROR,
        timestamp,
        requestId
      };
    }

    // Handle permission errors
    if (error.code === 'EACCES' || error.message?.includes('permission')) {
      return {
        success: false,
        error: 'Insufficient permissions to perform this operation.',
        code: this.ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        timestamp,
        requestId
      };
    }

    // Handle generic errors
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
      code: this.ERROR_CODES.INTERNAL_SERVER_ERROR,
      details: this.getErrorDetails(error),
      timestamp,
      requestId
    };
  }

  /**
   * Get HTTP status code for error type
   */
  private static getStatusCode(errorCode?: string): number {
    if (!errorCode) return 500;
    return this.STATUS_CODES[errorCode] || 500;
  }

  /**
   * Sanitize error message to remove sensitive information
   */
  private static sanitizeErrorMessage(message: string): string {
    // Remove potential sensitive information
    return message
      .replace(/password[=:]\s*[^\s,]+/gi, 'password=***')
      .replace(/token[=:]\s*[^\s,]+/gi, 'token=***')
      .replace(/key[=:]\s*[^\s,]+/gi, 'key=***')
      .replace(/secret[=:]\s*[^\s,]+/gi, 'secret=***')
      .replace(/auth[=:]\s*[^\s,]+/gi, 'auth=***');
  }

  /**
   * Extract relevant error details for debugging (excluding sensitive info)
   */
  private static getErrorDetails(error: any): any {
    if (!error || typeof error !== 'object') return null;

    const details: any = {};
    
    // Include non-sensitive error properties
    const allowedProperties = ['name', 'code', 'stack', 'cause'];
    
    for (const prop of allowedProperties) {
      if (error[prop] && prop !== 'stack') {
        details[prop] = error[prop];
      }
    }

    // Include stack trace in development mode only
    if (process.env['NODE_ENV'] === 'development' && error.stack) {
      details.stack = error.stack.split('\n').slice(0, 5).join('\n'); // Limit stack trace
    }

    return Object.keys(details).length > 0 ? details : null;
  }

  /**
   * Validate request body and throw ValidationError if invalid
   */
  static validateRequestBody(body: any, requiredFields: string[]): void {
    if (!body) {
      throw new ValidationError('Request body is required');
    }

    for (const field of requiredFields) {
      if (!body[field]) {
        throw new ValidationError(`Field '${field}' is required`, field);
      }
    }
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string, fieldName: string = 'email'): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError(`Invalid email format for ${fieldName}`, fieldName);
    }
  }

  /**
   * Validate IMAP configuration
   */
  static validateImapConfig(config: any): void {
    const requiredFields = ['host', 'username', 'password'];
    this.validateRequestBody(config, requiredFields);

    // Validate host format
    if (typeof config.host !== 'string' || config.host.trim().length === 0) {
      throw new ValidationError('Host must be a non-empty string', 'host');
    }

    // Validate port if provided
    if (config.port !== undefined) {
      const port = parseInt(config.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new ValidationError('Port must be a number between 1 and 65535', 'port');
      }
    }

    // Validate TLS setting
    if (config.tls !== undefined && typeof config.tls !== 'boolean') {
      throw new ValidationError('TLS setting must be a boolean', 'tls');
    }

    // Validate email format for username
    this.validateEmail(config.username, 'username');
  }

  /**
   * Validate pagination parameters
   */
  static validatePaginationParams(params: any): { limit: number; offset: number } {
    let limit = 50; // Default
    let offset = 0; // Default

    if (params.limit !== undefined) {
      limit = parseInt(params.limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be a number between 1 and 100', 'limit');
      }
    }

    if (params.offset !== undefined) {
      offset = parseInt(params.offset);
      if (isNaN(offset) || offset < 0) {
        throw new ValidationError('Offset must be a non-negative number', 'offset');
      }
    }

    return { limit, offset };
  }

  /**
   * Validate sort parameters
   */
  static validateSortParams(params: any): { sortOrder: 'asc' | 'desc' } {
    let sortOrder: 'asc' | 'desc' = 'desc'; // Default

    if (params.sortOrder !== undefined) {
      if (!['asc', 'desc'].includes(params.sortOrder)) {
        throw new ValidationError('Sort order must be either "asc" or "desc"', 'sortOrder');
      }
      sortOrder = params.sortOrder;
    }

    return { sortOrder };
  }

  /**
   * Validate email operation parameters
   */
  static validateEmailOperation(operation: any): void {
    const requiredFields = ['type', 'uids'];
    this.validateRequestBody(operation, requiredFields);

    const validOperations = [
      'mark_read', 'mark_unread', 'star', 'unstar', 
      'delete', 'move', 'copy', 'add_label', 'remove_label'
    ];

    if (!validOperations.includes(operation.type)) {
      throw new ValidationError(
        `Invalid operation type. Must be one of: ${validOperations.join(', ')}`, 
        'type'
      );
    }

    if (!Array.isArray(operation.uids) || operation.uids.length === 0) {
      throw new ValidationError('UIDs must be a non-empty array', 'uids');
    }

    // Validate target folder for move/copy operations
    if (['move', 'copy'].includes(operation.type) && !operation.targetFolder) {
      throw new ValidationError('Target folder is required for move/copy operations', 'targetFolder');
    }

    // Validate labels for label operations
    if (['add_label', 'remove_label'].includes(operation.type)) {
      if (!operation.labels || !Array.isArray(operation.labels) || operation.labels.length === 0) {
        throw new ValidationError('Labels must be a non-empty array for label operations', 'labels');
      }
    }
  }

  /**
   * Create success response
   */
  static createSuccessResponse(data: any, statusCode: number = 200): APIGatewayProxyResult {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: JSON.stringify({
        success: true,
        ...data,
        timestamp: new Date().toISOString()
      }),
    };
  }

  /**
   * Handle CORS preflight requests
   */
  static handleCors(): APIGatewayProxyResult {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  /**
   * Wrap async function with error handling
   */
  static wrapHandler<T extends any[], R>(
    handler: (...args: T) => Promise<R>
  ): (...args: T) => Promise<APIGatewayProxyResult> {
    return async (...args: T): Promise<APIGatewayProxyResult> => {
      try {
        const result = await handler(...args);
        return this.createSuccessResponse(result);
      } catch (error) {
        return this.handleError(error);
      }
    };
  }

  /**
   * Rate limiting helper (simplified implementation)
   */
  private static requestCounts = new Map<string, { count: number; resetTime: number }>();

  static checkRateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 60000): void {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [key, data] of this.requestCounts.entries()) {
      if (data.resetTime < windowStart) {
        this.requestCounts.delete(key);
      }
    }

    const current = this.requestCounts.get(identifier);
    
    if (!current || current.resetTime < windowStart) {
      // New window
      this.requestCounts.set(identifier, { count: 1, resetTime: now + windowMs });
      return;
    }

    if (current.count >= maxRequests) {
      const resetIn = Math.ceil((current.resetTime - now) / 1000);
      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${resetIn} seconds.`,
        resetIn
      );
    }

    current.count++;
  }
}
