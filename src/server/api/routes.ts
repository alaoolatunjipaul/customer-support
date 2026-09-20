import { Router } from 'express';
import { z } from 'zod';
import * as db from '../data/db.js';
import { listAudit } from '../data/audit.js';
import { captureInteraction } from '../services/interactions.js';
import { generateDraft, listDraftsForInteraction, updateDraftContent } from '../services/drafts.js';
import { logInteraction } from '../services/logging.js';
import { HttpError } from '../lib/errors.js';
import { config } from '../lib/config.js';
import {
  CaptureInteractionInputSchema,
  CustomerListQuerySchema,
  GenerateDraftInputSchema,
  HealthSchema,
  LogInteractionInputSchema,
  UpdateDraftInputSchema,
  type DraftKind,
  type Health,
} from '../../shared/schemas.js';

export const apiRouter = Router();

const KIND_BY_ENDPOINT: ReadonlyArray<{ path: string; kind: DraftKind }> = [
  { path: '/summarize', kind: 'SUMMARY' },
  { path: '/generate-note', kind: 'CRM_NOTE' },
  { path: '/generate-response', kind: 'RESPONSE' },
];

function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.output<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new HttpError(`Invalid input: ${message}`, 400, 'VALIDATION');
  }
  return result.data;
}

const parseQuery = parse;

apiRouter.get('/health', (_req, res) => {
  const c = db.counts();
  const health: Health = {
    ok: true,
    service: 'customer-support-copilot',
    version: '0.1.0',
    data: c,
    ai: { configured: config.ai.configured, mode: config.ai.mode },
  };
  res.json(HealthSchema.parse(health));
});

apiRouter.get('/customers', (req, res) => {
  const query = parseQuery(CustomerListQuerySchema, req.query);
  res.json(db.listCustomers(query));
});

apiRouter.get('/customers/:id', (req, res) => {
  const customer = db.getCustomer(req.params.id);
  if (!customer) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found.' } });
    return;
  }
  res.json(customer);
});

apiRouter.post('/customers/:id/interactions', (req, res) => {
  const body = parse(CaptureInteractionInputSchema, req.body ?? {});
  const interaction = captureInteraction(req.params.id, body);
  res.status(201).json({ interaction });
});

apiRouter.get('/interactions/:id', (req, res) => {
  const interaction = db.getInteraction(req.params.id);
  if (!interaction) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Interaction not found.' } });
    return;
  }
  res.json({ interaction });
});

for (const { path, kind } of KIND_BY_ENDPOINT) {
  apiRouter.post(`/interactions/:id${path}`, (req, res) => {
    const interactionId = req.params.id;
    if (!interactionId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Interaction not found.' } });
      return;
    }
    const body = parse(GenerateDraftInputSchema, req.body ?? {});
    const draft = generateDraft(interactionId, kind, body.actor);
    res.json({ draft });
  });
}

apiRouter.get('/interactions/:id/drafts', (req, res) => {
  res.json(listDraftsForInteraction(req.params.id));
});

apiRouter.put('/interactions/:id/drafts/:draftId', (req, res) => {
  const body = parse(UpdateDraftInputSchema, req.body ?? {});
  const draft = updateDraftContent(req.params.id, req.params.draftId, body.content);
  res.json({ draft });
});

apiRouter.post('/interactions/:id/log', (req, res) => {
  const body = parse(LogInteractionInputSchema, req.body ?? {});
  const activity = logInteraction(req.params.id, body);
  res.status(201).json({ activity });
});

apiRouter.get('/agents', (_req, res) => {
  res.json({ items: db.getAgents() });
});

apiRouter.get('/dashboard', (_req, res) => {
  res.json(db.getDashboard());
});

apiRouter.get('/audit', (req, res) => {
  const query = parseQuery(
    z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
    req.query,
  );
  res.json(listAudit(query.limit));
});