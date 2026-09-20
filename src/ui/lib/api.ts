import { z } from 'zod';
import {
  ApiErrorSchema,
  AuditListResponseSchema,
  CaptureInteractionResponseSchema,
  CustomerDetailSchema,
  CustomerListResponseSchema,
  DashboardSchema,
  DraftListResponseSchema,
  GenerateDraftResponseSchema,
  InteractionDetailResponseSchema,
  LogInteractionResponseSchema,
  type CaptureInteractionInput,
  type Channel,
  type DraftKind,
  type Activity,
} from '../../shared/schemas.js';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? 'GET',
      body: init?.body,
      headers: init?.headers ?? (init?.body ? { 'Content-Type': 'application/json' } : undefined),
    });
  } catch {
    throw new ApiError('Could not reach the server. Is the API running?', 'NETWORK', 0);
  }

  if (!res.ok) {
    const body = ApiErrorSchema.safeParse(await res.json().catch(() => undefined));
    throw new ApiError(
      body.success ? body.data.error.message : `Request failed with status ${res.status}.`,
      body.success ? body.data.error.code : 'HTTP_ERROR',
      res.status,
    );
  }

  const json: unknown = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError('Server returned an unexpected payload.', 'SCHEMA_ERROR', 500);
  }
  return parsed.data;
}

export type CustomerListParams = { search?: string; channel?: Channel | 'ALL'; limit?: number; offset?: number };

const DRAFT_KIND_ENDPOINTS: Record<DraftKind, string> = {
  SUMMARY: 'summarize',
  CRM_NOTE: 'generate-note',
  RESPONSE: 'generate-response',
};

export const api = {
  getDashboard: () => request('/api/dashboard', DashboardSchema),
  getCustomers: (params: CustomerListParams) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.channel && params.channel !== 'ALL') query.set('channel', params.channel);
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return request(`/api/customers${qs ? `?${qs}` : ''}`, CustomerListResponseSchema);
  },
  getCustomer: (id: string) => request(`/api/customers/${encodeURIComponent(id)}`, CustomerDetailSchema),
  captureInteraction: (customerId: string, body: Omit<CaptureInteractionInput, 'capturedBy'>) =>
    request(`/api/customers/${encodeURIComponent(customerId)}/interactions`, CaptureInteractionResponseSchema, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getInteraction: (id: string) => request(`/api/interactions/${encodeURIComponent(id)}`, InteractionDetailResponseSchema),
  getDrafts: (interactionId: string) =>
    request(`/api/interactions/${encodeURIComponent(interactionId)}/drafts`, DraftListResponseSchema),
  generateDraft: (interactionId: string, kind: DraftKind) =>
    request(
      `/api/interactions/${encodeURIComponent(interactionId)}/${DRAFT_KIND_ENDPOINTS[kind]}`,
      GenerateDraftResponseSchema,
      { method: 'POST', body: '{}' },
    ),
  updateDraft: (interactionId: string, draftId: string, content: string) =>
    request(
      `/api/interactions/${encodeURIComponent(interactionId)}/drafts/${encodeURIComponent(draftId)}`,
      GenerateDraftResponseSchema,
      { method: 'PUT', body: JSON.stringify({ content }) },
    ),
  logInteraction: (interactionId: string, kind: Activity['kind']) =>
    request(`/api/interactions/${encodeURIComponent(interactionId)}/log`, LogInteractionResponseSchema, {
      method: 'POST',
      body: JSON.stringify({ kind }),
    }),
  getAudit: (limit: number) => request(`/api/audit?limit=${limit}`, AuditListResponseSchema),
};