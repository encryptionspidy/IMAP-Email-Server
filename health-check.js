#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Test configuration
const config = {
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  username: "veryeasytotype999@gmail.com", 
  password: "hvls rrhy tfks ryhz",
  folder: "INBOX",
  limit: 3
};

const API_BASE = 'http://localhost:3000';

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runHealthCheck() {
  console.log('🏥 Running IMAP Email Server Health Check\n');

  try {
    // Test 1: Health endpoint
    console.log('1️⃣  Testing health endpoint...');
    const healthResult = await makeRequest('GET', '/health');
    if (healthResult.status === 200 && healthResult.data.status === 'healthy') {
      console.log('✅ Health check passed');
    } else {
      console.log('❌ Health check failed:', healthResult);
      return;
    }

    // Test 2: Email list endpoint
    console.log('\n2️⃣  Testing email list endpoint...');
    const listResult = await makeRequest('POST', '/emails/list', config);
    if (listResult.status === 200 && listResult.data.success) {
      const { emails, total, hasMore } = listResult.data;
      console.log(`✅ Email list: ${emails.length} emails fetched, ${total} total, hasMore: ${hasMore}`);
      
      if (emails.length > 0) {
        const firstEmail = emails[0];
        console.log(`   📧 First email: "${firstEmail.subject}" from ${firstEmail.from.name || firstEmail.from.address}`);
        console.log(`   📊 Email structure: id=${firstEmail.id}, uid=${firstEmail.uid}, preview="${firstEmail.preview}"`);
        
        // Test 3: Get single email
        console.log('\n3️⃣  Testing get single email endpoint...');
        const emailParams = new URLSearchParams({
          host: config.host,
          port: config.port.toString(),
          tls: config.tls.toString(),
          username: config.username,
          password: config.password,
          folder: config.folder
        });
        
        const emailResult = await makeRequest('GET', `/emails/${firstEmail.uid}?${emailParams}`);
        if (emailResult.status === 200 && emailResult.data.success) {
          const email = emailResult.data.email;
          console.log(`✅ Single email: "${email.subject}"`);
          console.log(`   📝 Content: ${email.textBody ? email.textBody.substring(0, 50) + '...' : 'No text body'}`);
          console.log(`   🔗 Has HTML: ${!!email.htmlBody}`);
          console.log(`   📎 Attachments: ${email.attachments?.length || 0}`);
        } else {
          console.log('❌ Get single email failed:', emailResult.data.error || emailResult.status);
        }
      }
    } else {
      console.log('❌ Email list failed:', listResult.data.error || listResult.status);
      return;
    }

    // Test 4: Folders endpoint
    console.log('\n4️⃣  Testing folders endpoint...');
    const foldersResult = await makeRequest('POST', '/folders/list', {
      host: config.host,
      port: config.port,
      tls: config.tls,
      username: config.username,
      password: config.password
    });
    if (foldersResult.status === 200 && foldersResult.data.success) {
      const folders = foldersResult.data.folders;
      console.log(`✅ Folders: ${folders.length} folders found`);
      console.log('   📁 Available folders:', folders.slice(0, 5).map(f => f.path).join(', '));
    } else {
      console.log('❌ Folders test failed:', foldersResult.data.error || foldersResult.status);
    }

    console.log('\n🎉 Health check completed successfully!');
    
  } catch (error) {
    console.error('💥 Health check failed with error:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  runHealthCheck();
}

module.exports = { runHealthCheck };
