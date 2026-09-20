# Customer Support Copilot — Technical Architecture

Status: PROPOSED — awaiting approval before implementation.
Last updated: 2026-09-20

## 1. Guiding principles

- Simple architecture: one Node.js server serving a static frontend build and a REST API.
- Clear separation between layers: UI, API, AI logic, data.
- AI is advisory only; every AI-generated output is a draft that requires explicit human approval before it is logged.
- No real customer data, no banking/CRM integrations, no real social-media accounts. All data synthetic.
- Secrets never leave the server; API keys are only ever in backend environment variables.
- Every state-changing action and every AI generation is recorded in an audit trail.

## 2. System context

```
+----------------+       HTTPS       +-----------------------------------------------+
|                | ----------------->|                                               |
|  Browser       |   JSON (REST)     |   Customer Support Copilot (single Node app)  |
|  (React UI)    |                   |                                               |
|                |                   |  +-----------+   +-----------+   +----------+ |
|  Human agent   |                   |  |  API      |-->|  AI       |-->|  LLM     | |
|  (keyboard +   |                   |  |  layer    |   |  service  |   |  (OpenAI |
|   mouse,       |                   |  |  routes   |   |  (server) |   |   compat)| |
|   WCAG-minded) |                   |  +-----------+   +-----------+   +----------+ |
+----------------+                   |       |                  |                    |
                                     |       v    +----------+  |                    |
                                     |  +-------->| SQLite   |<----------------------+
                                     |  |  data   |  (file)  |  (every AI call is   |
                                     |  |  layer  | +-------+ |   audited too)       |
                                     |  +--------->| seeds, |                      |
                                     |             |  audit |                      |
                                     |             +--------+                       |
                                     +-----------------------------------------------+
```

- In development, the LLM can be replaced by a **mock AI mode** so the app runs with no API key.
- The AI layer is the only place that talks to an LLM.

## 3. Layered architecture

```
src/
  ui/            React frontend (Vite build, static files served by the server)
  server/
    api/         HTTP routes + request validation (the only HTTP boundary)
    services/    business logic: capture, draft, review, approve, log, audit
    ai/          AI logic: context assembly, prompt versioning, structured output
    data/        database access (Drizzle), migrations, seed script
    lib/         middleware, auth, config, audit writer
  shared/        TypeScript types + zod schemas shared by API and UI
```

Separation rules:

