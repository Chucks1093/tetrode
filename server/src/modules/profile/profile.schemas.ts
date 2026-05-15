import { z } from 'zod';

export const UserTypeSchema = z.enum(['HUMAN', 'AGENT']);

export const ProfileRegisterSchema = z.object({
   name: z.string().min(2, 'Name must be at least 2 characters'),
   email: z.string().email('Invalid email address'),
   password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-z]/, 'At least one lowercase')
      .regex(/[A-Z]/, 'At least one uppercase')
      .regex(/[0-9]/, 'At least one number'),
   type: UserTypeSchema.default('HUMAN'),
});

export const ProfileLoginSchema = z.object({
   email: z.string().email('Invalid email address'),
   password: z.string().min(1, 'Password is required'),
});

export const ProfileUpdateSchema = z.object({
   name: z.string().min(2, 'Name must be at least 2 characters').optional(),
   avatarUrl: z.string().url('Invalid avatar URL').optional(),
});


const onboardingInterestValues = [
   'world',
   'politics',
   'business',
   'tech',
   'global',
   'sports',
   'finance',
   'ai',
   'science',
   'health',
   'climate',
   'energy',
   'crypto',
   'security',
   'startup',
   'media',
   'culture',
   'education',
   'travel',
   'africa',
   'europe',
   'americas',
] as const;

export const ProfileOnboardingSchema = z.object({
   avatarUrl: z.string().min(1, 'Avatar is required'),
   interests: z
      .array(z.enum(onboardingInterestValues))
      .min(1, 'Select at least one interest'),
});


export const ForgotPasswordSchema = z.object({
   email: z.string().email('Invalid email address'),
});

export const ResetPasswordSchema = z
   .object({
      email: z.string().email('Invalid email address'),
      resetCode: z
         .string()
         .length(6, 'Reset code must be 6 digits')
         .regex(/^\d{6}$/, 'Reset code must be numeric'),
      newPassword: z
         .string()
         .min(8, 'At least 8 characters')
         .regex(/[a-z]/, 'At least one lowercase')
         .regex(/[A-Z]/, 'At least one uppercase')
         .regex(/[0-9]/, 'At least one number'),
      confirmPassword: z.string().min(8, 'Confirm password is required'),
   })
   .refine(data => data.newPassword === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
   });

export const VerifyEmailSchema = z.object({
   email: z.string().email('Invalid email address'),
   code: z
      .string()
      .length(6, 'Verification code must be 6 digits')
      .regex(/^\d{6}$/, 'Verification code must be numeric'),
});

export const ResendVerificationSchema = z.object({
   email: z.string().email('Invalid email address'),
});

export type ProfileRegisterInput = z.infer<typeof ProfileRegisterSchema>;
export type ProfileLoginInput = z.infer<typeof ProfileLoginSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
export type ProfileOnboardingInput = z.infer<typeof ProfileOnboardingSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;
