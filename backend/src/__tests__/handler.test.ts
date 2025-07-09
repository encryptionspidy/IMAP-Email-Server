import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../handler';
import { WorkingImapClient } from '../services/workingImapClient';
import { AiService } from '../services/aiService';
import { SmtpService } from '../services/smtpService';

// Mock the services
jest.mock('../services/workingImapClient');
jest.mock('../services/aiService');
jest.mock('../services/smtpService');

const MockWorkingImapClient = WorkingImapClient as jest.MockedClass<typeof WorkingImapClient>;
const MockAiService = AiService as jest.MockedClass<typeof AiService>;
const MockSmtpService = SmtpService as jest.MockedClass<typeof SmtpService>;

// Create mock instances
const mockImapClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  listEmails: jest.fn(),
  getEmail: jest.fn(),
  searchEmails: jest.fn(),
  performEmailOperation: jest.fn(),
  listFolders: jest.fn(),
};

const mockAiService = {
  summarizeEmail: jest.fn(),
};

const mockSmtpService = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendEmail: jest.fn(),
};

// Setup mocks
MockWorkingImapClient.mockImplementation(() => mockImapClient as any);
MockAiService.mockImplementation(() => mockAiService as any);
MockSmtpService.mockImplementation(() => mockSmtpService as any);

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
    
    // Reset all mocks
    jest.clearAllMocks();
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

  describe('Email List Endpoint', () => {
    it('should successfully list emails with valid request', async () => {
      mockEvent.path = '/emails/list';
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        host: 'imap.test.com',
        username: 'test@example.com',
        password: 'password123',
        folder: 'INBOX',
        limit: 10
      });

      mockImapClient.listEmails.mockResolvedValue({
        total: 2,
        emails: [
          {
            uid: '1',
            subject: 'Test Email 1',
            from: 'sender1@test.com',
            to: 'test@example.com',
            date: '2023-01-01T00:00:00Z',
            flags: ['\\Seen'],
            size: 1024,
            isRead: true
          },
          {
            uid: '2',
            subject: 'Test Email 2',
            from: 'sender2@test.com',
            to: 'test@example.com',
            date: '2023-01-02T00:00:00Z',
            flags: [],
            size: 2048,
            isRead: false
          }
        ],
        hasMore: false
      });

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockImapClient.connect).toHaveBeenCalledWith({
        host: 'imap.test.com',
        port: 993,
        tls: true,
        username: 'test@example.com',
        password: 'password123'
      });
      expect(mockImapClient.listEmails).toHaveBeenCalledWith('INBOX', 10, 0, 'desc');
      expect(mockImapClient.disconnect).toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.emails).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it('should handle IMAP connection error gracefully', async () => {
      mockEvent.path = '/emails/list';
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        host: 'imap.test.com',
        username: 'test@example.com',
        password: 'wrongpassword'
      });

      mockImapClient.connect.mockRejectedValue(new Error('Authentication failed'));

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(500);
      expect(mockImapClient.disconnect).toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Authentication failed');
    });
  });

  describe('Get Single Email Endpoint', () => {
    it('should successfully get single email', async () => {
      mockEvent.path = '/emails/12345';
      mockEvent.httpMethod = 'GET';
      mockEvent.queryStringParameters = {
        host: 'imap.test.com',
        username: 'test@example.com',
        password: 'password123',
        folder: 'INBOX'
      };

      mockImapClient.getEmail.mockResolvedValue({
        uid: '12345',
        subject: 'Test Email',
        from: 'sender@test.com',
        to: 'test@example.com',
        date: '2023-01-01T00:00:00Z',
        flags: ['\\Seen'],
        size: 1024,
        body: 'This is the email body',
        textBody: 'This is the email body',
        headers: {},
        attachments: []
      });

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockImapClient.getEmail).toHaveBeenCalledWith('12345', 'INBOX');

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.email.uid).toBe('12345');
    });

    it('should return 400 for missing UID', async () => {
      mockEvent.path = '/emails/';
      mockEvent.httpMethod = 'GET';
      mockEvent.queryStringParameters = {
        host: 'imap.test.com',
        username: 'test@example.com',
        password: 'password123'
      };

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Email UID is required');
    });
  });

  describe('AI Summarize Endpoint', () => {
    it('should successfully summarize email', async () => {
      mockEvent.path = '/emails/12345/summarize';
      mockEvent.httpMethod = 'GET';
      mockEvent.queryStringParameters = {
        host: 'imap.test.com',
        username: 'test@example.com',
        password: 'password123'
      };

      mockImapClient.getEmail.mockResolvedValue({
        uid: '12345',
        subject: 'Important Meeting',
        from: 'boss@company.com',
        textBody: 'This is about the quarterly review meeting scheduled for next week.'
      });

      mockAiService.summarizeEmail.mockResolvedValue({
        summary: 'Meeting about quarterly review',
        keyPoints: ['Quarterly review', 'Next week'],
        sentiment: 'neutral',
        urgency: 'medium'
      });

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockAiService.summarizeEmail).toHaveBeenCalledWith(
        'Important Meeting',
        'This is about the quarterly review meeting scheduled for next week.'
      );

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.summary.summary).toBe('Meeting about quarterly review');
    });
  });

  describe('Email Search Endpoint', () => {
    it('should successfully search emails', async () => {
      mockEvent.path = '/emails/search';
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        host: 'imap.test.com',
        username: 'test@example.com',
        password: 'password123',
        search: { query: 'important' },
        folder: 'INBOX'
      });

      mockImapClient.searchEmails.mockResolvedValue({
        emails: [{
          uid: '1',
          subject: 'Important Notice',
          from: 'admin@company.com'
        }],
        total: 1
      });

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockImapClient.searchEmails).toHaveBeenCalledWith(
        { query: 'important' },
        'INBOX',
        50,
        0
      );

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.emails).toHaveLength(1);
    });
  });

  describe('Email Operations Endpoint', () => {
    it('should successfully perform email operation', async () => {
      mockEvent.path = '/emails/operations';
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        host: 'imap.test.com',
        username: 'test@example.com',
        password: 'password123',
        operation: {
          type: 'mark_read',
          uids: ['1', '2']
        }
      });

      mockImapClient.performEmailOperation.mockResolvedValue({
        success: true,
        processed: 2
      });

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockImapClient.performEmailOperation).toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.processed).toBe(2);
    });
  });

  describe('Folders Endpoint', () => {
    it('should successfully list folders', async () => {
      mockEvent.path = '/folders';
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        host: 'imap.test.com',
        username: 'test@example.com',
        password: 'password123'
      });

      mockImapClient.listFolders.mockResolvedValue([
        { name: 'INBOX', path: 'INBOX', delimiter: '/', flags: [] },
        { name: 'Sent', path: 'Sent', delimiter: '/', flags: [] }
      ]);

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockImapClient.listFolders).toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.folders).toHaveLength(2);
    });
  });

  describe('Send Email Endpoint', () => {
    it('should successfully send email', async () => {
      mockEvent.path = '/emails/send';
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        smtpConfig: {
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          username: 'test@example.com',
          password: 'password123'
        },
        emailData: {
          to: ['recipient@test.com'],
          subject: 'Test Email',
          body: 'This is a test email'
        }
      });

      mockSmtpService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-123'
      });

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockSmtpService.connect).toHaveBeenCalled();
      expect(mockSmtpService.sendEmail).toHaveBeenCalled();
      expect(mockSmtpService.disconnect).toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.messageId).toBe('msg-123');
    });

    it('should return 400 for missing SMTP config', async () => {
      mockEvent.path = '/emails/send';
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        emailData: {
          to: ['recipient@test.com'],
          subject: 'Test Email',
          body: 'This is a test email'
        }
      });

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('smtpConfig and emailData are required');
    });
  });

  describe('Attachment Download Endpoint', () => {
    it('should successfully download attachment', async () => {
      mockEvent.path = '/emails/12345/attachments/0';
      mockEvent.httpMethod = 'GET';
      mockEvent.queryStringParameters = {
        host: 'imap.test.com',
        username: 'test@example.com',
        password: 'password123'
      };

      mockImapClient.getEmail.mockResolvedValue({
        uid: '12345',
        attachments: [{
          filename: 'document.pdf',
          contentType: 'application/pdf',
          size: 1024,
          content: Buffer.from('fake pdf content')
        }]
      });

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/pdf');
      expect(result.isBase64Encoded).toBe(true);
    });

    it('should return 404 for missing attachment', async () => {
      mockEvent.path = '/emails/12345/attachments/5';
      mockEvent.httpMethod = 'GET';
      mockEvent.queryStringParameters = {
        host: 'imap.test.com',
        username: 'test@example.com',
        password: 'password123'
      };

      mockImapClient.getEmail.mockResolvedValue({
        uid: '12345',
        attachments: []
      });

      const result: APIGatewayProxyResult = await handler(mockEvent);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Attachment not found');
    });
  });
});
