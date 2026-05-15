import bcrypt from 'bcrypt';
import { prisma } from '../../utils/prisma.utils';

export const checkUserEmailExists = async (email: string) => {
   const existing = await prisma.profile.findUnique({
      where: { email },
      select: { id: true },
   });
   return Boolean(existing);
};

export const findUserByEmail = async (email: string) => {
   return prisma.profile.findUnique({
      where: { email },
   });
};

export const verifyUserPassword = async (
   plainPassword: string,
   passwordHash: string
) => {
   return bcrypt.compare(plainPassword, passwordHash);
};

export const createNewUserWithPassword = async (input: {
   name: string;
   email: string;
   passwordHash: string;
   type?: 'HUMAN' | 'AGENT';
}) => {
   return prisma.profile.create({
      data: {
         email: input.email,
         name: input.name.trim(),
         passwordHash: input.passwordHash,
         type: input.type ?? 'HUMAN',
         provider: 'local',
      },
   });
};

export const createGoogleUser = async (input: {
   email: string;
   name: string;
   passwordHash: string;
   providerId: string;
   avatar?: string;
}) => {
   return prisma.profile.create({
      data: {
         email: input.email,
         name: input.name.trim(),
         passwordHash: input.passwordHash,
         emailVerified: true,
         provider: 'google',
         providerId: input.providerId,
         avatarUrl: input.avatar,
      },
   });
};

export const markProfileEmailVerified = async (profileId: string) => {
   return prisma.profile.update({
      where: { id: profileId },
      data: {
         emailVerified: true,
      },
   });
};

export const createVerificationCodeForProfile = async (input: {
   profileId: string;
   code: string;
   expiresAt: Date;
}) => {
   return prisma.verificationCode.create({
      data: {
         profileId: input.profileId,
         code: input.code,
         expiresAt: input.expiresAt,
      },
   });
};

export const getLatestValidVerificationCode = async (input: {
   profileId: string;
   code: string;
}) => {
   return prisma.verificationCode.findFirst({
      where: {
         profileId: input.profileId,
         code: input.code,
         usedAt: null,
         expiresAt: {
            gt: new Date(),
         },
      },
      orderBy: {
         createdAt: 'desc',
      },
   });
};

export const markVerificationCodeUsed = async (verificationId: string) => {
   return prisma.verificationCode.update({
      where: { id: verificationId },
      data: {
         usedAt: new Date(),
      },
   });
};

export const findUserById = async (profileId: string) => {
   return prisma.profile.findUnique({
      where: { id: profileId },
   });
};

export const updateProfileOnboarding = async (input: {
   profileId: string;
   avatarUrl: string;
   interests: string[];
}) => {
   return prisma.profile.update({
      where: { id: input.profileId },
      data: {
         avatarUrl: input.avatarUrl,
         interests: input.interests,
      },
   });
};

export const createPasswordResetCode = async (input: {
   profileId: string;
   code: string;
   expiresAt: Date;
}) => {
   return prisma.passwordResetCode.create({
      data: {
         profileId: input.profileId,
         code: input.code,
         expiresAt: input.expiresAt,
      },
   });
};

export const getLatestValidPasswordResetCode = async (input: {
   profileId: string;
   code: string;
}) => {
   return prisma.passwordResetCode.findFirst({
      where: {
         profileId: input.profileId,
         code: input.code,
         usedAt: null,
         expiresAt: {
            gt: new Date(),
         },
      },
      orderBy: {
         createdAt: 'desc',
      },
   });
};

export const markPasswordResetCodeUsed = async (id: string) => {
   return prisma.passwordResetCode.update({
      where: { id },
      data: { usedAt: new Date() },
   });
};

export const updateProfilePassword = async (input: {
   profileId: string;
   passwordHash: string;
}) => {
   return prisma.profile.update({
      where: { id: input.profileId },
      data: { passwordHash: input.passwordHash },
   });
};
