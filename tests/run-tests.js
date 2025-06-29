#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function runTest(testFile) {
  return new Promise((resolve, reject) => {
    const testProcess = spawn('node', [testFile], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test ${testFile} failed with code ${code}`));
      }
    });
    
    testProcess.on('error', reject);
  });
}

async function runAllTests() {
  console.log('🚀 Running all tests...\n');
  
  const tests = [
    'config.test.js',
    'integration.test.js'
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`\n📝 Running ${test}...`);
      await runTest(test);
      passed++;
    } catch (error) {
      console.error(`\n❌ ${test} failed:`, error.message);
      failed++;
    }
  }
  
  console.log(`\n🏁 Final Results: ${passed} test suites passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
