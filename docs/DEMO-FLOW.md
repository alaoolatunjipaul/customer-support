# Demo Flow — 3–5 Minute Presentation Script

**Product:** Customer Support Copilot — "AI-assisted customer support, human reviewed."
**Environment:** `http://localhost:8787` (production build + API, single command: `npm run dev`).
**Prep:** Start the server and open `http://localhost:8787/#/dashboard`. Use a fresh session so the demo starts clean.

---

## Opening (0:00–0:45) — Dashboard & positioning

- Point to the topbar: **"Demo environment • Synthetic data"** and **"AI: mock"**.
- One line of context: *"This is a synthetic showcase — AI drafts, a human reviews and approves every record. Nothing is auto-sent, nothing touches a real CRM, and no real customer data is used."*
- Walk the four stat cards (customers, logged activities, open items, today’s activity) and the "Customers by channel" bars.

## Journey A — Customer workflow (0:45–1:30)

- Click **Find a customer** → Customers page. Search is instant.
- Open **Maya Keller** (first synthetic customer).
- Show the profile header + **Social handle** card and the seeded activity timeline/drafted guidance.
- Paste or type a quick message into **Capture interaction** (e.g. *"Order #9921 shipped but the box arrived damaged — hoping for a replacement."*).
- Click **Capture interaction** → see the `CAPTURED` badge appear in the timeline ("not yet logged").

## Journey B — AI workflow (1:30–2:15)

- In the **AI Copilot** panel, the captured interaction is pre-selected.
- Click **Summarize**, then **Generate CRM note**, then **Draft customer response**.
- Note the provenance line on each draft: *revision · prompt version · model (mock) · synthetic*.
- Emphasize: *"Every draft is versioned, grounded only in the captured message, and carries a 'draft only — never sent automatically' advisory banner."*

## Journey C — Human review workflow (2:15–3:15)

- Edit the summary text in the card (type a tweak) → **Save** → notice "saved (revision …)".
- Scroll to **Approve & log activity** → the preview shows exactly what will be logged.
- Show the **Activity kind** selector (default "Direct message").
- Note the button is **disabled until you tick** *"I have reviewed the drafts and confirm logging this activity."* — that explicit confirmation is the human-in-the-loop gate.
- Click **Approve & log activity**.

## Journey D — Audit workflow (3:15–4:00)

- Watch the interaction leave the captured list and become a **logged activity** in the timeline (summary = your edited draft, approved-by actor).
- Open **Audit log** from the sidebar.
- Show the newest-first entries: **Interaction captured → AI draft generated → Draft edited → Activity logged**, each with **actor, action, entity and timestamp**.
- Close with: *"An append-only ledger — you can trace the whole interaction from raw capture to approved record."*

## Wrap (4:00–4:30)

- Return to **Dashboard** → note today’s activity + recent list now include the record the audience just logged.
- One closing line: *"AI drafts. Humans decide. Everything is audited."*

---

## Presenter notes

- A full clean run is under 4 minutes; the two most WOW moments are the **explicit confirmation gate** (Journey C) and the **audit trail that proves it** (Journey D).
- Do not claim real LLM calls, real bank integration or real customers — the app itself labels everything synthetic, and so should the presentation.
- If the audience asks "is this production?", answer: single-node demo, in-memory state, deterministic mock AI — all documented in `docs/PROJECT-SUMMARY.md`.