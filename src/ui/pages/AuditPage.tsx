import type { AuditEntry } from '../../shared/schemas.js';
import { api } from '../lib/api.js';
import { useFetch } from '../hooks/useFetch.js';
import { formatTimestamp } from '../lib/format.js';
import { EmptyState, ErrorState, LoadingState } from '../components/States.js';

const ACTION_LABELS: Record<string, string> = {
  CAPTURE: 'Interaction captured',
  AI_GENERATE: 'AI draft generated',
  DRAFT_EDIT: 'Draft edited',
  ACTIVITY_LOGGED: 'Activity logged',
};

function describe(entry: AuditEntry): string {
  const after = entry.payloadAfter as Record<string, unknown> | null;
  if (!after || typeof after !== 'object') return '';
  if (entry.action === 'AI_GENERATE' && typeof after.kind === 'string') {
    return `${after.kind} · model ${after.model}`;
  }
  if (entry.action === 'DRAFT_EDIT') {
    return `revision ${String(after.revision)}`;
  }
  if (entry.action === 'CAPTURE') {
    const channel = typeof after.channel === 'string' ? after.channel.toLowerCase() : '';
    const direction = typeof after.direction === 'string' ? after.direction.toLowerCase() : '';
    return `${channel} · ${direction}`;
  }
  if (entry.action === 'ACTIVITY_LOGGED' && typeof after.summary === 'string') {
    return after.summary.slice(0, 90);
  }
  return '';
}

export default function AuditPage() {
  const { data, error } = useFetch((_signal) => api.getAudit(200), []);

  if (error) return <ErrorState message={error.message} />;
  if (!data) return <LoadingState label="Loading audit log…" />;

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1>Audit log</h1>
          <p className="page__subtitle">
            Every capture, AI draft and approved log in this session, newest first. In-memory and reset on restart.
          </p>
        </div>
      </header>

      {data.items.length === 0 ? (
        <EmptyState
          title="No audit entries yet"
          message="Capture an interaction or generate a draft to start an audit trail."
        />
      ) : (
        <>
          <p className="results-count" aria-live="polite">
            {data.total} entr{data.total === 1 ? 'y' : 'ies'} recorded
          </p>
          <ol className="audit-list" aria-label="Audit entries">
            {data.items.map((entry) => (
              <li key={entry.id} className="audit-item">
                <div className="audit-item__meta">
                  <span className={`audit-item__action audit-item__action--${entry.action.toLowerCase()}`}>
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className="audit-item__entity">
                    {entry.entityType} · {entry.entityId}
                  </span>
                  <span className="audit-item__actor">{entry.actor}</span>
                  <time dateTime={entry.createdAt}>{formatTimestamp(entry.createdAt)}</time>
                </div>
                {describe(entry) ? <p className="audit-item__detail">{describe(entry)}</p> : null}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}