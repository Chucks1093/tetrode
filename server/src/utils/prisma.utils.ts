import { PrismaClient } from '@prisma/client';
import { envConfig } from '../config';

// Use global variable to prevent multiple instances in development
// See: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management

declare global {
   // eslint-disable-next-line no-var
   var prisma: PrismaClient | undefined;
}

// Export a singleton PrismaClient instance
export const prisma =
   global.prisma ||
   new PrismaClient({
      log:
         envConfig.MODE === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
      datasourceUrl: envConfig.DATABASE_URL,
   });

// Prevent multiple instances in development environment
if (envConfig.MODE !== 'production') {
   global.prisma = prisma;
}
