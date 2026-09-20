import { generateAll, type GeneratedData } from './seed/generator.js';
import type { Activity, CustomerListQuery, Interaction } from '../../shared/schemas.js';

let state: GeneratedData | null = null;
let seq = 0;
let captured: Interaction[] = [];
let loggedActivities: Array<{ activity: Activity; customerId: string }> = [];

function getState(): GeneratedData {
  if (!state) {
    state = generateAll();
  }
  return state;
}

export function resetDb(): void {
  state = null;
  seq = 0;
  captured = [];
  loggedActivities = [];
}

export function listCustomers(query: CustomerListQuery) {
  const { customers } = getState();
  const search = query.search?.trim().toLowerCase() ?? '';
  const filtered = customers.filter((c) => {
    const matchesSearch =
      search.length === 0 || c.name.toLowerCase().includes(search) || c.handle.toLowerCase().includes(search);
    const matchesChannel = !query.channel || c.channel === query.channel;
    return matchesSearch && matchesChannel;
  });
  const total = filtered.length;
  const items = filtered.slice(query.offset, query.offset + query.limit);
  return { items, total, limit: query.limit, offset: query.offset };
}

export function getCustomer(id: string) {
  const { customers, activitiesByCustomer } = getState();
  const customer = customers.find((c) => c.id === id);
  if (!customer) return undefined;

  const seededLogged = (activitiesByCustomer[id] ?? []).map((a) => ({ ...a, source: 'logged' as const }));
  const runtimeLogged = loggedActivities
    .filter((a) => a.customerId === id)
    .map((a) => ({ ...a.activity, source: 'logged' as const }));
  const capturedItems = captured
    .filter((i) => i.customerId === id && i.status === 'CAPTURED')
    .map((i) => ({ ...i, source: 'captured' as const }));

  const activityTimeline = [...seededLogged, ...runtimeLogged, ...capturedItems].sort((a, b) => {
    const aTime = a.source === 'captured' ? a.capturedAt : a.loggedAt;
    const bTime = b.source === 'captured' ? b.capturedAt : b.loggedAt;
    return aTime < bTime ? 1 : -1;
  });

  return { ...customer, activityTimeline };
}

export function createInteraction(customerId: string, input: { channel: string; direction: string; content: string; capturedBy: string }) {
  const { customers } = getState();
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return undefined;

  seq += 1;
  const interaction: Interaction = {
    id: `i-${Date.now()}-${seq}`,
    customerId,
    channel: input.channel as Interaction['channel'],
    direction: input.direction as Interaction['direction'],
    content: input.content,
    status: 'CAPTURED',
    capturedBy: input.capturedBy,
    capturedAt: new Date().toISOString(),
    isSynthetic: true,
  };
  captured.push(interaction);
  return interaction;
}

export function getInteraction(id: string): Interaction | undefined {
  return captured.find((i) => i.id === id);
}

export function markInteractionLogged(id: string): void {
  const interaction = captured.find((i) => i.id === id);
  if (interaction) interaction.status = 'LOGGED';
}

export function createLoggedActivity(
  customerId: string,
  input: {
    kind: Activity['kind'];
    channel: Activity['channel'];
    direction: Activity['direction'];
    summary: string;
    crmNote: string;
    suggestedResponse: string | null;
    approvedBy: string;
  },
): Activity {
  seq += 1;
  const activity: Activity = {
    id: `r-${Date.now()}-${seq}`,
    kind: input.kind,
    summary: input.summary,
    crmNote: input.crmNote,
    suggestedResponse: input.suggestedResponse,
    channel: input.channel,
    direction: input.direction,
    loggedAt: new Date().toISOString(),
    approvedBy: input.approvedBy,
    isSynthetic: true,
  };
  loggedActivities.push({ activity, customerId });
  return activity;
}

export function getCapturedInteractions(customerId: string): Interaction[] {
  return captured
    .filter((i) => i.customerId === customerId && i.status === 'CAPTURED')
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
}

export function getAgents() {
  return getState().agents;
}

export function getDashboard() {
  const { customers, activitiesByCustomer, agents } = getState();
  const seededActivities = Object.values(activitiesByCustomer).flat();
  const runtimeActivities = loggedActivities.map((entry) => ({
    activity: entry.activity,
    customerId: entry.customerId,
  }));
  const allActivities = seededActivities.map((a) => {
    const owner = customers.find((c) => (activitiesByCustomer[c.id] ?? []).includes(a));
    return { activity: a, customerId: owner?.id };
  });
  allActivities.push(...runtimeActivities);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const byChannel = (['X', 'INSTAGRAM', 'FACEBOOK'] as const).map((channel) => ({
    channel,
    count: customers.filter((c) => c.channel === channel).length,
  }));

  const recent = allActivities
    .sort((x, y) => (x.activity.loggedAt < y.activity.loggedAt ? 1 : -1))
    .slice(0, 8)
    .map(({ activity, customerId }) => {
      const owner = customers.find((c) => c.id === customerId);
      return {
        ...activity,
        customerId: customerId ?? 'unknown',
        customerName: owner?.name ?? 'Unknown',
        customerHandle: owner?.handle ?? '@unknown',
      };
    });

  return {
    totalCustomers: customers.length,
    totalActivities: allActivities.length,
    openInteractions: allActivities.filter((a) => a.activity.kind === 'TICKET' || a.activity.kind === 'ESCALATED').length,
    todayActivities: allActivities.filter((a) => new Date(a.activity.loggedAt).getTime() >= startOfToday).length,
    byChannel,
    recentActivities: recent,
    agents,
  };
}

export function counts() {
  const { customers, activitiesByCustomer, agents } = getState();
  return {
    customers: customers.length,
    activities: Object.values(activitiesByCustomer).reduce((n, list) => n + list.length, 0) + loggedActivities.length,
    interactions: captured.length,
    agents: agents.length,
  };
}