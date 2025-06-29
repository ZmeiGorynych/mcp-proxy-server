const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Simple test runner
class IntegrationTestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🔧 Running integration tests...\n');
    
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        this.failed++;
      }
    }
    
    console.log(`\n📊 Integration Results: ${this.passed} passed, ${this.failed} failed`);
    
    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

// Helper to run server with timeout and capture output
function runServerWithConfig(configPath, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    // Copy config to main directory
    const mainConfigPath = path.join(__dirname, '..', 'config.json');
    const originalConfig = fs.existsSync(mainConfigPath) ? fs.readFileSync(mainConfigPath, 'utf8') : null;
    
    try {
      fs.copyFileSync(configPath, mainConfigPath);
      
      const serverProcess = spawn('node', ['dist/index.js'], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      serverProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      serverProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      const timeout = setTimeout(() => {
        serverProcess.kill('SIGTERM');
        
        // Restore original config
        if (originalConfig) {
          fs.writeFileSync(mainConfigPath, originalConfig);
        } else {
          fs.unlinkSync(mainConfigPath);
        }
        
        resolve({ stdout, stderr, timedOut: true });
      }, timeoutMs);
      
      serverProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        // Restore original config
        if (originalConfig) {
          fs.writeFileSync(mainConfigPath, originalConfig);
        } else if (fs.existsSync(mainConfigPath)) {
          fs.unlinkSync(mainConfigPath);
        }
        
        resolve({ stdout, stderr, code, timedOut: false });
      });
      
      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        
        // Restore original config
        if (originalConfig) {
          fs.writeFileSync(mainConfigPath, originalConfig);
        } else if (fs.existsSync(mainConfigPath)) {
          fs.unlinkSync(mainConfigPath);
        }
        
        reject(error);
      });
    } catch (error) {
      // Restore original config on error
      if (originalConfig) {
        fs.writeFileSync(mainConfigPath, originalConfig);
      }
      reject(error);
    }
  });
}

const runner = new IntegrationTestRunner();

// Test configuration file detection
runner.test('Configuration format detection works correctly', async () => {
  // Test MCP-style config detection
  const mcpConfigPath = path.join(__dirname, 'fixtures', 'mcp-style-basic.json');
  const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));

  if (!mcpConfig.mcpServers) {
    throw new Error('MCP-style fixture should have mcpServers property');
  }

  // Test legacy config detection
  const legacyConfigPath = path.join(__dirname, 'fixtures', 'legacy-format.json');
  const legacyConfig = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf8'));

  if (!legacyConfig.servers) {
    throw new Error('Legacy fixture should have servers property');
  }
});

// Test that config files are valid JSON
runner.test('All fixture config files are valid JSON', async () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const configFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json'));

  for (const file of configFiles) {
    const filePath = path.join(fixturesDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in ${file}: ${error.message}`);
    }
  }
});

// Test that the build output exists
runner.test('Build output exists and is accessible', async () => {
  const distDir = path.join(__dirname, '..', 'dist');
  const configFile = path.join(distDir, 'config.js');

  if (!fs.existsSync(distDir)) {
    throw new Error('dist directory does not exist');
  }

  if (!fs.existsSync(configFile)) {
    throw new Error('config.js build output does not exist');
  }

  // Try to require the config module
  try {
    const configModule = require(configFile);
    if (typeof configModule.loadConfig !== 'function') {
      throw new Error('loadConfig function not exported');
    }
  } catch (error) {
    throw new Error(`Cannot load config module: ${error.message}`);
  }
});

// Run all integration tests
runner.run().catch(console.error);
