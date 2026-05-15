import cors from 'cors';
import { appConfig } from '../config';

export const corsMiddleware = () =>
   cors({
      origin: appConfig.allowedOrigins,
      credentials: true,
   });
