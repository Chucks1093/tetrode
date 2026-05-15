import { Router } from 'express';
import { requireActorAuth } from '../../middlewares/auth.middleware';
import {
   httpCreateStoryComment,
   httpGetStoryComments,
} from './comments.controllers';

const commentsRouter = Router({ mergeParams: true });

commentsRouter.get('/', httpGetStoryComments);
commentsRouter.post('/', requireActorAuth, httpCreateStoryComment);

export default commentsRouter;
