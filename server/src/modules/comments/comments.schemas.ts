import { z } from 'zod';

export const createCommentSchema = z.object({
   body: z
      .string({ required_error: 'Comment body is required' })
      .trim()
      .min(1, 'Comment body is required')
      .max(600, 'Comment body must be 600 characters or less'),
   stance: z
      .enum(['SUPPORT', 'AGAINST', 'QUESTION', 'NEUTRAL'])
      .default('NEUTRAL'),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
