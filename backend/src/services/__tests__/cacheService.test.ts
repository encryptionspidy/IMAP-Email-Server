import { CacheService } from '../cacheService';

// Mock Redis with proper implementation
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([])
  }))
}));

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
  });

  describe('Memory Cache (Redis not available)', () => {
    it('should store and retrieve value from memory cache', async () => {
      await cacheService.set('key1', 'value1', 60);
      const value = await cacheService.get('key1');
      expect(value).toBe('value1');
    });

    it('should return null for missing key', async () => {
      const value = await cacheService.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should remove existing key from cache', async () => {
      await cacheService.set('key3', 'value3', 60);
      await cacheService.delete('key3');
      const value = await cacheService.get('key3');
      expect(value).toBeNull();
    });

    it('should generate unique cache keys', () => {
      const key1 = cacheService.generateKey('test', { param1: 'value1', param2: 'value2' });
      const key2 = cacheService.generateKey('test', { param2: 'value2', param1: 'value1' });
      const key3 = cacheService.generateKey('test', { param1: 'different', param2: 'value2' });
      
      expect(key1).toBe(key2); // Same params in different order should produce same key
      expect(key1).not.toBe(key3); // Different params should produce different key
    });

    it('should cache and retrieve email lists', async () => {
      const mockEmails = [
        { uid: '1', subject: 'Test 1', from: 'test@example.com', to: 'recipient@example.com', date: '2023-01-01', flags: [], size: 1024 },
        { uid: '2', subject: 'Test 2', from: 'test2@example.com', to: 'recipient@example.com', date: '2023-01-02', flags: [], size: 2048 }
      ];
      
      const params = { folder: 'INBOX', limit: 10, offset: 0 };
      
      await cacheService.cacheEmailList('list', params, mockEmails);
      const cachedEmails = await cacheService.getCachedEmailList('list', params);
      
      expect(cachedEmails).toEqual(mockEmails);
    });

    it('should cache and retrieve single email', async () => {
      const mockEmail = {
        uid: '123',
        subject: 'Test Email',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        date: '2023-01-01',
        flags: [],
        size: 1024,
        body: 'Test body',
        headers: {}
      };
      
      await cacheService.cacheEmail('123', 'INBOX', mockEmail);
      const cachedEmail = await cacheService.getCachedEmail('123', 'INBOX');
      
      expect(cachedEmail).toEqual(mockEmail);
    });
  });
});
