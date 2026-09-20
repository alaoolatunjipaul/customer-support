import { HttpError } from '../lib/errors.js';
import * as db from '../data/db.js';
import { appendAudit } from '../data/audit.js';
import { resolveAgentName } from '../lib/agents.js';
import type { CaptureInteractionInput } from '../../shared/schemas.js';

export function captureInteraction(customerId: string, input: CaptureInteractionInput) {
  const customer = db.getCustomer(customerId);
  if (!customer) {
    throw new HttpError('Customer not found.', 404, 'NOT_FOUND');
  }

  const capturedBy = resolveAgentName(input.capturedBy);
  const interaction = db.createInteraction(customerId, {
    channel: input.channel,
    direction: input.direction,
    content: input.content,
    capturedBy,
  });

  if (!interaction) {
    throw new HttpError('Customer not found.', 404, 'NOT_FOUND');
  }

  appendAudit({
    actor: capturedBy,
    action: 'CAPTURE',
    entityType: 'interaction',
    entityId: interaction.id,
    payloadBefore: null,
    payloadAfter: { channel: interaction.channel, direction: interaction.direction, content: interaction.content },
  });

  return interaction;
}