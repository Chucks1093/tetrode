// Copy this to your src/middlewares/rate.middleware.ts
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { envConfig } from '../config';
import { Request, Response } from 'express';

export const appRateLimit: RateLimitRequestHandler = rateLimit({
   windowMs: 15 * 60 * 1000, // 15 minutes
   max: envConfig.MODE === 'production' ? 1000 : 10000,
   message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes',
      type: 'RATE_LIMIT_EXCEEDED',
   },
   standardHeaders: true,
   legacyHeaders: false,
   // ✅ Remove custom keyGenerator - let library handle IP properly
   handler: (req: Request, res: Response) => {
      res.status(429).json({
         error: 'Too many requests',
         message: 'Rate limit exceeded. Please try again later.',
         retryAfter: '15 minutes',
         timestamp: new Date().toISOString(),
      });
   },
});
