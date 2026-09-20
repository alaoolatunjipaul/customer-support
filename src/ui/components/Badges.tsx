import type { ActivityKind, Channel, CustomerStatus, Direction } from '../../shared/schemas.js';
import { CHANNEL_LABELS, KIND_LABELS } from '../lib/format.js';

export function ChannelBadge({ channel }: { channel: Channel }) {
  return <span className={`badge badge--channel badge--${channel.toLowerCase()}`}>{CHANNEL_LABELS[channel]}</span>;
}

export function KindBadge({ kind }: { kind: ActivityKind }) {
  return <span className="badge badge--kind">{KIND_LABELS[kind]}</span>;
}

export function StatusBadge({ status }: { status: CustomerStatus }) {
  return <span className={`badge badge--status badge--${status.toLowerCase()}`}>{status}</span>;
}

export function DirectionBadge({ direction }: { direction: Direction }) {
  return <span className={`badge badge--direction badge--${direction.toLowerCase()}`}>{direction}</span>;
}