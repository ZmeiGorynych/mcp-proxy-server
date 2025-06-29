# Tests

This directory contains tests for the MCP Proxy Server, specifically focusing on the configuration system that supports both MCP-style and legacy configuration formats.

## Test Structure

- `config.test.js` - Unit tests for configuration loading and parsing
- `integration.test.js` - Integration tests for server startup with different configurations
- `run-tests.js` - Test runner script
- `fixtures/` - Test configuration files

## Running Tests

### All Tests
```bash
npm test
```

### Configuration Tests Only
```bash
npm run test:config
```

### Integration Tests Only
```bash
npm run test:integration
```

### Individual Test Files
```bash
node tests/config.test.js
node tests/integration.test.js
```

## Test Coverage

### Configuration Tests (`config.test.js`)
- ✅ MCP-style configuration with stdio servers
- ✅ MCP-style configuration with SSE servers
- ✅ Legacy configuration format support
- ✅ Mixed server types in MCP-style format
- ✅ Error handling for missing config files
- ✅ Error handling for invalid JSON
- ✅ MCP-style configuration with tool filtering
- ✅ Legacy configuration with tool filtering

### Integration Tests (`integration.test.js`)
- ✅ Server startup with MCP-style configuration
- ✅ Server startup with legacy configuration
- ✅ Graceful handling of missing configuration files

## Test Fixtures

The `fixtures/` directory contains sample configuration files:

- `mcp-style-basic.json` - Basic MCP-style configuration
- `mcp-style-complex.json` - Complex MCP-style configuration with multiple server types
- `mcp-style-with-tools.json` - MCP-style configuration demonstrating tool filtering
- `legacy-format.json` - Legacy configuration format example

## Adding New Tests

To add new tests:

1. Add test cases to existing test files, or
2. Create new test files following the naming pattern `*.test.js`
3. Update `run-tests.js` to include new test files
4. Add corresponding npm scripts to `package.json` if needed

## Test Framework

The tests use a simple custom test runner built with Node.js. Each test file exports a test runner that:

- Runs tests sequentially
- Provides clear pass/fail reporting
- Exits with appropriate status codes
- Includes setup and teardown for temporary files
