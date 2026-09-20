# Implementation Artifact — Application Shell + Dashboard UI

Milestone: 2026-09-20 · No AI implemented in this milestone. Capture workflow added later the same day (`IMPLEMENTATION_ARTIFACT.md` → "Capture workflow" section below).

## What was built

An end-to-end runnable slice of the approved architecture (`context/ARCHITECTURE.md`): a single Node server exposing a zod-validated REST API over deterministic synthetic data, plus a React application shell and dashboard UI. AI, capture workflow, approval/logging, and audit views are explicitly deferred.

```
src/
  shared/schemas.ts        single source of truth: zod schemas + TS types
  server/
    index.ts               Express app; API + built UI served from one process
    api/routes.ts          health, customers list/search, customers/:id, agents, dashboard
    data/db.ts             in-memory query layer (Drizzle/SQLite swap-in later)
    data/seed/             deterministic synthetic generator + seed-data.json snapshot
    lib/config.ts, lib/middleware.ts   env config, request logger, HttpError + error handler
  ui/
    index.html, main.tsx, App.tsx, styles.css
    components/            AppLayout, Sidebar, States, StatCard, Badges
    pages/                 DashboardPage, CustomersPage, CustomerProfilePage
    hooks/useFetch.ts, lib/api.ts, lib/format.ts
    __tests__/             setup + app.test.tsx (7 tests)
```

## UI features delivered (as requested)

- **Sidebar navigation** — Dashboard + Customers links, disabled "Coming later" entries, agent chip. NavLink active state, `aria-current`, focus-visible.
- **Dashboard** — stat cards (customers, logged activities, open items, today), customers-by-channel bars, recent logged activity with links to profiles.
- **Customer search** — debounced search by name/handle, channel filter (All/X/Instagram/Facebook), pagination, result count, empty/loading/error states. Query lives in the URL so it survives navigation.
- **Customer profile** — profile facts (summary, bio, location, joined year, tags), status + channel badges, provenance note ("seeded synthetic profile").
- **Social handle section** — handle rendered as a handle with the explicit rule that a handle is never an identity claim; profile facts are seeded only (R5).
- **Activity timeline** — logged (approved) records, newest first: kind/channel/direction badges, timestamp, summary, CRM note, suggested response, approver.
- **Responsive layout** — sidebar becomes an off-canvas drawer with backdrop ≤960px, grids stack at ≤1100/≤640/≤460px, reduced-motion respected, skip-link, labelled controls.

## How to run

```
npm install
npm run seed          # deterministic synthetic snapshot
npm run dev           # API :8787 + Vite :5173 (dev, with /api proxy)
npm run build         # production UI build
npm start             # single server: API + built UI on http://localhost:8787
```

Quality gates: `npm run lint` · `npm run typecheck` · `npm run test` (all green).

## Verification performed

- Lint 0 issues, typecheck 0 errors, Vitest 7/7 pass (navigation, debounced search, profile/handle/timeline, 404 state, responsive drawer open/close/auto-close).
- Server checks against `http://localhost:8787`:
  - `GET /api/health` → `{ ok: true, ..., ai: { configured: false, mode: "deferred" } }`
  - `GET /api/dashboard`, `GET /api/customers?search=` (name and handle), `channel=` filter, `limit`/`offset`
  - `GET /api/customers/c-001` → profile + timeline sorted newest-first
  - invalid `channel=WRONG` and `limit=99999` → 400 `VALIDATION`
  - missing customer → 404 `NOT_FOUND`
  - `/` serves the built UI
- Built bundle scanned: no API-key or LLM references (R9).
- App opened in the default browser at `http://localhost:8787`.
- Rule compliance re-checked against `context/RULES.md` (synthetic only, no integrations, no identity-from-handle, no keys in client, layer separation, zod on boundaries, accessibility).

## Notes and trade-offs

- Data layer is in-memory + deterministic seed; the full Drizzle/SQLite data foundation and the AI pipeline are later phases. The API contract (shared zod schemas) is designed to stay stable across that swap.
- Search matches name/handle only, per `ARCHITECTURE.md` §5.
- `/api/health` reports AI as deferred because AI is not implemented here — the dashboard topbar shows "AI: deferred" likewise.
- Navigation and responsive-drawer behavior are covered by automated component tests; the drawer's visibility is class-driven so the same mechanism works at any viewport.

---

# Implementation Artifact — Customer Interaction Capture Workflow

Milestone: 2026-09-20 · Same-day follow-up. No AI implemented.

## What was added

The capture step of the 10-step workflow: select a customer → choose channel/direction → enter the interaction → save → see it immediately in the activity timeline, with validation and error states.

- `POST /api/customers/:id/interactions` — zod-validated (strict, unknown keys rejected), 400 `VALIDATION` / 404 `NOT_FOUND` / 201 with the created interaction.
- `GET /api/audit?limit=` — append-only in-memory capture audit trail (R11).
- `CaptureForm` — channel + direction selects, content textarea (max 2000, live counter), inline errors with `aria-invalid`/`aria-describedby`, submitting state, success and error banners.
- Timeline is now a discriminated-union view: `logged` activities (seeded approved records) and `captured` interactions (runtime) merge newest-first, each visibly badged.

## Guardrail note (R7)

