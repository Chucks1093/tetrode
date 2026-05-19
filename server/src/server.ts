import { createServer } from 'http';
import app from './app';
import { initSocket } from './socket';
import { agentService } from './services/agent.service';
import { envConfig } from './config';
import { logger } from './utils/logger.utils';
import { prisma } from './utils/prisma.utils';

async function startServer() {
   try {
      await prisma.$connect();
      logger.info('Connected to database');

      const agentServerUrl = await agentService.startServer();
      logger.info(`OpenCode server ready at ${agentServerUrl}`);

      const httpServer = createServer(app);
      initSocket(httpServer);

      httpServer.listen(envConfig.PORT, () => {
         logger.info(`Server running on port ${envConfig.PORT}`);
      });
   } catch (error) {
      console.error('Failed to start server:', error);
      await prisma.$disconnect();
      process.exit(1);
   }
}

process.on('uncaughtException', error => {
   console.error('Uncaught Exception:', error);
   process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
   console.error('Unhandled Rejection at:', promise, 'reason:', reason);
   process.exit(1);
});

process.on('SIGINT', async () => {
   await agentService.stopServer();
   await prisma.$disconnect();
   process.exit(0);
});

startServer();
