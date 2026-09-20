# AGENTS.md — Operating instructions for coding agents on this project

Status: PROPOSED. Effective for all future implementation sessions on Customer Support Copilot.

## 1. Read first

Start any session by reading, in order:
1. `context/RULES.md` — non-negotiable constraints.
2. `context/PRD.md` — product requirements and acceptance criteria.
3. `context/ARCHITECTURE.md` — layering, data model, API, AI pipeline.
4. `context/PROJECT_PLAN.md` — current phase and definition of done.
5. `context/SKILLS.md` — runbooks for common tasks.
6. `DEVELOPMENT_LOG.md` — recent decisions and status; append to it when a change ships.

Do not begin implementing until Phase 0 documents are approved by the human.

## 2. Repository layout (target)

```
context/          Product + engineering context (this docs set)
src/
  ui/             React frontend (Vite)
  server/
    api/          HTTP routes + zod validation
    services/     workflow/business logic (capture, draft, approve, log)
    ai/           prompts/, context assembler, structured output client
    data/         Drizzle schema, migrations, seed generator
    lib/          config, middleware, audit writer
  shared/         TS types + zod schemas used by API and UI
DEVELOPMENT_LOG.md  dev/ship log
README.md
```

## 3. Hard rules for code

- **Never** write real customer data, connect to a real CRM, real social feeds, or any banking/payment system. Use the synthetic seed generator.
- **Never** put API keys in frontend code, in shared/ validation schemas, in logs, or in the repository. Server-side env only (`server/.env`, git-ignored).
- **Never** let the `api/` layer write to the database or call the LLM. Never let `ai/` write to the database or render UI.
- **Never** create a logged activity without passing through the approve-and-log service with explicit human confirmation.
- **Never** add comments to code unless a human explicitly asked for them.
- No emojis in files (unless requested).

## 4. Conventions

- TypeScript strict everywhere. Everything serializes through a shared zod schema in `src/shared`.
- Statuses: `CAPTURED -> DRAFTED -> APPROVED -> LOGGED`. Only `LOGGED` counts as customer history.
- Every AI draft stores `prompt_version` and `model`. Prompt templates live in `src/server/ai/prompts/` as versioned strings, never inline.
- Every state-changing action and every AI generation emits an audit row via the shared audit writer.
- Follow existing patterns and styling before inventing new ones; keep the dashboard consistent.

## 5. Commands

- Install: `npm install`
- Dev (server + UI): see README (a `npm run dev` script that runs both)
- Lint: `npm run lint` — fix before finishing a task
- Typecheck: `npm run typecheck`
- Test: `npm run test` (Vitest unit tests) — run after touching services/ai/shared
- Seed: `npm run seed` — regenerates synthetic data
- AI mock mode is automatic when no API key is configured

Run lint and typecheck (and tests when affected) on every completed change. Never claim a task done unless these pass.

## 6. Verification before wrapping up

1. Run `npm run lint` and `npm run typecheck` — must be clean.
2. Run `npm run test`.
3. Re-read `context/RULES.md` for the feature you touched and confirm compliance.
4. Confirm the frontend build has no client-side reference to API keys or LLM endpoints.
5. Update `DEVELOPMENT_LOG.md` with what changed and under which phase.

## 7. Recurring reminders

- A social handle alone is never treated as identity. Do not build "resolve identity from handle" anywhere.
- AI outputs are drafts until a human approves. The approval gate lives in `services/`, not the UI.
- If a requirement is ambiguous, check PRD/ARCHITECTURE first, then ask the human. Never guess product behavior that touches approval, identity, or data provenance.