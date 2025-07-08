import express from 'express';
import cors from 'cors';
import { WorkingImapClient } from './services/workingImapClient';
import { SmtpService } from './services/smtpService';
import { AiService } from './services/aiService';
import { ImapConfig, ListEmailsRequest } from './types';

const app = express();
const PORT = process.env['PORT'] || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint
app.get('/test', (_req, res) => {
  res.json({
    success: true,
    message: 'Test endpoint working!',
  });
});

// Email list endpoint
app.post('/emails/list', async (req, res) => {
  try {
    const body: ListEmailsRequest = req.body;
    
    // Validate required fields
    if (!body.host || !body.username || !body.password) {
      return res.status(400).json({
        success: false,
        error: 'host, username, and password are required',
      });
    }

    // Create IMAP config
    const config: ImapConfig = {
      host: body.host,
      port: body.port || 993,
      tls: body.tls !== false,
      username: body.username,
      password: body.password,
    };

    console.log('Connecting to IMAP server:', config.host, 'with user:', config.username);

    // Create IMAP client and get emails
    const client = new WorkingImapClient();
    await client.connect(config);
    
    try {
      const result = await client.listEmails(
        body.folder || 'INBOX',
        body.limit || 10,
        body.offset || 0,
        body.sortOrder || 'desc'
      );
      
      // Debug logging
      console.log('API: listEmails() result:', result);
      console.log('Returning parsed emails:', result.emails.length, result.emails[0]);
      
      // Transform EmailMetadata to match frontend Email type expectations
      const transformedEmails = result.emails.map(email => {
        const parseEmailAddress = (emailStr: string) => {
          if (!emailStr) return { name: '', address: '' };
          if (emailStr.includes('<')) {
            const parts = emailStr.split('<');
            return {
              name: parts[0]?.trim() || '',
              address: parts[1]?.replace('>', '').trim() || ''
            };
          }
          return { name: '', address: emailStr };
        };
        
        // Get preview content from the email metadata
        const preview = (email as any).preview || email.subject;
        
        return {
          id: email.uid, // Frontend expects 'id', backend provides 'uid'
          messageId: email.uid, // Use UID as messageId for now
          uid: email.uid, // Keep original uid field too
          subject: email.subject,
          from: parseEmailAddress(email.from),
          to: email.to ? [parseEmailAddress(email.to)] : [],
          cc: email.cc ? [parseEmailAddress(email.cc)] : [],
          date: new Date(email.date),
          body: {
            text: preview, // Use preview for now, will be filled when fetching full email
            html: ''
          },
          attachments: [],
          labels: [],
          isRead: email.isRead || false,
          isStarred: email.isStarred || false,
          isImportant: false,
          isDraft: false,
          isDeleted: false,
          flags: email.flags,
          folder: body.folder || 'INBOX',
          size: email.size,
          hasAttachments: email.hasAttachments || false,
          preview: preview
        };
      });
      
      console.log('Transformed emails for frontend:', transformedEmails.length, transformedEmails[0]);
      
      return res.json({
        success: true,
        emails: transformedEmails,
        total: result.total,
        hasMore: result.hasMore,
      });
    } finally {
      await client.disconnect();
    }
  } catch (error) {
    console.error('Error in /emails/list:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Get single email endpoint
app.get('/emails/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const queryParams = req.query;
    
    // Validate required fields
    if (!queryParams['host'] || !queryParams['username'] || !queryParams['password']) {
      return res.status(400).json({
        success: false,
        error: 'host, username, and password query parameters are required',
      });
    }

    // Create IMAP config
    const config: ImapConfig = {
      host: queryParams['host'] as string,
      port: parseInt(queryParams['port'] as string || '993'),
      tls: queryParams['tls'] !== 'false',
      username: queryParams['username'] as string,
      password: queryParams['password'] as string,
    };

    // Create IMAP client and get email
    const client = new WorkingImapClient();
    await client.connect(config);
    
    try {
      const email = await client.getEmail(
        uid,
        queryParams['folder'] as string || 'INBOX'
      );
      
      return res.json({
        success: true,
        email: email,
      });
    } finally {
      await client.disconnect();
    }
  } catch (error) {
    console.error('Error in /emails/:uid:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// List folders endpoint
app.post('/folders/list', async (req, res) => {
  try {
    const body: { host: string; port?: number; tls?: boolean; username: string; password: string } = req.body;
    
    // Validate required fields
    if (!body.host || !body.username || !body.password) {
      return res.status(400).json({
        success: false,
        error: 'host, username, and password are required',
      });
    }

    // Create IMAP config
    const config: ImapConfig = {
      host: body.host,
      port: body.port || 993,
      tls: body.tls !== false,
      username: body.username,
      password: body.password,
    };

    console.log('Connecting to IMAP server to list folders:', config.host);

    // Create IMAP client and list folders
    const client = new WorkingImapClient();
    await client.connect(config);
    
    try {
      const folders = await client.listFolders();
      
      return res.json({
        success: true,
        folders: folders,
      });
    } finally {
      await client.disconnect();
    }
  } catch (error) {
    console.error('Error in /folders/list:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Download attachment endpoint
app.get('/emails/:uid/attachments/:index', async (req, res): Promise<any> => {
  try {
    const { uid, index } = req.params;
    const queryParams = req.query;
    
    // Validate required fields
    if (!queryParams['host'] || !queryParams['username'] || !queryParams['password']) {
      return res.status(400).json({
        success: false,
        error: 'host, username, and password query parameters are required',
      });
    }

    // Create IMAP config
    const config: ImapConfig = {
      host: queryParams['host'] as string,
      port: parseInt(queryParams['port'] as string || '993'),
      tls: queryParams['tls'] !== 'false',
      username: queryParams['username'] as string,
      password: queryParams['password'] as string,
    };

    // Create IMAP client and get email with attachments
    const client = new WorkingImapClient();
    await client.connect(config);
    
    try {
      const email = await client.getEmail(
        uid,
        queryParams['folder'] as string || 'INBOX'
      );
      
      const attachmentIndex = parseInt(index);
      if (!email.attachments || attachmentIndex >= email.attachments.length || attachmentIndex < 0) {
        return res.status(404).json({
          success: false,
          error: 'Attachment not found',
        });
      }
      
      const attachment = email.attachments[attachmentIndex];
      
      if (!attachment) {
        return res.status(404).json({
          success: false,
          error: 'Attachment not found',
        });
      }
      
      // Set appropriate headers for file download
      res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
      
      if (attachment.content) {
        return res.send(attachment.content);
      } else {
        return res.status(404).json({
          success: false,
          error: 'Attachment content not available',
        });
      }
    } finally {
      await client.disconnect();
    }
  } catch (error) {
    console.error('Error in /emails/:uid/attachments/:index:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Send email endpoint
app.post('/emails/send', async (req, res) => {
  try {
    const body = req.body;
    
    // Validate required fields for SMTP
    if (!body.smtpConfig || !body.emailData) {
      return res.status(400).json({
        success: false,
        error: 'smtpConfig and emailData are required',
      });
    }

    const smtpService = new SmtpService();
    await smtpService.connect(body.smtpConfig);
    
    try {
      const result = await smtpService.sendEmail(body.emailData);
      return res.json(result);
    } finally {
      await smtpService.disconnect();
    }
  } catch (error) {
    console.error('Error in /emails/send:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Email summarize endpoint
app.get('/emails/:uid/summarize', async (req, res) => {
  try {
    const { uid } = req.params;
    const queryParams = req.query;
    
    // Validate required fields
    if (!queryParams['host'] || !queryParams['username'] || !queryParams['password']) {
      return res.status(400).json({
        success: false,
        error: 'host, username, and password query parameters are required',
      });
    }

    const config: ImapConfig = {
      host: queryParams['host'] as string,
      port: parseInt(queryParams['port'] as string || '993'),
      tls: queryParams['tls'] !== 'false',
      username: queryParams['username'] as string,
      password: queryParams['password'] as string,
    };

    // Get the email first
    const client = new WorkingImapClient();
    await client.connect(config);
    
    try {
      const email = await client.getEmail(
        uid,
        queryParams['folder'] as string || 'INBOX'
      );
      
      // Use AI service to summarize
      const aiService = new AiService();
      const summary = await aiService.summarizeEmail(email.subject, email.textBody || email.body);
      
      return res.json({
        success: true,
        summary,
        email: {
          uid: email.uid,
          subject: email.subject,
          from: email.from,
        },
      });
    } finally {
      await client.disconnect();
    }
  } catch (error) {
    console.error('Error in /emails/:uid/summarize:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Debug endpoint for testing Gmail connection
app.post('/debug/gmail', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'username and password are required',
      });
    }

    const config: ImapConfig = {
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      username,
      password,
    };

    console.log('🔍 DEBUG: Connecting to Gmail IMAP...');
    console.log('Host:', config.host);
    console.log('Port:', config.port);
    console.log('TLS:', config.tls);
    console.log('Username:', config.username);

    const client = new WorkingImapClient();
    await client.connect(config);
    
    try {
      console.log('✅ Connected successfully!');
      
      // List all folders
      console.log('📁 Listing folders...');
      const folders = await client.listFolders();
      console.log('Folders found:', folders.length);
      folders.forEach(folder => {
        console.log(`  - ${folder.path} (${folder.name})`);
      });

      // Try to open [Gmail]/All Mail specifically
      const allMailFolder = folders.find(f => f.path === '[Gmail]/All Mail' || f.name === 'All Mail');
      const targetFolder = allMailFolder ? allMailFolder.path : 'INBOX';
      
      console.log(`📧 Opening folder: ${targetFolder}`);
      
      const result = await client.listEmails(targetFolder, 5, 0, 'desc');
      
      console.log(`📊 Found ${result.total} total emails`);
      console.log(`📋 Retrieved ${result.emails.length} emails`);
      
      if (result.emails.length > 0) {
        console.log('📨 First email details:');
        console.log('  UID:', result.emails[0]?.uid);
        console.log('  Subject:', result.emails[0]?.subject);
        console.log('  From:', result.emails[0]?.from);
        console.log('  Date:', result.emails[0]?.date);
        console.log('  Size:', result.emails[0]?.size);
      }

      return res.json({
        success: true,
        connection: 'successful',
        folders: folders,
        emailCount: result.total,
        emails: result.emails,
        debugInfo: {
          targetFolder,
          hasEmails: result.total > 0,
          retrievedCount: result.emails.length,
        }
      });
    } finally {
      await client.disconnect();
      console.log('🔌 Disconnected from Gmail');
    }
  } catch (error) {
    console.error('❌ DEBUG Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Local development server running on http://localhost:${PORT}`);
  console.log(`📧 IMAP Email Server - Local Development Mode`);
  console.log(`🔧 Available endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /test - Test endpoint`);
  console.log(`   POST /emails/list - List emails`);
  console.log(`   GET  /emails/:uid - Get single email`);
  console.log(`   POST /emails/send - Send email`);
  console.log(`   GET  /emails/:uid/summarize - Summarize email`);
  console.log(`   GET  /emails/:uid/attachments/:index - Download attachment`);
  console.log(`   POST /folders/list - List folders`);
  console.log(`   POST /debug/gmail - Debug Gmail connection`);
});

export default app; 