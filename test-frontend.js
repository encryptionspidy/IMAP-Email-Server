#!/usr/bin/env node

const http = require('http');

// Test function to check if frontend is loading correctly
function testFrontend() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3002/', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 && data.includes('<div id="root">')) {
          resolve('✅ Frontend is loading correctly');
        } else {
          reject(`❌ Frontend error: Status ${res.statusCode}`);
        }
      });
    });
    
    req.on('error', (err) => {
      reject(`❌ Frontend connection error: ${err.message}`);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject('❌ Frontend timeout');
    });
  });
}

// Test function to check if API proxy is working
function testAPIProxy() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3002/api/health', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200 && json.status === 'healthy') {
            resolve('✅ API proxy is working correctly');
          } else {
            reject(`❌ API proxy error: Status ${res.statusCode}, Data: ${data}`);
          }
        } catch (e) {
          reject(`❌ API proxy JSON parse error: ${e.message}`);
        }
      });
    });
    
    req.on('error', (err) => {
      reject(`❌ API proxy connection error: ${err.message}`);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject('❌ API proxy timeout');
    });
  });
}

// Test function to check if backend is responding
function testBackend() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000/health', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200 && json.status === 'healthy') {
            resolve('✅ Backend is responding correctly');
          } else {
            reject(`❌ Backend error: Status ${res.statusCode}, Data: ${data}`);
          }
        } catch (e) {
          reject(`❌ Backend JSON parse error: ${e.message}`);
        }
      });
    });
    
    req.on('error', (err) => {
      reject(`❌ Backend connection error: ${err.message}`);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject('❌ Backend timeout');
    });
  });
}

async function runTests() {
  console.log('🧪 Testing IMAP Email Server setup...\n');
  
  try {
    const backendResult = await testBackend();
    console.log(backendResult);
  } catch (error) {
    console.log(error);
    return;
  }
  
  try {
    const proxyResult = await testAPIProxy();
    console.log(proxyResult);
  } catch (error) {
    console.log(error);
    return;
  }
  
  try {
    const frontendResult = await testFrontend();
    console.log(frontendResult);
  } catch (error) {
    console.log(error);
    return;
  }
  
  console.log('\n🎉 All systems are working correctly!');
  console.log('🌐 Frontend: http://localhost:3002/');
  console.log('🔧 Backend: http://localhost:3000/');
  console.log('\nThe frontend should now display the connection form instead of a black screen.');
}

runTests();
