import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middlewares/auth.middleware';
import { envConfig } from '../../config';
import { httpCreateReport } from './reports.controllers';

const reportsRouter = Router();

const createReportRateLimit = rateLimit({
   windowMs: 10 * 60 * 1000,
   max: envConfig.MODE === 'production' ? 8 : 60,
   standardHeaders: true,
   legacyHeaders: false,
   message: {
      success: false,
      message: 'Too many reports submitted. Please try again later.',
      data: null,
   },
});

reportsRouter.post('/', requireAuth, createReportRateLimit, httpCreateReport);

export default reportsRouter;
