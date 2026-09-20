# Development / Ship Log — Customer Support Copilot

This log records decisions and progress by phase. It is append-only; every entry is dated and tied to a phase of `context/PROJECT_PLAN.md`.

## 2026-09-20 — Phase 0: Context & foundations

**Created**
- `context/PRD.md` — requirements, 10-step workflow, guardrails, acceptance criteria.
- `context/ARCHITECTURE.md` — system context, layering, data model, REST API, AI context-engineering pipeline, security model, ADR-style decisions.
- `context/PROJECT_PLAN.md` — phases 0–5, definition of done, risks, release criteria.
- `context/AGENTS.md` — operating instructions for coding agents.
- `context/RULES.md` — 17 non-negotiable constraints (R1–R17).
- `context/SKILLS.md` — 7 runbooks (capture, AI drafts, review/edit, approve/log, synthetic data, verification pass, prompt updates).
- `README.md` — project overview and status.
- This `DEVELOPMENT_LOG.md`.

**Decisions recorded**
- Single Node server (API + static UI); SQLite + Drizzle; React + Vite + TS; AI behind an OpenAI-compatible interface with deterministic mock mode.
- Human-in-the-loop approval gate lives in `services/`, not the UI.
- Status model: `CAPTURED -> DRAFTED -> APPROVED -> LOGGED`; only `LOGGED` is customer history.
- Prompt templates versioned in `src/server/ai/prompts/`; every AI artifact records `prompt_version` and `model`.

**Compliance check (Phase 0)**
- Synthetic data only: enforced in architecture and rules; no data assets exist yet.
- No real CRM/social/banking integrations defined.
- No API keys in frontend: keys are server-env-only by design.
- Advisory AI + explicit human approval: gate is a first-class service in the design.

**Current status:** DESIGN COMPLETE, NO CODE WRITTEN. Waiting for human approval to begin Phase 1.

---

## 2026-09-20 — Application shell + dashboard UI (frontend milestone; no AI yet)

Implemented the approved architecture's application shell and dashboard UI against a synthetic-data API. AI, capture, approval/logging, and audit views are deferred to later phases.

**Built**
- Scaffold: `package.json`, TypeScript configs (shared UI/server), Vite (root `src/ui`), Vitest + Testing Library, ESLint flat config, `.gitignore`. TypeScript strict everywhere.
- `src/shared/schemas.ts` — single source of truth: zod schemas + inferred types for customers, customer detail (profile + activity timeline), activities, agents, dashboard, search query/response, health, API errors.
- `src/server/data/seed/` — deterministic synthetic generator (mulberry32, fixed seed). 24 invented customers (fake names/handles/bios/locations), 76 logged activities across X/Instagram/Facebook, 3 demo agents. `npm run seed` writes a deterministic JSON snapshot. No real person/brand references; `is_synthetic = true` on every record.
- `src/server/data/db.ts` — in-memory query layer (list/search/filter customer, detail, agents, dashboard stats). No business rules; architected to be replaced by Drizzle/SQLite in the data foundation phase.
- `src/server/api/routes.ts` + `src/server/index.ts` — Express server: `GET /api/health`, `GET /api/customers` (search/channel/limit/offset, zod-validated), `GET /api/customers/:id`, `GET /api/agents`, `GET /api/dashboard`; zod-validated query boundaries, typed error responses (`HttpError` → 400 VALIDATION / 404 NOT_FOUND), request logger, serves the built UI from one process.
- `src/ui` — React 19 + react-router (hash routing). Application shell with off-canvas responsive sidebar navigation + topbar, dashboard (stat cards, channel breakdown, recent activity), customer search (debounced name/handle search, channel filter, pagination), customer profile (profile facts, social-handle section with explicit "handle ≠ identity" note, activity timeline of logged records). Responsive CSS: sidebar collapses to a drawer ≤960px, grids stack ≤1100/960/640/460px; focus-visible, landmarks, labels, skip-link, `prefers-reduced-motion` respected.
- Tests: 7 Vitest + Testing Library tests covering shell render, sidebar navigation, debounced search filtering, profile/handle/timeline render, 404 error state, and responsive drawer open/close/auto-close.

**Verified**
- `npm run lint`, `npm run typecheck` clean; `npm test` 7/7 pass.
- Server on `http://localhost:8787`: health, dashboard, list/search/filter, detail (timeline newest-first), agents, static UI serving, 400 on invalid query params, 404 on missing customer.
- Built bundle scanned: no API-key or LLM references (R9).
- Browser opened at `http://localhost:8787`.

