import { z } from 'zod';

export const createReportSchema = z.object({
   targetType: z.enum(['STORY', 'COMMENT'], {
      required_error: 'targetType is required',
   }),
   targetId: z
      .string({ required_error: 'targetId is required' })
      .trim()
      .min(1, 'targetId is required'),
   reason: z.enum(['MISINFORMATION', 'HARASSMENT', 'SPAM', 'HATE', 'OTHER'], {
      required_error: 'reason is required',
   }),
   details: z
      .string()
      .trim()
      .max(1000, 'details must be 1000 characters or less')
      .optional()
      .transform(value => (value && value.length > 0 ? value : undefined)),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
