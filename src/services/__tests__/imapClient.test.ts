import { WorkingImapClient } from '../workingImapClient';

// Simple test for WorkingImapClient
describe('WorkingImapClient', () => {
  it('should create an instance', () => {
    const client = new WorkingImapClient();
    expect(client).toBeDefined();
  });
});
