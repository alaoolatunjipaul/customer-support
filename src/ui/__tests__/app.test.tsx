import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Activity, ActivityKind, AiDraft, AuditEntry, CustomerDetail, Dashboard, DraftKind, Interaction } from '../../shared/schemas.js';
import App from '../App.js';

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type FetchMock = Mock<FetchFn>;

function customerFixture(captured: Interaction[] = [], extraLogged: Activity[] = [], loggedIds: string[] = []) {
  const capturedTimeline: CustomerDetail['activityTimeline'] = captured
    .filter((i) => !loggedIds.includes(i.id))
    .map((i) => ({
      ...i,
      source: 'captured',
    }));
  const loggedTimeline: CustomerDetail['activityTimeline'] = [
    {
      id: 'a-0001',
      kind: 'DM',
      summary: 'Asked about shipping times via X',
      crmNote: 'Customer asked about order delivery timing on X. Follow up for order reference.',
      suggestedResponse: 'Hi! Happy to check shipping times — can you DM us your order number?',
      channel: 'X',
      direction: 'INBOUND',
      loggedAt: '2026-09-05T04:39:02.501Z',
      approvedBy: 'Demo Agent',
      isSynthetic: true,
      source: 'logged',
    },
  ];
  const extraLoggedItems: CustomerDetail['activityTimeline'] = extraLogged.map((a) => ({
    ...a,
    source: 'logged',
  }));
  return {
    id: 'c-001',
    name: 'Maya Keller',
    handle: '@mayakeller88',
    channel: 'X',
    summary: 'Pottery orders and shipping questions from Fernbrook',
    bio: 'Small-batch ceramicist in Fernbrook. Catches up on X orders between kiln firings.',
    location: 'Fernbrook',
    joinedYear: 2023,
    status: 'ATTENTION',
    tags: ['orders', 'shipping'],
    isSynthetic: true,
    activityTimeline: [...extraLoggedItems, ...loggedTimeline, ...capturedTimeline].sort((a, b) => {
      const aTime = a.source === 'captured' ? a.capturedAt : a.loggedAt;
      const bTime = b.source === 'captured' ? b.capturedAt : b.loggedAt;
      return aTime < bTime ? 1 : -1;
    }),
  };
}

function dashboardFixture(): Dashboard {
  const customer = customerFixture();
  return {
    totalCustomers: 24,
    totalActivities: 76,
    openInteractions: 5,
    todayActivities: 3,
    byChannel: [
      { channel: 'X', count: 8 },
      { channel: 'INSTAGRAM', count: 8 },
      { channel: 'FACEBOOK', count: 8 },
    ],
    recentActivities: [
      {
        ...customer.activityTimeline[0]!,
        customerId: customer.id,
        customerName: customer.name,
        customerHandle: customer.handle,
      } as Dashboard['recentActivities'][number],
    ],
    agents: [{ id: 'ag-001', name: 'Demo Agent', role: 'Support Agent', isSynthetic: true }],
  };
}

function allCustomers(term?: string) {
  const customers = Array.from({ length: 6 }, (_, i) => ({
    id: `c-00${i + 1}`,
    name: i === 0 ? 'Maya Keller' : `Person N. ${i}`,
    handle: i === 0 ? '@mayakeller88' : `@person${i}`,
    channel: (['X', 'INSTAGRAM', 'FACEBOOK'] as const)[i % 3]!,
    summary: `Synthetic summary for entry ${i + 1}`,
    bio: 'Synthetic bio.',
    location: 'Port Falls',
    joinedYear: 2022,
    status: 'ACTIVE',
    tags: ['orders'],
    isSynthetic: true,
  }));
  const filtered = term
    ? customers.filter((c) => c.name.toLowerCase().includes(term) || c.handle.toLowerCase().includes(term))
    : customers;
  return { items: filtered.slice(0, 20), total: filtered.length, limit: 20, offset: 0 };
}

let capturedInteractions: Interaction[] = [];
let draftsByInteraction: Record<string, AiDraft[]> = {};
let loggedActivities: Activity[] = [];
let loggedIds: string[] = [];
let auditLog: AuditEntry[] = [];
let installedFetch: FetchMock | null = null;

function fetchMockInstance(): FetchMock {
  if (!installedFetch) throw new Error('fetch mock not installed');
  return installedFetch;
}

