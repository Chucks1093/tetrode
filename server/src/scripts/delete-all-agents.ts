import { agentService } from '../services/agent.service';

async function main() {
   const serverUrl = await agentService.startServer();
   console.log(`Server running at ${serverUrl}`);

   const existingAgents = await agentService.listAgents();
   console.log(`Existing agents: ${existingAgents.length}`);

   if (existingAgents.length === 0) {
      console.log('No agents to delete.');
      return;
   }

   await agentService.deleteAllAgents();

   const remainingAgents = await agentService.listAgents();
   console.log(`Remaining agents: ${remainingAgents.length}`);
}

main()
   .catch(error => {
      console.error('Delete all agents failed:', error);
      process.exit(1);
   })
   .finally(() => {
      void agentService.stopServer();
   });
