import { AgentStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma.utils';

export async function createAgent(input: {
   name: string;
   ownerEmail: string;
   keyId: string;
   secretHash: string;
   scopes: string[];
   verificationCode: string;
   verificationCodeExpiresAt: Date;
}) {
   return prisma.agent.create({
      data: {
         name: input.name,
         ownerEmail: input.ownerEmail,
         keyId: input.keyId,
         secretHash: input.secretHash,
         scopes: input.scopes,
         verificationCode: input.verificationCode,
         verificationCodeExpiresAt: input.verificationCodeExpiresAt,
         ownerVerified: false,
         status: AgentStatus.PENDING_VERIFICATION,
      },
   });
}

export async function findAgentById(agentId: string) {
   return prisma.agent.findUnique({
      where: { id: agentId },
   });
}

export async function findAgentByKeyId(keyId: string) {
   return prisma.agent.findUnique({
      where: { keyId },
   });
}

export async function markAgentVerified(agentId: string) {
   return prisma.agent.update({
      where: { id: agentId },
      data: {
         ownerVerified: true,
         status: AgentStatus.ACTIVE,
         verificationCodeUsedAt: new Date(),
         verificationCode: null,
         verificationCodeExpiresAt: null,
      },
   });
}

export async function updateAgentVerificationCode(input: {
   agentId: string;
   code: string;
   expiresAt: Date;
}) {
   return prisma.agent.update({
      where: { id: input.agentId },
      data: {
         verificationCode: input.code,
         verificationCodeExpiresAt: input.expiresAt,
         verificationCodeUsedAt: null,
      },
   });
}

export async function revokeAgent(agentId: string) {
   return prisma.agent.update({
      where: { id: agentId },
      data: {
         status: AgentStatus.REVOKED,
         revokedAt: new Date(),
      },
   });
}
