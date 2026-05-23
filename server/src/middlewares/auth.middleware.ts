import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { HTTP_STATUS } from '../utils/logger.utils';
import '../types/request.types';

function parseBearerToken(authHeader: string | undefined): string | null {
   if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
   const token = authHeader.slice('Bearer '.length).trim();
   return token || null;
}

export async function requireAuth(
   req: Request,
   res: Response,
   next: NextFunction
) {
   try {
      const token = parseBearerToken(req.headers.authorization);

      if (!token) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
         });
      }

      const sessionProfile = await AuthService.getSessionProfileByToken(token);

      if (!sessionProfile) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Invalid or expired session',
         });
      }

      if (sessionProfile.profile.status !== 'ACTIVE') {
         return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'Profile is not active',
         });
      }

      req.currentProfile = sessionProfile.profile;
      return next();
   } catch (error) {
      return next(error);
   }
}
