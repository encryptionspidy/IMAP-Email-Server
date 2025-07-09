import { WorkingImapClient } from '../workingImapClient';
import { ImapConfig } from '../../types';

// Mock ImapFlow
const mockImapFlow = {
  connect: jest.fn(),
  close: jest.fn(),
  logout: jest.fn(),
  mailboxOpen: jest.fn(),
  search: jest.fn(),
  fetch: jest.fn(),
  list: jest.fn(),
  getQuota: jest.fn()
};

jest.mock('imapflow', () => {
  return {
    ImapFlow: jest.fn().mockImplementation(() => mockImapFlow)
  };
});

describe('WorkingImapClient', () => {
  let imapClient: WorkingImapClient;
  
  const config: ImapConfig = {
    host: 'imap.test.com',
    port: 993,
    tls: true,
    username: 'user@test.com',
    password: 'password',
  };

  beforeEach(() => {
    imapClient = new WorkingImapClient();
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect successfully with valid config', async () => {
      mockImapFlow.connect.mockResolvedValue(undefined);
      
      await expect(imapClient.connect(config)).resolves.toBeUndefined();
    });

    it('should throw an error if connection fails', async () => {
      mockImapFlow.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(imapClient.connect(config)).rejects.toThrow('Failed to connect to IMAP server');
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      mockImapFlow.logout.mockResolvedValue(undefined);
      
      await expect(imapClient.disconnect()).resolves.toBeUndefined();
    });

    it('should handle disconnect errors gracefully', async () => {
      mockImapFlow.logout.mockRejectedValue(new Error('Logout failed'));
      
      // Should not throw, just log warning
      await expect(imapClient.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('listEmails', () => {
    beforeEach(async () => {
      mockImapFlow.connect.mockResolvedValue(undefined);
      await imapClient.connect(config);
    });

    it('should return empty result when no emails found', async () => {
      mockImapFlow.mailboxOpen.mockResolvedValue({ exists: 0 });
      mockImapFlow.search.mockResolvedValue([]);

      const result = await imapClient.listEmails('INBOX', 10, 0, 'desc');

      expect(result.emails).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle IMAP errors gracefully', async () => {
      mockImapFlow.mailboxOpen.mockRejectedValue(new Error('Mailbox not found'));

      await expect(imapClient.listEmails('INVALID', 10, 0, 'desc')).rejects.toThrow('Failed to list emails from folder');
    });
  });

  describe('getEmail', () => {
    beforeEach(async () => {
      mockImapFlow.connect.mockResolvedValue(undefined);
      await imapClient.connect(config);
    });

    it('should retrieve single email successfully', async () => {
      const mockEmail = {
        uid: '123',
        envelope: {
          subject: 'Test Email',
          from: [{ address: 'sender@test.com' }],
          to: [{ address: 'recipient@test.com' }],
          date: new Date('2023-01-01')
        },
        bodyStructure: {},
        flags: new Set(['\\Seen']),
        size: 1024,
        source: 'From: sender@test.com\nTo: recipient@test.com\nSubject: Test Email\n\nTest email body'
      };

      mockImapFlow.mailboxOpen.mockResolvedValue({ exists: 1 });
      mockImapFlow.fetch.mockReturnValue([mockEmail]);

      const result = await imapClient.getEmail('123', 'INBOX');

      expect(result.uid).toBe('123');
      expect(result.subject).toBe('Test Email');
    });

    it('should throw error for non-existent email', async () => {
      mockImapFlow.mailboxOpen.mockResolvedValue({ exists: 0 });
      mockImapFlow.fetch.mockReturnValue([]);

      await expect(imapClient.getEmail('999', 'INBOX')).rejects.toThrow();
    });
  });

  describe('listFolders', () => {
    beforeEach(async () => {
      mockImapFlow.connect.mockResolvedValue(undefined);
      await imapClient.connect(config);
    });

    it('should list folders successfully', async () => {
      const mockFolders = [
        { name: 'INBOX', path: 'INBOX', delimiter: '/', flags: new Set() },
        { name: 'Sent', path: 'Sent', delimiter: '/', flags: new Set() }
      ];

      mockImapFlow.list.mockResolvedValue(mockFolders);

      const result = await imapClient.listFolders();

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('INBOX');
      expect(result[1]?.name).toBe('Sent');
    });
  });
});
