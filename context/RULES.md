# RULES.md — Non-negotiable constraints (Customer Support Copilot)

Status: PROPOSED. These rules bind all implementation. If a change would violate one of these, it is declined, not "adjusted".

## Data integrity

- **R1. Synthetic data only.** Every customer, interaction, and profile record comes from the synthetic seed generator. `is_synthetic = true` always. No real customer information may be imported, pasted, or sampled.
- **R2. No real integrations.** Never connect to a real bank CRM, real social-media accounts/APIs, or any payment/financial service.
- **R3. No financial transactions.** The app never performs, simulates, or implies real financial operations.
- **R4. No invented facts.** AI and code must never invent customer details, account numbers, balances, or history beyond the seeded profile and captured interaction. Uncertainty must be flagged, not filled in.
- **R5. No identity inference from a handle.** A social handle is a handle, never an identity claim. Profile fields are seeded facts; resolving/deriving identity from a handle is forbidden.

## AI behavior

- **R6. AI is advisory only.** All AI output is a draft. The model cannot log, write CRM records, or take consequential actions.
- **R7. Human approval required.** A CRM-ready note or suggested response is only written to customer history after explicit human confirmation through the approve-and-log service. The gate lives in business logic and cannot be bypassed by the UI or a direct API call.
- **R8. Structured, versioned context.** All AI calls use the context assembler + versioned prompt templates with structured outputs validated by zod. Invalid output is rejected, never partially trusted.
- **R9. No keys in frontend.** API keys live only in server environment variables. Client payloads, bundles, and repos contain no secrets.

## Privacy & ethics

- **R10. No real PII.** Nothing in the product, seeds, tests, or docs references real individuals or exposes a real person's data.
- **R11. Audit everything.** Every capture, AI generation, draft edit, approval, and log emits an immutable audit record with actor, entity, and before/after payloads.

## Engineering

- **R12. Layer separation.** `api/` (HTTP) must not write DB or call LLM. `ai/` must not write DB or render UI. `data/` has no business rules.
- **R13. Validation on every boundary.** All API inputs pass zod schemas; shared types are single-sourced in `src/shared`.
- **R14. No secrets in logs.** Audit and request logs never contain keys or credential material.
- **R15. Accessibility is a feature.** Every shipped screen keeps keyboard operability, visible focus, labels, and responsive layout in its definition of done.

## Ship discipline

- **R16. Green before ship.** Lint, typecheck, and tests must pass and be recorded in the dev/ship log before a phase is marked done.
- **R17. Context files are law.** When docs in `context/` and code disagree, resolve the conflict explicitly with the human; do not silently change either.

Violations are recorded in `DEVELOPMENT_LOG.md` with what happened and the corrective action.