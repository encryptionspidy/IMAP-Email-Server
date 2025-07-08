import { AiService } from '../aiService';

// Simple test for AiService
describe('AiService', () => {
  let service: AiService;

  beforeEach(() => {
    service = new AiService();
  });

  it('should create an instance', () => {
    expect(service).toBeDefined();
  });

  it('should return status', () => {
    const status = service.getStatus();
    expect(status).toHaveProperty('available');
    expect(status).toHaveProperty('provider');
    expect(typeof status.available).toBe('boolean');
    expect(typeof status.provider).toBe('string');
  });

  it('should handle summarizeEmail with invalid input', async () => {
    const result = await service.summarizeEmail('', '');
    expect(result).toBeNull();
  });

  it('should handle summarizeEmail with valid input but no API key', async () => {
    // Store original env var
    const originalKey = process.env['GEMINI_API_KEY'];
    delete process.env['GEMINI_API_KEY'];
    
    try {
      const result = await service.summarizeEmail('Test email content', 'Test body content');
      expect(result).toBeNull();
    } finally {
      // Restore original env var
      if (originalKey) {
        process.env['GEMINI_API_KEY'] = originalKey;
      }
    }
  });

  it('should classify email', async () => {
    const result = await service.classifyEmail('Test subject', 'Test body');
    expect(result).toBeNull(); // Will be null without API key
  });

  it('should check availability', () => {
    const available = service.isAvailable();
    expect(typeof available).toBe('boolean');
  });
});
