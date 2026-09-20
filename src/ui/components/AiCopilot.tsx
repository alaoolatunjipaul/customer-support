import { useEffect, useState } from 'react';
import type { ActivityKind, AiDraft, DraftKind, Interaction } from '../../shared/schemas.js';
import { ApiError, api } from '../lib/api.js';
import { CHANNEL_LABELS, KIND_LABELS, formatTimestamp } from '../lib/format.js';
import { ChannelBadge, DirectionBadge } from './Badges.js';
import { EmptyState } from './States.js';

const DRAFT_CARDS: ReadonlyArray<{ kind: DraftKind; label: string; action: string; description: string }> = [
  { kind: 'SUMMARY', label: 'Summary', action: 'Summarize', description: 'Concise factual recap of the interaction.' },
  { kind: 'CRM_NOTE', label: 'CRM note', action: 'Generate CRM note', description: 'Canonical record draft for the CRM.' },
  { kind: 'RESPONSE', label: 'Customer response', action: 'Draft customer response', description: 'Customer-facing reply draft.' },
];

type Notice = { kind: 'success' | 'error'; message: string } | null;

type AiCopilotProps = {
  interactions: Interaction[];
  onLogged: () => void;
};

export default function AiCopilot({ interactions, onLogged }: AiCopilotProps) {
  const [selectedId, setSelectedId] = useState(interactions[0]?.id ?? '');
  const selected = interactions.find((i) => i.id === selectedId) ?? interactions[0];
  const [drafts, setDrafts] = useState<Partial<Record<DraftKind, AiDraft>>>({});
  const [values, setValues] = useState<Partial<Record<DraftKind, string>>>({});
  const [baselines, setBaselines] = useState<Partial<Record<DraftKind, string>>>({});
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [generating, setGenerating] = useState<DraftKind | null>(null);
  const [saving, setSaving] = useState<DraftKind | null>(null);
  const [logKind, setLogKind] = useState<ActivityKind>('DM');
  const [logConfirmed, setLogConfirmed] = useState(false);
  const [logging, setLogging] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    setSelectedId((prev) => (interactions.some((i) => i.id === prev) ? prev : (interactions[0]?.id ?? '')));
  }, [interactions]);

  const selectedInteractionId = selected?.id;

  useEffect(() => {
    if (!selectedInteractionId) {
      setDrafts({});
      setValues({});
      setBaselines({});
      setDraftLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadingDrafts(true);
    setDraftLoadError(null);
    api
      .getDrafts(selectedInteractionId)
      .then(({ items }) => {
        if (cancelled) return;
        const next: Partial<Record<DraftKind, AiDraft>> = {};
        const nextValues: Partial<Record<DraftKind, string>> = {};
        const nextBaselines: Partial<Record<DraftKind, string>> = {};
        for (const item of items) {
          next[item.kind] = item;
          nextValues[item.kind] = item.content;
          nextBaselines[item.kind] = item.content;
        }
        setDrafts(next);
        setValues(nextValues);
        setBaselines(nextBaselines);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDraftLoadError(err instanceof ApiError ? err.message : 'Could not load drafts.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDrafts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedInteractionId, retryTick]);

  if (interactions.length === 0) {
    return (
      <section className="panel ai-panel" aria-labelledby="ai-heading">
        <h2 id="ai-heading">AI Copilot</h2>
        <p className="panel__sub">Advisory drafts only — never sent automatically and never written to the CRM.</p>
        <EmptyState
          title="No interaction captured yet"
          message="Capture a social interaction in the panel above, then return here to generate AI drafts."
        />
      </section>
    );
  }

  const busy = generating !== null || saving !== null || logging;

  function isDirty(kind: DraftKind) {
    return (values[kind] ?? '') !== (baselines[kind] ?? '');
  }

  async function handleGenerate(kind: DraftKind) {
    const other = DRAFT_CARDS.find((card) => card.kind === kind);
    if (!selected || !other) return;
    setNotice(null);
    setGenerating(kind);
    try {
      const { draft } = await api.generateDraft(selected.id, kind);
      setDrafts((prev) => ({ ...prev, [kind]: draft }));
      setValues((prev) => ({ ...prev, [kind]: draft.content }));
      setBaselines((prev) => ({ ...prev, [kind]: draft.content }));
      setNotice({ kind: 'success', message: `${other.label} generated (revision ${draft.revision}).` });
    } catch (err) {
      setNotice({
        kind: 'error',
        message: err instanceof ApiError ? err.message : `Could not generate the ${other.label.toLowerCase()}.`,
      });
    } finally {
      setGenerating(null);
    }
  }

  async function handleSave(kind: DraftKind) {
    const draft = drafts[kind];
    if (!selected || !draft) return;
    const content = values[kind]?.trim();
    if (!content) return;
    setNotice(null);
    setSaving(kind);
    try {
      const { draft: updated } = await api.updateDraft(selected.id, draft.id, content);
      setDrafts((prev) => ({ ...prev, [kind]: updated }));
      setValues((prev) => ({ ...prev, [kind]: updated.content }));
      setBaselines((prev) => ({ ...prev, [kind]: updated.content }));
      setNotice({ kind: 'success', message: `${DRAFT_CARDS.find((c) => c.kind === kind)?.label} saved (revision ${updated.revision}).` });
    } catch (err) {
      setNotice({
        kind: 'error',
        message: err instanceof ApiError ? err.message : 'Could not save the draft.',
      });
    } finally {
      setSaving(null);
    }
  }

  async function handleLog() {
    if (!selected || !logConfirmed) return;
    setNotice(null);
    setLogging(true);
    try {
      await api.logInteraction(selected.id, logKind);
      setNotice({ kind: 'success', message: 'Activity logged and added to the activity timeline.' });
      setLogConfirmed(false);
      onLogged();
    } catch (err) {
      setNotice({
        kind: 'error',
        message: err instanceof ApiError ? err.message : 'Could not log the activity.',
      });
    } finally {
      setLogging(false);
    }
  }

  const anyDirty = DRAFT_CARDS.some((card) => isDirty(card.kind));

  return (
    <section className="panel ai-panel" aria-labelledby="ai-heading">
      <h2 id="ai-heading">AI Copilot</h2>
      <p className="panel__sub">Advisory drafts only — never sent automatically and never written to the CRM.</p>

      {notice ? (
        <p className={`capture-form__notice capture-form__notice--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          {notice.message}
        </p>
      ) : null}

      <div className="ai-source">
        <div className="ai-source__head">
          <label className="ai-source__label" htmlFor="ai-interaction">
            Interaction to draft
          </label>
          <select
            id="ai-interaction"
            value={selected?.id ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {interactions.map((i) => (
              <option key={i.id} value={i.id}>
                {CHANNEL_LABELS[i.channel]} · {i.capturedAt.slice(0, 10)} · {i.direction === 'INBOUND' ? 'inbound' : 'outbound'}
              </option>
            ))}
          </select>
        </div>
        {selected ? (
          <div className="ai-source__meta">
            <ChannelBadge channel={selected.channel} />
            <DirectionBadge direction={selected.direction} />
            <time dateTime={selected.capturedAt}>{formatTimestamp(selected.capturedAt)}</time>
          </div>
        ) : null}
        <p className="ai-source__content">{selected?.content}</p>
        <p className="provenance-note">
          Grounding rule: drafts may only use this interaction. Nothing is invented or imported, and missing details are
          flagged rather than filled in.
        </p>
      </div>

      <div className="ai-actions" role="group" aria-label="Generate draft actions">
        {DRAFT_CARDS.map(({ kind, action }) => (
          <button
            key={kind}
            type="button"
            className="btn btn--primary"
            disabled={busy || !selected}
            onClick={() => handleGenerate(kind)}
          >
            {generating === kind ? 'Drafting…' : action}
          </button>
        ))}
      </div>

      {draftLoadError ? (
        <p className="ai-panel__error" role="alert">
          Could not load drafts: {draftLoadError}{' '}
          <button type="button" className="btn" onClick={() => setRetryTick((t) => t + 1)}>
            Retry
          </button>
        </p>
      ) : null}

      <div className="ai-grid">
        {DRAFT_CARDS.map(({ kind, label, description }) => {
          const draft = drafts[kind];
          return (
            <article key={kind} className="ai-card" aria-label={`${label} draft card`}>
              <div className="ai-card__head">
                <h3 id={`ai-${kind.toLowerCase()}`} className="ai-card__label">
                  {label}
                </h3>
                {draft && draft.model.startsWith('mock') ? (
                  <span className="badge badge--mock" title="Deterministic mock output; no real LLM call">
                    MOCK
                  </span>
                ) : null}
              </div>
              <p className="panel__sub">{description}</p>

              {loadingDrafts && !draft && !draftLoadError ? (
                <p className="ai-card__loading" role="status">
                  <span className="spinner" aria-hidden="true" />
                  Loading drafts…
                </p>
              ) : generating === kind ? (
                <p className="ai-card__loading" role="status">
                  <span className="spinner" aria-hidden="true" />
                  Generating {label.toLowerCase()}…
                </p>
              ) : !draft ? (
                <p className="muted">Not generated yet. Use “{DRAFT_CARDS.find((c) => c.kind === kind)?.action}”.</p>
              ) : (
                <>
                  <textarea
                    className="ai-card__input"
                    aria-label={`${label} draft`}
                    rows={6}
                    value={values[kind] ?? ''}
                    onChange={(event) => setValues((prev) => ({ ...prev, [kind]: event.target.value }))}
                  />
                  <p className="ai-card__provenance">
                    Revision {draft.revision} · prompt {draft.promptVersion} · {draft.model}
                    {draft.isSynthetic ? ' · synthetic' : ''}
                  </p>
                  <p className="ai-card__advisory">
                    Draft only — never sent automatically and never written to the CRM.
                    {kind === 'RESPONSE' ? ' A human sends it from the channel tool after review.' : ''}
                  </p>
                  <div className="ai-card__actions" role="group" aria-label={`${label} draft actions`}>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={busy || !isDirty(kind) || !(values[kind]?.trim() ?? '')}
                      onClick={() => handleSave(kind)}
                    >
                      {saving === kind ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className="btn" disabled={busy} onClick={() => handleGenerate(kind)}>
                      Regenerate
                    </button>
                  </div>
                  {values[kind] !== undefined && !values[kind]!.trim() ? (
                    <p className="ai-card__empty-warn" role="status">
                      The {label.toLowerCase()} draft is empty and cannot be saved — add content or regenerate.
                    </p>
                  ) : null}
                </>
              )}
            </article>
          );
        })}
      </div>

      <div className="ai-log" role="region" aria-label="Approve and log this interaction">
        <div className="ai-log__head">
          <h3>Approve & log activity</h3>
          <span className="badge badge--status captured">PENDING LOG</span>
        </div>
        <p className="panel__sub">
          Explicit sign-off step. Logging records this interaction in the synthetic activity timeline — it is never
          sent to the customer and never written to a real CRM.
        </p>

        <p className="ai-log__preview-label">Will be logged</p>
        <ul className="ai-log__preview">
          {DRAFT_CARDS.map(({ kind, label }) => {
            const saved = drafts[kind]?.content?.trim();
            return (
              <li key={kind}>
                <span className="ai-log__preview-kind">{label}</span>
                <span className={saved ? '' : 'muted'}>
                  {saved ? saved : 'Not generated — the captured message is used instead.'}
                </span>
              </li>
            );
          })}
        </ul>
        {anyDirty ? (
          <p className="ai-log__warn" role="status">
            You have unsaved draft edits. Save them first so they are included in the logged record.
          </p>
        ) : null}

        <div className="ai-log__controls">
          <div className="ai-log__field">
            <label htmlFor="log-kind">Activity kind</label>
            <select
              id="log-kind"
              value={logKind}
              onChange={(event) => setLogKind(event.target.value as ActivityKind)}
              disabled={logging}
            >
              {(Object.keys(KIND_LABELS) as ActivityKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </div>
          <label className="ai-log__confirm">
            <input
              type="checkbox"
              checked={logConfirmed}
              onChange={(event) => setLogConfirmed(event.target.checked)}
              disabled={logging}
            />
            I have reviewed the drafts and confirm logging this activity.
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!logConfirmed || logging || anyDirty}
            onClick={handleLog}
          >
            {logging ? 'Logging…' : 'Approve & log activity'}
          </button>
        </div>
      </div>
    </section>
  );
}