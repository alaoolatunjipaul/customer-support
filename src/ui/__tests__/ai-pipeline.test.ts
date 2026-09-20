import { describe, expect, it, beforeEach } from 'vitest';
import type { Interaction } from '../../shared/schemas.js';
import { CaptureInteractionInputSchema, DraftContentSchema, UpdateDraftInputSchema } from '../../shared/schemas.js';
import { assembleInteractionContext } from '../../server/ai/context.js';
import { mockGenerate } from '../../server/ai/mock.js';
import { createDraft, listCurrentDrafts, resetDrafts } from '../../server/data/drafts.js';
import { createInteraction, getCustomer, getDashboard, resetDb } from '../../server/data/db.js';
import { listAudit, resetAudit } from '../../server/data/audit.js';
import { HttpError } from '../../server/lib/errors.js';
import { logInteraction } from '../../server/services/logging.js';
import { captureInteraction } from '../../server/services/interactions.js';
import { updateDraftContent } from '../../server/services/drafts.js';

const INTERACTION: Interaction = {
  id: 'i-0001',
  customerId: 'c-001',
  channel: 'X',
  direction: 'INBOUND',
  content: 'Hi, is my order #4829 going to ship this Friday?',
  status: 'CAPTURED',
  capturedBy: 'Demo Agent',
  capturedAt: '2026-09-20T10:00:00.000Z',
  isSynthetic: true,
};

const NO_REFERENCE: Interaction = {
  ...INTERACTION,
  id: 'i-0002',
  content: 'Is the kiln-dried vase still available?',
};

beforeEach(() => {
  resetDrafts();
  resetDb();
  resetAudit();
});

describe('mock AI pipeline', () => {
  it('is deterministic for identical input', () => {
    const context = assembleInteractionContext(INTERACTION);
    const first = mockGenerate({ kind: 'SUMMARY', interaction: INTERACTION, context });
    const second = mockGenerate({ kind: 'SUMMARY', interaction: INTERACTION, context });
    expect(first).toBe(second);
  });

  it('grounds the summary in the interaction and flags missing information', () => {
    const context = assembleInteractionContext(NO_REFERENCE);
    const summary = mockGenerate({ kind: 'SUMMARY', interaction: NO_REFERENCE, context });

    expect(summary).toContain('Is the kiln-dried vase still available?');
    expect(summary).toContain('order reference — not provided in the message');
    expect(summary).toContain('Missing information');
    expect(summary).toContain('neutral');
    expect(summary).not.toContain('order #4829');
  });

  it('does not invent an order reference it was not given', () => {
    const context = assembleInteractionContext(NO_REFERENCE);
    const response = mockGenerate({ kind: 'RESPONSE', interaction: NO_REFERENCE, context });

    expect(response).toContain('order number');
    expect(response).not.toContain('#4829');
    expect(response).toContain('Not sent — draft for human review');
    expect(response).toContain('Hi!');
  });

  it('keeps every draft within the shared output schema, including for very long content', () => {
    const longInteraction: Interaction = {
      ...INTERACTION,
      id: 'i-0003',
      content: 'a'.repeat(3000),
    };
    const context = assembleInteractionContext(longInteraction);
    expect(context.content).toContain('content truncated for context budget');

    for (const kind of ['SUMMARY', 'CRM_NOTE', 'RESPONSE'] as const) {
      const output = mockGenerate({ kind, interaction: longInteraction, context });
      expect(DraftContentSchema.parse(output)).toBe(output);
    }
  });

  it('creates a versioned draft and supersedes the previous revision', () => {
    const source = {
      channel: 'X' as const,
      direction: 'INBOUND' as const,
      content: 'original',
      capturedAt: '2026-09-20T10:00:00.000Z',
    };
    const first = createDraft({
      interactionId: 'i-0001',
      kind: 'CRM_NOTE',
      content: 'v1',
      model: 'mock-copilot-v1',
      promptVersion: 'crm-note-2026-09-20-v1',
      source,
    });
    const second = createDraft({
      interactionId: 'i-0001',
      kind: 'CRM_NOTE',
      content: 'v2',
      model: 'mock-copilot-v1',
      promptVersion: 'crm-note-2026-09-20-v1',
      source,
    });

    expect(first.revision).toBe(1);
    expect(first.supersededAt).not.toBeNull();
    expect(second.revision).toBe(2);
    expect(second.supersededAt).toBeNull();

    const current = listCurrentDrafts('i-0001');
    expect(current).toHaveLength(1);
    expect(current[0]!.content).toBe('v2');
  });
});

