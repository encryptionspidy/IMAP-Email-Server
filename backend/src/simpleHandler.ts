import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const simpleHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  try {
    const path = event.path;
    const method = event.httpMethod;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: '',
      };
    }

    // Handle health check
    if (path === '/health' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          status: 'healthy',
          timestamp: new Date().toISOString(),
          message: 'IMAP Email Server is running on AWS Lambda'
        }),
      };
    }

    // Handle test endpoint  
    if (path === '/test' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'IMAP Email Server Test Endpoint',
          endpoints: [
            'POST /api/emails/list - List emails',
            'GET /api/emails/:uid - Get email details'
          ]
        }),
      };
    }

    // Handle /api/emails/list - simplified version
    if (path === '/api/emails/list' && method === 'POST') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Email list endpoint ready. Provide IMAP credentials in request body.',
          example: {
            host: 'outlook.office365.com',
            port: 993,
            tls: true,
            username: 'your-email@outlook.com',
            password: 'your-password',
            folder: 'INBOX'
          }
        }),
      };
    }

    // Handle /api/emails/:uid - simplified version
    if (path.startsWith('/api/emails/') && method === 'GET') {
      const uid = path.split('/api/emails/')[1];
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: `Email details endpoint ready for UID: ${uid}`,
          note: 'Provide IMAP credentials as query parameters: host, username, password'
        }),
      };
    }

    // Handle root paths
    if (path === '/' || path === '/api') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'IMAP Email Server REST API',
          version: '1.0.0',
          endpoints: {
            health: 'GET /health',
            test: 'GET /test', 
            listEmails: 'POST /api/emails/list',
            getEmail: 'GET /api/emails/:uid'
          }
        }),
      };
    }

    // 404 handler
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        path,
        method,
        availableEndpoints: [
          'GET /health',
          'GET /test',
          'POST /api/emails/list',
          'GET /api/emails/:uid'
        ]
      }),
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
