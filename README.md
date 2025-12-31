# Soulseek MCP Server

An MCP (Model Context Protocol) server that enables Claude to search and download music files from the Soulseek peer-to-peer network.

## Prerequisites

- Node.js 18+
- A Soulseek account (create one at [slsknet.org](http://www.slsknet.org/))

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd SoulseekMCP
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Set the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SOULSEEK_USERNAME` | Yes | Your Soulseek account username |
| `SOULSEEK_PASSWORD` | Yes | Your Soulseek account password |
| `DOWNLOAD_PATH` | No | Directory for downloaded files (default: `./downloads`) |

## Usage with Claude Desktop

Add the server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "soulseek": {
      "command": "node",
      "args": ["path/to/SoulseekMCP/dist/index.js"],
      "env": {
        "SOULSEEK_USERNAME": "your-username",
        "SOULSEEK_PASSWORD": "your-password",
        "DOWNLOAD_PATH": "/path/to/downloads"
      }
    }
  }
}
```

## Available Tools

### search
Search for files on the Soulseek network.

**Parameters:**
- `query` (string, required): Search query (artist, song title, album, etc.)
- `limit` (number, optional): Maximum results to return (default: 50)

### download
Download a file from a Soulseek peer.

**Parameters:**
- `username` (string, required): Username of the peer (from search results)
- `filename` (string, required): Full file path (from search results)

### get_status
Check the connection status to the Soulseek network.

## Development

Watch mode for development:
```bash
npm run dev
```

## License

MIT
