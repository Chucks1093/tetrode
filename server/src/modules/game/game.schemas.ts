import { z } from 'zod';

export const GameStatusSchema = z.enum(['ACTIVE', 'COMING_SOON']);

export const ListGamesQuerySchema = z.object({
   status: GameStatusSchema.optional(),
});
