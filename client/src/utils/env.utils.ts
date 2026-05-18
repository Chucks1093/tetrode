import { z } from 'zod';

const envSchema = z.object({
	VITE_BACKEND_URL: z.string().default('/api'),
	VITE_PRIVY_APP_ID: z.string().optional(),
});

export const env = envSchema.parse({
	VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
	VITE_PRIVY_APP_ID: import.meta.env.VITE_PRIVY_APP_ID,
});
