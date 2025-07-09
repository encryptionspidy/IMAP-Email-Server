import { AuthService } from '../authService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock external dependencies
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid')
}));

const mockBcrypt = {
  hash: jest.fn(),
  compare: jest.fn()
};

const mockJwt = {
  sign: jest.fn(),
  verify: jest.fn()
};

// Override the actual modules with our mocks
(bcrypt as any).hash = mockBcrypt.hash;
(bcrypt as any).compare = mockBcrypt.compare;
(jwt as any).sign = mockJwt.sign;
(jwt as any).verify = mockJwt.verify;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment for each test
    process.env['JWT_SECRET'] = 'test-secret';
    process.env['JWT_EXPIRES_IN'] = '1h';
    authService = new AuthService();
  });

  afterEach(() => {
    delete process.env['JWT_SECRET'];
    delete process.env['JWT_EXPIRES_IN'];
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      mockJwt.sign.mockReturnValue('mock-token');

      const result = await authService.register('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.token).toBe('mock-token');
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });

    it('should fail with missing email', async () => {
      const result = await authService.register('', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email and password are required');
    });

    it('should fail with missing password', async () => {
      const result = await authService.register('test@example.com', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email and password are required');
    });

    it('should fail with invalid email format', async () => {
      const result = await authService.register('invalid-email', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should fail with short password', async () => {
      const result = await authService.register('test@example.com', '12345');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Password must be at least 6 characters long');
    });

    it('should fail if user already exists', async () => {
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      mockJwt.sign.mockReturnValue('mock-token');

      // Register first user
      await authService.register('test@example.com', 'password123');

      // Try to register same user again
      const result = await authService.register('test@example.com', 'password456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User with this email already exists');
    });

    it('should handle bcrypt hash error', async () => {
      mockBcrypt.hash.mockRejectedValue(new Error('Hash failed'));

      const result = await authService.register('test@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to register user');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Setup a registered user
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      mockJwt.sign.mockReturnValue('register-token');
      await authService.register('test@example.com', 'password123');
    });

    it('should successfully login with valid credentials', async () => {
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('login-token');

      const result = await authService.login('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.token).toBe('login-token');
      expect(result.user?.email).toBe('test@example.com');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
    });

    it('should fail with missing email', async () => {
      const result = await authService.login('', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email and password are required');
    });

    it('should fail with missing password', async () => {
      const result = await authService.login('test@example.com', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email and password are required');
    });

    it('should fail with non-existent user', async () => {
      const result = await authService.login('nonexistent@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should fail with invalid password', async () => {
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await authService.login('test@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should handle bcrypt compare error', async () => {
      mockBcrypt.compare.mockRejectedValue(new Error('Compare failed'));

      const result = await authService.login('test@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to login');
    });
  });

  describe('verifyToken', () => {
    it('should successfully verify valid token', () => {
      const mockPayload = { userId: 'user-id', email: 'test@example.com', iat: 123, exp: 456 };
      mockJwt.verify.mockReturnValue(mockPayload);

      const result = authService.verifyToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    });

    it('should return null for invalid token', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = authService.verifyToken('invalid-token');

      expect(result).toBe(null);
    });
  });

  describe('getUserById', () => {
    it('should return user if exists', async () => {
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      mockJwt.sign.mockReturnValue('mock-token');
      
      const registerResult = await authService.register('test@example.com', 'password123');
      const userId = registerResult.user!.id;

      const user = authService.getUserById(userId);

      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
    });

    it('should return null if user does not exist', () => {
      const user = authService.getUserById('nonexistent-id');

      expect(user).toBe(null);
    });
  });

  describe('updateUserPreferences', () => {
    let userId: string;

    beforeEach(async () => {
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      mockJwt.sign.mockReturnValue('mock-token');
      
      const result = await authService.register('test@example.com', 'password123');
      userId = result.user!.id;
    });

    it('should successfully update user preferences', async () => {
      const newPreferences = { theme: 'dark' as const, emailsPerPage: 25 };

      const updatedUser = await authService.updateUserPreferences(userId, newPreferences);

      expect(updatedUser).toBeDefined();
      expect(updatedUser?.preferences.theme).toBe('dark');
      expect(updatedUser?.preferences.emailsPerPage).toBe(25);
      expect(updatedUser?.preferences.showEmailPreview).toBe(true); // Should keep existing
    });

    it('should return null for non-existent user', async () => {
      const result = await authService.updateUserPreferences('nonexistent-id', { theme: 'dark' });

      expect(result).toBe(null);
    });
  });

  describe('addEmailAccount', () => {
    let userId: string;

    beforeEach(async () => {
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      mockJwt.sign.mockReturnValue('mock-token');
      
      const result = await authService.register('test@example.com', 'password123');
      userId = result.user!.id;
    });

    it('should successfully add email account', async () => {
      const accountData = {
        name: 'Test Account',
        config: {
          host: 'imap.test.com',
          port: 993,
          tls: true,
          username: 'test@test.com',
          password: 'password'
        },
        isDefault: true
      };

      const updatedUser = await authService.addEmailAccount(userId, accountData);

      expect(updatedUser).toBeDefined();
      expect(updatedUser?.emailAccounts).toHaveLength(1);
      expect(updatedUser?.emailAccounts[0]?.name).toBe('Test Account');
      expect(updatedUser?.emailAccounts[0]?.id).toBe('mock-uuid');
    });

    it('should return null for non-existent user', async () => {
      const accountData = {
        name: 'Test Account',
        config: {
          host: 'imap.test.com',
          port: 993,
          tls: true,
          username: 'test@test.com',
          password: 'password'
        },
        isDefault: true
      };

      const result = await authService.addEmailAccount('nonexistent-id', accountData);

      expect(result).toBe(null);
    });
  });

  describe('environment configuration', () => {
    it('should use default JWT secret when not provided', () => {
      delete process.env['JWT_SECRET'];
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      new AuthService();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  Warning: Using default JWT secret. Set JWT_SECRET environment variable in production!'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should use default JWT expires when not provided', () => {
      delete process.env['JWT_EXPIRES_IN'];

      const service = new AuthService();
      expect(service).toBeDefined(); // Just ensure it doesn't crash
    });
  });
});