async function openProfileAndCapture(user: ReturnType<typeof userEvent.setup>, content: string) {
  render(<App />);
  await screen.findByRole('heading', { name: 'Dashboard' });
  await user.click(screen.getByRole('link', { name: 'Customers' }));
  await screen.findByRole('heading', { name: 'Customer search' });
  await user.click(screen.getByRole('link', { name: 'Open profile for Maya Keller' }));
  await screen.findByRole('heading', { name: 'Activity timeline' });

  await user.type(screen.getByRole('textbox', { name: 'Interaction content' }), content);
  await user.click(screen.getByRole('button', { name: 'Capture interaction' }));
  await screen.findByText(/Interaction captured and added to the timeline/i);
}

function installFetchMock() {
  capturedInteractions = [];
  draftsByInteraction = {};
  loggedActivities = [];
  loggedIds = [];
  auditLog = [];
  const capturePath = /\/api\/customers\/([\w-]+)\/interactions$/;
  const fetchMock = vi.fn<FetchFn>(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/dashboard')) return new Response(JSON.stringify(dashboardFixture()), { status: 200 });

    const capture = url.match(capturePath);
    if (capture && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { channel: string; direction: string; content: string };
      if (body.content.includes('REJECTME')) {
        return new Response(JSON.stringify({ error: { code: 'VALIDATION', message: 'Simulated server rejection.' } }), { status: 400 });
      }
      const interaction: Interaction = {
        id: `i-${capturedInteractions.length + 1}`,
        customerId: capture[1]!,
        channel: body.channel as Interaction['channel'],
        direction: body.direction as Interaction['direction'],
        content: body.content,
        status: 'CAPTURED',
        capturedBy: 'Demo Agent',
        capturedAt: new Date().toISOString(),
        isSynthetic: true,
      };
      capturedInteractions.push(interaction);
      return new Response(JSON.stringify({ interaction }), { status: 201 });
    }

    const draftsList = url.match(/\/api\/interactions\/([\w-]+)\/drafts$/);
    if (draftsList) {
      const items = (draftsByInteraction[draftsList[1]!] ?? []).filter((d) => !d.supersededAt);
      items.sort((a, b) => a.revision - b.revision);
      return new Response(JSON.stringify({ items, total: items.length }), { status: 200 });
    }

    const generation = url.match(/\/api\/interactions\/([\w-]+)\/(summarize|generate-note|generate-response)$/);
    if (generation && init?.method === 'POST') {
      const interaction = capturedInteractions.find((i) => i.id === generation[1]);
      if (!interaction) {
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Interaction not found.' } }), { status: 404 });
      }
      if (interaction.content.includes('REJECTAI')) {
        return new Response(
          JSON.stringify({ error: { code: 'AI_OUTPUT_INVALID', message: 'AI produced output that failed schema validation.' } }),
          { status: 502 },
        );
      }
      const kind: DraftKind =
        generation[2] === 'generate-note' ? 'CRM_NOTE' : generation[2] === 'generate-response' ? 'RESPONSE' : 'SUMMARY';
      const existing = draftsByInteraction[interaction.id] ?? [];
      const now = new Date().toISOString();
      const superseded = existing.map((d) => (d.kind === kind && !d.supersededAt ? { ...d, supersededAt: now, updatedAt: now } : d));
      const revision = Math.max(0, ...existing.filter((d) => d.kind === kind).map((d) => d.revision)) + 1;
      const draft: AiDraft = {
        id: `d-${existing.length + 1}`,
        interactionId: interaction.id,
        kind,
        content: `Mock ${kind} — ${interaction.content}`,
        model: 'mock-copilot-v1',
        promptVersion: `${kind.toLowerCase()}-v1`,
        source: {
          channel: interaction.channel,
          direction: interaction.direction,
          content: interaction.content,
          capturedAt: interaction.capturedAt,
        },
        revision,
        createdAt: now,
        updatedAt: now,
        supersededAt: null,
        isSynthetic: true,
      };
      draftsByInteraction[interaction.id] = [...superseded, draft];
      return new Response(JSON.stringify({ draft }), { status: 200 });
    }

    const editPath = url.match(/\/api\/interactions\/([\w-]+)\/drafts\/([\w-]+)$/);
    if (editPath && init?.method === 'PUT') {
      const existing = draftsByInteraction[editPath[1]!] ?? [];
      const current = existing.find((d) => d.id === editPath[2] && !d.supersededAt);
      if (!current) {
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Draft not found.' } }), { status: 404 });
      }
      const body = JSON.parse(String(init.body)) as { content: string };
      const now = new Date().toISOString();
      const superseded = existing.map((d) => (d.id === current.id ? { ...d, supersededAt: now, updatedAt: now } : d));
      const revision = Math.max(0, ...existing.filter((d) => d.kind === current.kind).map((d) => d.revision)) + 1;
      const draft: AiDraft = {
        ...current,
        id: `d-${existing.length + 1}`,
        content: body.content,
        revision,
        createdAt: now,
        updatedAt: now,
        supersededAt: null,
      };
      draftsByInteraction[editPath[1]!] = [...superseded, draft];
      return new Response(JSON.stringify({ draft }), { status: 200 });
    }

    const logPath = url.match(/\/api\/interactions\/([\w-]+)\/log$/);
    if (logPath && init?.method === 'POST') {
      const interaction = capturedInteractions.find((i) => i.id === logPath[1]);
      if (!interaction) {
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Interaction not found.' } }), { status: 404 });
      }
      if (loggedIds.includes(interaction.id)) {
        return new Response(JSON.stringify({ error: { code: 'ALREADY_LOGGED', message: 'Interaction is already logged.' } }), { status: 409 });
      }
      const body = JSON.parse(String(init.body)) as { kind: string };
      const kind = body.kind as ActivityKind;
      const draftContent = (k: DraftKind) => draftsByInteraction[interaction.id]?.find((d) => d.kind === k && !d.supersededAt)?.content;
      const now = new Date().toISOString();
      const activity: Activity = {
        id: `r-${(auditLog.length + 1)
          .toString()
          .padStart(4, '0')}`,
        kind,
        summary: draftContent('SUMMARY') ?? interaction.content,
        crmNote: draftContent('CRM_NOTE') ?? interaction.content,
        suggestedResponse: draftContent('RESPONSE') ?? null,
        channel: interaction.channel,
        direction: interaction.direction,
        loggedAt: now,
        approvedBy: 'Demo Agent',
        isSynthetic: true,
      };
      loggedActivities.push(activity);
      loggedIds.push(interaction.id);
      auditLog.unshift({
        id: `aud-${auditLog.length + 1}`,
        actor: 'Demo Agent',
        action: 'ACTIVITY_LOGGED',
        entityType: 'activity',
        entityId: activity.id,
        payloadBefore: { interactionStatus: 'CAPTURED' },
        payloadAfter: { kind: activity.kind, summary: activity.summary },
        createdAt: now,
      });
      return new Response(JSON.stringify({ activity }), { status: 201 });
    }

    if (url.startsWith('/api/audit')) {
      return new Response(JSON.stringify({ items: auditLog, total: auditLog.length }), { status: 200 });
    }

    if (url.startsWith('/api/customers')) {
      const match = url.match(/\/api\/customers\/([\w-]+)\/?(?:\?.*)?$/);
      if (match && match[1] === 'c-001') {
        return new Response(JSON.stringify(customerFixture(capturedInteractions, loggedActivities, loggedIds)), { status: 200 });
      }
      const params = new URLSearchParams(url.split('?')[1] ?? '');
      const term = params.get('search') ?? undefined;
      return new Response(JSON.stringify(allCustomers(term?.toLowerCase())), { status: 200 });
    }

    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), { status: 404 });
  });
  installedFetch = fetchMock;
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  installedFetch = null;
  window.location.hash = '';
  installFetchMock();
});

