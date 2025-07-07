import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/authService';
import { AuthenticationError, RateLimitError } from '../types';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  /**
   * JWT Authentication middleware
   */
  authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string;

    // Check for JWT token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      const decoded = this.authService.verifyToken(token);
      if (decoded) {
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
        };
        next();
        return;
      }
    }

    // Check for API key
    if (apiKeyHeader) {
      const apiKeyData = this.authService.verifyApiKey(apiKeyHeader);
      if (apiKeyData) {
        req.user = {
          userId: apiKeyData.userId,
          email: apiKeyData.email,
        };
        next();
        return;
      }
    }

    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide a valid JWT token or API key.',
    });
  };

  /**
   * Optional authentication middleware (for public endpoints with optional user context)
   */
  optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string;

    // Try JWT token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = this.authService.verifyToken(token);
      if (decoded) {
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
        };
      }
    }

    // Try API key
    if (apiKeyHeader && !req.user) {
      const apiKeyData = this.authService.verifyApiKey(apiKeyHeader);
      if (apiKeyData) {
        req.user = {
          userId: apiKeyData.userId,
          email: apiKeyData.email,
        };
      }
    }

    next();
  };

  /**
   * Rate limiting middleware
   */
  static createRateLimit(windowMs: number = 15 * 60 * 1000, max: number = 100) {
    return rateLimit({
      windowMs, // 15 minutes by default
      max, // limit each IP to max requests per windowMs
      message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req: Request, res: Response) => {
        res.status(429).json({
          success: false,
          error: 'Too many requests from this IP, please try again later.',
        });
      },
    });
  }

  /**
   * Strict rate limiting for authentication endpoints
   */
  static authRateLimit = AuthMiddleware.createRateLimit(15 * 60 * 1000, 5); // 5 attempts per 15 minutes

  /**
   * General API rate limiting
   */
  static apiRateLimit = AuthMiddleware.createRateLimit(15 * 60 * 1000, 100); // 100 requests per 15 minutes

  /**
   * Heavy operations rate limiting (like AI processing)
   */
  static heavyOperationsRateLimit = AuthMiddleware.createRateLimit(60 * 60 * 1000, 10); // 10 per hour

  /**
   * Validate request body middleware
   */
  static validateRequestBody = (requiredFields: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const missingFields = requiredFields.filter(field => {
        const value = req.body[field];
        return value === undefined || value === null || value === '';
      });

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        });
        return;
      }

      next();
    };
  };

  /**
   * Sanitize input middleware
   */
  static sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
    // Basic XSS protection
    const sanitizeString = (str: string): string => {
      if (typeof str !== 'string') return str;
      return str
        .replace(/[<>]/g, '') // Remove < and >
        .trim();
    };

    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitizeString(obj);
      }
      if (typeof obj === 'object' && obj !== null) {
        const sanitized: any = Array.isArray(obj) ? [] : {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    req.params = sanitizeObject(req.params);

    next();
  };

  /**
   * Error handling middleware
   */
  static errorHandler = (error: Error, _req: Request, res: Response): void => {
    console.error('Unhandled error:', error);

    if (error instanceof AuthenticationError) {
      res.status(401).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (error instanceof RateLimitError) {
      res.status(429).json({
        success: false,
        error: error.message,
        retryAfter: error.retryAfter,
      });
      return;
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: process.env['NODE_ENV'] === 'production'
        ? 'Internal server error' 
        : error.message,
    });
  };

  /**
   * CORS middleware with security headers
   */
  static corsHandler = (req: Request, res: Response, next: NextFunction): void => {
    const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(',') || ['*'];
    const origin = req.headers.origin;

    if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'");

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  };

  /**
   * Request logging middleware
   */
  static requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const { method, url, ip } = req;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        method,
        url,
        statusCode,
        duration: `${duration}ms`,
        ip,
        userAgent,
        userId: req.user?.userId || 'anonymous',
      }));
    });

    next();
  };
}