- **api/** never talks to the LLM directly; it calls `services/`.
- **ai/** is called only through services; it never renders UI and never writes DB records (only returns drafts).
- **data/** has no business rules; services own the workflow and the approval gate.
- **ui/** never holds API keys and never calls the LLM directly.

## 4. Data model (SQLite)

- **customers** — synthetic personas. Fields: id, name, handle, channel, profile summary, is_synthetic flag (always true), created_at. A handle never carries an inferred identity: profile fields are seeded facts, not derivations.
- **agents** — human operators for audit attribution. id, name, role, created_at. (Seed with demo agents.)
- **interactions** — a captured raw social engagement (post, comment, DM) tied to a customer. Fields: id, customer_id, channel, direction (inbound/outbound), content, captured_by, captured_at, status.
- **ai_drafts** — provisional AI outputs, always revisable. Fields: id, interaction_id, kind (SUMMARY, CRM_NOTE, RESPONSE), content, model, prompt_version, created_at, updated_at, superseded_at.
- **logged_activities** — CRM-ready records created only after human approval. Fields: id, interaction_id, customer_id, summary, crm_note, suggested_response (nullable), approved_by, approved_at, logged_at. This is the customer's interaction history.
- **audit_log** — immutable append-only trail. Fields: id, actor, action, entity_type, entity_id, payload_before (nullable), payload_after (nullable), created_at.

Workflow status transitions: `CAPTURED -> DRAFTED (ai_drafts exist) -> APPROVED -> LOGGED`.

## 5. REST API

- `GET /api/health`
- `GET /api/customers?search=&channel=&limit=&offset=` — search by name/handle
- `GET /api/customers/:id` — profile + handle + activity history
- `POST /api/customers/:id/interactions` — capture an interaction
- `GET /api/interactions/:id`
- `POST /api/interactions/:id/summarize` — returns AI summary draft
- `POST /api/interactions/:id/generate-note` — returns AI CRM-note draft
- `POST /api/interactions/:id/generate-response` — returns AI suggested reply draft
- `PUT /api/interactions/:id/drafts/:draftId` — agent edits a draft (versioned)
- `POST /api/interactions/:id/approve` — explicit human approval (requires `confirm: true`); creates the logged activity
- `GET /api/interactions/:id/audit` and `GET /api/audit` — audit trail queries
- `GET /api/agents` — demo agent list (for attribution)

Everything is server-validated with zod. Unknown fields are rejected. Approve-and-log is idempotent-guarded: an interaction can only be logged once.

## 6. AI layer and the context-engineering pipeline

The AI service assembles context in layers and only ever returns **structured drafts**; it cannot log anything.

1. **System prompt (invariant):** role (advisory copilot for a social customer-service desk), guardrails (no PII invention, no identity claims from handle alone, no financial advice, human-approval reminder), tone guidance, output JSON schema.
2. **Dynamic context assembly per task:**
   - *Customer context* — sanitized synthetic profile + handle + channel; explicitly labels handle as non-identifying.
   - *Interaction context* — raw captured content, channel, direction; capped/truncated when long so the prompt stays within budget.
   - *Tone context* — per-channel voice guidance (X, Instagram, Facebook) applied only to response drafting.
   - *Safety context* — hard rules appended last: advisory only, never fabricate details, flag uncertainty.
3. **Structured output:** each task requests a defined JSON schema; the result is validated with zod before it is surfaced. Invalid output is rejected and surfaced as a draft error, never partially trusted.
4. **Prompt versioning:** every invocation records `prompt_version` (hash of the prompt template), `model`, and `timestamp` into `ai_drafts` and `audit_log`, so output reproducibility and changes are auditable.
5. **Mock mode:** when no API key is set, the AI service returns deterministic pseudo-drafts (clearly marked `MOCK`), so the full approval workflow can be exercised without an LLM.

### Context-engineering decisions (documented for the portfolio)

- Prompt templates are versioned strings in `src/server/ai/prompts/`, not inline code.
- Dynamic field injection is centralized in an assembler; the same customer context block is reused across summary/note/response so behavior is consistent.
- The instruction "do not infer customer identity from a social handle alone" is stated explicitly in the prompt and mirrored by validation on the data layer.
- Long interactions are truncated with an explicit marker so the model knows content was elided.
- Outputs are advisory by construction: the UI renders drafts in an editable review panel, and the log is created only by the human approval endpoint.

## 7. Security model

- API keys exist only in `server` environment variables; the frontend has no key references, and the build process injects none.
- All inputs validated with zod (injection-safe, length-capped).
- Server-side rate limiting on AI endpoints (generations are the expensive, abuse-prone path).
- Demo auth: a lightweight session for the seeded demo agents; audit records always carry an actor. Full auth is out of MVP scope but the audit + approval gate is designed so a real identity provider can be added without workflow changes.
- SQL used only through Drizzle parameterized queries.
- Logging: no secrets ever logged; audit payloads are trimmed to defined fields.

## 8. Observability & maintainability

- Structured request logging middleware.
- `/api/health` exposes service + mock-mode status.
- Every audit row is write-once; deletions are not allowed by the API.
- Definition of done for every feature includes: types shared, zod validated, audit event emitted, accessibility touched, tests green.

## 9. Key decisions (ADR-style)

- **Single Node server (API + static UI)** — simplest deployable; one artifact, minimal moving parts for an MVP.
- **SQLite file DB** — zero setup, transactional, fine for a single-instance MVP; switch to Postgres later if multi-instance scale is required.
- **Drizzle ORM** — type-safe, lightweight, SQLite/Postgres compatible, no codegen bloat.
- **React + Vite + TypeScript** — one language across UI/API/shared, fast build, ecosystem maturity.
- **AI via OpenAI-compatible interface** — provider-swappable; mock mode decouples development from cost/keys.
- **Human-in-the-loop gate at the service layer** — the approval check lives in business logic, not the UI, so it cannot be bypassed by a direct API call.