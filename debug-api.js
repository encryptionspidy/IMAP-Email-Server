#!/usr/bin/env node

const fetch = require('node-fetch');

async function testAPI() {
  console.log('🔍 Testing IMAP Email API...\n');
  
  // Test 1: Health check
  console.log('1. Testing health endpoint...');
  try {
    const response = await fetch('http://localhost:3000/health');
    const data = await response.json();
    console.log('✅ Health check:', data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return;
  }
  
  // Test 2: List emails endpoint with mock data
  console.log('\n2. Testing /emails/list endpoint...');
  
  // You'll need to replace these with actual credentials
  const testConfig = {
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    username: 'your-email@gmail.com', // Replace with actual
    password: 'your-app-password',     // Replace with actual
    folder: 'INBOX',
    limit: 5,
    offset: 0,
    sortOrder: 'desc'
  };
  
  try {
    const response = await fetch('http://localhost:3000/emails/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testConfig)
    });
    
    const data = await response.json();
    console.log('📊 Response status:', response.status);
    console.log('📊 Response data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ API call successful');
      console.log(`📧 Total emails: ${data.total}`);
      console.log(`📋 Emails returned: ${data.emails ? data.emails.length : 0}`);
      
      if (data.emails && data.emails.length > 0) {
        console.log('📨 First email preview:');
        const firstEmail = data.emails[0];
        console.log(`  - UID: ${firstEmail.uid}`);
        console.log(`  - Subject: ${firstEmail.subject}`);
        console.log(`  - From: ${firstEmail.from}`);
        console.log(`  - Date: ${firstEmail.date}`);
      } else {
        console.log('⚠️  No emails in response array');
      }
    } else {
      console.log('❌ API call failed:', data.error);
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

if (require.main === module) {
  testAPI().catch(console.error);
}