describe('application shell and navigation', () => {
  it('renders the dashboard with stat cards and sidebar navigation', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('76')).toBeInTheDocument();

    const nav = screen.getByRole('complementary', { name: 'Primary navigation' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Customers' })).toBeInTheDocument();
  });

  it('navigates to customer search and back to dashboard via the sidebar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Dashboard' });

    await user.click(screen.getByRole('link', { name: 'Customers' }));
    expect(await screen.findByRole('heading', { name: 'Customer search' })).toBeInTheDocument();
    expect(screen.getByText(/Maya Keller/i)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('filters customers by search text passed through the search URL state', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('link', { name: 'Customers' }));
    await screen.findByRole('heading', { name: 'Customer search' });

    const input = screen.getByRole('searchbox', { name: 'Search customers' });
    await user.type(input, 'Maya');

    expect(await screen.findByText('1 result for "Maya"')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Customer results' });
    expect(within(list).getByText('Maya Keller')).toBeInTheDocument();
  });
});

describe('customer profile, handle section and activity timeline', () => {
  it('opens a customer profile showing profile facts, the social handle and the timeline', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('link', { name: 'Customers' }));
    await screen.findByRole('heading', { name: 'Customer search' });

    await user.click(screen.getByRole('link', { name: 'Open profile for Maya Keller' }));

    expect(await screen.findByRole('heading', { name: 'Maya Keller' })).toBeInTheDocument();
    const handleSection = screen.getByRole('region', { name: 'Social handle' });
    expect(handleSection).toBeInTheDocument();
    expect(within(handleSection).getByText('@mayakeller88')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activity timeline' })).toBeInTheDocument();
    expect(await screen.findByText('Asked about shipping times via X')).toBeInTheDocument();
    expect(screen.getByText(/never resolves or infers identity from a handle/i)).toBeInTheDocument();
    expect(screen.getByText(/seeded synthetic profile/i)).toBeInTheDocument();
  });

  it('shows a profile not found error for a missing customer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('link', { name: 'Customers' }));
    await screen.findByRole('heading', { name: 'Customer search' });
    await user.click(screen.getByRole('link', { name: 'Open profile for Person N. 1' }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});

describe('responsive navigation drawer', () => {
  it('toggles the off-canvas sidebar via the topbar menu button', async () => {
    const user = userEvent.setup();
    render(<App />);

    const aside = screen.getByRole('complementary');
    expect(aside).not.toHaveClass('is-open');

    const menu = screen.getByRole('button', { name: 'Open navigation' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');

    await user.click(menu);
    expect(aside).toHaveClass('is-open');
    expect(menu).toHaveAttribute('aria-expanded', 'true');

    await user.click(menu);
    expect(aside).not.toHaveClass('is-open');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the drawer when a sidebar link is followed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Dashboard' });
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(menu);
    const aside = screen.getByRole('complementary');
    expect(aside).toHaveClass('is-open');

    await user.click(screen.getByRole('link', { name: 'Customers' }));
    expect(aside).not.toHaveClass('is-open');
    expect(await screen.findByRole('heading', { name: 'Customer search' })).toBeInTheDocument();
  });
});

describe('customer interaction capture workflow', () => {
  async function openProfile(user: ReturnType<typeof userEvent.setup>) {
    render(<App />);
    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('link', { name: 'Customers' }));
    await screen.findByRole('heading', { name: 'Customer search' });
    await user.click(screen.getByRole('link', { name: 'Open profile for Maya Keller' }));
    await screen.findByRole('heading', { name: 'Activity timeline' });
  }

  it('requires content and does not POST when the form is invalid', async () => {
    const user = userEvent.setup();
    await openProfile(user);

    const fetchMock = fetchMockInstance();
    await user.click(screen.getByRole('button', { name: 'Capture interaction' }));

    expect(await screen.findByText('Content is required.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Interaction content' })).toHaveAttribute('aria-invalid', 'true');
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(0);
  });

  it('captures an interaction, clears the form, and shows it immediately in the timeline', async () => {
    const user = userEvent.setup();
    await openProfile(user);
    const fetchMock = fetchMockInstance();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Channel' }), 'INSTAGRAM');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Direction' }), 'OUTBOUND');
    await user.type(
      screen.getByRole('textbox', { name: 'Interaction content' }),
      'Asking if the kiln-dried vase is restocked this week.',
    );
    await user.click(screen.getByRole('button', { name: 'Capture interaction' }));

    expect(await screen.findByText(/Interaction captured and added to the timeline/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Interaction content' })).toHaveValue('');
    expect(fetchMock.mock.calls.some(([u, init]) => init?.method === 'POST' && String(u).endsWith('/interactions'))).toBe(true);

    const postedBody = JSON.parse(
      String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body),
    ) as { channel: string; direction: string; content: string };
    expect(postedBody).toEqual({
      channel: 'INSTAGRAM',
      direction: 'OUTBOUND',
      content: 'Asking if the kiln-dried vase is restocked this week.',
    });

    const timelineSection = screen.getByRole('region', { name: 'Activity timeline' });
    expect(within(timelineSection).getByText('CAPTURED')).toBeInTheDocument();
    expect(await within(timelineSection).findByText('Asking if the kiln-dried vase is restocked this week.')).toBeInTheDocument();
    expect(screen.getByText(/not yet logged — draft with the AI Copilot, then approve to log/i)).toBeInTheDocument();
  });

  it('shows the server error message when saving fails', async () => {
    const user = userEvent.setup();
    await openProfile(user);

    await user.type(
      screen.getByRole('textbox', { name: 'Interaction content' }),
      'This content triggers REJECTME rejection',
    );
    await user.click(screen.getByRole('button', { name: 'Capture interaction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Simulated server rejection.');
  });
});

describe('AI copilot drafts workflow', () => {
  it('shows an empty state before any interaction is captured', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('link', { name: 'Customers' }));
    await screen.findByRole('heading', { name: 'Customer search' });
    await user.click(screen.getByRole('link', { name: 'Open profile for Maya Keller' }));

    expect(await screen.findByText('No interaction captured yet')).toBeInTheDocument();
    expect(screen.getByText(/never sent automatically and never written to the CRM/i)).toBeInTheDocument();
  });

  it('generates an editable summary draft after capture', async () => {
    const user = userEvent.setup();
    await openProfileAndCapture(user, 'Asking if the kiln-dried vase is restocked this week.');

    const select = await screen.findByRole('combobox', { name: 'Interaction to draft' });
    expect(select).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Summarize' }));

    const summary = await screen.findByRole('textbox', { name: 'Summary draft' });
    expect((summary as HTMLTextAreaElement).value).toContain('Mock SUMMARY');
    expect(await screen.findByText(/Summary generated \(revision 1\)/)).toBeInTheDocument();
    expect(within(screen.getByLabelText('Summary draft card')).getByText(/never sent automatically and never written to the CRM/i)).toBeInTheDocument();
    expect(within(screen.getByLabelText('Summary draft card')).getByText('MOCK')).toBeInTheDocument();
  });

  it('edits a draft and saves a new revision', async () => {
    const user = userEvent.setup();
    await openProfileAndCapture(user, 'Asking about shipping times.');
    const fetchMock = fetchMockInstance();

    await user.click(screen.getByRole('button', { name: 'Summarize' }));
    const summary = await screen.findByRole('textbox', { name: 'Summary draft' });

    await user.clear(summary);
    await user.type(summary, 'Edited by the agent for accuracy.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Summary saved \(revision 2\)/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, init]) => init?.method === 'PUT' && String(u).includes('/drafts/'))).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Summary draft' })).toHaveValue('Edited by the agent for accuracy.');
    expect(within(screen.getByLabelText('Summary draft card')).getByText(/Revision 2/)).toBeInTheDocument();
  });

  it('generates a CRM note and a customer response in their own editable cards', async () => {
    const user = userEvent.setup();
    await openProfileAndCapture(user, 'Order #8821 never arrived and I am upset.');

    await user.click(screen.getByRole('button', { name: 'Generate CRM note' }));
    const crmNote = await screen.findByRole('textbox', { name: 'CRM note draft' });
    expect((crmNote as HTMLTextAreaElement).value).toContain('Mock CRM_NOTE');

    await user.click(screen.getByRole('button', { name: 'Draft customer response' }));
    const response = await screen.findByRole('textbox', { name: 'Customer response draft' });
    expect((response as HTMLTextAreaElement).value).toContain('Mock RESPONSE');
    expect(
      within(screen.getByLabelText('Customer response draft card')).getByText(/Draft only — never sent automatically/i),
    ).toBeInTheDocument();
    expect(within(screen.getByLabelText('Customer response draft card')).getByText(/Revision 1/)).toBeInTheDocument();
  });

  it('surfaces an error banner when generation fails', async () => {
    const user = userEvent.setup();
    await openProfileAndCapture(user, 'This content triggers REJECTAI generation failure');

    await user.click(screen.getByRole('button', { name: 'Summarize' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'AI produced output that failed schema validation.',
    );
  });

  it('blocks saving an emptied draft and does not send a PUT request', async () => {
    const user = userEvent.setup();
    await openProfileAndCapture(user, 'Asking about delivery timing.');
    const fetchMock = fetchMockInstance();

    await user.click(screen.getByRole('button', { name: 'Summarize' }));
    const summary = await screen.findByRole('textbox', { name: 'Summary draft' });
    expect((summary as HTMLTextAreaElement).value).toContain('Mock SUMMARY');

    await user.clear(summary);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText(/The summary draft is empty and cannot be saved/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, init]) => init?.method === 'PUT' && String(u).includes('/drafts/'))).toBe(false);
  });
});

