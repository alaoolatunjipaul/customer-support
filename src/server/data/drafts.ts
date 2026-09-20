import type { AiDraft, DraftKind, DraftSource } from '../../shared/schemas.js';

const KIND_ORDER: Record<DraftKind, number> = { SUMMARY: 0, CRM_NOTE: 1, RESPONSE: 2 };

let seq = 0;
const drafts: AiDraft[] = [];

export function resetDrafts(): void {
  seq = 0;
  drafts.length = 0;
}

export function latestRevision(interactionId: string, kind: DraftKind): number {
  let latest = 0;
  for (const draft of drafts) {
    if (draft.interactionId === interactionId && draft.kind === kind && draft.revision > latest) {
      latest = draft.revision;
    }
  }
  return latest;
}

export function createDraft(
  input: {
    interactionId: string;
    kind: DraftKind;
    content: string;
    model: string;
    promptVersion: string;
    source: DraftSource;
  },
): AiDraft {
  seq += 1;
  const now = new Date().toISOString();
  for (const draft of drafts) {
    if (draft.interactionId === input.interactionId && draft.kind === input.kind && !draft.supersededAt) {
      draft.supersededAt = now;
      draft.updatedAt = now;
    }
  }

  const draft: AiDraft = {
    id: `d-${seq}`,
    interactionId: input.interactionId,
    kind: input.kind,
    content: input.content,
    model: input.model,
    promptVersion: input.promptVersion,
    source: input.source,
    revision: latestRevision(input.interactionId, input.kind) + 1,
    createdAt: now,
    updatedAt: now,
    supersededAt: null,
    isSynthetic: true,
  };
  drafts.push(draft);
  return draft;
}

export function listCurrentDrafts(interactionId: string): AiDraft[] {
  return drafts
    .filter((d) => d.interactionId === interactionId && !d.supersededAt)
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

export function getCurrentDraft(id: string): AiDraft | undefined {
  return drafts.find((d) => d.id === id && !d.supersededAt);
}