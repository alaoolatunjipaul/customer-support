# Customer Support Copilot — Product Requirements Document (PRD)

Status: PROPOSED — awaiting approval.
Last updated: 2026-09-20

## 1. Overview

Customer Support Copilot is a production-style MVP portfolio/bootcamp project for a social-media customer-contact workflow. It equips a human customer-support agent to quickly find a customer, capture a social interaction, have AI draft a summary, CRM note, and suggested reply, then review, edit, explicitly approve, and log the interaction — with a complete activity history and audit trail.

## 2. Goals

- Demonstrate a human-in-the-loop AI workflow, not a black-box "AI does everything" product.
- Demonstrate **context engineering**: layered, versioned, structured-context prompts with strict output schemas.
- Deliver a clean, modern, responsive, accessible contact-center dashboard.
- Keep the architecture simple and teachable: UI / API / AI / data clearly separated.

## 3. Non-goals (out of scope)

- No real bank CRM or any live CRM integration.
- No real social-media API integrations or real accounts.
- No financial transactions, balances, or payments of any kind.
- No customer identity inference from a social handle.
- No fully autonomous AI logging; no one-click "AI did it" logging without human confirmation.
- No multi-tenant production auth (demo agent sessions only; designed to be replaceable).

## 4. Personas

- **Support Agent (primary):** a human working the social queue. Needs speed, clarity, and control over what gets written to the CRM. Operates with keyboard and mouse; may be on any screen size.
- **Team Lead / Auditor (secondary):** views the audit trail and logged activity history to verify human approval and provenance.

## 5. Core workflow (mapped to the 10 required steps)

1. Select/search a customer — search by name or handle; filter by channel.
2. View customer profile + social handle — profile facts are seeded synthetic data; the handle is explicitly shown as a handle, never an identity claim.
3. Capture an interaction — agent records a raw social engagement (post/comment/DM) for the customer.
4. AI summarizes the interaction — concise factual recap, distilling the raw content.
5. AI generates a CRM-ready note — canonical record with category, tone, and follow-up, written for the CRM.
6. AI generates a suggested customer response — customer-facing draft in the right channel voice.
7. Agent edits/reviews AI output — all three AI outputs are editable drafts; editing is versioned and audited.
8. Explicit human confirmation before logging — approve-and-log requires a positive confirm and cannot be bypassed.
9. Display interaction history — logged activities for the customer, newest first.
10. Maintain an audit trail — every capture, AI call, edit, approval, and log is appended to an immutable audit log.

## 6. Functional requirements

### FR-1 Customer directory
- Search customers by name or handle, with channel filter and pagination.
- Customer detail shows profile, handle, channel, and interaction history.

### FR-2 Capture interaction
- Agent enters channel, direction, and raw content for a selected customer.
- Captured interaction is stored with captured_by + timestamp; status `CAPTURED`.

### FR-3 AI drafting
- Three draft types per interaction: SUMMARY, CRM_NOTE, RESPONSE.
- Each draft carries `prompt_version` and `model`; drafts are versioned on edit.
- AI runs in mock mode when no API key is configured (drafts clearly marked MOCK).

### FR-4 Review and edit
- UI presents the raw interaction and the editable AI drafts side by side.
- Agent can regenerate a draft, edit it, and see what changed.

### FR-5 Approval and logging
- Approve button is disabled unless the agent explicitly confirms (e.g., type/click confirm).
- On approval, a CRM-ready logged activity is created; interaction only ever logs once.
- Rejected/unapproved drafts never appear in customer history.

### FR-6 History and audit
- Customer history = logged activities only (approved records).
- Audit trail lists actions (CAPTURE, AI_GENERATE, DRAFT_EDIT, APPROVE, LOG) with actor, entity, before/after payloads, timestamp.

## 7. Non-functional requirements

- **Usability:** core workflow completable in under one minute after data capture; clear status progression (Captured → Drafted → Approved → Logged).
- **Accessibility (WCAG-minded):** keyboard-operable, visible focus, labelled fields, semantic landmarks, sufficient contrast, reduced-motion respected.
- **Responsive:** usable from 360px mobile through desktop; dashboard adapts, controls remain reachable.
- **Security:** server-side-only secrets, zod validation on every input, rate-limited AI endpoints, parameterized SQL, no client-visible keys.
- **Maintainability:** layer separation enforced; shared types; versioned prompt templates; lint/typecheck/test green before ship.
- **Simple architecture:** single deployable server; SQLite data store; no services the codebase does not need.

## 8. Data constraints & guardrails

- 100% synthetic data. Every customer/interaction seeded by a generator; `is_synthetic = true`; no real names, handles, or content.
- The app must never claim a handle implies a real identity; do not "invent" facts about a customer beyond seeded profile fields.
- AI must never fabricate customer details, account info, or financial facts, and must flag uncertainty.
- AI output is always advisory; only the human approval step creates a CRM record.
- API keys: server env only; never in frontend code or client payloads.

## 9. Acceptance criteria (MVP)

1. An agent can complete steps 1–10 end to end with synthetic data.
2. A UI path exists to edit every AI draft and to regenerate it.
3. Logging is impossible without explicit human confirmation (verified by test).
4. Every AI generation emits an audit row; every draft records prompt_version/model.
5. The app runs fully in mock-AI mode with no API key and no errors.
6. `npm test`, lint, and typecheck pass; keyboard-only e2e of the core flow passes.

## 10. Future (post-MVP, not built now)

- Real authn/authz with an identity provider.
- Queues/prioritization across social channels.
- Feedback loop for AI drafts (thumbs up/down → evals).
- Export integration to a real CRM (with explicit approval and consent).
- Batch processing with per-item human review.