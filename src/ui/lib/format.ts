import type { Channel, ActivityKind } from '../../shared/schemas.js';

export const CHANNEL_LABELS: Record<Channel, string> = {
  X: 'X',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
};

export const KIND_LABELS: Record<ActivityKind, string> = {
  POST: 'Post',
  COMMENT: 'Comment',
  DM: 'Direct message',
  TICKET: 'Ticket',
  RESOLVED: 'Resolved',
  ESCALATED: 'Escalated',
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

export function formatTimestamp(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso));
}