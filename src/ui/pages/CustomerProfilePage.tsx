import { Link, useParams } from 'react-router-dom';
import type { CustomerDetail, Interaction, TimelineItem } from '../../shared/schemas.js';
import { api } from '../lib/api.js';
import { useFetch } from '../hooks/useFetch.js';
import { CHANNEL_LABELS, formatTimestamp } from '../lib/format.js';
import { ChannelBadge, DirectionBadge, KindBadge, StatusBadge } from '../components/Badges.js';
import CaptureForm from '../components/CaptureForm.js';
import AiCopilot from '../components/AiCopilot.js';
import { ErrorState, EmptyState, LoadingState } from '../components/States.js';

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, refresh } = useFetch<CustomerDetail>((_signal) => api.getCustomer(id ?? ''), [id]);

  if (!data && !error) return <LoadingState label="Loading profile…" />;
  if (error || !data) return <ErrorState message={error?.message ?? 'Customer not found.'} />;

  function handleCaptured(_interaction: Interaction) {
    refresh();
  }

  const capturedInteractions = data.activityTimeline
    .filter((item): item is Interaction & { source: 'captured' } => item.source === 'captured')
    .map((item) => ({ ...item }));

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/customers">Customer search</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{data.name}</span>
      </nav>

      <header className="profile-header">
        <div className="profile-header__avatar" aria-hidden="true">
          {data.name
            .split(' ')
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase()}
        </div>
        <div className="profile-header__text">
          <h1>{data.name}</h1>
          <p className="profile-header__handle">{data.handle}</p>
          <div className="profile-header__badges">
            <ChannelBadge channel={data.channel} />
            <StatusBadge status={data.status} />
          </div>
        </div>
      </header>

      <section className="panel" aria-labelledby="capture-heading">
        <h2 id="capture-heading">Capture interaction</h2>
        <p className="panel__sub">Record a raw social engagement for this customer.</p>
        <CaptureForm customerId={data.id} defaultChannel={data.channel} onCaptured={handleCaptured} />
        <p className="provenance-note">
          Saved as a <strong>CAPTURED</strong> interaction and shown in the timeline immediately. Use the AI Copilot
          below to draft, review and edit, then explicitly approve to log it as an approved activity.
        </p>
      </section>

      <AiCopilot interactions={capturedInteractions} onLogged={() => refresh()} />

      <div className="profile-grid">
        <div className="profile-column">
          <section className="panel" aria-labelledby="profile-heading">
            <h2 id="profile-heading">Profile</h2>
            <dl className="profile-facts">
              <div className="profile-facts__row">
                <dt>Summary</dt>
                <dd>{data.summary}</dd>
              </div>
              <div className="profile-facts__row">
                <dt>Bio</dt>
                <dd>{data.bio}</dd>
              </div>
              <div className="profile-facts__row">
                <dt>Location</dt>
                <dd>{data.location}</dd>
              </div>
              <div className="profile-facts__row">
                <dt>Joined</dt>
                <dd>{data.joinedYear}</dd>
              </div>
              <div className="profile-facts__row">
                <dt>Tags</dt>
                <dd>
                  {data.tags.length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    data.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))
                  )}
                </dd>
              </div>
            </dl>
            <p className="provenance-note">Seeded synthetic profile. No real customer data. </p>
          </section>

          <section className="panel" aria-labelledby="handle-heading">
            <h2 id="handle-heading">Social handle</h2>
            <div className="handle-card">
              <span className={`handle-card__icon handle-card__icon--${data.channel.toLowerCase()}`} aria-hidden="true">
                @
              </span>
              <div>
                <p className="handle-card__handle">{data.handle}</p>
                <p className="handle-card__meta">
                  {CHANNEL_LABELS[data.channel]} · profile fact, shown for reference
                </p>
              </div>
            </div>
            <p className="provenance-note">
              A social handle is a handle, never an identity claim. The app never resolves or infers identity from a
              handle; all profile facts here are seeded synthetic data.
            </p>
          </section>
        </div>

        <section className="panel timeline-panel" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading">Activity timeline</h2>
          <p className="panel__sub">Logged (approved) records and captured interactions, newest first.</p>
          {data.activityTimeline.length === 0 ? (
            <EmptyState
              title="No activity yet"
              message="Capture an interaction or log an approved activity to build this customer’s timeline."
            />
          ) : (
            <ol className="timeline">
              {data.activityTimeline.map((item) => (
                <TimelineEntry key={item.id} item={item} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  if (item.source === 'captured') {
    return (
      <li className="timeline__item">
        <div className="timeline__marker timeline__marker--captured" aria-hidden="true" />
        <article className="timeline__card timeline__card--captured">
          <div className="timeline__meta">
            <span className="badge badge--status captured">CAPTURED</span>
            <ChannelBadge channel={item.channel} />
            <DirectionBadge direction={item.direction} />
            <time dateTime={item.capturedAt}>{formatTimestamp(item.capturedAt)}</time>
          </div>
          <p className="timeline__content">{item.content}</p>
          <p className="timeline__approver">
            Captured by {item.capturedBy} · not yet logged — draft with the AI Copilot, then approve to log
          </p>
        </article>
      </li>
    );
  }

  return (
    <li className="timeline__item">
      <div className="timeline__marker" aria-hidden="true" />
      <article className="timeline__card">
        <div className="timeline__meta">
          <KindBadge kind={item.kind} />
          <ChannelBadge channel={item.channel} />
          <span className="timeline__direction">{item.direction}</span>
          <time dateTime={item.loggedAt}>{formatTimestamp(item.loggedAt)}</time>
        </div>
        <h3 className="timeline__summary">{item.summary}</h3>
        <div className="timeline__details">
          <p className="timeline__label">CRM note</p>
          <p>{item.crmNote}</p>
          <p className="timeline__label">Suggested response</p>
          {item.suggestedResponse ? (
            <blockquote className="timeline__response">{item.suggestedResponse}</blockquote>
          ) : (
            <p className="muted">None recorded.</p>
          )}
        </div>
        <p className="timeline__approver">Approved by {item.approvedBy} · synthetic record</p>
      </article>
    </li>
  );
}