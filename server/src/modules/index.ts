import { Router } from 'express';
import profileRouter from './profile/profile.routes';
import gameRouter from './game/game.routes';
import chatRouter from './chat/chat.routes';
import roomRouter from './room/room.routes';

const router = Router();

router.use('/profile', profileRouter);
router.use('/games', gameRouter);
router.use('/rooms/:roomId/chat', chatRouter);
router.use('/rooms', roomRouter);

export default router;
