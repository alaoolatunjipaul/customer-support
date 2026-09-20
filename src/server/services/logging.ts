import { HttpError } from '../lib/errors.js';
import * as db from '../data/db.js';
import { listCurrentDrafts } from '../data/drafts.js';
import { appendAudit } from '../data/audit.js';
import { resolveAgentName } from '../lib/agents.js';
import type { Activity, LogInteractionInput } from '../../shared/schemas.js';

function stripDraftBanner(content: string): string {
  return content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !(trimmed.startsWith('[') && trimmed.endsWith(']') && !trimmed.includes('\n'));
    })
    .join('\n')
    .trim();
}

export function logInteraction(interactionId: string, input: LogInteractionInput): Activity {
  const interaction = db.getInteraction(interactionId);
  if (!interaction) {
    throw new HttpError('Interaction not found.', 404, 'NOT_FOUND');
  }
  if (interaction.status === 'LOGGED') {
    throw new HttpError('Interaction is already logged.', 409, 'ALREADY_LOGGED');
  }

  const approvedBy = resolveAgentName(input.actor);
  const drafts = listCurrentDrafts(interactionId);
  const draftByKind = new Map(drafts.map((d) => [d.kind, d.content]));
  const summary = draftByKind.get('SUMMARY') ? stripDraftBanner(draftByKind.get('SUMMARY')!) : interaction.content;
  const crmNote = draftByKind.get('CRM_NOTE') ? stripDraftBanner(draftByKind.get('CRM_NOTE')!) : interaction.content;
  const suggestedResponse = draftByKind.get('RESPONSE')
    ? stripDraftBanner(draftByKind.get('RESPONSE')!)
    : null;

  const activity = db.createLoggedActivity(interaction.customerId, {
    kind: input.kind,
    channel: interaction.channel,
    direction: interaction.direction,
    summary,
    crmNote,
    suggestedResponse,
    approvedBy,
  });

  db.markInteractionLogged(interactionId);

  appendAudit({
    actor: approvedBy,
    action: 'ACTIVITY_LOGGED',
    entityType: 'activity',
    entityId: activity.id,
    payloadBefore: { interactionStatus: interaction.status },
    payloadAfter: {
      interactionId,
      kind: activity.kind,
      summary: activity.summary,
      crmNote: activity.crmNote,
      suggestedResponse: activity.suggestedResponse,
      channel: activity.channel,
      direction: activity.direction,
    },
  });

  return activity;
}