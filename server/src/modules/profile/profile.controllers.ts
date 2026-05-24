import bcrypt from 'bcrypt';
import { mintFreePass } from '../../services/leaderboard.service';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { createPrivateKey, createSign } from 'crypto';
import { envConfig, resolvedPrivyJwtPrivateKey } from '../../config';
import { AuthService } from '../../services/auth.service';
import { AsyncController } from '../../types/auth.types';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { SendMailAsync } from '../../utils/mail.utils';
import '../../types/request.types';
import {
   ProfileLoginSchema,
   ProfileRegisterSchema,
   ForgotPasswordSchema,
   ProfileUpdateSchema,
   ProfileWalletSchema,
   ResendVerificationSchema,
   ResetPasswordSchema,
   VerifyEmailSchema,
} from './profile.schemas';
import {
   checkUserEmailExists,
   createGoogleUser,
   createPasswordResetCode,
   createNewUserWithPassword,
   createVerificationCodeForProfile,
   findUserByEmail,
   findUserById,
   getLatestValidPasswordResetCode,
   getLatestValidVerificationCode,
   markPasswordResetCodeUsed,
   markProfileEmailVerified,
   markVerificationCodeUsed,
   updateProfileDetails,
   updateProfileWalletAddress,
   updateProfilePassword,
   verifyUserPassword,
} from './profile.utils';

const buildGoogleClient = (): OAuth2Client => {
   const redirectUri =
      envConfig.GOOGLE_REDIRECT_URI ||
      `${envConfig.BACKEND_URL}/api/v1/profile/google/callback`;

   return new OAuth2Client(
      envConfig.GOOGLE_CLIENT_ID,
      envConfig.GOOGLE_CLIENT_SECRET,
      redirectUri
   );
};

const toSafeProfile = (profile: {
   id: string;
   publicId?: string | null;
   email: string;
   name: string;
   type: 'HUMAN' | 'AGENT';
   status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
   emailVerified: boolean;
   avatarUrl?: string | null;
   provider?: string | null;
   walletAddress?: string | null;
   createdAt: Date;
}) => ({
   id: profile.publicId ?? profile.id,
   name: profile.name,
   email: profile.email,
   type: profile.type,
   status: profile.status,
   avatarUrl: profile.avatarUrl ?? undefined,
   provider: profile.provider ?? undefined,
   walletAddress: profile.walletAddress ?? undefined,
   emailVerified: profile.emailVerified,
   createdAt: profile.createdAt,
});

const generateVerificationCode = () =>
   String(Math.floor(100000 + Math.random() * 900000));

