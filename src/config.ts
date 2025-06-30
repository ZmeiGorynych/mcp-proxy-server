import { readFile } from 'fs/promises';
import { resolve } from 'path';

export type TransportConfigStdio = {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: string[];
};

export type TransportConfigSSE = {
  type: 'sse';
  url: string;
};

export type TransportConfig = TransportConfigSSE | TransportConfigStdio;

export interface ServerConfig {
  name: string;
  transport: TransportConfig;
  tools?: string[]; // Optional list of tool names to expose
}

export interface Config {
  servers: ServerConfig[];
}

// New MCP-style configuration types
export type McpServerConfigStdio = {
  command: string;
  args?: string[];
  env?: string[];
  tools?: string[]; // Optional list of tool names to expose
};

export type McpServerConfigSSE = {
  url: string;
  tools?: string[]; // Optional list of tool names to expose
};

export type McpServerConfig = McpServerConfigStdio | McpServerConfigSSE;

export interface McpStyleConfig {
  mcpServers: Record<string, McpServerConfig>;
}

// Union type to support both formats
export type AnyConfig = Config | McpStyleConfig;

// Type guard to check if config is MCP-style
function isMcpStyleConfig(config: unknown): config is McpStyleConfig {
  return (
    config !== null &&
    typeof config === 'object' &&
    'mcpServers' in config &&
    !('servers' in config)
  );
}

// Convert MCP-style config to internal format
function convertMcpStyleConfig(mcpConfig: McpStyleConfig): Config {
  const servers: ServerConfig[] = [];

  for (const [name, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
    if ('url' in serverConfig) {
      // SSE transport
      servers.push({
        name,
        transport: {
          type: 'sse',
          url: serverConfig.url,
        },
        tools: serverConfig.tools,
      });
    } else {
      // Stdio transport
      servers.push({
        name,
        transport: {
          type: 'stdio',
          command: serverConfig.command,
          args: serverConfig.args,
          env: serverConfig.env,
        },
        tools: serverConfig.tools,
      });
    }
  }

  return { servers };
}

export const loadConfig = async (): Promise<Config> => {
  try {
    const configPath = resolve(process.cwd(), 'config.json');
    const fileContents = await readFile(configPath, 'utf-8');
    const parsedConfig = JSON.parse(fileContents);

    // Check if it's the new MCP-style format
    if (isMcpStyleConfig(parsedConfig)) {
      console.log('Detected MCP-style configuration format');
      return convertMcpStyleConfig(parsedConfig);
    }

    // Assume it's the legacy format
    console.log('Using legacy configuration format');
    return parsedConfig as Config;
  } catch (error) {
    console.error('Error loading config.json:', error);
    // Return empty config if file doesn't exist
    return { servers: [] };
  }
};
