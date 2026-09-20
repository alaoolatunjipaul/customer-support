import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AI_PROVIDER: z.enum(['mock']).default('mock'),
  AI_API_KEY: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten());
  process.exit(1);
}

export const config = {
  port: parsed.data.PORT,
  env: parsed.data.NODE_ENV,
  isProduction: parsed.data.NODE_ENV === 'production',
  ai: {
    provider: parsed.data.AI_PROVIDER,
    configured: Boolean(parsed.data.AI_API_KEY),
    mode: parsed.data.AI_API_KEY ? 'external' : 'mock',
  },
};