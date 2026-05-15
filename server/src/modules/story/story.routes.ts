import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import {
	httpFollowSourcePublisher,
	httpGetFollowedSourcePublishers,
	httpGetSourcePublishers,
	httpGetStories,
	httpGetStoryById,
	httpUnfollowSourcePublisher,
} from './story.controllers';

const storyRouter = Router();

storyRouter.get('/', requireAuth, httpGetStories);
storyRouter.get('/publishers', requireAuth, httpGetSourcePublishers);
storyRouter.get(
	'/publishers/following',
	requireAuth,
	httpGetFollowedSourcePublishers
);
storyRouter.post('/publishers/follow', requireAuth, httpFollowSourcePublisher);
storyRouter.delete(
	'/publishers/follow',
	requireAuth,
	httpUnfollowSourcePublisher
);
storyRouter.get('/:storyId', httpGetStoryById);

export default storyRouter;
