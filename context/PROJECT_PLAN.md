# Customer Support Copilot — Project Plan

Status: PROPOSED — awaiting approval.
Last updated: 2026-09-20

## 1. Goal

Ship a production-style MVP: a contact-center copilot that lets a human agent find a synthetic customer, capture a social interaction, get AI-drafted summary/note/response, review and edit them, approve explicitly, and log a CRM-ready record with a full audit trail — while demonstrating context engineering.

## 2. Phases and milestones

### Phase 0 — Context & foundations (this phase)
- [x] Requirements analysis
- [x] Architecture proposal (`context/ARCHITECTURE.md`)
- [ ] PRD (`context/PRD.md`)
- [ ] Agent/Rules/Skills context (`context/AGENTS.md`, `context/RULES.md`, `context/SKILLS.md`)
- [ ] README and development/ship log
- Gate: user approval before any implementation.

### Phase 1 — Data & API foundation
- Scaffold `src/server`, `src/shared`, Vite app.
- Schema + migrations + Drizzle setup.
- Synthetic seed data generator (customers, agents, sample interactions) — clearly synthetic, no real data.
- Search/list/get customer endpoints.
- Capture-interaction endpoint.
- Definition of done: all Phase-1 endpoints tested, audit events written, `npm run lint` and `npm test` green.

### Phase 2 — AI context pipeline
- Versioned prompt templates in `src/server/ai/prompts/`.
- Context assembler (customer + interaction + tone + safety layers).
- Structured-output calls with zod validation; mock mode when no API key.
- Endpoints: summarize / generate-note / generate-response.
- Definition of done: guaranteed-shaped drafts, prompt_version recorded, mock mode produces deterministic drafts, API-key-free test run passes.

### Phase 3 — Review & approval workflow
- Versioned draft editing (`PUT .../drafts/:id`).
- Approve-and-log endpoint with explicit `confirm`; idempotency guard (one log per interaction).
- Logged activity history per customer.
- Definition of done: cannot log without human approval; cannot approve a draft that fails zod validation; one interaction logs once.

### Phase 4 — Dashboard UI
- Customer search + list.
- Customer detail: profile, handle, activity history.
- Capture panel.
- AI review panel (read-only source → editable drafts → approve).
- Responsive, accessible, modern contact-center layout.
- Definition of done: full workflow passes keyboard-only; WCAG-minded contrast/focus; dashboard usable at 360px and desktop widths.

### Phase 5 — Audit, polish, ship
- Audit trail views (per interaction + global).
- Error states, empty states, loading states.
- Rate limiting, content security policy, deployment docs.
- Manual end-to-end test script + Playwright smoke suite.
- Definition of done: ship checklist in `DEVELOPMENT_LOG.md` complete.

## 3. Deliverables per feature (definition of done)

Every feature ships only when all of the following hold:
1. Shared types + zod schema exist in `src/shared`.
2. Service/controller separation respected (no DB writes from `api/`, no LLM calls from `api/`).
3. Audit event emitted for the action.
4. Accessibility pass: labelled controls, focus order, keyboard operable.
5. Tests pass for the touched module; lint + typecheck green.

## 4. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| LLM produces malformed/off-policy output | Strict JSON schema + zod validation, block-and-retry, advisory-only framing |
| API key leakage to client | Keys server-side only; mock mode default; CSP + no injected env in frontend |
| Logging something unapproved | Approval gate enforced in service layer, not UI; idempotency guard |
| Scope creep (real integrations) | RULES.md forbids real CRM/social/banking integrations for this MVP |
| Prompt drift / non-reproducibility | Versioned prompt templates + `prompt_version` on every AI artifact |
| Long interaction breaks prompt budget | Truncation with elision marker in context assembler |

## 5. Release criteria (MVP)

- [ ] Full 10-step workflow works end to end against synthetic data.
- [ ] AI advisory-only enforced; human approval required; audit trail complete.
- [ ] No API key required to run (mock mode) and no keys in frontend code.
- [ ] Dashboard responsive + keyboard accessible on core flows.
- [ ] README documents run/test/seed; DEVELOPMENT_LOG tracks every change.