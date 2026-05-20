import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerHiddenHumanTools } from './modules/games/hidden-human/hidden-human.tools';

async function main() {
	const server = new McpServer({
		name: 'tetrode',
		version: '1.0.0',
	});

	registerHiddenHumanTools(server);
	// registerMineStuffTools(server); // add future games here

	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
