import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Channel, CustomerListResponse } from '../../shared/schemas.js';
import { api } from '../lib/api.js';
import { useFetch } from '../hooks/useFetch.js';
import { CHANNEL_LABELS } from '../lib/format.js';
import { ChannelBadge, StatusBadge } from '../components/Badges.js';
import { EmptyState, ErrorState, LoadingState } from '../components/States.js';

const PAGE_SIZE = 20;

function parseChannel(value: string | null): Channel | 'ALL' {
  if (value === 'X' || value === 'INSTAGRAM' || value === 'FACEBOOK') return value;
  return 'ALL';
}

export default function CustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const channel = parseChannel(searchParams.get('channel'));
  const page = Math.max(Number(searchParams.get('page') ?? 1), 1);
  const [draft, setDraft] = useState(search);

  useEffect(() => {
    setDraft(search);
  }, [search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (draft) next.set('search', draft);
        else next.delete('search');
        next.delete('page');
        return next;
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [draft, setSearchParams]);

  const { data, error } = useFetch<CustomerListResponse>(
    (_signal) =>
      api.getCustomers({
        search: search || undefined,
        channel,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
    [search, channel, page],
  );

  function updateParams(patch: Record<string, string | null>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      return next;
    });
  }

  if (error) return <ErrorState message={error.message} />;
  if (!data) return <LoadingState label="Searching…" />;

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1>Customer search</h1>
          <p className="page__subtitle">Search by name or handle, filter by channel.</p>
        </div>
      </header>

      <form
        className="customer-toolbar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          updateParams({ search: draft || null, page: null });
        }}
      >
        <div className="search-field">
          <label className="sr-only" htmlFor="customer-search">
            Search customers
          </label>
          <input
            id="customer-search"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Name or @handle…"
            autoComplete="off"
          />
        </div>

        <div className="channel-filter" role="group" aria-label="Filter by channel">
          {(['ALL', 'X', 'INSTAGRAM', 'FACEBOOK'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`channel-filter__option${channel === option ? ' is-active' : ''}`}
              aria-pressed={channel === option}
              onClick={() => {
                updateParams({ channel: option === 'ALL' ? null : option, page: null });
              }}
            >
              {option === 'ALL' ? 'All' : CHANNEL_LABELS[option]}
            </button>
          ))}
        </div>
      </form>

      {data.items.length === 0 ? (
        <EmptyState
          title="No customers match"
          message={`No synthetic customers match "${search || 'your filters'}". Try a different name, handle, or channel.`}
        />
      ) : (
        <>
          <p className="results-count" aria-live="polite">
            {data.total} result{data.total === 1 ? '' : 's'}
            {search ? ` for "${search}"` : ''} {channel !== 'ALL' ? ` on ${CHANNEL_LABELS[channel]}` : ''}
          </p>
          <ul className="customer-list" aria-label="Customer results">
            {data.items.map((customer) => (
              <li key={customer.id}>
                <Link
                  className="customer-row"
                  to={`/customers/${customer.id}`}
                  aria-label={`Open profile for ${customer.name}`}
                >
                  <span className="customer-row__avatar" aria-hidden="true">
                    {customer.name
                      .split(' ')
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')
                      .toUpperCase()}
                  </span>
                  <span className="customer-row__main">
                    <span className="customer-row__name">{customer.name}</span>
                    <span className="customer-row__handle">{customer.handle}</span>
                    <span className="customer-row__summary">{customer.summary}</span>
                  </span>
                  <span className="customer-row__right">
                    <ChannelBadge channel={customer.channel} />
                    <StatusBadge status={customer.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {data.total > PAGE_SIZE ? (
            <nav className="pagination" aria-label="Pagination">
              <button
                type="button"
                className="btn"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                Previous
              </button>
              <span className="pagination__info" aria-live="polite">
                Page {page} of {Math.max(Math.ceil(data.total / PAGE_SIZE), 1)}
              </span>
              <button
                type="button"
                className="btn"
                disabled={page * PAGE_SIZE >= data.total}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}