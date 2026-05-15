import crypto from 'crypto';
import { prisma } from '../utils/prisma.utils';

const OWNER_VERIFY_TTL_MS = 1000 * 60 * 10;

export class AgentAuthService {
   static generateKeyId(): string {
      return `plak_${crypto.randomBytes(12).toString('hex')}`;
   }

   static generateSecret(): string {
      return `secret_${crypto.randomBytes(24).toString('hex')}`;
   }

   static hashSecret(secret: string): string {
      return crypto.createHash('sha256').update(secret).digest('hex');
   }

   static generateOwnerVerificationCode(): string {
      return String(Math.floor(100000 + Math.random() * 900000));
   }

   static ownerVerificationExpiry(): Date {
      return new Date(Date.now() + OWNER_VERIFY_TTL_MS);
   }

   static parseAgentBearerToken(
      authHeader: string | undefined
   ): { keyId: string; secret: string } | null {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return null;
      }

      const token = authHeader.slice('Bearer '.length).trim();
      if (!token.includes('.')) {
         return null;
      }

      const [keyId, secret] = token.split('.', 2);
      if (!keyId || !secret) {
         return null;
      }

      return { keyId, secret };
   }

   static async getVerifiedAgentByToken(input: { keyId: string; secret: string }) {
      const agent = await prisma.agent.findUnique({
         where: { keyId: input.keyId },
         select: {
            id: true,
            name: true,
            ownerEmail: true,
            ownerVerified: true,
            status: true,
            scopes: true,
            secretHash: true,
            revokedAt: true,
         },
      });

      if (!agent) return null;
      if (!agent.ownerVerified) return null;
      if (agent.status !== 'ACTIVE') return null;
      if (agent.revokedAt) return null;

      const incomingSecretHash = this.hashSecret(input.secret);
      if (incomingSecretHash !== agent.secretHash) {
         return null;
      }

      await prisma.agent.update({
         where: { id: agent.id },
         data: { lastUsedAt: new Date() },
      });

      return {
         id: agent.id,
         name: agent.name,
         ownerEmail: agent.ownerEmail,
         scopes: agent.scopes,
      };
   }
}
