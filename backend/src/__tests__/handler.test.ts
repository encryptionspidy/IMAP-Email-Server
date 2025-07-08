import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../handler';

// Mock the services
jest.mock('../services/workingImapClient');
jest.mock('../services/aiService');
jest.mock('../services/smtpService');

describe('Handler', () => {
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    mockEvent = {
      httpMethod: 'GET',
      path: '/health',
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null,
      isBase64Encoded: false,
    };
  });

  it('should return health status', async () => {
    const result: APIGatewayProxyResult = await handler(mockEvent);
    
    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('status', 'healthy');
    expect(body).toHaveProperty('timestamp');
  });

  it('should return test response', async () => {
    mockEvent.path = '/test';
    
    const result: APIGatewayProxyResult = await handler(mockEvent);
    
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('message', 'Test endpoint working!');
  });

  it('should return 400 for missing body in email list', async () => {
    mockEvent.path = '/api/emails/list';
    mockEvent.httpMethod = 'POST';
    mockEvent.body = null;
    
    const result: APIGatewayProxyResult = await handler(mockEvent);
    
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error', 'Request body is required');
  });

  it('should return 400 for invalid email list request', async () => {
    mockEvent.path = '/api/emails/list';
    mockEvent.httpMethod = 'POST';
    mockEvent.body = JSON.stringify({
      host: 'imap.gmail.com',
      // missing username and password
    });
    
    const result: APIGatewayProxyResult = await handler(mockEvent);
    
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('success', false);
    expect(body.error).toContain('username');
  });

  it('should handle 404 for unknown paths', async () => {
    mockEvent.path = '/unknown';
    
    const result: APIGatewayProxyResult = await handler(mockEvent);
    
    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error', 'Endpoint not found');
    expect(body).toHaveProperty('path', '/unknown');
    expect(body).toHaveProperty('method', 'GET');
  });

  it('should handle OPTIONS request for CORS', async () => {
    mockEvent.httpMethod = 'OPTIONS';
    mockEvent.path = '/any-path';
    
    const result: APIGatewayProxyResult = await handler(mockEvent);
    
    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(result.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    expect(result.body).toBe('');
  });
});
