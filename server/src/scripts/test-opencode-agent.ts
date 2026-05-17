import { agentService } from '../services/agent.service';

async function main() {
   const serverUrl = await agentService.startServer();
   console.log(`Server running at ${serverUrl}`);

   const initialAgents = await agentService.listAgents();
   console.log(`Existing agents: ${initialAgents.length}`);

   const createdAgent = await agentService.createAgent({
      title: 'Tetrode Test Agent',
   });
   console.log(`Created agent: ${createdAgent.id}`);

   const responseText = await agentService.promptAgentText(
      createdAgent.id,
      'Reply with exactly: Tetrode agent is online.'
   );
   console.log(`Agent response: ${responseText || '[no text response]'}`);

   const agentsAfterCreate = await agentService.listAgents();
   console.log(`Agents after create: ${agentsAfterCreate.length}`);

   const deleted = await agentService.deleteAgent(createdAgent.id);
   console.log(`Deleted agent: ${deleted}`);

   const agentsAfterDelete = await agentService.listAgents();
   console.log(`Agents after delete: ${agentsAfterDelete.length}`);
}

main()
   .catch(error => {
      console.error('OpenCode agent test failed:', error);
      process.exit(1);
   })
   .finally(() => {
      void agentService.stopServer();
   });
