import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AgentAuthService } from '../services/agent-auth.service';
import { HTTP_STATUS } from '../utils/logger.utils';
import '../types/request.types';

function parseBearerToken(authHeader: string | undefined): string | null {
   if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
   }

   const token = authHeader.slice('Bearer '.length).trim();
   return token || null;
}

function clearResolvedActor(req: Request) {
   req.currentProfile = undefined;
   req.currentAgent = undefined;
}

async function resolveActorFromBearer(req: Request): Promise<boolean> {
   const authHeader = req.headers.authorization;
   if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
   }

   const maybeAgent = AgentAuthService.parseAgentBearerToken(authHeader);
   if (maybeAgent) {
      const agent = await AgentAuthService.getVerifiedAgentByToken(maybeAgent);
      if (!agent) return false;
      clearResolvedActor(req);
      req.currentAgent = agent;
      return true;
   }

   const token = parseBearerToken(authHeader);
   if (!token) return false;

   const sessionProfile = await AuthService.getSessionProfileByToken(token);
   if (!sessionProfile) return false;
   if (sessionProfile.profile.status !== 'ACTIVE') return false;

   clearResolvedActor(req);
   req.currentProfile = sessionProfile.profile;
   return true;
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

export async function requireActorAuth(
   req: Request,
   res: Response,
   next: NextFunction
) {
   try {
      const resolved = await resolveActorFromBearer(req);

      if (!resolved) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
         });
      }

      return next();
   } catch (error) {
      return next(error);
   }
}

export function requireAgentScope(scope: string) {
   return (req: Request, res: Response, next: NextFunction) => {
      const agent = req.currentAgent;
      if (!agent) {
         return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'Agent authentication required',
         });
      }

      if (!agent.scopes.includes(scope)) {
         return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: `Missing required scope: ${scope}`,
         });
      }

      return next();
   };
}
