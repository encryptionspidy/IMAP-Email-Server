import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { 
  User, 
  JwtPayload, 
  AuthResponse, 
  AuthenticationError, 
  ValidationError,
  ApiKeyPayload
} from '../types';

export class AuthService {
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private users: Map<string, User> = new Map(); // In production, use a database

  constructor() {
    this.jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key-change-in-production';
    this.jwtExpiresIn = process.env['JWT_EXPIRES_IN'] || '7d';
    
    if (this.jwtSecret === 'your-secret-key-change-in-production') {
      console.warn('⚠️  Warning: Using default JWT secret. Set JWT_SECRET environment variable in production!');
    }
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string): Promise<AuthResponse> {
    try {
      // Validate input
      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      if (!this.isValidEmail(email)) {
        throw new ValidationError('Invalid email format', 'email');
      }

      if (password.length < 6) {
        throw new ValidationError('Password must be at least 6 characters long', 'password');
      }

      // Check if user already exists
      const existingUser = this.findUserByEmail(email);
      if (existingUser) {
        throw new ValidationError('User with this email already exists', 'email');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user: User = {
        id: uuidv4(),
        email: email.toLowerCase(),
        hashedPassword,
        emailAccounts: [],
        preferences: {
          theme: 'light',
          emailsPerPage: 50,
          autoRefreshInterval: 300, // 5 minutes
          showEmailPreview: true,
          defaultFolder: 'INBOX',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Store user (in production, save to database)
      this.users.set(user.id, user);

      // Generate token
      const token = this.generateToken(user);

      return {
        success: true,
        token,
        user: this.sanitizeUser(user),
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: error.message,
        };
      }
      
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Failed to register user',
      };
    }
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      // Validate input
      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      // Find user
      const user = this.findUserByEmail(email);
      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.hashedPassword);
      if (!isValidPassword) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Update last login
      user.updatedAt = new Date().toISOString();
      this.users.set(user.id, user);

      // Generate token
      const token = this.generateToken(user);

      return {
        success: true,
        token,
        user: this.sanitizeUser(user),
      };
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        return {
          success: false,
          error: error.message,
        };
      }
      
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Failed to login',
      };
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
      return decoded;
    } catch (error) {
      console.warn('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Get user by ID
   */
  getUserById(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string, 
    preferences: Partial<User['preferences']>
  ): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.preferences = { ...user.preferences, ...preferences };
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);

    return user;
  }

  /**
   * Add email account to user
   */
  async addEmailAccount(
    userId: string,
    accountData: Omit<User['emailAccounts'][0], 'id'>
  ): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const newAccount = {
      id: uuidv4(),
      ...accountData,
    };

    // If this is the first account, make it default
    if (user.emailAccounts.length === 0) {
      newAccount.isDefault = true;
    }

    user.emailAccounts.push(newAccount);
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);

    return user;
  }

  /**
   * Remove email account from user
   */
  async removeEmailAccount(userId: string, accountId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const accountIndex = user.emailAccounts.findIndex(acc => acc.id === accountId);
    if (accountIndex === -1) {
      return null;
    }

    const removedAccount = user.emailAccounts[accountIndex];
    user.emailAccounts.splice(accountIndex, 1);

    // If removed account was default, make first remaining account default
    if (removedAccount && removedAccount.isDefault && user.emailAccounts.length > 0) {
      user.emailAccounts[0]!.isDefault = true;
    }

    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);

    return user;
  }

  /**
   * Update user email account
   */
  async updateEmailAccount(
    userId: string,
    accountId: string,
    updates: Partial<Omit<User['emailAccounts'][0], 'id'>>
  ): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const account = user.emailAccounts.find(acc => acc.id === accountId);
    if (!account) {
      return null;
    }

    Object.assign(account, updates);
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);

    return user;
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!isValidPassword) {
      return false;
    }

    // Validate new password
    if (newPassword.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long');
    }

    // Hash and update password
    user.hashedPassword = await bcrypt.hash(newPassword, 12);
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);

    return true;
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn || '24h'
    } as jwt.SignOptions);
  }

  /**
   * Find user by email
   */
  private findUserByEmail(email: string): User | null {
    const normalizedEmail = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === normalizedEmail) {
        return user;
      }
    }
    return null;
  }

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: User): Omit<User, 'hashedPassword'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hashedPassword, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get all users (admin function)
   */
  getAllUsers(): Omit<User, 'hashedPassword'>[] {
    return Array.from(this.users.values()).map(user => this.sanitizeUser(user));
  }

  /**
   * Delete user account
   */
  async deleteUser(userId: string): Promise<boolean> {
    return this.users.delete(userId);
  }

  /**
   * Generate API key for user (for programmatic access)
   */
  generateApiKey(userId: string): string {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate a long-lived token for API access
    const payload = {
      userId: user.id,
      email: user.email,
      type: 'api',
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: '1y' });
  }

  /**
   * Verify API key
   */
  verifyApiKey(apiKey: string): { userId: string; email: string } | null {
    try {
      const decoded = jwt.verify(apiKey, this.jwtSecret) as ApiKeyPayload;
      if (decoded.type === 'api') {
        return {
          userId: decoded.userId,
          email: decoded.email,
        };
      }
    } catch (error) {
      console.warn('API key verification failed:', error);
    }
    return null;
  }
}
