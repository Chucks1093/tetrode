import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
	name: 'tetrode-test',
	version: '0.1.0',
});

// @ts-ignore — MCP SDK generic depth exceeds TS limit
server.registerTool(
	'get_game_info',
	{
		description: 'Returns current game room info including participants and time remaining.',
		inputSchema: { roomId: z.string().describe('The public ID of the room') },
	},
	async ({ roomId }) => {
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({
						roomId,
						timeRemaining: 45,
						participants: [
							{ name: 'Alex', isHuman: false },
							{ name: 'Sam', isHuman: false },
							{ name: 'Jordan', isHuman: true },
							{ name: 'TestUser', isHuman: false },
						],
					}),
				},
			],
		};
	}
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
