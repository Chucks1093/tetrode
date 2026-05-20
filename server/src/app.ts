// src/app.ts
import express, { Express, Response, RequestHandler, Request } from 'express';
import { TspecDocsMiddleware } from 'tspec';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware'; // Add notFoundHandler import
import router from './modules/index';
import { corsMiddleware } from './middlewares/cors.middleware';
import helmet from 'helmet';
import morgan from 'morgan';
import tspecOptions from './tspec.config';
import { envConfig } from './config';
import { SendMail } from './utils/mail.utils';
import { appRateLimit } from './middlewares/rate.middleware';
import { io } from './socket';
import { prisma } from './utils/prisma.utils';
import { serializeChatMessage } from './modules/chat/chat.utils';
import { ChatSenderType } from '@prisma/client';

const app: Express = express();

// Middleware setup
app.set('trust proxy', 1);
app.use(corsMiddleware());
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));
app.use(express.urlencoded({ extended: true }));
app.use(appRateLimit);

// Health check
app.get('/health', (_, res: Response) => {
   const healthData = {
      success: true,
      message: 'Proofline API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: envConfig.MODE || 'development',
      uptime: process.uptime(),
      memory: {
         used:
            Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
            100,
         total:
            Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
            100,
      },
      system: {
         platform: process.platform,
         nodeVersion: process.version,
      },
   };

   res.status(200).json(healthData);
});

async function setupTspecDocs() {
   try {
      const tspecMiddlewares = await TspecDocsMiddleware(tspecOptions);
      app.use(
         '/api-docs',
         ...(tspecMiddlewares as unknown as RequestHandler[])
      );
   } catch (error) {
      console.error('Failed to setup API docs:', error);
   }
}

setupTspecDocs();

// Quick test endpoint
app.get('/test-email', async (_, res: Response) => {
   try {
      const result = await SendMail({
         to: 'aniokesebastian@gmail.com',
         subject: 'Test Email',
         html: '<h1>Test</h1><p>If you get this, it works!</p>',
      });

      res.json({
         success: result,
         message: result ? 'Check your email' : 'Email failed',
      });
   } catch (error) {
      res.json({ error: error });
   }
});

// Redirect root
app.get('/', (_, res: Response) => {
   res.redirect('/api-docs');
});

// Internal endpoint — called by MCP tools to persist and broadcast vote events
app.post('/internal/vote-cast', (req: Request, res: Response) => {
   void (async () => {
      const { roomPublicId, voterName } = req.body as { roomPublicId?: string; voterName?: string };
      if (roomPublicId && voterName) {
         const room = await prisma.room.findUnique({ where: { publicId: roomPublicId } }).catch(() => null);
         if (room) {
            const sysMsg = await prisma.chatMessage.create({
               data: { roomId: room.id, senderType: ChatSenderType.SYSTEM, content: `${voterName} has voted.` },
               include: {
                  room: { select: { publicId: true } },
                  senderParticipant: { select: { publicId: true, displayName: true, type: true } },
               },
            }).catch(() => null);
            if (sysMsg) {
               io.to(roomPublicId).emit('message:new', serializeChatMessage(sysMsg));
            }
         }
      }
      res.json({ success: true });
   })();
});

// Routes
app.use('/api/v1', router);

// 404 handler - MUST come after all routes
app.use(notFoundHandler);

// Error handler - MUST be last
app.use(errorHandler);

export default app;