describe('approve & log workflow', () => {
  it('only logs an activity after explicit confirmation, then shows it in the timeline', async () => {
    const user = userEvent.setup();
    await openProfileAndCapture(user, 'Order #1234 is late, please help.');

    await user.click(screen.getByRole('button', { name: 'Summarize' }));
    await screen.findByRole('textbox', { name: 'Summary draft' });

    const fetchMock = fetchMockInstance();
    const logPosts = () => fetchMock.mock.calls.filter(([u, init]) => init?.method === 'POST' && String(u).endsWith('/log'));

    await user.click(screen.getByRole('button', { name: 'Approve & log activity' }));
    expect(logPosts()).toHaveLength(0);

    await user.click(screen.getByRole('checkbox', { name: /I have reviewed the drafts and confirm logging this activity/i }));
    await user.click(screen.getByRole('button', { name: 'Approve & log activity' }));

    expect(logPosts()).toHaveLength(1);
    const loggedBody = JSON.parse(String(logPosts()[0]![1]?.body)) as { kind: string };
    expect(loggedBody.kind).toBe('DM');

    const timelineSection = screen.getByRole('region', { name: 'Activity timeline' });
    expect(await within(timelineSection).findByText('Mock SUMMARY — Order #1234 is late, please help.')).toBeInTheDocument();
    expect(within(timelineSection).queryByText('CAPTURED')).not.toBeInTheDocument();
  });

  it('blocks logging while drafts are unsaved', async () => {
    const user = userEvent.setup();
    await openProfileAndCapture(user, 'Asking about delivery timing.');

    await user.click(screen.getByRole('button', { name: 'Summarize' }));
    const summary = await screen.findByRole('textbox', { name: 'Summary draft' });
    await user.type(summary, ' unsaved edit');

    await user.click(screen.getByRole('checkbox', { name: /I have reviewed the drafts and confirm logging this activity/i }));
    expect(screen.getByRole('button', { name: 'Approve & log activity' })).toBeDisabled();
    expect(screen.getByText(/You have unsaved draft edits/)).toBeInTheDocument();
  });
});

