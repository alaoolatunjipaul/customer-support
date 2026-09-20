# Customer Support Copilot — Project Summary

**Tagline:** AI-assisted customer support — human reviewed.
**Stack:** React 19 + TypeScript, Vite, Express, zod (validation), Vitest + Testing Library.
**Status:** Demo-ready milestone for a portfolio / bootcamp week-5 submission. All data and AI output are **synthetic**.

---

## Problem

Support agents drown in raw social-media messages (DMs, posts, comments) and spend most of their time rewriting the same thing: a factual summary, a CRM record, and a customer-facing reply. Generative AI is fast but unsafe to attach to real customer communication without guardrails — automated replies and silent CRM writes can damage trust and expose a company to compliance risk. There was no thin, auditable layer that keeps **human approval** at the center of AI-assisted support.

## Solution

A single-workspace copilot that turns a captured social interaction into **three reviewable drafts** (summary, CRM note, suggested response), then requires an **explicit human confirmation** before any record is logged — and writes every step to an **append-only audit trail**. The system never talks to the customer and never writes to a CRM; it drafts, the human decides, and everything is auditable.

## Target user

A support agent working a social contact desk (X, Instagram, Facebook). The UI is built around one agent ("Demo Agent") capturing interactions, reviewing AI drafts, editing them, and choosing to log. All personas and handles are **synthetic**; the app never claims identity from a handle.

## Key features

- **Dashboard** — stat cards (customers, logged activities, open items, today's activity), customers-by-channel breakdown, recent logged activity.
- **Customer search** — instant search by name/handle, channel filter, pagination, deep-linkable via URL state.
- **Customer profile** — profile facts, social handle, and a merged timeline of logged (approved) records + captured interactions.
- **AI Copilot** — generates Summary / CRM note / Customer response drafts for a chosen captured interaction, each versioned (revision, prompt version, model, synthetic flag) and grounded only in that interaction.
- **Human review** — edit any draft in-place, save a new revision; logging is blocked while edits are unsaved.
- **Approve & log** — explicit sign-off: agent picks an activity kind, reviews the exact payload, ticks a confirmation checkbox, then logs (double-logs rejected with `409`).
- **Audit log** — page listing every append-only entry: actor, action, entity, before/after payload, timestamp.

## Architecture

```
React UI (HashRouter)
   │  fetch → /api/* (zod-validated on both sides)
Express API (src/server/api/routes.ts)
   ├── services/  (interactions, drafts, logging — business rules)
   ├── ai/        (context assembly → prompt → mock LLM → schema check)
   └── data/      (in-memory stores: customers seed, captured, drafts, logged activities, audit)
```

- One shared schema module (`src/shared/schemas.ts`) is the single source of truth for types **and** runtime validation (zod) on every API boundary.
- UI uses a small `useFetch` hook with abort handling; every response is validated against a schema and fails closed (`SCHEMA_ERROR`) rather than rendering unknown shapes.
- Production build is served by Express alongside the API (`http://localhost:8787`); dev mode runs Vite (port 5173) proxying `/api`.

## Context Engineering approach

- Any generated draft may **only use the captured interaction text** (`assembleInteractionContext`). Context is assembled explicitly and capped (~1600 chars, truncation flagged in the context itself).
- Prompts are **versioned** (`summary-2026-09-20-v1`, etc.) and templated per draft kind; version and model are shown in the UI provenance line so the human can audit what produced each draft.
- The mock model is **deterministic** (same input → same output) and grounded in the message, explicitly **flagging missing information** (e.g., "order reference — not provided in the message") instead of inventing it.
- Output is constrained by `DraftContentSchema`; anything outside it is rejected as `AI_UNAVAILABLE`/schema failure.

## AI safety approach

- **Advisory only.** Every draft card and the log step repeat: *"Draft only — never sent automatically and never written to the CRM."* Customer-facing replies additionally note a human sends them from the channel tool after review.
- **Fail closed.** Real LLM keys are not wired; with a key present, generation returns `AI_UNAVAILABLE` rather than risking unvalidated output. Model output is zod-checked on the server.
- **No key in the frontend.** Verified by a bundle scan; secret management is server-side (env-gated production guard).
- **Synthetic guardrails.** AI only has access to the captured message; it cannot reach other customers, write data, or send anything.

## Human-in-the-loop design

- Status model is binary-progress: captured (`CAPTURED`) → human-reviewed → logged (`LOGGED`).
- The agent picks the **ActivityKind** explicitly (system never infers metadata).
- The **"Approve & log activity"** control previews the exact record and stays **disabled until a confirmation checkbox is ticked**; unsaved edits also block it.
- The agent can edit drafts to their standard; edits spawn a new revision rather than mutating history.

## Auditability

- `AuditEntry` is append-only and in-memory: `actor`, `action` (`CAPTURE | AI_GENERATE | DRAFT_EDIT | ACTIVITY_LOGGED`), `entityType`, `entityId`, `payloadBefore`/`payloadAfter`, `createdAt`.
- Visible on the **Audit log** page (`/#/audit`) with action badges and timestamps.
- Logged activities on the customer timeline carry `approvedBy`; drafts carry revision + prompt version + model.
- Reset-on-restart is documented (single-node demo), not hidden.

## Testing

- **35/35 passing** (`npm run test`, Vitest + Testing Library); no skipped tests.
  - 19 UI workflow tests: shell/navigation, dashboard, customer search, profile + social handle, responsive drawer, capture flow (validation, success, server-error banner), AI drafts (empty state, generate, edit/save revisions, multi-card, validation-failure banner), approve & log (gating, unsaved-edit block, timeline effect), audit page (render + empty state).
  - 11 pipeline/service tests: mock determinism, grounding, no-invented-facts, schema-constrained output, draft revision superseding, logging service (banner stripping, fallbacks, 404/409, customer timeline move, audit entry).
- Guardrails `npm run lint`, `npm run typecheck` (UI + server), `npm run build` all green.
- End-to-end HTTP verification and a browser workflow of the full demo round-trip performed.

## Current limitations

- **Synthetic only.** No real bank/CRM connection and no real customer data; the app labels this everywhere.
- **In-memory state.** Captures, drafts, logged activities and the audit log reset on restart.
- **Mock AI.** Deterministic replacement model; no real LLM call is made.
- **No auth UI.** The demo runs an in-memory cookie session; production guard (env-gated secret) exists but no SSO is wired.
- **Minor UX gaps.** Regenerating with unsaved edits discards those edits; no pagination on the audit page.

## Future improvements

1. Real LLM integration behind the same validated pipeline (fail closed on schema mismatch).
2. Persistent storage (SQLite/Postgres) for drafts, activities, audit.
3. Confirm-on-regenerate to protect unsaved edits; audit pagination.
4. Jurisdiction-scoped privacy/terms pages and a persona-approval onboarding flow.
5. Multi-agent workspaces with role-based access.