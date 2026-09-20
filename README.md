# Customer Support Copilot

Production-style MVP for a social-media customer-contact workflow. Helps a human support agent capture a customer interaction, get AI drafts (summary, CRM-ready note, suggested response), review/edit them, approve explicitly, and log a CRM-ready record with a full activity history and audit trail.

**Context engineering is a core goal:** layered, versioned, structured-context prompts with strict output validation and human-in-the-loop approval.

> This is a portfolio/bootcamp project. It uses 100% synthetic data. It never connects to a real CRM, real social accounts, or any financial system, and it never infers a customer's identity from a social handle.

## Status

**Shell + dashboard UI implemented (2026-09-20), capture workflow added (2026-09-20), AI Copilot drafting added (2026-09-20).** Application shell, dashboard, customer search, customer profile with social-handle section, activity timeline, the customer-interaction **capture workflow** (select customer → channel/direction/content → save → visible instantly in the timeline), and the **AI Copilot** (human-editable AI drafts — summary, CRM note, suggested customer response — grounded strictly in the captured interaction, never inventing facts, flagging missing information) are implemented against a synthetic-data API and a deterministic mock-AI engine. Approval/logging and audit views are **not** implemented yet. Captured interactions are stored as `CAPTURED` (not part of approved/logged history) and AI drafts are never auto-sent and never written to the CRM, per the guardrails. See `DEVELOPMENT_LOG.md` and `context/PROJECT_PLAN.md`.

## Current runbook

```
npm install
npm run seed          # regenerate synthetic snapshot (deterministic)
npm run dev           # API (8787) + Vite dev server (5173, proxies /api)
npm run build         # production build of the UI
npm start             # single server: API + built UI on http://localhost:8787
npm run lint
npm run typecheck
npm run test
```

No API key is involved in this milestone. The AI Copilot runs in deterministic **mock mode** (no outbound LLM calls); `/api/health` reports `ai.mode: "mock"`.

## Workflow (10 steps)

1. Select/search a customer
2. View customer profile + social handle
3. **Capture an interaction** — implemented: channel/direction/content form, saved as `CAPTURED`, shown immediately in the timeline
4. **AI summarizes the interaction** — implemented (mock AI, versioned prompts, grounded in the interaction, flags missing info)
5. **AI generates a CRM-ready note** — implemented, human-editable draft only
6. **AI generates a suggested customer response** — implemented; explicitly never sent automatically
7. **Agent edits/reviews the AI output** — implemented (editable drafts; saving creates a new revision with audit trail)
8. Explicit human confirmation before logging — deferred (approval gate is enforced in services when it lands)
9. Customer interaction history displayed — timeline shows logged records + captured interactions
10. Audit trail maintained — captures and AI actions emit audit entries (in-memory audit store; view coming later)

## Guardrails

- AI is advisory only. Nothing AI produces is written to history without explicit human approval.
- A social handle is never treated as identity. Customer facts are seeded, synthetic, and never invented.
- API keys live only in server environment variables; no keys in frontend code.
- Full rules: `context/RULES.md`.

## Repository layout

```
context/         PRD, architecture, plan, agent rules, skills
src/
  ui/            React frontend (Vite)
  server/
    api/         HTTP routes + validation
    services/    workflow business logic
    ai/          prompts/, context assembler, structured-output client
    data/        schema, migrations, synthetic seed generator
    lib/         config, middleware, audit writer
  shared/        Types + zod schemas shared by API and UI
DEVELOPMENT_LOG.md
README.md
```

## Getting started (post-approval)

```
npm install
npm run seed          # regenerate synthetic data
npm run dev           # API + UI (starts after Phase 1)
```

Runs in mock-AI mode automatically when no API key is configured. To enable a real LLM, set the server-side key in `server/.env` (git-ignored).

> Note: mock-AI drafting ships now; real LLM wiring is future work and, like the mock, would never auto-send replies or write to a CRM.

```
npm run lint
npm run typecheck
npm run test
```

## Documentation

- `context/PRD.md` — product requirements and acceptance criteria
- `context/ARCHITECTURE.md` — system design, data model, AI context pipeline
- `context/PROJECT_PLAN.md` — phases, definition of done, ship criteria
- `context/RULES.md` — non-negotiable constraints
- `context/AGENTS.md` — operating instructions for coding agents
- `context/SKILLS.md` — runbooks for common tasks
- `DEVELOPMENT_LOG.md` — development and ship log