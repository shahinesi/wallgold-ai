import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './mcp/create-server.js';

const server=createServer();
const transport=new StdioServerTransport();
await server.connect(transport);
