import { Link } from 'react-router-dom';
import type { Dashboard } from '../../shared/schemas.js';
import { api } from '../lib/api.js';
import { useFetch } from '../hooks/useFetch.js';
import { CHANNEL_LABELS, formatShortDate } from '../lib/format.js';
import StatCard from '../components/StatCard.js';
import { ChannelBadge, DirectionBadge, KindBadge } from '../components/Badges.js';
import { EmptyState, ErrorState, LoadingState } from '../components/States.js';

export default function DashboardPage() {
  const { data, error } = useFetch<Dashboard>((_signal) => api.getDashboard(), []);

  if (!data && !error) return <LoadingState label="Loading dashboard…" />;
  if (error || !data) return <ErrorState message={error?.message ?? 'No data.'} />;

  const total = data.byChannel.reduce((sum, item) => sum + item.count, 0);
  const maxChannel = Math.max(...data.byChannel.map((item) => item.count), 1);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1>Dashboard</h1>
          <p className="page__subtitle">
            Synthetic demo workspace — AI drafts, a human reviews and approves every logged record.
          </p>
        </div>
        <Link className="btn btn--primary" to="/customers">
          Find a customer
        </Link>
      </header>

      <section className="stats-grid" aria-label="Key figures">
        <StatCard label="Customers" value={data.totalCustomers} hint="Synthetic profiles" />
        <StatCard label="Logged activities" value={data.totalActivities} hint="Human-approved records" />
        <StatCard label="Open items" value={data.openInteractions} hint="Tickets + escalations" />
        <StatCard label="Today’s activity" value={data.todayActivities} hint="Logged today" />
      </section>

      <div className="dashboard-grid">
        <section className="panel" aria-labelledby="channel-heading">
          <h2 id="channel-heading">Customers by channel</h2>
          <ul className="channel-bars">
            {data.byChannel.map((item) => (
              <li key={item.channel} className="channel-bar">
                <div className="channel-bar__row">
                  <span className="channel-bar__label">{CHANNEL_LABELS[item.channel]}</span>
                  <span className="channel-bar__count">
                    {item.count} · {total === 0 ? '0' : Math.round((item.count / total) * 100)}%
                  </span>
                </div>
                <div className="channel-bar__track">
                  <div
                    className={`channel-bar__fill channel-bar__fill--${item.channel.toLowerCase()}`}
                    style={{ width: `${Math.max((item.count / maxChannel) * 100, 4)}%` }}
                  >
                    {null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel" aria-labelledby="recent-heading">
          <h2 id="recent-heading">Recent logged activity</h2>
          {data.recentActivities.length === 0 ? (
            <EmptyState title="No activity yet" message="Approved activity will appear here." />
          ) : (
            <ul className="recent-list">
              {data.recentActivities.map((activity) => (
                <li key={activity.id} className="recent-item">
                  <div className="recent-item__meta">
                    <KindBadge kind={activity.kind} />
                    <ChannelBadge channel={activity.channel} />
                    <DirectionBadge direction={activity.direction} />
                    <time dateTime={activity.loggedAt}>{formatShortDate(activity.loggedAt)}</time>
                  </div>
                  <p className="recent-item__summary">{activity.summary}</p>
                  <Link className="recent-item__customer" to={`/customers/${activity.customerId}`}>
                    {activity.customerName} · <span className="recent-item__handle">{activity.customerHandle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}