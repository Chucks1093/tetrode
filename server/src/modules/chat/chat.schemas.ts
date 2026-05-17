import { z } from 'zod';

export const CreateChatMessageSchema = z.object({
   senderId: z.string().trim().min(1),
   content: z.string().trim().min(1).max(4000),
});

export const ListChatMessagesQuerySchema = z.object({
   limit: z.coerce.number().int().min(1).max(100).default(50),
});
