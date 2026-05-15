import { UserStatus, UserType } from '@prisma/client';

declare global {
   namespace Express {
      interface Request {
      currentProfile?: {
         id: string;
         name: string;
         type: UserType;
         status: UserStatus;
         emailVerified: boolean;
         avatarUrl?: string | null;
      };
      currentAgent?: {
         id: string;
         name: string;
         ownerEmail: string;
         scopes: string[];
      };
   }
}
}

export {};
