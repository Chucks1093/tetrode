import { z } from 'zod';

export const AgentRegisterSchema = z.object({
   name: z.string().trim().min(2).max(80),
   ownerEmail: z.string().trim().toLowerCase().email(),
});

export const AgentVerifyOwnerSchema = z.object({
   agentId: z.string().trim().min(1),
   code: z.string().trim().regex(/^\d{6}$/),
});

export const AgentResendOwnerCodeSchema = z.object({
   agentId: z.string().trim().min(1),
});

export const AgentRevokeSchema = z.object({
   agentId: z.string().trim().min(1),
});
