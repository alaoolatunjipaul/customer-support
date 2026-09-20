import type { AuditEntry } from '../../shared/schemas.js';

let seq = 0;
let entries: AuditEntry[] = [];

export type NewAuditEntry = Omit<AuditEntry, 'id' | 'createdAt'>;

export function appendAudit(entry: NewAuditEntry): AuditEntry {
  seq += 1;
  const now = new Date().toISOString();
  const record: AuditEntry = {
    id: `aud-${now.replace(/\D/g, '').slice(0, 14)}-${seq}`,
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    payloadBefore: entry.payloadBefore,
    payloadAfter: entry.payloadAfter,
    createdAt: now,
  };
  entries.push(record);
  return record;
}

export function listAudit(limit?: number): { items: AuditEntry[]; total: number } {
  const ordered = [...entries].reverse();
  if (entries.length === 0) return { items: [], total: 0 };
  const items = typeof limit === 'number' ? ordered.slice(0, Math.max(limit, 1)) : ordered;
  return { items, total: entries.length };
}

export function resetAudit(): void {
  seq = 0;
  entries = [];
}