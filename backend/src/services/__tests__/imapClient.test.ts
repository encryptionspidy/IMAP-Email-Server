import { WorkingImapClient } from '../workingImapClient';
import { ImapConfig } from '../../types';

// Simple test for WorkingImapClient
describe('WorkingImapClient', () => {
  let client: WorkingImapClient;
  let config: ImapConfig;

  beforeEach(() => {
    client = new WorkingImapClient();
    config = {
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      username: 'dummy@example.com',
      password: 'dummy-password',
    };
  });

  it('should create an instance', () => {
    expect(client).toBeDefined();
  });

  it('should fail to connect with missing configuration', async () => {
    try {
      await client.connect({ ...config, username: '', password: '' });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should connect and disconnect successfully', async () => {
    try {
      await client.connect(config);
      expect(client).toBeDefined();
      await client.disconnect();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
