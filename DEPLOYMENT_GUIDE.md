# IMAP Email Server - AWS Lambda Deployment Guide

## 🚀 Deployed Successfully!

Your IMAP Email Server REST API has been deployed to AWS Lambda in the `ap-south-1` region.

### API Gateway Endpoints
- **Base URL**: `https://zbwddyowtg.execute-api.ap-south-1.amazonaws.com/dev`
- **API Base URL**: `https://zbwddyowtg.execute-api.ap-south-1.amazonaws.com/dev/api`

## 📋 Available Endpoints

### Core Email Endpoints (Required)
1. **POST** `/api/emails/list` - List emails from IMAP server
2. **GET** `/api/emails/:uid` - Get single email details

### Additional Endpoints
3. **GET** `/health` - Health check
4. **GET** `/test` - Test endpoint
5. **POST** `/api/emails/search` - Search emails
6. **POST** `/api/emails/operations` - Email operations
7. **POST** `/api/folders` - List folders
8. **GET** `/api/emails/:uid/attachments/:index` - Download attachments
9. **GET** `/api/emails/:uid/summarize` - AI email summary
10. **POST** `/api/emails/send` - Send emails
11. **GET** `/stats` - Server statistics
12. **POST** `/cache/clear` - Clear cache

## 🧪 Testing Instructions

### 1. Health Check Test
```bash
curl -X GET "https://zbwddyowtg.execute-api.ap-south-1.amazonaws.com/dev/health"
```

### 2. Test Endpoint
```bash
curl -X GET "https://zbwddyowtg.execute-api.ap-south-1.amazonaws.com/dev/test"
```

### 3. List Emails (POST /api/emails/list)
```bash
curl -X POST "https://zbwddyowtg.execute-api.ap-south-1.amazonaws.com/dev/api/emails/list" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "outlook.office365.com",
    "port": 993,
    "tls": true,
    "username": "your-email@outlook.com",
    "password": "your-password",
    "folder": "INBOX",
    "limit": 10,
    "offset": 0,
    "sortOrder": "desc"
  }'
```

### 4. Get Single Email (GET /api/emails/:uid)
```bash
curl -X GET "https://zbwddyowtg.execute-api.ap-south-1.amazonaws.com/dev/api/emails/12345?host=outlook.office365.com&username=your-email@outlook.com&password=your-password&folder=INBOX"
```

## 🔧 Testing with Postman

### Collection Setup
1. **Base URL**: `https://zbwddyowtg.execute-api.ap-south-1.amazonaws.com/dev`
2. **Headers**: 
   - `Content-Type: application/json`
   - `Accept: application/json`

### Test Requests

#### 1. Health Check
- **Method**: GET
- **URL**: `{{baseUrl}}/health`
- **Expected Response**: 200 OK with service status

#### 2. List Emails
- **Method**: POST
- **URL**: `{{baseUrl}}/api/emails/list`
- **Body** (JSON):
```json
{
  "host": "outlook.office365.com",
  "port": 993,
  "tls": true,
  "username": "testuser@outlook.com",
  "password": "testpassword",
  "folder": "INBOX",
  "limit": 10,
  "offset": 0,
  "sortOrder": "desc"
}
```

#### 3. Get Email Details
- **Method**: GET
- **URL**: `{{baseUrl}}/api/emails/{{uid}}`
- **Query Parameters**:
  - `host`: outlook.office365.com
  - `username`: testuser@outlook.com
  - `password`: testpassword
  - `folder`: INBOX

## 🔑 Sample Test Credentials

For testing purposes, use these sample Outlook credentials structure:
```json
{
  "host": "outlook.office365.com",
  "port": 993,
  "tls": true,
  "username": "your-test-email@outlook.com",
  "password": "your-app-password"
}
```

**Important**: 
- For Outlook/Office365, you may need to use App Passwords instead of regular passwords
- Enable 2FA and generate an app-specific password for IMAP access
- Ensure IMAP is enabled in your Outlook account settings

## 📁 Repository Setup for Reviewers

### Clone and Setup
```bash
git clone <your-repo-url>
cd IMAP-Email-Server
npm install
```

### Local Development
```bash
# Build TypeScript
npm run build

# Run locally (if needed)
npm run local

# Run tests
npm test
```

### Deploy to Your Own AWS Account
```bash
# Configure AWS credentials
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=ap-south-1

# Deploy
npm run deploy
```

## 🛠️ Configuration

### Environment Variables
- `GEMINI_API_KEY`: Google Gemini API key for AI features (optional)
- `NODE_ENV`: Environment (dev/prod)

### CORS Configuration
- CORS is enabled for all origins (`*`)
- Supports all HTTP methods (GET, POST, PUT, DELETE, OPTIONS)
- Headers: Content-Type, Authorization

### Performance & Limits
- **Memory**: 512MB
- **Timeout**: 30 seconds
- **Rate Limiting**: 100 requests per minute per IP
- **Caching**: In-memory caching enabled

## 🚨 Error Handling

The API includes comprehensive error handling:
- Input validation
- IMAP connection errors
- Authentication failures
- Rate limiting
- Proper HTTP status codes
- Detailed error messages

## 📊 Response Format

All responses follow this structure:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2025-01-07T16:47:00Z"
}
```

## 🔍 Monitoring

- CloudWatch logs are automatically configured
- Function name: `imap-email-server-dev-api`
- Log group: `/aws/lambda/imap-email-server-dev-api`

## 🔄 Updates and Redeployment

To update the deployed function:
```bash
npm run build
npx serverless deploy
```

## 🎯 Ready for Evaluation

Your IMAP Email Server REST API is now fully deployed and ready for testing. The reviewer can:

1. Test the health endpoint immediately
2. Use the provided sample requests with their own IMAP credentials
3. Verify all functionality including email listing and retrieval
4. Deploy to their own AWS account using the provided instructions

**Deployment Status**: ✅ **COMPLETE**
**Endpoints**: ✅ **ACTIVE**
**CORS**: ✅ **ENABLED**
**Error Handling**: ✅ **IMPLEMENTED**
