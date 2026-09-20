# SKILLS.md — Runbooks and reusable workflows for agents

Status: PROPOSED. Each skill lists the inputs, the steps, and the "done" check that must hold.

## Skill 1 — Capture a customer interaction

Purpose: turn a raw social engagement into a workflow-ready interaction record.

1. Load customer via search (`GET /api/customers?search=...`).
2. Open customer detail; click "Capture interaction".
3. Fill channel, direction (inbound/outbound), and raw content. Content is capped by the zod schema.
4. Submit → `POST /api/customers/:id/interactions`.
5. Verify: interaction created with status `CAPTURED`, `captured_by` set, audit row CAPTURE emitted.

Done check: interaction exists, is attached to the customer, and appears as CAPTURED.

## Skill 2 — Generate AI drafts (summary / CRM note / response)

Purpose: produce versioned, schema-valid drafts with full context engineering.

1. Ensure either a real API key (server env) or mock mode (default) is active.
2. Call `POST /api/interactions/:id/summarize` (or `.../generate-note`, `.../generate-response`).
3. The AI service assembles context (customer + interaction + tone + safety), calls with a versioned prompt template and structured output, then zod-validates.
4. Client renders the draft in the review panel.

Done check: draft row `kind`, `prompt_version`, `model` populated; audit AI_GENERATE emitted; invalid output surfaced as an error, not partial text.

## Skill 3 — Review and edit a draft

Purpose: let the human change AI output safely and auditably.

1. Edit in the review panel; every save calls `PUT /api/interactions/:id/drafts/:draftId`.
2. Server validates the new content with the same zod schema used for AI output (no loosening).
3. Draft revision recorded; old revision kept; audit DRAFT_EDIT emits before/after payloads.

Done check: history shows revisions; malformed edits rejected; audit trail intact.

## Skill 4 — Approve and log

Purpose: the single path from draft to CRM history, guarded by a human.

1. Review summary, note, and response in the confirmation screen.
2. Confirm explicitly (the UI disables Approve until confirmation is given).
3. `POST /api/interactions/:id/approve` with `{ confirm: true, approvedBy }` → service re-validates, checks the interaction is not already logged, creates the logged activity.
4. Interaction status → `LOGGED`; idempotency guard prevents double logging.

Done check: logged activity appears in customer history; audit rows APPROVE + LOG emitted; a second approve attempt returns a conflict.

## Skill 5 — Add synthetic data

Purpose: extend the demo dataset without ever touching real data.

1. Edit `src/server/data/seed/` generator only. Keep determinism (seeded RNG, stable ids).
2. Every customer gets `is_synthetic = true` and plausible-but-fake profile fields.
3. Handles and bios must not reference real people or brands.
4. Run `npm run seed`, then re-run tests.

Done check: fresh DB regenerates identical data; nothing references real individuals; lint/typecheck/test green.

## Skill 6 — Run the full manual verification pass

Purpose: prove the 10-step workflow and guards before shipping a phase.

1. `npm run seed` → fresh data.
2. Search a customer → open profile → capture interaction.
3. Generate summary, note, response (mock mode OK).
4. Edit a draft; regenerate another.
5. Try to log without confirming → must fail. Confirm → logged once.
6. Try to log a second time → must fail (conflict).
7. Inspect history (shows only LOGGED) and audit trail (all actions present).
8. Verify no API key appears in the built frontend bundle.
9. Run `npm run lint`, `npm run typecheck`, `npm run test`.

Done check: all steps pass; recorded in DEVELOPMENT_LOG.md.

## Skill 7 — Context-engineering update (prompt change)

Purpose: change model behavior safely and auditably.

1. Edit the versioned prompt template in `src/server/ai/prompts/`; do not modify schema or layering in the same change.
2. Bump its version string; ensure `prompt_version` differs from all prior runs.
3. Re-validate against R6–R9; run AI unit tests (schema conformance, mock-mode determinism).
4. Update ARCHITECTURE.md section 6 if behavior surface changed.

Done check: new prompts are versioned, tests cover output shape, docs updated, audit continues to record `prompt_version`.