describe('audit log view', () => {
  beforeEach(() => {
    auditLog.push(
      {
        id: 'aud-1',
        actor: 'Demo Agent',
        action: 'CAPTURE',
        entityType: 'interaction',
        entityId: 'i-1',
        payloadBefore: null,
        payloadAfter: { channel: 'X', direction: 'INBOUND' },
        createdAt: '2026-09-20T10:01:00.000Z',
      },
      {
        id: 'aud-2',
        actor: 'Demo Agent',
        action: 'AI_GENERATE',
        entityType: 'ai_draft',
        entityId: 'd-1',
        payloadBefore: null,
        payloadAfter: { kind: 'SUMMARY', model: 'mock-copilot-v1' },
        createdAt: '2026-09-20T10:02:00.000Z',
      },
      {
        id: 'aud-3',
        actor: 'Demo Agent',
        action: 'DRAFT_EDIT',
        entityType: 'ai_draft',
        entityId: 'd-2',
        payloadBefore: { revision: 1 },
        payloadAfter: { revision: 2 },
        createdAt: '2026-09-20T10:03:00.000Z',
      },
      {
        id: 'aud-4',
        actor: 'Demo Agent',
        action: 'ACTIVITY_LOGGED',
        entityType: 'activity',
        entityId: 'r-1',
        payloadBefore: { interactionStatus: 'CAPTURED' },
        payloadAfter: { kind: 'DM', summary: 'Order shipped question resolved.' },
        createdAt: '2026-09-20T10:04:00.000Z',
      },
    );
  });

  it('lists every audit action with metadata', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('link', { name: 'Audit log' }));

    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    expect(screen.getByText('4 entries recorded')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Audit entries' });
    expect(within(list).getByText('Interaction captured')).toBeInTheDocument();
    expect(within(list).getByText('AI draft generated')).toBeInTheDocument();
    expect(within(list).getByText('Draft edited')).toBeInTheDocument();
    expect(within(list).getByText('Activity logged')).toBeInTheDocument();
    expect(within(list).getByText(/mock-copilot-v1/)).toBeInTheDocument();
    expect(within(list).getByText('Order shipped question resolved.')).toBeInTheDocument();
    expect(within(list).getAllByText('Demo Agent')).toHaveLength(4);
    expect(within(list).getAllByRole('time')).toHaveLength(4);
  });

  it('shows an empty state when there are no entries', async () => {
    auditLog.length = 0;
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('link', { name: 'Audit log' }));

    expect(await screen.findByText('No audit entries yet')).toBeInTheDocument();
  });
});