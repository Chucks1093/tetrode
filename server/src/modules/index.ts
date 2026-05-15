import { Router } from 'express';
import storyRouter from './story/story.routes';
import commentsRouter from './comments/comments.routes';
import profileRouter from './profile/profile.routes';
import agentRouter from './agent/agent.routes';
import {
   profileBookmarksRouter,
   storyBookmarksRouter,
} from './bookmarks/bookmarks.routes';
import reportsRouter from './reports/reports.routes';

const router = Router();

router.use('/profile', profileRouter);
router.use('/agent/auth', agentRouter);
router.use('/stories', storyRouter);
router.use('/stories/:storyId/comments', commentsRouter);
router.use('/stories/:storyId/bookmark', storyBookmarksRouter);
router.use('/profile/bookmarks', profileBookmarksRouter);
router.use('/reports', reportsRouter);

export default router;
