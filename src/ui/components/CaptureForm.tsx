import { useState } from 'react';
import type { Channel, Direction, Interaction } from '../../shared/schemas.js';
import { ApiError, api } from '../lib/api.js';
import { CHANNEL_LABELS } from '../lib/format.js';

const CONTENT_MAX = 2000;

type FieldErrors = { content?: string };
type Notice = { kind: 'success' | 'error'; message: string } | null;

type CaptureFormProps = {
  customerId: string;
  defaultChannel: Channel;
  onCaptured: (interaction: Interaction) => void;
};

export default function CaptureForm({ customerId, defaultChannel, onCaptured }: CaptureFormProps) {
  const [channel, setChannel] = useState<Channel>(defaultChannel);
  const [direction, setDirection] = useState<Direction>('INBOUND');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const trimmed = content.trim();
    if (trimmed.length === 0) next.content = 'Content is required.';
    else if (trimmed.length > CONTENT_MAX) next.content = `Content is limited to ${CONTENT_MAX} characters.`;
    return next;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (next.content) {
      setNotice(null);
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await api.captureInteraction(customerId, {
        channel,
        direction,
        content: content.trim(),
      });
      setContent('');
      setNotice({ kind: 'success', message: 'Interaction captured and added to the timeline.' });
      onCaptured(response.interaction);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not save the interaction.';
      setNotice({ kind: 'error', message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="capture-form" onSubmit={handleSubmit} noValidate>
      <div className="capture-form__row">
        <div className="capture-form__field">
          <label htmlFor={`channel-${customerId}`}>Channel</label>
          <select
            id={`channel-${customerId}`}
            value={channel}
            onChange={(event) => setChannel(event.target.value as Channel)}
          >
            {(['X', 'INSTAGRAM', 'FACEBOOK'] as const).map((option) => (
              <option key={option} value={option}>
                {CHANNEL_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
        <div className="capture-form__field">
          <label htmlFor={`direction-${customerId}`}>Direction</label>
          <select
            id={`direction-${customerId}`}
            value={direction}
            onChange={(event) => setDirection(event.target.value as Direction)}
          >
            <option value="INBOUND">Inbound (customer → us)</option>
            <option value="OUTBOUND">Outbound (us → customer)</option>
          </select>
        </div>
      </div>

      <div className="capture-form__field">
        <label htmlFor={`content-${customerId}`}>Interaction content</label>
        <textarea
          id={`content-${customerId}`}
          rows={4}
          maxLength={CONTENT_MAX}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            if (errors.content) setErrors({});
          }}
          aria-invalid={errors.content ? true : undefined}
          aria-describedby={errors.content ? `content-error-${customerId}` : `content-count-${customerId}`}
          placeholder="Paste or type the post, comment, or DM…"
        />
        <span className="capture-form__count" id={`content-count-${customerId}`}>
          {content.length}/{CONTENT_MAX}
        </span>
        {errors.content ? (
          <p className="capture-form__error" id={`content-error-${customerId}`} role="alert">
            {errors.content}
          </p>
        ) : null}
      </div>

      {notice ? (
        <p className={`capture-form__notice capture-form__notice--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          {notice.message}
        </p>
      ) : null}

      <button type="submit" className="btn btn--primary capture-form__submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Capture interaction'}
      </button>
    </form>
  );
}