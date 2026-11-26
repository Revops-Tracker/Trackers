# Trigger lead review panel API (RevOps L10 panel; function `trigger-lead-review`)

Backend for the "Trigger lead review panel" tab on https://revops-tracker.github.io/Trackers/revops.html (next to "RTB Review Panel").
Supabase project `ottvswkgqohurzilfafu`, edge function **`trigger-lead-review`** (verify_jwt=false, own auth like `bad-data-review`).
Source: `supabase/functions/trigger-lead-review/index.ts`. Page code: `revops-trigger-review.js` (styles reuse the RTB panel's).

Purpose: the Trigger Engine (Claude sessions, later n8n) puts anything it cannot decide on its own into `public.trigger_lead_review`. A person answers in the panel. The engine reads the answers and applies them. Nothing here writes to HubSpot or Apollo.

## Table `public.trigger_lead_review`
RLS on, no policies, anon/authenticated revoked: only the service role (the function, Claude, n8n) can touch it.

| column | notes |
|---|---|
| `item_type` | `lead_question` (one lead or company) or `rule_question` (process rule) |
| `lead_key` | unique while pending. `lead:<slug>` or `rule:<slug>` (letters, digits, `. _ : -`, max 200) |
| `trigger_source`, `company_name`, `domain`, `hubspot_company_id`, `person_name`, `title`, `linkedin_url`, `priority` | context shown on the left of the row (company name links to HubSpot when the id is set) |
| `question` | required, max 2000 |
| `context` | what the engine found and why it is unsure, max 4000 |
| `options` | JSON array of short choices (may be empty: free text only) |
| `status` | `pending` or `answered` |
| `answer_option`, `answer`, `reviewed_by`, `reviewed_at` | filled when answered |
| `applied`, `applied_at` | set by the engine after it has acted on the answer |

## Engine side (service role)
- Post a question: `insert into trigger_lead_review (...)`. A second pending row with the same `lead_key` is rejected by the unique index; use `on conflict do nothing`.
- Read answers: `select * from trigger_lead_review where status='answered' and not applied`. After acting on one, `update ... set applied=true, applied_at=now()`.
- Do not re-post a question that is already pending or recently answered.

## People routes (Bearer jf_token, same as the rest of the page)
- `GET /list` -> `{ok, me, canReview, pending:[...], recent:[...]}` (recent = answered in the last 14 days).
- `POST /verdict` `{id, option?, answer?}` -> `{ok, item}`. At least one of `option` / `answer`. `option` must be one of the row's `options` (400 otherwise). Final: answering again is 409. `role=view` gets 403. Reviewer = the signed-in email.
- Access: `role=admin` or `"revops"` in `sso_roster.access`.
- Errors: 400 bad id / nothing chosen / option not on the question; 401 not signed in; 403 no access or view-only; 404 not in the list; 409 already answered or someone answered first.

## Deploy order
1. Migration `trigger_lead_review_queue` (applied 2026-11-27).
2. Edge function `trigger-lead-review` (deployed 2026-11-27, verify_jwt=false).
3. Publish `revops.html` + `revops-trigger-review.js` (merge to `main`).
