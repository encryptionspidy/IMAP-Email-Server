import { AiService } from '../aiService';

// Simple test for AiService
describe('AiService', () => {
  it('should create an instance', () => {
    const service = new AiService();
    expect(service).toBeDefined();
  });

  it('should return status', () => {
    const service = new AiService();
    const status = service.getStatus();
    expect(status).toHaveProperty('available');
    expect(status).toHaveProperty('provider');
  });
});