describe('log interaction service', () => {
  function seedInteraction() {
    const interaction = createInteraction('c-001', {
      channel: 'X',
      direction: 'INBOUND',
      content: 'Hi, is my order #4829 going to ship this Friday?',
      capturedBy: 'Demo Agent',
    });
    if (!interaction) throw new Error('seeding failed');
    return interaction;
  }

  it('logs an activity from saved drafts and strips advisory banner lines', () => {
    const interaction = seedInteraction();
    const source = {
      channel: 'X' as const,
      direction: 'INBOUND' as const,
      content: interaction.content,
      capturedAt: interaction.capturedAt,
    };
    createDraft({
      interactionId: interaction.id,
      kind: 'SUMMARY',
      content: '[Not sent — draft for human review before sending.]\nCustomer asks if order #4829 ships this Friday.',
      model: 'mock-copilot-v1',
      promptVersion: 'summary-2026-09-20-v1',
      source,
    });
    createDraft({
      interactionId: interaction.id,
      kind: 'RESPONSE',
      content: 'Hi! Here is the tracking update for order #4829.',
      model: 'mock-copilot-v1',
      promptVersion: 'response-2026-09-20-v1',
      source,
    });

    const activity = logInteraction(interaction.id, { kind: 'DM', actor: 'Demo Agent' });

    expect(activity.kind).toBe('DM');
    expect(activity.channel).toBe('X');
    expect(activity.direction).toBe('INBOUND');
    expect(activity.isSynthetic).toBe(true);
    expect(activity.approvedBy).toBe('Demo Agent');
    expect(activity.summary).toContain('order #4829 ships this Friday');
    expect(activity.summary).not.toContain('[Not sent');
    expect(activity.suggestedResponse).toBe('Hi! Here is the tracking update for order #4829.');
  });

  it('falls back to the captured message when no drafts exist, and uses no suggested response', () => {
    const interaction = seedInteraction();
    const activity = logInteraction(interaction.id, { kind: 'DM' });

    expect(activity.summary).toBe(interaction.content);
    expect(activity.crmNote).toBe(interaction.content);
    expect(activity.suggestedResponse).toBeNull();
  });

  it('moves the interaction into the customer timeline as a logged activity and out of captured', () => {
    const interaction = seedInteraction();
    const activity = logInteraction(interaction.id, { kind: 'DM', actor: 'Demo Agent' });

    const customer = getCustomer('c-001');
    expect(customer).toBeDefined();
    expect(customer!.activityTimeline.some((item) => item.source === 'logged' && item.id === activity.id)).toBe(true);
    expect(customer!.activityTimeline[0]).toMatchObject({ id: activity.id, source: 'logged' });
    expect(customer!.activityTimeline.some((item) => item.source === 'captured')).toBe(false);
  });

  it('rejects logging an unknown interaction with a 404 NOT_FOUND HttpError', () => {
    try {
      logInteraction('i-missing', { kind: 'DM' });
      expect.unreachable('logging a missing interaction should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpErr = err as HttpError;
      expect(httpErr.status).toBe(404);
      expect(httpErr.code).toBe('NOT_FOUND');
      expect(httpErr.message).toMatch(/Interaction not found/i);
    }
  });

  it('rejects logging the same interaction twice with a 409 ALREADY_LOGGED HttpError', () => {
    const interaction = seedInteraction();
    logInteraction(interaction.id, { kind: 'DM' });
    try {
      logInteraction(interaction.id, { kind: 'DM' });
      expect.unreachable('logging a duplicate interaction should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpErr = err as HttpError;
      expect(httpErr.status).toBe(409);
      expect(httpErr.code).toBe('ALREADY_LOGGED');
      expect(httpErr.message).toMatch(/already logged/i);
    }
  });

  it('appends an ACTIVITY_LOGGED audit entry with the logged payload', () => {
    const interaction = seedInteraction();
    const activity = logInteraction(interaction.id, { kind: 'DM', actor: 'Demo Agent' });

    const { items } = listAudit();
    expect(items).toHaveLength(1);
    const entry = items[0]!;
    expect(entry.action).toBe('ACTIVITY_LOGGED');
    expect(entry.actor).toBe('Demo Agent');
    expect(entry.entityType).toBe('activity');
    expect(entry.entityId).toBe(activity.id);
    expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect((entry.payloadAfter as { kind: string }).kind).toBe('DM');
  });

  it('updates the dashboard totals and recent activity after logging', () => {
    const interaction = seedInteraction();
    const before = getDashboard();
    const activity = logInteraction(interaction.id, { kind: 'DM', actor: 'Demo Agent' });
    const after = getDashboard();

    expect(after.totalActivities).toBe(before.totalActivities + 1);
    expect(after.todayActivities).toBe(before.todayActivities + 1);
    expect(after.recentActivities.some((item) => item.id === activity.id)).toBe(true);
    const surfaced = after.recentActivities.find((item) => item.id === activity.id)!;
    expect(surfaced).toMatchObject({ kind: 'DM', customerId: 'c-001', customerName: 'Maya Keller' });
  });

  it('captures to an unknown customer with a 404 NOT_FOUND HttpError', () => {
    try {
      captureInteraction('c-missing', { channel: 'X', direction: 'INBOUND', content: 'hello', capturedBy: 'Demo Agent' });
      expect.unreachable('capturing for a missing customer should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpErr = err as HttpError;
      expect(httpErr.status).toBe(404);
      expect(httpErr.code).toBe('NOT_FOUND');
    }
  });

  it('rejects empty capture content and empty draft updates at the schema boundary', () => {
    expect(CaptureInteractionInputSchema.safeParse({ channel: 'X', direction: 'INBOUND', content: '' }).success).toBe(false);
    expect(CaptureInteractionInputSchema.safeParse({ channel: 'X', direction: 'INBOUND', content: '   ' }).success).toBe(false);
    expect(UpdateDraftInputSchema.safeParse({ content: '' }).success).toBe(false);
    expect(UpdateDraftInputSchema.safeParse({ content: '   ' }).success).toBe(false);
    const ok = CaptureInteractionInputSchema.safeParse({ channel: 'X', direction: 'INBOUND', content: 'hello' });
    expect(ok.success).toBe(true);
  });

  it('reverts only a draft onto a new revision and records a DRAFT_EDIT audit entry', () => {
    const interaction = seedInteraction();
    const source = {
      channel: 'X' as const,
      direction: 'INBOUND' as const,
      content: interaction.content,
      capturedAt: interaction.capturedAt,
    };
    const first = createDraft({
      interactionId: interaction.id,
      kind: 'SUMMARY',
      content: 'original draft',
      model: 'mock-copilot-v1',
      promptVersion: 'summary-2026-09-20-v1',
      source,
    });
    const edited = updateDraftContent(interaction.id, first.id, 'edited by the agent');

    expect(edited.revision).toBe(2);
    expect(edited.content).toBe('edited by the agent');
    expect(edited.supersededAt).toBeNull();

    const { items } = listAudit();
    const editEntry = items.find((entry) => entry.action === 'DRAFT_EDIT');
    expect(editEntry).toBeDefined();
    const before = editEntry!.payloadBefore as { revision: number };
    const after = editEntry!.payloadAfter as { revision: number };
    expect(before.revision).toBe(1);
    expect(after.revision).toBe(2);
  });
});