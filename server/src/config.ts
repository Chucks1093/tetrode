import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({
   path: process.env.ENV_FILE || '.env',
});

export const envSchema = z.object({
   PORT: z.coerce.number().default(3000),
   MODE: z.enum(['development', 'production', 'test']).default('development'),
   DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required in the environment variables'),

   GMAIL_USER: z.string(),
   GMAIL_APP_PASSWORD: z.string(),
   RESEND_API_KEY: z.string().optional(),
   RESEND_FROM_EMAIL: z.string().email().optional(),
   // Google OAuth
   GOOGLE_CLIENT_ID: z
      .string()
      .min(1, 'GOOGLE_CLIENT_ID is required for Google OAuth'),
   GOOGLE_CLIENT_SECRET: z
      .string()
      .min(1, 'GOOGLE_CLIENT_SECRET is required for Google OAuth'),
   GOOGLE_REDIRECT_URI: z.string().url().optional(),

   // URLs
   BACKEND_URL: z.string().url(),
   FRONTEND_URL: z
      .string()
      .url('FRONTEND_URL must be a valid URL')
      .min(1, 'FRONTEND_URL is required'),

   // Cloudinary
   CLOUDINARY_CLOUD_NAME: z
      .string()
      .min(1, 'CLOUDINARY_CLOUD_NAME is required for image uploads'),
   CLOUDINARY_API_KEY: z
      .string()
      .min(1, 'CLOUDINARY_API_KEY is required for image uploads'),
   CLOUDINARY_API_SECRET: z
      .string()
      .min(1, 'CLOUDINARY_API_SECRET is required for image uploads'),

   PAYSTACK_SECRET_KEY: z
      .string()
      .min(1, 'PAYSTACK_SECRET_KEY is required for payment processing'),
   PAYSTACK_PUBLIC_KEY: z
      .string()
      .min(1, 'PAYSTACK_PUBLIC_KEY is required for payment processing')
      .optional(),
   PRIVY_APP_ID: z.string().optional(),
   PRIVY_APP_SECRET: z.string().optional(),
   PRIVY_JWT_ISSUER: z.string().optional(),
   PRIVY_JWT_AUDIENCE: z.string().optional(),
   PRIVY_JWT_PRIVATE_KEY: z.string().optional(),
   PRIVY_JWT_PRIVATE_KEY_PATH: z.string().optional(),
   PRIVY_JWT_KID: z.string().optional(),
   OPENCODE_PROVIDER: z.string().default('opencode'),
   OPENCODE_MODEL_ID: z.string().default('deep-deepseek-v4-flash'),
   OPENCODE_BASE_URL: z.string().url().default('http://127.0.0.1:4096'),

   // Celo leaderboard + payments
   ORACLE_PRIVATE_KEY: z.string().optional(),
   LEADERBOARD_CONTRACT_ADDRESS: z.string().optional(),
   TETRODE_PASS_CONTRACT_ADDRESS: z.string().optional(),
   TREASURY_WALLET_ADDRESS: z.string().optional(),
   USDC_CONTRACT_ADDRESS: z.string().optional(),
});

export const envConfig = envSchema.parse(process.env);

export const resolvedPrivyJwtPrivateKey = envConfig.PRIVY_JWT_PRIVATE_KEY_PATH
   ? fs.readFileSync(envConfig.PRIVY_JWT_PRIVATE_KEY_PATH, 'utf8')
   : envConfig.PRIVY_JWT_PRIVATE_KEY;

const developmentOrigins = ['http://localhost:5173', 'http://localhost:3000'];
const sharedOrigins = [
   'https://tetrode.netlify.app',
   'https://tetrode.xyz',
   'https://proofline-eight.vercel.app',
   'https://proofline.xyz',
];

const allowedOrigins = Array.from(
   new Set(
      [
         ...sharedOrigins,
         envConfig.FRONTEND_URL,
         ...(envConfig.MODE === 'development' ? developmentOrigins : []),
      ].filter(Boolean)
   )
);

export const appConfig = {
   allowedOrigins,
};
