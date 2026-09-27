import type { DraftKind, Interaction } from '../../shared/schemas.js';
import { DraftContentSchema } from '../../shared/schemas.js';
import { HttpError } from '../lib/errors.js';
import { config } from '../lib/config.js';
import type { InteractionContext } from './context.js';
import { mockGenerate } from './mock.js';
import { PROMPTS } from './prompts/templates.js';

export const MOCK_MODEL_ID = 'mock-copilot-v1';

export type DraftOutput = { content: string; model: string; promptVersion: string; mode: 'mock' };

export function generateDraftDrive(
  params: { kind: DraftKind; interaction: Interaction; context: InteractionContext },
): DraftOutput {
  if (config.ai.mode !== 'mock') {
    throw new HttpError(
      config.ai.keyIgnored
        ? 'AI_API_KEY is present but this build is mock-only, so the key is ignored and no external model is called. Remove AI_API_KEY to re-enable mock generation.'
        : 'No real LLM provider is wired into this build; the app runs in mock-AI mode only.',
      501,
      'AI_UNAVAILABLE',
    );
  }

  const content = mockGenerate(params);
  const parsed = DraftContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new HttpError('AI produced output that failed schema validation.', 502, 'AI_OUTPUT_INVALID');
  }

  return {
    content: parsed.data,
    model: MOCK_MODEL_ID,
    promptVersion: PROMPTS[params.kind].version,
    mode: 'mock',
  };
}