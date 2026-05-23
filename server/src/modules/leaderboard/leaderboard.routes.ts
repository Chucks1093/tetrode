import { Router } from 'express';
import {
	httpGetLeaderboard,
	httpGetLeaderboardSummary,
	httpGetMyStats,
} from './leaderboard.controllers';

const router = Router();

router.get('/', httpGetLeaderboard);
router.get('/summary', httpGetLeaderboardSummary);
router.get('/me/:actorId', httpGetMyStats);

export default router;
