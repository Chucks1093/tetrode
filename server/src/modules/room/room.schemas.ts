import { z } from 'zod';

export const RoomStatusSchema = z.enum(['WAITING', 'ACTIVE', 'FINISHED']);
export const ParticipantTypeSchema = z.enum(['HUMAN', 'AI']);

export const CreateRoomSchema = z.object({
   gameId: z.string().trim().min(1),
   actorId: z.string().trim().min(1).max(191),
   displayName: z.string().trim().min(1).max(32),
   walletAddress: z.string().trim().optional(),
});

export const ListRoomsQuerySchema = z.object({
   gameId: z.string().trim().min(1).optional(),
   status: RoomStatusSchema.optional(),
   limit: z.coerce.number().int().min(1).max(50).default(20),
   offset: z.coerce.number().int().min(0).default(0),
});

export const JoinRoomSchema = z.object({
   type: ParticipantTypeSchema,
   actorId: z.string().trim().min(1).max(191),
   displayName: z.string().trim().min(1).max(32),
   walletAddress: z.string().trim().optional(),
});

export const LeaveRoomSchema = z.object({
   participantId: z.string().trim().min(1),
});