**Decisions recorded**
- UI phase delivered before the data foundation phase per this milestone's request; data layer is in-memory + deterministic seed instead of Drizzle/SQLite, and will be swapped in without API contract changes.
- HashRouter chosen so the single server needs no SPA rewrite for refresh/deep links.
- `/api/health` reports `ai.mode: "deferred"` until the AI pipeline ships (honest about scope).
- Search matches name/handle only (per architecture §5), not summary/bio.

**Issues found and fixed during verification**
- `staticDir` path computed one level too high → serving started only after fixing `../ui/dist`.
- zod `.default([])` made `tags` optional in the extended detail type → schema switched to required `tags` (producer always emits it).
- Validation errors surfaced with HTTP 400 but code `SERVER_ERROR` → introduced `HttpError` with proper `VALIDATION` code.
- Navigation tests caught: `<aside>` nav labeled with `getByRole('navigation')` (it is `complementary`), router hash persisting across tests (reset in `beforeEach`), duplicate handle text (scoped by region).

---

## 2026-09-20 — Customer interaction capture workflow

Implemented the capture step of the workflow: a support agent selects a customer, chooses channel + direction, enters the interaction content, saves it, and sees it immediately in the activity timeline. Validation and error states added. AI, approval, and permanent logging remain deferred; captures are stored as `CAPTURED` and are explicitly not part of logged/approved history (R7 preserved).

**Built**
- `src/shared/schemas.ts` — `InteractionSchema` (CAPTURED), `TimelineItemSchema` (discriminated union: `logged` activity | `captured` interaction), `CaptureInteractionInputSchema` (strict, content trimmed 1–2000), `AuditEntrySchema`, `AuditListResponseSchema`; `CustomerDetail.activityTimeline` now carries timeline items; health reports interaction count.
- `src/server/lib/errors.ts` — shared `HttpError` (services + api + middleware use the same class; moved out of middleware).
- `src/server/data/audit.ts` — immutable append-only in-memory audit store (write-once, newest-first reads).
- `src/server/services/interactions.ts` — `captureInteraction` service: validates customer, resolves the demo agent for attribution, writes the interaction through the data layer, and emits a `CAPTURE` audit row. Services remain the only place that performs the workflow action.
- `src/server/data/db.ts` — `createInteraction` (runtime captures, in-memory, separated from the deterministic seed), `getCustomer` merges logged + captured into one newest-first timeline, counts include interactions.
- `src/server/api/routes.ts` — `POST /api/customers/:id/interactions` (zod body validation + strict unknown-key rejection → 400 `VALIDATION`; 404 for missing customer; 201 with the created interaction) and `GET /api/audit?limit=`.
- `src/ui/components/CaptureForm.tsx` — accessible capture form: channel/direction selects, content textarea with live character count and inline validation (`aria-invalid`, `aria-describedby`, error message), disabled-while-submitting button, success (`role=status`) and error banners (`role=alert`).
- `src/ui/pages/CustomerProfilePage.tsx` — Capture panel above the profile; timeline now renders captured items distinctly (dashed card, `CAPTURED` badge, "not yet logged — pending AI drafting and approval" note). `useFetch` gained a `refresh()` used to reload the timeline immediately after capture.
- Tests: 3 new workflow tests (invalid form does not POST; valid capture posts the right payload, clears the form, and appears in the timeline; server rejection surfaces the server message). 10/10 pass.

**Verified**
- API over HTTP: valid capture → 201 `CAPTURED`; empty content / 2001-char content / unknown extra key → 400 `VALIDATION`; unknown customer → 404; captured item appears first in `GET /api/customers/:id` timeline; `GET /api/audit` lists `CAPTURE` entries; health shows `interactions`.
- `npm run lint`, `npm run typecheck`, `npm run test` green. Browser opened at the profile page.

**Decisions recorded**
- Captured interactions are real, runtime objects but they are `CAPTURED`, never `LOGGED`; the timeline is a merged view with clear source badges. This satisfies "see it immediately" while keeping the approve-and-log gate intact for later phases.
- Capture attribution uses the seeded demo agent (no auth yet); `capturedBy` on the body is optional and matched against seeded agents.
- Audit store is in-memory for this milestone (immutable append-only semantics, reset on server restart); the DB-backed audit and its view arrive later.

---

## 2026-09-20 — AI Copilot drafting (mock AI)

Implemented the AI drafting step of the workflow: from an inventory of captured interactions, the agent picks one and the AI Copilot produces three kinds of human-editable drafts — a **summary**, a **CRM note**, and a **suggested customer response**. Output is grounded strictly in the captured interaction (never invented facts, missing information explicitly flagged), versioned prompt templates are recorded per artifact, every draft/keep side effect flows through a service, and nothing is auto-sent or auto-written to a CRM (R4, R6, R7, R8, R12, R13).

