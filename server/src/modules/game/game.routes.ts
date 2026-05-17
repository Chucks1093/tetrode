import { Router } from 'express';
import { httpGetGameById, httpListGames } from './game.controllers';

const gameRouter = Router();

gameRouter.get('/', httpListGames);
gameRouter.get('/:gameId', httpGetGameById);

export default gameRouter;
