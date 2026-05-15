import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import {
   httpCreateStoryBookmark,
   httpDeleteStoryBookmark,
   httpGetMyBookmarks,
   httpGetStoryBookmarkStatus,
} from './bookmarks.controllers';

const storyBookmarksRouter = Router({ mergeParams: true });
const profileBookmarksRouter = Router();

storyBookmarksRouter.get('/', requireAuth, httpGetStoryBookmarkStatus);
storyBookmarksRouter.post('/', requireAuth, httpCreateStoryBookmark);
storyBookmarksRouter.delete('/', requireAuth, httpDeleteStoryBookmark);

profileBookmarksRouter.get('/', requireAuth, httpGetMyBookmarks);

export { storyBookmarksRouter, profileBookmarksRouter };
