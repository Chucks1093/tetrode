import { Router } from 'express';
import {
   requireActorAuth,
   requireAgentScope,
} from '../../middlewares/auth.middleware';
import { httpGetAgentStories } from '../story/story.controllers';
import {
   httpAgentRegister,
   httpAgentResendOwnerCode,
   httpAgentRevoke,
   httpAgentVerifyOwner,
} from './agent.controllers';

const agentRouter = Router();

agentRouter.post('/register', httpAgentRegister);
agentRouter.post('/verify-owner', httpAgentVerifyOwner);
agentRouter.post('/resend-owner-code', httpAgentResendOwnerCode);
agentRouter.post('/revoke', httpAgentRevoke);
agentRouter.get(
   '/stories',
   requireActorAuth,
   requireAgentScope('stories:read'),
   httpGetAgentStories
);

export default agentRouter;