**Built**
- `src/shared/schemas.ts` — `DraftKindSchema` (`SUMMARY | CRM_NOTE | RESPONSE`), `DraftContentSchema` (trimmed 1–2000), `DraftSourceSchema`, `AiDraftSchema` (revision, model, promptVersion, supersededAt, `isSynthetic`), draft list/generate/update response schemas, `UpdateDraftInputSchema` (strict), `GenerateDraftInputSchema`; audit actions extended with `AI_GENERATE` and `DRAFT_EDIT`.
- `src/server/ai/` — **versioned prompt templates** (`prompts/templates.ts`), **context assembler** (`context.ts`, body capped at 1600 chars with truncation marker), **deterministic grounded mock engine** (`mock.ts`, model `mock-copilot-v1`; extracts order-ref/price/timeline/question/tone from the message and never asserts facts not present), and **client** (`client.ts`): mock mode always; 501 if a real provider is configured; 502 if output fails schema validation.
- `src/server/data/drafts.ts` — in-memory draft store; each generate/edit inserts a new revision row and supersedes the previous; `listCurrentDrafts` returns only current drafts sorted SUMMARY → CRM_NOTE → RESPONSE.
- `src/server/services/drafts.ts` — `generateDraft` / `listDraftsForInteraction` / `updateDraftContent`; 404 for unknown interaction; emits `AI_GENERATE` and `DRAFT_EDIT` audit rows.
- `src/server/api/routes.ts` — `POST /api/interactions/:id/summarize|generate-note|generate-response`, `GET /api/interactions/:id`, `GET /api/interactions/:id/drafts`, `PUT /api/interactions/:id/drafts/:draftId`; health now reports `ai: { configured, mode }`.
- `src/server/data/db.ts` — `getInteraction`, `getCapturedInteractions`; `src/server/lib/agents.ts` — shared agent-name resolver (deduped from interactions service).
- `src/ui/components/AiCopilot.tsx` — panel on the customer profile: empty state ("No interaction captured yet"), interaction picker with raw source box, three generate actions, three editable draft cards (per-card loading / "Not generated yet" empty / textarea + Save + Regenerate), provenance (model, prompt version, revision, superseded), mock badge, advisory ("Draft only — never sent automatically and never written to the CRM"), and loading / error / empty states throughout.
- `src/ui/lib/api.ts`, `src/ui/pages/CustomerProfilePage.tsx` — API methods and AI Copilot wiring between the capture panel and the profile grid.
- Tests: 5 new UI workflow tests (empty state; generate editable summary; edit + save → PUT and revision 2; CRM note + response cards + advisory; `REJECTAI` server failure surfaces an alert) and 5 new server-side pipeline tests in `src/ui/__tests__/ai-pipeline.test.ts` (mock determinism, grounded summary + missing-info flags, no invented order refs in responses, truncation still conforms to the shared schema, revision/supersede semantics). **20/20 pass.**

**Verified**
- `npm run lint`, `npm run typecheck` (UI + server), `npm run test`, `npm run build` all green.
- API over HTTP (`http://localhost:8787`): capture → summarize/generate-note/generate-response each return `mock-copilot-v1` drafts with `promptVersion` and `Missing information` lines; drafts list shows 3 current drafts; PUT edit bumps revision 2 and supersedes the prior row; audit lists `CAPTURE`, 3× `AI_GENERATE`, `DRAFT_EDIT`; error paths 404 (unknown interaction), 400 (empty content), 400 (strict unknown body key); health shows `interactions` and `ai.mode: "mock"`.
- Built bundle re-scanned: no LLM provider endpoints, no API keys, no `AI_API_KEY` in the client (R9). Browser opened at `http://localhost:8787/#/customers/c-001`.

**Decisions recorded**
- Mock-first AI was the deliberate scope: a deterministic, obviously-synthetic generator exercises the exact production contract (grounding, versioned prompts, zod schema validation, audit, draft lifecycle) with zero cost and zero risk. The client throws `AI_UNAVAILABLE` (501) if a real provider is configured rather than half-coding a second path.
- Drafts are a versioned revision stream (immutable rows + supersede) rather than mutable documents, so every AI/agent change is visible and auditable; only non-superseded rows are surfaced.
- Draft content is real text but is never `LOGGED`, never sent, and never written to a CRM; the audit trail records the actions without claiming those artifacts were shipped.

---

## Future entries

- [ ] Phase 1 — Data & API foundation
- [ ] Phase 2 — AI context pipeline
- [ ] Phase 3 — Review & approval workflow
- [ ] Phase 4 — Dashboard UI
- [ ] Phase 5 — Audit, polish, ship