import { Prisma } from '@prisma/client';
import { AsyncController } from '../../types/auth.types';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { prisma } from '../../utils/prisma.utils';
import { ListGamesQuerySchema } from './game.schemas';
import { serializeGame } from './game.utils';

function getRouteParam(value: string | string[] | undefined) {
   return Array.isArray(value) ? value[0] : value;
}

export const httpListGames: AsyncController = async (req, res, next) => {
   try {
      const validated = ListGamesQuerySchema.parse(req.query);

      const where: Prisma.GameWhereInput = {
         ...(validated.status ? { status: validated.status } : {}),
      };

      const games = await prisma.game.findMany({
         where,
         orderBy: { createdAt: 'asc' },
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Games fetched successfully',
         data: games.map(serializeGame),
      });
   } catch (error) {
      next(error);
   }
};

export const httpGetGameById: AsyncController = async (req, res, next) => {
   try {
      const gameId = getRouteParam(req.params.gameId);
      if (!gameId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'gameId is required',
            data: null,
         });
      }

      const game = await prisma.game.findUnique({
         where: { publicId: gameId },
      });

      if (!game) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Game not found',
            data: null,
         });
      }

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Game fetched successfully',
         data: serializeGame(game),
      });
   } catch (error) {
      next(error);
   }
};
