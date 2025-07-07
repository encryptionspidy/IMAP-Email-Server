import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { WorkingImapClient } from './services/workingImapClient';
import { AiService } from './services/aiService';
import { SmtpService } from './services/smtpService';
import { ImapConfig, ListEmailsRequest } from './types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const path = event.path;
  const method = event.httpMethod;

  // Health check endpoint
  if (path === '/health' && method === 'GET') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Test endpoint
  if (path === '/test' && method === 'GET') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: JSON.stringify({
        success: true,
        message: 'Test endpoint working!',
      }),
    };
  }

  // Email list endpoint
  if (path === '/emails/list' && method === 'POST') {
    try {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'Request body is required',
          }),
        };
      }

      const body: ListEmailsRequest = JSON.parse(event.body);
      
      // Validate required fields
      if (!body.host || !body.username || !body.password) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'host, username, and password are required',
          }),
        };
      }

      // Create IMAP config
      const config: ImapConfig = {
        host: body.host,
        port: body.port || 993,
        tls: body.tls !== false,
        username: body.username,
        password: body.password,
      };

      // Create IMAP client and get emails
      const client = new WorkingImapClient();
      await client.connect(config);
      
      try {
        console.log('🔍 HANDLER: Calling client.listEmails with:', {
          folder: body.folder || 'INBOX',
          limit: body.limit || 10,
          offset: body.offset || 0,
          sortOrder: body.sortOrder || 'desc'
        });
        
        const result = await client.listEmails(
          body.folder || 'INBOX',
          body.limit || 10,
          body.offset || 0,
          body.sortOrder || 'desc'
        );
        
        console.log('📊 HANDLER: listEmails result:', {
          totalEmails: result.total,
          emailsLength: result.emails.length,
          hasMore: result.hasMore,
          firstEmail: result.emails[0] || 'No emails'
        });
        
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
        
        console.log('✅ HANDLER: Transformed emails:', {
          originalCount: result.emails.length,
          transformedCount: transformedEmails.length,
          firstTransformed: transformedEmails[0] || 'No transformed emails'
        });
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: true,
            emails: transformedEmails,
            total: result.total,
            hasMore: result.hasMore,
          }),
        };
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error in /emails/list:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
      };
    }
  }

  // Get single email endpoint
  if (path?.startsWith('/emails/') && method === 'GET') {
    try {
      const uid = path.split('/emails/')[1];
      if (!uid) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'Email UID is required',
          }),
        };
      }

      const queryParams = event.queryStringParameters || {};
      
      // Validate required fields
      if (!queryParams['host'] || !queryParams['username'] || !queryParams['password']) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'host, username, and password query parameters are required',
          }),
        };
      }

      // Create IMAP config
      const config: ImapConfig = {
        host: queryParams['host'],
        port: parseInt(queryParams['port'] || '993'),
        tls: queryParams['tls'] !== 'false',
        username: queryParams['username'],
        password: queryParams['password'],
      };

      // Create IMAP client and get email
      const client = new WorkingImapClient();
      await client.connect(config);
      
      try {
        const email = await client.getEmail(
          uid,
          queryParams['folder'] || 'INBOX'
        );
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: true,
            email: email,
          }),
        };
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error in /emails/:uid:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
      };
    }
  }

  // Email search endpoint
  if (path === '/emails/search' && method === 'POST') {
    try {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'Request body is required',
          }),
        };
      }

      const body = JSON.parse(event.body);
      
      // Validate required fields
      if (!body.host || !body.username || !body.password) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'host, username, and password are required',
          }),
        };
      }

      const config: ImapConfig = {
        host: body.host,
        port: body.port || 993,
        tls: body.tls !== false,
        username: body.username,
        password: body.password,
      };

      const client = new WorkingImapClient();
      await client.connect(config);
      
      try {
        const result = await client.searchEmails(
          body.search || {},
          body.folder || 'INBOX',
          body.limit || 50,
          body.offset || 0
        );
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: true,
            ...result,
          }),
        };
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error in /emails/search:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
      };
    }
  }

  // Email operations endpoint
  if (path === '/emails/operations' && method === 'POST') {
    try {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'Request body is required',
          }),
        };
      }

      const body = JSON.parse(event.body);
      
      // Validate required fields
      if (!body.host || !body.username || !body.password || !body.operation) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'host, username, password, and operation are required',
          }),
        };
      }

      const config: ImapConfig = {
        host: body.host,
        port: body.port || 993,
        tls: body.tls !== false,
        username: body.username,
        password: body.password,
      };

      const client = new WorkingImapClient();
      await client.connect(config);
      
      try {
        const result = await client.performEmailOperation(
          body.operation,
          body.folder || 'INBOX'
        );
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify(result),
        };
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error in /emails/operations:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
      };
    }
  }

  // Folders endpoint
  if (path === '/folders' && method === 'POST') {
    try {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'Request body is required',
          }),
        };
      }

      const body = JSON.parse(event.body);
      
      // Validate required fields
      if (!body.host || !body.username || !body.password) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'host, username, and password are required',
          }),
        };
      }

      const config: ImapConfig = {
        host: body.host,
        port: body.port || 993,
        tls: body.tls !== false,
        username: body.username,
        password: body.password,
      };

      const client = new WorkingImapClient();
      await client.connect(config);
      
      try {
        const folders = await client.listFolders();
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: true,
            folders,
          }),
        };
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error in /folders:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
      };
    }
  }

  // Download attachment endpoint
  if (path?.match(/^\/emails\/[^\/]+\/attachments\/\d+$/) && method === 'GET') {
    try {
      const pathParts = path.split('/');
      const uid = pathParts[2];
      const index = pathParts[4];
      
      if (!uid || !index) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'Email UID and attachment index are required',
          }),
        };
      }

      const queryParams = event.queryStringParameters || {};
      
      // Validate required fields
      if (!queryParams['host'] || !queryParams['username'] || !queryParams['password']) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'host, username, and password query parameters are required',
          }),
        };
      }

      const config: ImapConfig = {
        host: queryParams['host'],
        port: parseInt(queryParams['port'] || '993'),
        tls: queryParams['tls'] !== 'false',
        username: queryParams['username'],
        password: queryParams['password'],
      };

      // Get the email with attachments
      const client = new WorkingImapClient();
      await client.connect(config);
      
      try {
        const email = await client.getEmail(
          uid,
          queryParams['folder'] || 'INBOX'
        );
        
        const attachmentIndex = parseInt(index);
        if (!email.attachments || attachmentIndex >= email.attachments.length || attachmentIndex < 0) {
          return {
            statusCode: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            },
            body: JSON.stringify({
              success: false,
              error: 'Attachment not found',
            }),
          };
        }
        
        const attachment = email.attachments[attachmentIndex];
        
        if (!attachment || !attachment.content) {
          return {
            statusCode: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            },
            body: JSON.stringify({
              success: false,
              error: 'Attachment content not available',
            }),
          };
        }
        
        // Return attachment as binary data
        return {
          statusCode: 200,
          headers: {
            'Content-Type': attachment!.contentType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${attachment!.filename}"`,
            'Access-Control-Allow-Origin': '*',
          },
          body: attachment!.content.toString('base64'),
          isBase64Encoded: true,
        };
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error in /emails/:uid/attachments/:index:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
      };
    }
  }

  // AI summarize endpoint
  if (path?.startsWith('/emails/') && path?.endsWith('/summarize') && method === 'GET') {
    try {
      const uid = path.split('/emails/')[1]?.split('/summarize')[0];
      if (!uid) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'Email UID is required',
          }),
        };
      }

      const queryParams = event.queryStringParameters || {};
      
      // Validate required fields
      if (!queryParams['host'] || !queryParams['username'] || !queryParams['password']) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'host, username, and password query parameters are required',
          }),
        };
      }

      const config: ImapConfig = {
        host: queryParams['host'],
        port: parseInt(queryParams['port'] || '993'),
        tls: queryParams['tls'] !== 'false',
        username: queryParams['username'],
        password: queryParams['password'],
      };

      // Get the email first
      const client = new WorkingImapClient();
      await client.connect(config);
      
      try {
        const email = await client.getEmail(
          uid,
          queryParams['folder'] || 'INBOX'
        );
        
        // Use AI service to summarize
        const aiService = new AiService();
        const summary = await aiService.summarizeEmail(email.subject, email.textBody || email.body);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: true,
            summary,
            email: {
              uid: email.uid,
              subject: email.subject,
              from: email.from,
            },
          }),
        };
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error in /emails/:uid/summarize:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
      };
    }
  }

  // Send email endpoint
  if (path === '/emails/send' && method === 'POST') {
    try {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'Request body is required',
          }),
        };
      }

      const body = JSON.parse(event.body);
      
      // Validate required fields for SMTP
      if (!body.smtpConfig || !body.emailData) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify({
            success: false,
            error: 'smtpConfig and emailData are required',
          }),
        };
      }

      const smtpService = new SmtpService();
      await smtpService.connect(body.smtpConfig);
      
      try {
        const result = await smtpService.sendEmail(body.emailData);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
          body: JSON.stringify(result),
        };
      } finally {
        await smtpService.disconnect();
      }
    } catch (error) {
      console.error('Error in /emails/send:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
      };
    }
  }

  // OPTIONS handler for CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: '',
    };
  }

  // 404 handler
  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: JSON.stringify({
      success: false,
      error: 'Endpoint not found',
      path,
      method,
    }),
  };
};
