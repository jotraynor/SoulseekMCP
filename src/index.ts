import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { soulseekClient, SearchResult } from './soulseek-client.js';

// Schema definitions
const searchSchema = z.object({
  query: z.string().describe('Search query for songs/files'),
  limit: z.number().optional().default(50).describe('Maximum number of results to return'),
});

const downloadSchema = z.object({
  username: z.string().describe('Username of the peer to download from'),
  filename: z.string().describe('Full file path from search results'),
});

// Create the MCP server
const server = new Server(
  {
    name: 'soulseek-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Format file size for display
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Format duration for display
function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'unknown';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format search result for display
function formatSearchResult(result: SearchResult, index: number): string {
  const parts = [
    `${index + 1}. ${result.filename}`,
    `   User: ${result.username}`,
    `   Size: ${formatSize(result.size)}`,
  ];

  if (result.bitrate) {
    parts.push(`   Bitrate: ${result.bitrate} kbps`);
  }
  if (result.duration) {
    parts.push(`   Duration: ${formatDuration(result.duration)}`);
  }

  parts.push(`   Slots: ${result.slotsFree ? 'Available' : 'Busy'}`);
  parts.push(`   Speed: ${formatSize(result.speed)}/s`);

  return parts.join('\n');
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search',
        description: 'Search for songs/files on the Soulseek network. Returns a list of available files matching the query.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (artist name, song title, album, etc.)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 50)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'download',
        description: 'Download a file from a Soulseek peer. Use the username and filename from search results.',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Username of the peer to download from',
            },
            filename: {
              type: 'string',
              description: 'Full file path from search results',
            },
          },
          required: ['username', 'filename'],
        },
      },
      {
        name: 'get_status',
        description: 'Check the current connection status to the Soulseek network.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search': {
        const parsed = searchSchema.parse(args);
        const results = await soulseekClient.search(parsed.query, parsed.limit);

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No results found for "${parsed.query}".`,
              },
            ],
          };
        }

        const formatted = results.map((r, i) => formatSearchResult(r, i)).join('\n\n');

        // Also return structured data for programmatic use
        const jsonData = JSON.stringify(results, null, 2);

        return {
          content: [
            {
              type: 'text',
              text: `Found ${results.length} result(s) for "${parsed.query}":\n\n${formatted}\n\n---\nTo download a file, use the download tool with the username and full filename path.`,
            },
          ],
        };
      }

      case 'download': {
        const parsed = downloadSchema.parse(args);
        const result = await soulseekClient.download(parsed.username, parsed.filename);

        return {
          content: [
            {
              type: 'text',
              text: `Download complete!\n\nFile: ${result.filename}\nSize: ${formatSize(result.size)}\nSaved to: ${result.filePath}`,
            },
          ],
        };
      }

      case 'get_status': {
        const status = soulseekClient.getStatus();

        return {
          content: [
            {
              type: 'text',
              text: status.connected
                ? `Connected to Soulseek as: ${status.username}`
                : 'Not connected to Soulseek. Will connect automatically on first search or download.',
            },
          ],
        };
      }

      default:
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Soulseek MCP] Server started on stdio');
}

main().catch((error) => {
  console.error('[Soulseek MCP] Fatal error:', error);
  process.exit(1);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.error('[Soulseek MCP] Shutting down...');
  soulseekClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[Soulseek MCP] Shutting down...');
  soulseekClient.disconnect();
  process.exit(0);
});
