# AWS Deployment Guide

## 🚀 Deploy to AWS Lambda

This guide covers deploying the IMAP Email Server to AWS Lambda using the Serverless Framework.

### Prerequisites

- AWS CLI configured
- IAM permissions for Lambda, API Gateway, and CloudFormation
- Node.js ≥16 installed

### 1. Setup AWS Credentials

```bash
aws configure
```

Ensure you have the following IAM permissions:
- `lambda:*`
- `apigateway:*`
- `cloudformation:*`
- `s3:*` (for deployment artifacts)
- `logs:*` (for CloudWatch logs)

### 2. Environment Variables

Set up your environment variables in the backend folder:

```bash
# In .env file
GEMINI_API_KEY=your_gemini_api_key_here
AWS_REGION=us-east-1
AWS_PROFILE=default
```

### 3. Deploy Backend

```bash
cd backend
npm install
npm run dev
```

This will:
1. Build the TypeScript code
2. Deploy to AWS Lambda
3. Create API Gateway endpoints
4. Set up CloudWatch logs

### 4. Deploy Frontend (Optional)

The frontend can be deployed to any static hosting service like:
- AWS S3 + CloudFront
- Netlify
- Vercel

```bash
cd ui
npm install
npm run build
```

### 5. Post-Deployment

After deployment, you'll get:
- API Gateway endpoint URL
- Lambda function ARN
- CloudWatch log group

Example output:
```
Service Information
service: imap-email-server
stage: dev
region: us-east-1
stack: imap-email-server-dev
resources: 12
api keys:
  None
endpoints:
  ANY - https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/{proxy+}
functions:
  api: imap-email-server-dev-api
```

### 6. Testing Deployment

Test the health endpoint:
```bash
curl -X GET "https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/health"
```

Test the email listing endpoint:
```bash
curl -X POST "https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/api/emails/list" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "imap.gmail.com",
    "port": 993,
    "tls": true,
    "username": "your-email@gmail.com",
    "password": "your-app-password",
    "folder": "INBOX",
    "limit": 10
  }'
```

### 7. Monitoring and Logs

View logs in CloudWatch:
```bash
aws logs tail /aws/lambda/imap-email-server-dev-api --follow
```

### 8. Environment-Specific Deployments

Deploy to different stages:
```bash
# Deploy to production
npm run dev --stage prod

# Deploy to staging
npm run dev --stage staging
```

### 9. Cleanup

To remove all AWS resources:
```bash
cd backend
npx serverless remove
```

## Configuration

### Serverless Configuration

The `serverless.yml` file includes:
- Lambda function configuration
- API Gateway setup
- CORS configuration
- CloudWatch logs
- Environment variables

### Performance Settings

- **Memory**: 512MB
- **Timeout**: 30 seconds
- **Runtime**: Node.js 18.x

### Security

- CORS enabled for all origins
- Input validation on all endpoints
- Rate limiting (configurable)
- Error handling and logging

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure AWS credentials have sufficient permissions
2. **Timeout Issues**: Increase timeout in serverless.yml if needed
3. **Memory Issues**: Increase memory allocation if processing large emails
4. **CORS Issues**: Check CORS configuration in serverless.yml

### Debugging

1. Check CloudWatch logs for errors
2. Test locally before deploying
3. Use `serverless invoke local` for testing
4. Verify environment variables are set correctly

## Cost Optimization

- Use appropriate memory allocation
- Implement caching where possible
- Monitor Lambda execution metrics
- Consider using provisioned concurrency for high-traffic scenarios

## Best Practices

1. Test thoroughly in development before production deployment
2. Use environment-specific configurations
3. Monitor performance and costs
4. Implement proper error handling
5. Keep dependencies minimal
6. Use AWS Parameter Store for sensitive configuration
