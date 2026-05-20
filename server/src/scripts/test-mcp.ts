import { agentService } from '../services/agent.service';

async function main() {
	const serverUrl = await agentService.startServer();
	console.log(`OpenCode server: ${serverUrl}`);

	// Check MCP servers registered
	const mcpStatus = await fetch(`${serverUrl}/mcp`).then(r => r.json()).catch(() => null);
	console.log('MCP status:', JSON.stringify(mcpStatus, null, 2));

	const agent = await agentService.createAgent({ title: 'MCP Test Agent' });
	console.log(`Agent created: ${agent.id}`);

	const prompt = `You have access to a tool called tetrode_cast_vote.
Call tetrode_cast_vote with roomId "test-room-xyz", voterName "Alex", targetName "Jordan" and tell me what the result was.`;

	console.log('\nSending prompt...');
	const response = await agentService.promptAgentText(agent.id, prompt);
	console.log('\nAgent response:');
	console.log(response);

	await agentService.deleteAgent(agent.id);
	console.log('\nAgent deleted. Test complete.');
}

main()
	.catch(error => {
		console.error('MCP test failed:', error);
		process.exit(1);
	})
	.finally(() => {
		void agentService.stopServer();
	});
