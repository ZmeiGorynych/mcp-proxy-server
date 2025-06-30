import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { ServerConfig } from './config.js';

const sleep = (time: number): Promise<void> =>
  new Promise<void>(resolve => setTimeout(() => resolve(), time));
export interface ConnectedClient {
  client: Client;
  cleanup: () => Promise<void>;
  name: string;
  allowedTools?: string[]; // Optional list of tool names to expose
}

const createClient = (
  server: ServerConfig
): { client: Client | undefined; transport: Transport | undefined } => {
  let transport: Transport | null = null;
  try {
    if (server.transport.type === 'sse') {
      transport = new SSEClientTransport(new URL(server.transport.url));
    } else {
      transport = new StdioClientTransport({
        command: server.transport.command,
        args: server.transport.args,
        env: server.transport.env
          ? server.transport.env.reduce(
              (o, v) => ({
                [v]: process.env[v] || '',
              }),
              {}
            )
          : undefined,
      });
    }
  } catch (error) {
    console.error(
      `Failed to create transport ${server.transport.type || 'stdio'} to ${server.name}:`,
      error
    );
  }

  if (!transport) {
    console.warn(`Transport ${server.name} not available.`);
    return { transport: undefined, client: undefined };
  }

  const client = new Client(
    {
      name: 'mcp-proxy-client',
      version: '1.0.0',
    },
    {
      capabilities: {
        prompts: {},
        resources: { subscribe: true },
        tools: {},
      },
    }
  );

  return { client, transport };
};

export const createClients = async (servers: ServerConfig[]): Promise<ConnectedClient[]> => {
  const clients: ConnectedClient[] = [];

  for (const server of servers) {
    console.log(`Connecting to server: ${server.name}`);

    const waitFor = 2500;
    const retries = 3;
    let count = 0;
    let retry = true;

    while (retry) {
      const { client, transport } = createClient(server);
      if (!client || !transport) {
        break;
      }

      try {
        await client.connect(transport);
        console.log(`Connected to server: ${server.name}`);

        // Fetch and display tools for this server
        try {
          const toolsResult = await client.listTools();
          console.log(`\n📋 Tools available from ${server.name}:`);
          if (toolsResult.tools && toolsResult.tools.length > 0) {
            // Apply tool filtering if specified
            let filteredTools = toolsResult.tools;
            if (server.tools && server.tools.length > 0) {
              filteredTools = toolsResult.tools.filter(tool => server.tools!.includes(tool.name));
              console.log(
                `   Filtered: ${filteredTools.length}/${toolsResult.tools.length} tools (only showing configured tools)`
              );
            }

            filteredTools.forEach((tool, index) => {
              console.log(`  ${index + 1}. ${tool.name}`);
              if (tool.description) {
                console.log(`     Description: ${tool.description}`);
              }
              if (tool.inputSchema) {
                console.log(
                  `     Input Schema: ${JSON.stringify(tool.inputSchema, null, 2).split('\n').join('\n     ')}`
                );
              }
              console.log('');
            });
          } else {
            console.log(`  No tools available from ${server.name}`);
          }
          console.log(`Total tools from ${server.name}: ${toolsResult.tools?.length || 0}\n`);
        } catch (toolError) {
          console.error(`Failed to fetch tools from ${server.name}:`, toolError);
        }

        clients.push({
          client,
          name: server.name,
          allowedTools: server.tools,
          cleanup: async () => {
            await transport.close();
          },
        });

        break;
      } catch (error) {
        console.error(`Failed to connect to ${server.name}:`, error);
        count++;
        retry = count < retries;
        if (retry) {
          try {
            await client.close();
          } catch {
            // Ignore cleanup errors
          }
          console.log(`Retry connection to ${server.name} in ${waitFor}ms (${count}/${retries})`);
          await sleep(waitFor);
        }
      }
    }
  }

  return clients;
};
