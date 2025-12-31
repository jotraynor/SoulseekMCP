# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that enables Claude to search and download music files from the Soulseek peer-to-peer network. It uses the `soulseek-ts` library for network communication and exposes three tools: `search`, `download`, and `get_status`.

## Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript in `dist/`
- **Start**: `npm run start` - Runs the compiled server
- **Dev**: `npm run dev` - Watches and recompiles TypeScript on changes

## Architecture

The server consists of two source files:

- **src/index.ts**: MCP server setup using `@modelcontextprotocol/sdk`. Defines tool schemas (using Zod), registers request handlers for `ListToolsRequest` and `CallToolRequest`, and manages stdio transport. Contains helper functions for formatting file sizes, durations, and search results.

- **src/soulseek-client.ts**: Wrapper around `soulseek-ts` library providing a `SoulseekClientWrapper` class exported as a singleton. Handles lazy connection (connects on first use), search with result sorting (free slots first, then by speed), and file downloads with streaming to disk.

## Environment Variables

The server requires these environment variables at runtime:
- `SOULSEEK_USERNAME` - Soulseek account username (required)
- `SOULSEEK_PASSWORD` - Soulseek account password (required)
- `DOWNLOAD_PATH` - Directory for downloaded files (optional, defaults to `./downloads`)

## Key Patterns

- Connection is lazy: the client connects on first search/download, not at startup
- Search results are sorted by slot availability then download speed
- File downloads stream directly to disk using Node.js streams
- The MCP server runs over stdio, not HTTP
