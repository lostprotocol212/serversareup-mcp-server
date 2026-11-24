#!/usr/bin/env node

/**
 * ServersAreUp MCP Server
 *
 * Model Context Protocol server that allows AI assistants (Cursor, Copilot,
 * Claude Code, etc.) to manage VMs on ServersAreUp.
 *
 * Usage:
 *   SAU_API_TOKEN=sau_xxx serversareup-mcp
 *
 * Or in MCP client config:
 *   {
 *     "mcpServers": {
 *       "serversareup": {
 *         "command": "serversareup-mcp",
 *         "env": { "SAU_API_TOKEN": "sau_xxx" }
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SAUClient } from './client.js';
import { TOOLS } from './tools.js';
import { handleToolCall } from './handlers.js';

const API_TOKEN = process.env.SAU_API_TOKEN || process.env.SAU_API_KEY;
const API_BASE = process.env.SAU_API_BASE || 'https://serversareup.com';

if (!API_TOKEN) {
  console.error('Error: SAU_API_TOKEN (or SAU_API_KEY) environment variable is required.');
  console.error('Generate one at: https://serversareup.com/account/api-keys');
  process.exit(1);
}

const client = new SAUClient(API_BASE, API_TOKEN);

const server = new Server(
  {
    name: 'serversareup',
    version: '0.3.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = await handleToolCall(client, name, args ?? {});
  return result as unknown as Record<string, unknown>;
});

// List resources (instances as resources)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const instances = await client.listInstances();
    return {
      resources: instances.map((inst) => ({
        uri: `sau://instances/${inst.id}`,
        name: inst.name,
        description: `${inst.status} — ${inst.ip || 'no public IP'}`,
        mimeType: 'application/json',
      })),
    };
  } catch {
    return { resources: [] };
  }
});

// Read a resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const match = uri.match(/^sau:\/\/instances\/([a-zA-Z0-9_-]{1,128})$/);
  if (!match) {
    throw new Error(`Unknown or invalid resource URI: ${uri}`);
  }

  const instance = await client.getInstance(match[1]);
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(instance, null, 2),
      },
    ],
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ServersAreUp MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
