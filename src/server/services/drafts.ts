import { HttpError } from '../lib/errors.js';
import * as db from '../data/db.js';
import { createDraft, getCurrentDraft, listCurrentDrafts } from '../data/drafts.js';
import { appendAudit } from '../data/audit.js';
import { resolveAgentName } from '../lib/agents.js';
import { assembleInteractionContext } from '../ai/context.js';
import { generateDraftDrive } from '../ai/client.js';
import type { AiDraft, DraftKind } from '../../shared/schemas.js';

function requireInteraction(interactionId: string) {
  const interaction = db.getInteraction(interactionId);
  if (!interaction) {
    throw new HttpError('Interaction not found.', 404, 'NOT_FOUND');
  }
  return interaction;
}

export function generateDraft(interactionId: string, kind: DraftKind, actorId?: string): AiDraft {
  const interaction = requireInteraction(interactionId);
  const context = assembleInteractionContext(interaction);
  const output = generateDraftDrive({ kind, interaction, context });

  const draft = createDraft({
    interactionId,
    kind,
    content: output.content,
    model: output.model,
    promptVersion: output.promptVersion,
    source: {
      channel: interaction.channel,
      direction: interaction.direction,
      content: interaction.content,
      capturedAt: interaction.capturedAt,
    },
  });

  appendAudit({
    actor: resolveAgentName(actorId),
    action: 'AI_GENERATE',
    entityType: 'ai_draft',
    entityId: draft.id,
    payloadBefore: null,
    payloadAfter: {
      kind: draft.kind,
      content: draft.content,
      model: draft.model,
      promptVersion: draft.promptVersion,
      mode: output.mode,
    },
  });

  return draft;
}

export function listDraftsForInteraction(interactionId: string): { items: AiDraft[]; total: number } {
  requireInteraction(interactionId);
  const items = listCurrentDrafts(interactionId);
  return { items, total: items.length };
}

export function updateDraftContent(interactionId: string, draftId: string, content: string): AiDraft {
  const current = getCurrentDraft(draftId);
  if (!current || current.interactionId !== interactionId) {
    throw new HttpError('Draft not found.', 404, 'NOT_FOUND');
  }

  const next = createDraft({
    interactionId: current.interactionId,
    kind: current.kind,
    content,
    model: current.model,
    promptVersion: current.promptVersion,
    source: current.source,
  });

  appendAudit({
    actor: resolveAgentName(undefined),
    action: 'DRAFT_EDIT',
    entityType: 'ai_draft',
    entityId: next.id,
    payloadBefore: { content: current.content, revision: current.revision },
    payloadAfter: { content: next.content, revision: next.revision },
  });

  return next;
}