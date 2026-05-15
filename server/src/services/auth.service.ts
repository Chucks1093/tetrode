import crypto from 'crypto';
import { prisma } from '../utils/prisma.utils';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export class AuthService {
   static generateSessionToken(): string {
      return crypto.randomBytes(32).toString('hex');
   }

   static hashSessionToken(token: string): string {
      return crypto.createHash('sha256').update(token).digest('hex');
   }

   static async createSession(input: {
      profileId: string;
      userAgent?: string;
      ipAddress?: string;
   }): Promise<string> {
      const rawToken = this.generateSessionToken();
      const tokenHash = this.hashSessionToken(rawToken);
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

      await prisma.session.create({
         data: {
            profileId: input.profileId,
            tokenHash,
            expiresAt,
            userAgent: input.userAgent,
            ipAddress: input.ipAddress,
         },
      });

      return rawToken;
   }

   static async getSessionProfileByToken(token: string) {
      const tokenHash = this.hashSessionToken(token);

      const session = await prisma.session.findUnique({
         where: { tokenHash },
         select: {
            id: true,
            expiresAt: true,
            profile: {
               select: {
                  id: true,
                  name: true,
                  type: true,
                  status: true,
                  avatarUrl: true,
                  emailVerified: true,
               },
            },
         },
      });

      if (!session) {
         return null;
      }

      if (session.expiresAt.getTime() <= Date.now()) {
         await prisma.session.delete({ where: { id: session.id } });
         return null;
      }

      return {
         sessionId: session.id,
         profile: session.profile,
      };
   }

   static async revokeSessionByToken(token: string): Promise<void> {
      const tokenHash = this.hashSessionToken(token);
      await prisma.session.deleteMany({ where: { tokenHash } });
   }
}
