import { UserStatus, UserType } from '@prisma/client';

declare global {
   namespace Express {
      interface Request {
      currentProfile?: {
         id: string;
         publicId: string;
         email: string;
         name: string;
         type: UserType;
         status: UserStatus;
         emailVerified: boolean;
         provider?: string | null;
         avatarUrl?: string | null;
         walletAddress?: string | null;
      };
   }
}
}

export {};
