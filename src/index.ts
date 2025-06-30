import { createServer } from './mcp-proxy.js';

async function main(): Promise<void> {
  const { server, cleanup } = await createServer();

  // Connect to stdio transport
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const transport = new StdioServerTransport();

  console.error('MCP Proxy Server starting...');

  await server.connect(transport);

  console.error('MCP Proxy Server connected and ready');

  // Handle cleanup on exit
  process.on('SIGINT', async () => {
    console.error('Shutting down...');
    await cleanup();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
