import type { Activity, Agent, CustomerProfile, Channel, Direction, ActivityKind } from '../../../shared/schemas.js';

const SEED = 0x9e3779b9;
const DAY_MS = 86_400_000;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Maya', 'Dario', 'Priya', 'Jonas', 'Lena', 'Omar', 'Ivy', 'Tomas', 'Amina', 'Felix',
  'Noor', 'Ravi', 'Elif', 'Caleb', 'Simone', 'Kei', 'Valentina', 'Marcus', 'Ingrid', 'Pedro',
  'Zara', 'Ilya', 'Sophie', 'Andre', 'Yuki', 'Nadia', 'Oscar', 'Freya', 'Diego', 'Amara',
];

const LAST_NAMES = [
  'Lindqvist', 'Okafor', 'Raman', 'Keller', 'Nowak', 'Haddad', 'Petrov', 'Castillo', 'Ali', 'Moreau',
  'Sato', 'Bauer', 'Ferrari', 'Nakamura', 'Rojas', 'Ivanov', 'Schmidt', 'Okonkwo', 'Diaz', 'Weber',
  'Khan', 'Lin', 'Silva', 'Johansson', 'Novak', 'Chen', 'Ahmed', 'Kowalski', 'Berg', 'Sousa',
];

const HANDLE_SUFFIXES = ['', '00', '_21', 'x', '79', '_', '88', '26', 's', '7'];

const TOWNS = [
  'Port Falls', 'Riverton', 'Lakewood', 'Northbridge', 'Ashfield', 'Cedar Hollow', 'Maple Ridge',
  'Westgrove', 'Stone Creek', 'Harborview', 'Briarcliff', 'Frostburn', 'Greenwater', 'Beacon Hill',
  'Silverpine', 'Old Mill', 'Fernbrook', 'Crowland', 'Dawson Mills', 'Highfield',
];

const BIO_TEMPLATES = [
  'Small-batch ceramicist in {town}. Catches up on {channel} orders between kiln firings.',
  'Runs a family food stall in {town}. Weekend recipes + menu updates land here first.',
  'Tour guide around {town} and a camera-first storyteller. Replies best on {channel}.',
  'Handmade goods, one at a time. Ships from {town} every Tuesday.',
  'Plant shop open Saturdays in {town}. Posts about restocks and care guides.',
  'Indie game tweaker crashing bugs between {town} meetups.',
  'Community library volunteer. Sends reading lists and event reminders from {town}.',
  'Neighborhood bike mechanic. Bookings and quick Q&A happen on {channel}.',
];

const SUMMARY_TEMPLATES = [
  'Pottery orders and shipping questions from {town}',
  'Menu and allergen questions on {channel}',
  'Tour bookings and itinerary requests',
  'Custom craft orders with color swatches',
  'Plant restock notifications and care tips',
  'Bug reports and feature requests from players',
  'Reading-list requests and event signups',
  'Bike tune-up bookings and part orders',
];

const TAGS_BY_ROLE = [
  ['orders', 'shipping'],
  ['food', 'menu'],
  ['bookings', 'travel'],
  ['orders', 'custom'],
  ['restock', 'care'],
  ['beta', 'bug'],
  ['events', 'library'],
  ['service', 'repair'],
] as const;

const CHANNELS: readonly Channel[] = ['X', 'INSTAGRAM', 'FACEBOOK'];
const DIRECTIONS: readonly Direction[] = ['INBOUND', 'OUTBOUND'];

type Ctx = { channel: Channel };

type KindTemplate = {
  kinds: readonly ActivityKind[];
  summary: (ctx: Ctx) => string;
  crmNote: (ctx: Ctx) => string;
  suggested: (ctx: Ctx) => string | null;
};

const KIND_TEMPLATES: readonly KindTemplate[] = [
  {
    kinds: ['DM', 'COMMENT'],
    summary: ({ channel }) => `Asked about shipping times via ${channel}`,
    crmNote: ({ channel }) => `Customer asked about order delivery timing on ${channel}. No order reference provided yet; follow up for order reference.`,
    suggested: ({ channel }) =>
      channel === 'X'
        ? 'Hi! Happy to check shipping times — can you DM us your order number?'
        : 'Hi! We can pull that up right away — could you send your order number?',
  },
  {
    kinds: ['POST', 'COMMENT'],
    summary: () => 'Shared feedback about packaging quality',
    crmNote: () => 'Customer noted packaging felt flimsy on arrival. No damage reported. Logged for ops review; monitor for repeat complaints.',
    suggested: () => 'Thanks for the feedback — we pass it straight to the packing team. If anything arrived damaged, let us know and we will sort it.',
  },
  {
    kinds: ['TICKET', 'DM'],
    summary: () => 'Reported missing item from a recent order',
    crmNote: () => 'Customer raised a missing-item report. Sought an order reference to verify fulfillment; mark for verification and possible reship.',
    suggested: () => 'Sorry about that! Please share your order number so we can verify and get the item out to you.',
  },
  {
    kinds: ['DM', 'COMMENT'],
    summary: () => 'Asked about custom order options and pricing',
    crmNote: () => 'Customer interested in a custom variant; pricing and timeline sent. Track preference; no commitment yet.',
    suggested: () => 'Custom options are available! What size and color did you have in mind? We can send a quote today.',
  },
  {
    kinds: ['RESOLVED', 'DM'],
    summary: () => 'Delivery address updated before dispatch',
    crmNote: () => 'Address corrected before shipment; dispatch confirmed to the new address. Case closed.',
    suggested: () => 'All set — we updated the address before dispatch. You will get tracking once it ships.',
  },
  {
    kinds: ['ESCALATED', 'TICKET'],
    summary: () => 'Billing question escalated after a first-response gap',
    crmNote: () => 'First response was delayed; issue escalated to team lead for callback. Flagged as a follow-up item.',
    suggested: () => 'Thank you for your patience — this has been escalated and someone will reach out shortly.',
  },
];