const sendVerificationCodeEmail = (email: string, code: string) => {
   SendMailAsync({
      to: email,
      subject: 'Verify your Tetrode email',
      text: `Your Tetrode verification code is ${code}. It expires in 10 minutes.`,
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Verify your email</h2>
        <p>Your Tetrode verification code is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${code}</p>
        <p>This code expires in 10 minutes.</p>
      </div>
      `,
   });
};

const readIpAddress = (req: Parameters<AsyncController>[0]) => {
   const forwarded = req.headers['x-forwarded-for'];
   if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim();
   }
   return req.ip;
};

const createSessionTokenForProfile = async (
   req: Parameters<AsyncController>[0],
   profileId: string
) => {
   return AuthService.createSession({
      profileId,
      userAgent: req.headers['user-agent'],
      ipAddress: readIpAddress(req),
   });
};

const parseBearerToken = (authHeader: string | undefined): string | null => {
   if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
   }

   const token = authHeader.slice('Bearer '.length).trim();
   return token || null;
};

const base64UrlEncode = (input: string | Buffer) =>
   Buffer.from(input)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

const normalizePrivateKey = (input: string) => {
   const normalized = input
      .trim()
      .replace(/^"|"$/g, '')
      .replace(/\\n/g, '\n');

   if (
      !normalized.includes('-----BEGIN PRIVATE KEY-----') &&
      !normalized.includes('-----BEGIN RSA PRIVATE KEY-----')
   ) {
      throw new Error(
         'PRIVY_JWT_PRIVATE_KEY must be a valid PEM private key.'
      );
   }

   return normalized;
};

const parseSigningKey = (input: string) => {
   const normalized = normalizePrivateKey(input);

   const attempts: Array<() => ReturnType<typeof createPrivateKey>> = [
      () =>
         createPrivateKey({
            key: normalized,
            format: 'pem',
            type: 'pkcs8',
         }),
      () =>
         createPrivateKey({
            key: normalized,
            format: 'pem',
            type: 'pkcs1',
         }),
      () =>
         createPrivateKey({
            key: normalized,
            format: 'pem',
         }),
   ];

   for (const attempt of attempts) {
      try {
         return attempt();
      } catch {
         continue;
      }
   }

   throw new Error(
      'PRIVY_JWT_PRIVATE_KEY could not be parsed. Make sure backend .env contains the PRIVATE key PEM, not the public certificate.'
   );
};

const createPrivyCustomAuthToken = (profile: {
   id: string;
   email: string;
   name: string;
}) => {
   const privateKey = resolvedPrivyJwtPrivateKey;
   const issuer = envConfig.PRIVY_JWT_ISSUER;
   const audience = envConfig.PRIVY_JWT_AUDIENCE;

   if (!privateKey || !issuer || !audience) {
      throw new Error(
         'Privy JWT auth is not fully configured. Missing PRIVY_JWT_PRIVATE_KEY, PRIVY_JWT_ISSUER, or PRIVY_JWT_AUDIENCE.'
         .replace('PRIVY_JWT_PRIVATE_KEY', 'PRIVY_JWT_PRIVATE_KEY or PRIVY_JWT_PRIVATE_KEY_PATH')
      );
   }

   const now = Math.floor(Date.now() / 1000);
   const header = {
      alg: 'RS256',
      typ: 'JWT',
      ...(envConfig.PRIVY_JWT_KID ? { kid: envConfig.PRIVY_JWT_KID } : {}),
   };
   const payload = {
      sub: profile.id,
      email: profile.email,
      name: profile.name,
      iss: issuer,
      aud: audience,
      iat: now,
      exp: now + 60 * 5,
   };

   const encodedHeader = base64UrlEncode(JSON.stringify(header));
   const encodedPayload = base64UrlEncode(JSON.stringify(payload));
   const signingInput = `${encodedHeader}.${encodedPayload}`;

   const signer = createSign('RSA-SHA256');
   signer.update(signingInput);
   signer.end();

   const signature = signer.sign(parseSigningKey(privateKey));

   return `${signingInput}.${base64UrlEncode(signature)}`;
};

export const httpProfileRegister: AsyncController = async (req, res, next) => {
   try {
      const validated = ProfileRegisterSchema.parse(req.body);
      const email = validated.email.toLowerCase();

      const emailExists = await checkUserEmailExists(email);
      if (emailExists) {
         return res.status(HTTP_STATUS.CONFLICT).json({
            success: false,
            message: 'Email already exists',
         });
      }

      const passwordHash = await bcrypt.hash(validated.password, 12);
      const user = await createNewUserWithPassword({
         name: validated.name,
         email,
         passwordHash,
         type: validated.type,
      });

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await createVerificationCodeForProfile({
         profileId: user.id,
         code,
         expiresAt,
      });
      sendVerificationCodeEmail(email, code);

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: 'Registration successful. Verification code sent.',
         data: {
            profile: toSafeProfile(user),
            requiresEmailVerification: true,
         },
      });
   } catch (error) {
      if (envConfig.MODE === 'development') {
         const message =
            error instanceof Error
               ? error.message
               : 'Could not create Privy auth token';

         return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message,
            data: null,
         });
      }

      next(error);
   }
};

export const httpProfileLogin: AsyncController = async (req, res, next) => {
   try {
      const validated = ProfileLoginSchema.parse(req.body);
      const email = validated.email.toLowerCase();
      const user = await findUserByEmail(email);

      if (!user) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Invalid credentials',
         });
      }

      if (!user.passwordHash) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Password login not available for this account',
         });
      }

      if (!user.emailVerified) {
         return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'Please verify your email before logging in',
         });
      }

      const isValidPassword = await verifyUserPassword(
         validated.password,
         user.passwordHash
      );

      if (!isValidPassword) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Invalid credentials',
         });
      }

      const sessionToken = await createSessionTokenForProfile(req, user.id);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Login successful',
         data: {
            profile: toSafeProfile(user),
            sessionToken,
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpProfileLogout: AsyncController = async (req, res, next) => {
   try {
      const token = parseBearerToken(req.headers.authorization);

      if (token) {
         await AuthService.revokeSessionByToken(token);
      }

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Logout successful',
      });
   } catch (error) {
      next(error);
   }
};

export const httpProfileMe: AsyncController = async (req, res, next) => {
   try {
      if (!req.currentProfile) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
            data: null,
         });
      }

      const profile = await findUserById(req.currentProfile.id);
      if (!profile) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Profile not found',
            data: null,
         });
      }

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Profile fetched successfully',
         data: toSafeProfile(profile),
      });
   } catch (error) {
      next(error);
   }
};

export const httpProfilePrivyToken: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      if (!req.currentProfile) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
            data: null,
         });
      }

      const profile = await findUserById(req.currentProfile.id);
      if (!profile) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Profile not found',
            data: null,
         });
      }

      const token = createPrivyCustomAuthToken({
         id: profile.id,
         email: profile.email,
         name: profile.name,
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Privy auth token created successfully',
         data: {
            token,
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpProfileUpdate: AsyncController = async (req, res, next) => {
   try {
      if (!req.currentProfile) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
            data: null,
         });
      }

      const validated = ProfileUpdateSchema.parse(req.body);

      const updatedProfile = await updateProfileDetails({
         profileId: req.currentProfile.id,
         name: validated.name,
         avatarUrl: validated.avatarUrl,
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Profile updated successfully',
         data: {
            profile: toSafeProfile(updatedProfile),
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpProfileGoogleStart: AsyncController = async (
   _req,
   res,
   next
) => {
   try {
      const client = buildGoogleClient();
      const authUrl = client.generateAuthUrl({
         access_type: 'offline',
         scope: ['openid', 'email', 'profile'],
         prompt: 'select_account',
      });

      return res.redirect(authUrl);
   } catch (error) {
      next(error);
   }
};

export const httpProfileGoogleCallback: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      const code =
         typeof req.query.code === 'string' ? req.query.code : undefined;

      if (!code) {
         return res.redirect(
            `${envConfig.FRONTEND_URL}/auth/callback?success=false&message=${encodeURIComponent(
               'Missing Google authorization code'
            )}`
         );
      }

      const client = buildGoogleClient();
      const { tokens } = await client.getToken(code);

      if (!tokens.access_token) {
         return res.redirect(
            `${envConfig.FRONTEND_URL}/auth/callback?success=false&message=${encodeURIComponent(
               'Google token missing'
            )}`
         );
      }

      const profileResponse = await fetch(
         'https://www.googleapis.com/oauth2/v2/userinfo',
         {
            headers: {
               Authorization: `Bearer ${tokens.access_token}`,
            },
         }
      );

      if (!profileResponse.ok) {
         return res.redirect(
            `${envConfig.FRONTEND_URL}/auth/callback?success=false&message=${encodeURIComponent(
               'Unable to fetch Google profile'
            )}`
         );
      }

      const googleProfile = (await profileResponse.json()) as {
         id?: string;
         email?: string;
         name?: string;
         picture?: string;
      };

      if (!googleProfile.email || !googleProfile.name || !googleProfile.id) {
         return res.redirect(
            `${envConfig.FRONTEND_URL}/auth/callback?success=false&message=${encodeURIComponent(
               'Google profile is missing required fields'
            )}`
         );
      }

      const email = googleProfile.email.toLowerCase();
      let user = await findUserByEmail(email);

      if (!user) {
        const generatedPassword = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(generatedPassword, 12);
        user = await createGoogleUser({
           email,
           name: googleProfile.name,
           passwordHash,
           providerId: googleProfile.id,
           avatar: googleProfile.picture,
         });
      } else if (!user.emailVerified) {
         user = await markProfileEmailVerified(user.id);
      }

      const sessionToken = await createSessionTokenForProfile(req, user.id);

      const redirectQuery = new URLSearchParams({
         success: 'true',
         profile: JSON.stringify(toSafeProfile(user)),
         token: sessionToken,
      });

      return res.redirect(
         `${envConfig.FRONTEND_URL}/auth/callback?${redirectQuery.toString()}`
      );
   } catch (error) {
      next(error);
   }
};

export const httpProfileVerifyEmail: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      const validated = VerifyEmailSchema.parse(req.body);
      const email = validated.email.toLowerCase();
      const profile = await findUserByEmail(email);

      if (!profile) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Profile not found',
         });
      }

      const verification = await getLatestValidVerificationCode({
         profileId: profile.id,
         code: validated.code,
      });

      if (!verification) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Invalid or expired verification code',
         });
      }

      await markVerificationCodeUsed(verification.id);
      const verifiedProfile = await markProfileEmailVerified(profile.id);
      const sessionToken = await createSessionTokenForProfile(
         req,
         verifiedProfile.id
      );

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Email verified successfully',
         data: {
            profile: toSafeProfile(verifiedProfile),
            sessionToken,
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpProfileResendVerification: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      const validated = ResendVerificationSchema.parse(req.body);
      const email = validated.email.toLowerCase();
      const profile = await findUserByEmail(email);

      if (!profile) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Profile not found',
         });
      }

      if (profile.emailVerified) {
         return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Email is already verified',
         });
      }

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await createVerificationCodeForProfile({
         profileId: profile.id,
         code,
         expiresAt,
      });
      sendVerificationCodeEmail(email, code);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Verification code sent',
      });
   } catch (error) {
      next(error);
   }
};


export const httpProfileUpdateWallet: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      if (!req.currentProfile) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
            data: null,
         });
      }

      const validated = ProfileWalletSchema.parse(req.body);
      const isFirstWallet = !req.currentProfile.walletAddress;

      const updatedProfile = await updateProfileWalletAddress({
         profileId: req.currentProfile.id,
         walletAddress: validated.walletAddress,
      });

      if (isFirstWallet) {
         void mintFreePass(validated.walletAddress);
      }

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Wallet updated successfully',
         data: {
            profile: toSafeProfile(updatedProfile),
         },
      });
   } catch (error) {
      next(error);
   }
};


export const httpProfileForgotPassword: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      const validated = ForgotPasswordSchema.parse(req.body);
      const email = validated.email.toLowerCase();
      const profile = await findUserByEmail(email);

      if (!profile) {
         return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'If the email exists, reset code has been sent',
         });
      }

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await createPasswordResetCode({
         profileId: profile.id,
         code,
         expiresAt,
      });

      SendMailAsync({
         to: email,
         subject: 'Reset your Tetrode password',
         text: `Your Tetrode reset code is ${code}. It expires in 10 minutes.`,
         html: `
         <div style="font-family: Arial, sans-serif; line-height: 1.5;">
           <h2>Reset your password</h2>
           <p>Your Tetrode reset code is:</p>
           <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${code}</p>
           <p>This code expires in 10 minutes.</p>
         </div>
         `,
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'If the email exists, reset code has been sent',
      });
   } catch (error) {
      next(error);
   }
};

export const httpProfileResetPassword: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      const validated = ResetPasswordSchema.parse(req.body);
      const email = validated.email.toLowerCase();

      const profile = await findUserByEmail(email);
      if (!profile) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Invalid reset request',
         });
      }

      const resetCode = await getLatestValidPasswordResetCode({
         profileId: profile.id,
         code: validated.resetCode,
      });

      if (!resetCode) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Invalid or expired reset code',
         });
      }

      const passwordHash = await bcrypt.hash(validated.newPassword, 12);

      await updateProfilePassword({
         profileId: profile.id,
         passwordHash,
      });

      await markPasswordResetCodeUsed(resetCode.id);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Password reset successful',
      });
   } catch (error) {
      next(error);
   }
};
