const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../dist/config.js');

// Simple test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running configuration tests...\n');
    
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
    
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    
    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

// Helper function to create temporary config file
function createTempConfig(config, filename = 'config.json') {
  const tempPath = path.join(__dirname, filename);
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2));
  return tempPath;
}

// Helper function to clean up temp files
function cleanup(filename = 'config.json') {
  const tempPath = path.join(__dirname, filename);
  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }
}

// Mock process.cwd() to point to our test directory
const originalCwd = process.cwd;
function mockCwd(testDir) {
  process.cwd = () => testDir;
}

function restoreCwd() {
  process.cwd = originalCwd;
}

const runner = new TestRunner();

// Test MCP-style configuration loading
runner.test('MCP-style configuration with stdio server', async () => {
  const config = {
    "mcpServers": {
      "test-server": {
        "command": "echo",
        "args": ["hello", "world"],
        "env": ["PATH", "HOME"]
      }
    }
  };

  createTempConfig(config);
  mockCwd(__dirname);

  try {
    const result = await loadConfig();

    if (!result.servers || result.servers.length !== 1) {
      throw new Error('Expected 1 server');
    }

    const server = result.servers[0];
    if (server.name !== 'test-server') {
      throw new Error(`Expected name 'test-server', got '${server.name}'`);
    }

    if (server.transport.command !== 'echo') {
      throw new Error(`Expected command 'echo', got '${server.transport.command}'`);
    }

    if (!server.transport.args || server.transport.args.length !== 2) {
      throw new Error('Expected 2 args');
    }

    if (!server.transport.env || server.transport.env.length !== 2) {
      throw new Error('Expected 2 env vars');
    }
  } finally {
    restoreCwd();
    cleanup();
  }
});

// Test MCP-style configuration with SSE server
runner.test('MCP-style configuration with SSE server', async () => {
  const config = {
    "mcpServers": {
      "sse-server": {
        "url": "http://localhost:8080/sse"
      }
    }
  };

  createTempConfig(config);
  mockCwd(__dirname);

  try {
    const result = await loadConfig();

    if (!result.servers || result.servers.length !== 1) {
      throw new Error('Expected 1 server');
    }

    const server = result.servers[0];
    if (server.name !== 'sse-server') {
      throw new Error(`Expected name 'sse-server', got '${server.name}'`);
    }

    if (server.transport.type !== 'sse') {
      throw new Error(`Expected type 'sse', got '${server.transport.type}'`);
    }

    if (server.transport.url !== 'http://localhost:8080/sse') {
      throw new Error(`Expected URL 'http://localhost:8080/sse', got '${server.transport.url}'`);
    }
  } finally {
    restoreCwd();
    cleanup();
  }
});

// Test legacy configuration loading
runner.test('Legacy configuration format', async () => {
  const config = {
    "servers": [
      {
        "name": "legacy-server",
        "transport": {
          "command": "echo",
          "args": ["legacy", "test"],
          "env": ["HOME"]
        }
      },
      {
        "name": "legacy-sse",
        "transport": {
          "type": "sse",
          "url": "http://localhost:9000/sse"
        }
      }
    ]
  };

  createTempConfig(config);
  mockCwd(__dirname);

  try {
    const result = await loadConfig();

    if (!result.servers || result.servers.length !== 2) {
      throw new Error('Expected 2 servers');
    }

    const stdioServer = result.servers[0];
    const sseServer = result.servers[1];

    if (stdioServer.name !== 'legacy-server') {
      throw new Error(`Expected name 'legacy-server', got '${stdioServer.name}'`);
    }

    if (sseServer.transport.type !== 'sse') {
      throw new Error(`Expected SSE server type 'sse', got '${sseServer.transport.type}'`);
    }
  } finally {
    restoreCwd();
    cleanup();
  }
});

// Test mixed MCP-style configuration
runner.test('MCP-style configuration with mixed server types', async () => {
  const config = {
    "mcpServers": {
      "stdio-server": {
        "command": "node",
        "args": ["server.js"],
        "env": ["NODE_ENV"]
      },
      "sse-server": {
        "url": "https://example.com/mcp"
      },
      "simple-server": {
        "command": "simple-command"
      }
    }
  };

  createTempConfig(config);
  mockCwd(__dirname);

  try {
    const result = await loadConfig();

    if (!result.servers || result.servers.length !== 3) {
      throw new Error(`Expected 3 servers, got ${result.servers.length}`);
    }

    const serverNames = result.servers.map(s => s.name).sort();
    const expectedNames = ['simple-server', 'sse-server', 'stdio-server'];

    if (JSON.stringify(serverNames) !== JSON.stringify(expectedNames)) {
      throw new Error(`Expected servers ${expectedNames.join(', ')}, got ${serverNames.join(', ')}`);
    }

    // Check SSE server
    const sseServer = result.servers.find(s => s.name === 'sse-server');
    if (sseServer.transport.type !== 'sse') {
      throw new Error('SSE server should have type "sse"');
    }

    // Check stdio servers
    const stdioServers = result.servers.filter(s => s.name !== 'sse-server');
    for (const server of stdioServers) {
      if (server.transport.type !== 'stdio') {
        throw new Error(`Stdio server ${server.name} should have type "stdio"`);
      }
    }
  } finally {
    restoreCwd();
    cleanup();
  }
});

// Test error handling for missing config file
runner.test('Missing config file returns empty config', async () => {
  const tempDir = path.join(__dirname, 'nonexistent');
  mockCwd(tempDir);
  
  try {
    const result = await loadConfig();
    
    if (!result.servers || result.servers.length !== 0) {
      throw new Error('Expected empty servers array for missing config');
    }
  } finally {
    restoreCwd();
  }
});

// Test error handling for invalid JSON
runner.test('Invalid JSON returns empty config', async () => {
  const tempPath = path.join(__dirname, 'config.json');
  fs.writeFileSync(tempPath, '{ invalid json }');
  mockCwd(__dirname);

  try {
    const result = await loadConfig();

    if (!result.servers || result.servers.length !== 0) {
      throw new Error('Expected empty servers array for invalid JSON');
    }
  } finally {
    restoreCwd();
    cleanup();
  }
});

// Run all tests
runner.run().catch(console.error);
