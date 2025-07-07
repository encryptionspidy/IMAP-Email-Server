#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Clearing frontend cache and ensuring clean state...\n');

// Function to clear browser cache directory if it exists
function clearBrowserCache() {
  const cacheDirs = [
    path.join(process.env.HOME, '.cache/google-chrome'),
    path.join(process.env.HOME, '.cache/chromium'),
    path.join(process.env.HOME, '.cache/mozilla'),
    path.join(process.env.HOME, '.cache/BraveSoftware'),
    path.join(process.env.HOME, '.cache/microsoft-edge')
  ];

  cacheDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`🗑️  Found browser cache at: ${dir}`);
      console.log('   (You may want to clear browser data manually)');
    }
  });
}

// Function to clear Vite cache
function clearViteCache() {
  const viteCacheDir = path.join(__dirname, 'ui', 'node_modules', '.vite');
  if (fs.existsSync(viteCacheDir)) {
    console.log('🗑️  Clearing Vite cache...');
    try {
      fs.rmSync(viteCacheDir, { recursive: true, force: true });
      console.log('✅ Vite cache cleared');
    } catch (error) {
      console.log(`❌ Failed to clear Vite cache: ${error.message}`);
    }
  } else {
    console.log('ℹ️  No Vite cache found');
  }
}

// Function to check if ports are in use
function checkPorts() {
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    exec('ss -tulpn | grep -E ":(3000|3002|3003)\\s"', (error, stdout) => {
      if (stdout) {
        console.log('🔍 Active ports:');
        console.log(stdout);
      } else {
        console.log('ℹ️  No active services on ports 3000, 3002, or 3003');
      }
      resolve();
    });
  });
}

async function main() {
  clearViteCache();
  clearBrowserCache();
  await checkPorts();
  
  console.log('\n📋 Manual steps to ensure clean state:');
  console.log('1. Open browser and press F12 (Developer Tools)');
  console.log('2. Right-click refresh button → "Empty Cache and Hard Reload"');
  console.log('3. Or go to Application tab → Storage → Clear site data');
  console.log('\n🌐 Frontend URL: http://localhost:3002/');
  console.log('📧 You should now see the connection form instead of a black screen!');
}

main();
