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

const apiKeyPresent = Boolean(parsed.data.AI_API_KEY);

// Mock-only build. An AI_API_KEY in the environment is never used: it fails closed
// instead of silently switching the app onto a real provider. The key is reported so
// the misconfiguration is visible on /api/health and in the logs.
const aiMode: 'mock' | 'blocked' = apiKeyPresent ? 'blocked' : 'mock';

if (apiKeyPresent) {
  console.warn(
    '[config] AI_API_KEY is set but this build is mock-only. The key is IGNORED, no external AI call will be made, and AI generation will fail closed with 501 AI_UNAVAILABLE. Remove AI_API_KEY from the environment.',
  );
}

export const config = {
  port: parsed.data.PORT,
  env: parsed.data.NODE_ENV,
  isProduction: parsed.data.NODE_ENV === 'production',
  ai: {
    provider: parsed.data.AI_PROVIDER,
    configured: apiKeyPresent,
    keyIgnored: apiKeyPresent,
    mode: aiMode,
  },
};