function pick<T>(rng: () => number, arr: readonly T[]): T {
  const index = Math.floor(rng() * arr.length);
  return arr[index]!;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function makeHandle(rng: () => number, name: string): string {
  const base = slugify(name);
  const suffix = pick(rng, HANDLE_SUFFIXES);
  return `@${base}${suffix}`;
}

export type GeneratedData = {
  customers: CustomerProfile[];
  activitiesByCustomer: Record<string, Activity[]>;
  agents: Agent[];
};

export function generateAll(seed = SEED): GeneratedData {
  const rng = mulberry32(seed);

  const nameIndexes = FIRST_NAMES.map((_, i) => i);
  for (let i = nameIndexes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = nameIndexes[i]!;
    nameIndexes[i] = nameIndexes[j]!;
    nameIndexes[j] = tmp;
  }

  const customers: CustomerProfile[] = [];
  const activitiesByCustomer: Record<string, Activity[]> = {};
  const count = 24;

  let activityCounter = 0;
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const last = LAST_NAMES[(i + 3) % LAST_NAMES.length]!;
    const name = `${first} ${last}`;
    const handle = makeHandle(rng, name);
    const channel = CHANNELS[i % CHANNELS.length]!;
    const town = pick(rng, TOWNS);
    const roleIndex = i % TAGS_BY_ROLE.length;
    const tags = [...TAGS_BY_ROLE[roleIndex]!];
    const bio = BIO_TEMPLATES[i % BIO_TEMPLATES.length]!
      .replace('{town}', town)
      .replace('{channel}', channel);
    const summary = SUMMARY_TEMPLATES[i % SUMMARY_TEMPLATES.length]!
      .replace('{town}', town)
      .replace('{channel}', channel);

    const customerId = `c-${String(i + 1).padStart(3, '0')}`;
    const status = i % 11 === 0 ? 'ATTENTION' : i % 7 === 0 ? 'INACTIVE' : 'ACTIVE';

    customers.push({
      id: customerId,
      name,
      handle,
      channel,
      summary,
      bio,
      location: town,
      joinedYear: 2020 + Math.floor(rng() * 5),
      status,
      tags,
      isSynthetic: true,
    });

    const activityCount = 2 + Math.floor(rng() * 4);
    const now = Date.now();
    const timeline: Activity[] = [];
    for (let a = 0; a < activityCount; a++) {
      const offsetDays = Math.floor(rng() * 110) + a;
      const loggedAt = new Date(now - offsetDays * DAY_MS + Math.floor(rng() * DAY_MS)).toISOString();
      const template = pick(rng, KIND_TEMPLATES);
      const kind = pick(rng, template.kinds);
      const direction = pick(rng, DIRECTIONS);
      const actChannel = rng() > 0.6 ? channel : pick(rng, CHANNELS);
      timeline.push({
        id: `a-${String(++activityCounter).padStart(4, '0')}`,
        kind,
        summary: template.summary({ channel: actChannel }),
        crmNote: template.crmNote({ channel: actChannel }),
        suggestedResponse: template.suggested({ channel: actChannel }),
        channel: actChannel,
        direction,
        loggedAt,
        approvedBy: 'Demo Agent',
        isSynthetic: true,
      });
    }
    timeline.sort((x, y) => (x.loggedAt < y.loggedAt ? 1 : -1));
    activitiesByCustomer[customerId] = timeline;
  }

  const agents: Agent[] = [
    { id: 'ag-001', name: 'Demo Agent', role: 'Support Agent', isSynthetic: true },
    { id: 'ag-002', name: 'Robin Vale', role: 'Team Lead', isSynthetic: true },
    { id: 'ag-003', name: 'Tess Moran', role: 'Support Agent', isSynthetic: true },
  ];

  return { customers, activitiesByCustomer, agents };
}

export const SEED_CONTEXT = { seed: String(SEED), note: 'Deterministic synthetic data. Never replaces real customer data.' };