Captures are stored as `CAPTURED`, never `LOGGED`. The timeline merges sources but marks captures: "not yet logged — pending AI drafting and approval (later phase)". No CRM-ready record is written and nothing bypasses the (future) approval gate; captured content is a raw engagement, not an approved history entry.

## Verified

- Automated: `npm run lint`, `npm run typecheck`, `npm test` (10/10). New tests cover: empty form does not POST and shows "Content is required."; a valid capture POSTs the correct payload, clears the form, and appears in the timeline with a `CAPTURED` badge; a server rejection surfaces the server's error message via `role=alert`.
- Manual over HTTP against `http://localhost:8787`:
  - valid capture → `201 CAPTURED`, attributed to the demo agent;
  - empty / 2001-char content and an unknown extra key → `400 VALIDATION`;
  - unknown customer → `404 NOT_FOUND`;
  - `GET /api/customers/c-004` timeline lists the captured item first;
  - `GET /api/audit` lists the `CAPTURE` entries; `/api/health` reports `interactions`.
- Browser opened at `http://localhost:8787/#/customers/c-001` (capture form + timeline with the captured interactions).

## Files changed

`src/shared/schemas.ts` · `src/server/lib/errors.ts` · `src/server/data/audit.ts` · `src/server/data/db.ts` · `src/server/services/interactions.ts` · `src/server/api/routes.ts` · `src/ui/hooks/useFetch.ts` · `src/ui/lib/api.ts` · `src/ui/components/CaptureForm.tsx` · `src/ui/pages/CustomerProfilePage.tsx` · `src/ui/components/Sidebar.tsx` · `src/ui/styles.css` · `src/ui/__tests__/app.test.tsx` · docs.

---

# Implementation Artifact — AI Copilot Drafting (mock AI)

Milestone: 2026-09-20 · Same-day follow-up. Deterministic mock AI; no LLM provider, no API key, no auto-send, no CRM writes.

## What was added

The AI drafting steps of the 10-step workflow. Pick a captured interaction; the Copilot produces three **human-editable drafts**: a summary, a CRM-ready note, and a suggested customer response. Every draft is grounded strictly in the captured message, flags anything it is missing, records its model + prompt template version, and is stored as an in-memory revision stream marked `isSynthetic`.

- `POST /api/interactions/:id/summarize | generate-note | generate-response` → current or new draft (201 semantics on 200; 404 unknown interaction; 502 if output fails schema validation).
- `GET /api/interactions/:id` and `GET /api/interactions/:id/drafts` → interaction detail and current (non-superseded) drafts.
- `PUT /api/interactions/:id/drafts/:draftId` → new edited revision, superseding the previous; empty content → 400 `VALIDATION`, unknown body keys → 400 `VALIDATION` (strict).
- `src/server/ai/` — versioned prompt templates, context assembler (1600-char body cap w/ truncation marker), deterministic grounded mock engine (`mock-copilot-v1`), and the client (mock mode; 501 if a real provider is configured).
- Audit actions `AI_GENERATE` and `DRAFT_EDIT` appended to the in-memory audit trail; `/api/health` reports `ai: { configured, mode: "mock" }`.
- `AiCopilot` UI panel on the customer profile: interaction picker + raw source, three generate actions, three editable draft cards (loading / empty / textarea + Save + Regenerate states), provenance and advisory ("Draft only — never sent automatically and never written to the CRM"), mock badge.

## Guardrail note (R4, R6, R7, R8, R9)

Drafts are advisory and human-gated end-to-end: nothing is sent automatically, nothing is written to the (future) CRM logging path, and draft artifacts never enter logged history. The engine cannot invent facts — the summary and response say "order reference — not provided in the message" when the order number is absent, and the response ends with `[Not sent — draft for human review before sending.]`. Versioned prompt templates and zod-validated structured output are the context-engineering contract. The built bundle was scanned: no LLM endpoints, no API keys.

## Verified

- Automated: `npm run lint`, `npm run typecheck` (UI + server configs), `npm test` (**20/20**), `npm run build`. New coverage: 5 UI workflow tests (empty state; generate → editable summary; edit + Save → PUT + revision 2; CRM note + response cards + advisory; generation failure → `role=alert`), 5 server-side pipeline tests (determinism; grounding + missing-info flags; no invented order ref; truncation within schema; revision/supersede semantics).
- Manual over HTTP against `http://localhost:8787` (capture → generate all three → list → edit → audit), plus error paths 404 / 400-empty / 400-unknown-key; health `ai.mode: "mock"`.
- Browser opened at `http://localhost:8787/#/customers/c-001` for the end-to-end workflow (capture → generate → edit → save → regenerate).

## Files changed

`src/shared/schemas.ts` · `src/server/ai/prompts/templates.ts` · `src/server/ai/context.ts` · `src/server/ai/mock.ts` · `src/server/ai/client.ts` · `src/server/data/drafts.ts` · `src/server/services/drafts.ts` · `src/server/api/routes.ts` · `src/server/data/db.ts` · `src/server/lib/agents.ts` · `src/server/lib/config.ts` · `src/server/services/interactions.ts` · `src/ui/lib/api.ts` · `src/ui/components/AiCopilot.tsx` · `src/ui/pages/CustomerProfilePage.tsx` · `src/ui/components/Sidebar.tsx` · `src/ui/components/AppLayout.tsx` · `src/ui/styles.css` · `src/ui/__tests__/app.test.tsx` · `src/ui/__tests__/ai-pipeline.test.ts` · docs.