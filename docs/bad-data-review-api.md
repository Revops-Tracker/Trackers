# RTB Review Panel API (RevOps L10 panel; function `bad-data-review`)

Backend for the "RTB Review Panel" (formerly "Bad Data Review") on https://revops-tracker.github.io/Trackers/revops.html.
Supabase project `ottvswkgqohurzilfafu`, edge function **`bad-data-review`** (verify_jwt=false, does its own auth like `bdr-report`).
Built 2026-11-23 (SGT). **v4** (2026-11-24) added medium-confidence leads. **v5** adds rule questions (`item_type = rule_question`): a bot posts a question that is not tied to a lead, and a reviewer answers it in free text.

Source in this repo: `supabase/functions/bad-data-review/index.ts`.
Migration: `supabase/migrations/20261125164000_bad_data_review_rule_questions.sql`.

**Base URL:** `https://ottvswkgqohurzilfafu.supabase.co/functions/v1/bad-data-review`

What it does:

- Fishing queue bots add contacts that look like bad data. A reviewer **ticks** a contact (data is fine, so dismiss it with no HubSpot change) or **crosses** it (bad data). A cross PATCHes HubSpot contact property `contactrtb_bad_contact` ("Contact.RTB Bad Contact", enum value `"True"`) in portal 1905790, then marks the row. It never touches the company field `companyrtb_non_msp`, or any other property.
- Medium-confidence leads are confirmed or rejected. Neither verdict writes to HubSpot. A confirmed row stays `status = ticked`, which the fishing-queue bot treats as a yes and enriches on its next run.
- Rule questions are general questions about a rule, queue, or ruleset. The reviewer writes an answer. That write never calls HubSpot and never triggers enrichment.

### Three item types (`item_type`)

| item_type | what it is | needs | decision | effect |
|---|---|---|---|---|
| `bad_data` (default) | a HubSpot contact that may be bad data (LinkedIn check failed) | `contact_id` | tick / cross | tick: dismiss, no HubSpot write. cross: HubSpot `contactrtb_bad_contact = "True"`, then row `crossed` (502 if HubSpot refuses) |
| `medium_confidence` | a MEDIUM-confidence lead for a human to judge fit | `linkedin_url` + a name; `contact_id` optional | tick = Confirm / cross = Reject | tick: row `ticked` (the fishing bot's yes). cross: row `crossed`. **No HubSpot write either way** |
| `rule_question` | a question that is not a lead | question text + `lead_key` like `rule:<slug>` | free-text answer, once | row `answered`, `answer` stored. **No HubSpot write and no enrichment** |

Rows added without `item_type` are `bad_data`, so older callers keep working unchanged.

---

## 1. Auth

### People (browser panel): jf-sso session token

- The token is issued by `jf-sso` (`POST /auth/google` with a Google ID token). The page keeps it in `localStorage['jf_token']`.
- Send it as `Authorization: Bearer <jf_token>`.
- The function verifies it exactly like `bdr-report` and `deal-review`: an HMAC-SHA256 signature with the key `"jf-sso:" + SUPABASE_SERVICE_ROLE_KEY`, payload `{email, exp}`, and `exp` must still be in the future. It then re-reads `sso_roster` on every call.
- **Access:** `role = admin`, or `"revops"` in `sso_roster.access`. This is the same rule as the RevOps L10 page and `bdr-report`.
- **Writes (`/verdict`, including a rule-question answer):** not allowed for `role = view` (403).
- **Reviewer identity:** always the email from the verified token. The client never sends it.

#### How the existing page does it (copy this pattern)

`config.js`:

```js
window.JF_CONFIG = { API_BASE: 'https://ottvswkgqohurzilfafu.supabase.co/functions/v1/jf-sso', CLIENT_ID: '…' };
```

`sso.js`:

- Wraps `window.fetch`. Only URLs starting with `/api/` or `/auth/` get prefixed with `API_BASE` and an `Authorization: Bearer <jf_token>` header.
- On any 401 it clears the token and redirects to `index.html` (the login page).
- It also hides the page until `GET jf-sso/auth/me` succeeds, and sets `window.JF_USER = {email, role, access, ...}`.
- Absolute URLs (like this function's) are **not** rewritten, so add the header yourself.

`revops.html` (Connect rate block) already does this for `bdr-report`. Do the same for this function:

```js
const API = ((window.JF_CONFIG||{}).API_BASE||"").replace(/\/jf-sso$/, "/bad-data-review");
const token = () => { try{ return localStorage.getItem("jf_token"); }catch(e){ return null; } };
async function call(path, opts){
  opts = opts || {};
  opts.headers = Object.assign({ Authorization: "Bearer " + token() }, opts.headers || {});
  const r = await fetch(API + path, opts);          // sso.js's fetch wrapper redirects to login on 401
  const j = await r.json().catch(()=>({}));
  if(!r.ok || j.ok === false) throw new Error(j.error || ("Request failed (" + r.status + ")"));
  return j;
}
// call("/list")
// call("/verdict", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id, verdict:"cross"})})
// call("/verdict", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id, verdict:"answer", answer:"..."})})
```

Show the panel only when `JF_USER.role === 'admin'` or `JF_USER.access` includes `'revops'` (the page itself already requires that). Hide or disable the buttons when `canReview === false` (view-only accounts).

### Bots: `X-JF-Bot-Key`

- Header `X-JF-Bot-Key: <key>`. Only the SHA-256 of the key is stored, in `public.bad_data_review_bot_keys` (label `grok-fishing-queue`, `revoked_at` null). This is the same scheme as `bdr-report`'s `/bot/*` routes.
- The key value is in `/home/box/reference-shared/bad-data-review-secret.txt` (chmod 600). Never put it in page JS, and never commit it.
- **Revoke:** `update bad_data_review_bot_keys set revoked_at = now() where label = '…'`.
- **Add a key:** insert the sha256 hex of a new random string (20+ characters).

---

## 2. CORS

- Allowed origins: `https://revops-tracker.github.io`, `http(s)://localhost:*`, `*.jumpfactor.net|co`. Other origins get no `Access-Control-Allow-Origin`.
- `OPTIONS` on any path returns 204 with:
  - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
  - `Access-Control-Allow-Headers: authorization, content-type`
  - `Access-Control-Max-Age: 600`
  - `Vary: Origin`
- Every response is JSON with `Cache-Control: no-store`.

---

## 3. Row shape (`item`)

```json
{
  "id": 12,
  "item_type": "bad_data",
  "contact_id": "263999222663",
  "contact_name": "Jane Doe",
  "first_name": "Jane",
  "last_name": "Doe",
  "title": "CEO",
  "company_id": "52958935930",
  "company_name": "Pivital",
  "domain": "pivital.com",
  "linkedin_url": "https://www.linkedin.com/in/jane-doe/",
  "lead_key": "li:linkedin.com/in/jane-doe",
  "source_queue": "20129",
  "reason": "Email bounced; person left company in 2024",
  "run_date": "2026-11-23",
  "status": "pending",
  "reviewed_by": null,
  "reviewed_at": null,
  "hubspot_updated": false,
  "hubspot_error": null,
  "note": null,
  "answer": null,
  "added_by": "bot:grok-fishing-queue",
  "created_at": "2026-11-23T15:56:04.04+00:00"
}
```

`answer` is present on every row. It is null for `bad_data` and `medium_confidence`, and null on a rule question until a reviewer submits. A rule question then looks like:

```json
{
  "id": 40,
  "item_type": "rule_question",
  "contact_id": null,
  "contact_name": null,
  "first_name": null,
  "last_name": null,
  "title": null,
  "company_id": null,
  "company_name": null,
  "domain": null,
  "linkedin_url": null,
  "lead_key": "rule:personal-email-on-company-domain",
  "source_queue": "20129",
  "reason": "Does a personal email on a company domain still count as bad data?",
  "run_date": "2026-11-25",
  "status": "answered",
  "reviewed_by": "reviewer@jumpfactor.net",
  "reviewed_at": "2026-11-25T16:12:03.221Z",
  "hubspot_updated": false,
  "hubspot_error": null,
  "note": "Example: jane@gmail.com at Acme. Ruleset rtb-v3.",
  "answer": "Only when the mailbox itself bounced.",
  "added_by": "bot:grok-fishing-queue",
  "created_at": "2026-11-25T16:01:11.04+00:00"
}
```

For a rule question, `reason` is the question and `note` is the optional context (examples, ruleset, related leads). Contact and company fields are stored null even if the bot sent them.

HubSpot record link for the panel: `https://app.hubspot.com/contacts/1905790/record/0-1/<contact_id>` (company: `/record/0-2/<company_id>`). Only link the contact when `contact_id` is set. Rule questions have none.

---

## 4. Routes for people (Bearer jf_token)

### `GET /list`

Returns pending rows of every type, and what was decided in the last 7 days (`ticked`, `crossed`, or `answered`).

```json
{ "ok": true, "me": "max@jumpfactor.net", "canReview": true,
  "pending": [ item, ... ],
  "recent":  [ item, ... ] }
```

`pending` is newest `run_date` first, max 500. `recent` is newest `reviewed_at` first, max 100. Answered rule questions are in `recent`, with `answer` set.

### `POST /verdict`

Request (`Content-Type: application/json`):

```json
{ "id": 12, "verdict": "tick" }
```

```json
{ "id": 12, "verdict": "cross", "note": "left the company in 2024" }
```

```json
{ "id": 40, "verdict": "answer", "answer": "Only when the mailbox itself bounced." }
```

- **tick (bad_data or medium_confidence):** the row becomes `ticked`, with no HubSpot call. Response `{ ok:true, hubspot:"not needed", item }`. On a medium row, tick = confirmed lead, and the fishing bot still reads `status = ticked` as yes.
- **cross on `medium_confidence`:** the row becomes `crossed` (= rejected) with **no HubSpot call**, even if it has a `contact_id`. Response `{ ok:true, hubspot:"not written (medium confidence: cross = rejected)", item }`.
- **cross on `bad_data`:** PATCH `https://api.hubapi.com/crm/v3/objects/contacts/<contact_id>` with `{"properties":{"contactrtb_bad_contact":"True"}}`. Only after HubSpot accepts does the row become `crossed` with `hubspot_updated=true`. Response `{ ok:true, hubspot:"updated", item }`.
  - If HubSpot refuses, the response is **502** `{ok:false, error:"HubSpot did not accept it: …. The row is still pending; try again."}`. The row stays `pending` and `hubspot_error` is set, so the reviewer can retry.
  - Test rows (`contact_id` or `lead_key` starting `TEST-`) never call HubSpot. Response `hubspot:"skipped (test row)"`. A `bad_data` row is not a test row just because its `lead_key` starts with `rule:TEST-`.
- **answer on `rule_question`:** `answer` is required, trimmed, and at most 4000 characters. The row becomes `answered` with `reviewed_by` and `reviewed_at` set. Response `{ ok:true, hubspot:"not written (rule question)", item }`. The context in `note` is left as the bot wrote it. Nothing is sent to HubSpot.
- **Wrong shape:** tick or cross on a rule question is **400** `rule questions take a text answer, not tick or cross`. `verdict: "answer"` on a lead is **400** `only rule questions take a text answer`. A blank answer is **400** `an answer is required`. Any other verdict string is **400** `verdict must be tick or cross`.
- **Idempotent for tick and cross:** sending the same verdict again returns `{ ok:true, unchanged:true, item }` and does nothing.
- A decided lead can't be flipped: tick then cross, or cross then tick, returns **409** `{ok:false, error:"already ticked by x; it can't be changed here", item}`. A crossed contact's HubSpot field has to be changed in HubSpot.
- A rule question is final once answered. Sending `answer` again, even with the same text, returns **409** `{ok:false, error:"already answered by x; it can't be changed here", item}`. There is no `unchanged: true` for answers.
- Two people deciding at once: only the first update to a pending row wins. The other gets 409 `someone else decided it first`, or `unchanged:true` if it was the same tick or cross.

---

## 5. Routes for bots (`X-JF-Bot-Key`)

### `POST /bot/items`

Adds items to the queue. The body is `{ "items": [ ... ] }` (a bare array, or a single object with `contact_id`, `linkedin_url`, or `item_type: "rule_question"`, also works). Maximum 200 per call.

```json
{ "items": [
  {
    "contact_id": "263999222663",
    "contact_name": "Donja Andrews", "title": "COO",
    "company_id": "52958935930", "company_name": "Pivital", "domain": "pivital.com",
    "source_queue": "20129",
    "reason": "why it looks like bad data",
    "run_date": "2026-11-25",
    "note": "optional"
  },
  {
    "item_type": "medium_confidence",
    "first_name": "Jane", "last_name": "Doe",
    "job_title": "COO",
    "company_name": "Pivital", "company_id": "52958935930", "domain": "pivital.com",
    "linkedin_url": "https://www.linkedin.com/in/jane-doe/",
    "contact_id": null,
    "lead_key": null,
    "source_queue": "20384",
    "reason": "Verifier reasoning: why it is only medium confidence"
  },
  {
    "item_type": "rule_question",
    "question": "Does a personal email on a company domain still count as bad data?",
    "context": "Example: jane@gmail.com at Acme. Ruleset rtb-v3, queue 20129.",
    "lead_key": "rule:personal-email-on-company-domain",
    "source_queue": "20129",
    "run_date": "2026-11-25"
  }
] }
```

`question` is stored in `reason` (`reason` is accepted as an alias). `context` is stored in `note` (`note` is accepted as an alias). `item_type` also accepts `rule-question` and `Rule Question`. `contact_id`, `linkedin_url`, and company fields on a rule question are ignored.

**Validation** (any invalid item = 400 and nothing is added):

- `item_type`: omitted → `bad_data`; otherwise must be `bad_data`, `medium_confidence`, or `rule_question`.
- `bad_data`: `contact_id` required (`bad_data items need contact_id`).
- `medium_confidence`: `linkedin_url` required (`medium_confidence items need linkedin_url`) and a name: `contact_name`, or `first_name`/`last_name` (`medium_confidence items need a name …`). `contact_id` optional.
- `rule_question`: a question (`question` or `reason`, max 2000 characters) and `lead_key` matching `rule:<slug>` (`rule_question items need a question`, `rule_question items need lead_key like rule:<slug>`). The slug is 1–195 characters of letters, digits, `.`, `_`, `:`, or `-`, so the whole key is at most 200 characters. Context is optional, max 2000 characters. `source_queue` uses the same 20384 / 20129 values, or is omitted when the question is not about one queue (put the ruleset in `context`).
- `contact_id` (when given, lead types): digits up to 20, or `TEST-` + up to 40 of `[A-Za-z0-9-]`.
- `linkedin_url` (when given, lead types): must be a LinkedIn profile URL: host `linkedin.com` (www./country subdomain ok), path `/in/…`, `/pub/…`, `/sales/lead/…` or `/sales/people/…`. Protocol optional.
- `company_id`: digits or TEST-…; `run_date`: YYYY-MM-DD; `source_queue`: 20384/20129/CST…/JF….
- Lengths for lead items: names 120, `lead_key` 200, `linkedin_url` 500, reason/note 1000, other text 300. Over-long lead text is trimmed to those limits. Over-long rule question, context, or answer is rejected, not trimmed.
- DB check constraints back this up: `bad_data_review_item_type_check`, `bad_data_review_status_check` (`pending`, `ticked`, `crossed`, `answered`), `bad_data_review_contact_required` (bad_data ⇒ contact_id not null), `bad_data_review_medium_required` (medium ⇒ linkedin_url and lead_key not null), `bad_data_review_rule_required` (rule_question ⇒ question and `rule:<slug>`), `bad_data_review_type_status_check` (an answer exists only on an answered rule question; lead rows stay pending/ticked/crossed with a null answer).

Response:

```json
{ "ok": true,
  "added":   [ {"id": 40, "item_type": "rule_question", "contact_id": null, "lead_key": "rule:personal-email-on-company-domain"} ],
  "skipped": [ {"item_type": "rule_question", "contact_id": null, "lead_key": "rule:personal-email-on-company-domain", "reason": "already pending", "id": 40} ] }
```

**Dedupe (pending rows only; decided items can be added again):**

- `bad_data`: same `contact_id` already pending as bad_data → skipped. Index `bad_data_review_pending_contact_uq` on `(item_type, contact_id) where status='pending' and contact_id is not null`.
- `medium_confidence`: same `lead_key` pending → skipped (index `bad_data_review_pending_lead_uq` on `lead_key where status='pending' and item_type='medium_confidence'`); also skipped if it has a `contact_id` that already has a pending medium row.
- `rule_question`: same `lead_key` pending → skipped. Index `bad_data_review_pending_rule_uq` on `lead_key where status='pending' and item_type='rule_question'`. The match is exact, including case, so the bot should reuse one stable slug. After the question is answered, the same key can be posted again.
- A contact can have one pending bad_data row and one pending medium row at the same time (they are different questions). A rule key cannot collide with those, because it is a different `item_type` and the key starts with `rule:`.
- The normalised LinkedIn key ignores protocol, `www.`, case, query string and trailing slash, so `https://www.LinkedIn.com/in/Jane-Doe/?trk=x` and `linkedin.com/in/jane-doe` dedupe together when no `lead_key` is sent.

### `GET /bot/list?status=pending|ticked|crossed|answered|all&item_type=bad_data|medium_confidence|rule_question&limit=200`

Returns `{ ok:true, items:[item,…] }` (full row shape, including `answer`), newest first.

- `status` defaults to `pending`. `answered` is only used by rule questions. `all` does not filter on status.
- `item_type` omitted means **bad_data and medium_confidence only**, the same two types as before. Rule questions are not included unless `item_type=rule_question` (exact; `rule-question` is 400).
- `limit` can go up to 1000.

Read answers with:

```http
GET /bot/list?item_type=rule_question&status=all
```

A pending question has `"answer": null` and `"status": "pending"`. An answered one has `"status": "answered"` and the text in `answer`. The fishing bot should keep calling `item_type=medium_confidence` (and treating `ticked` as yes). That query does not return rule questions.

### `POST /bot/test-verdict`

Same body and responses as `/verdict`, but it only works on test rows and never calls HubSpot. A test row is `contact_id` or `lead_key` starting `TEST-`, or a rule question whose `lead_key` is `rule:TEST-…` (otherwise 400). The reviewer is recorded as `bot:<label>`. It exists for smoke tests. A real rule question (`rule:` not followed by `TEST-`) is rejected here; a person answers it with `/verdict`.

### `POST /bot/delete-test`

Deletes every row whose `contact_id` or `lead_key` starts with `TEST-`, plus rule questions whose `lead_key` starts with `rule:TEST-`. A lead row is not deleted just because its `lead_key` starts with `rule:TEST-`. Response `{ ok:true, deleted:n }`.

### `GET /bot/health`

Returns `{ ok, hubspotTokenSet, property, scopes:[…], scopeError, canWriteContacts }`. It reads the HubSpot token's scopes from HubSpot's token-info endpoint and never returns the token itself.

---

## 6. Errors

Every error is JSON: `{ "ok": false, "error": "<message>", ...extra }`.

| status | when |
|---|---|
| 400 | bad id / verdict / items (`invalid` array on /bot/items); blank or over-long answer; tick/cross on a rule question; answer on a lead |
| 401 | `not signed in` (missing, bad or expired jf_token, or email not in sso_roster); `bad or missing X-JF-Bot-Key` |
| 403 | `no access to the RevOps L10`; `view-only account` (verdict, including answer) |
| 404 | `not found` (route); `not in the review list` (verdict id) |
| 409 | already decided with the other verdict; already answered; someone else decided it first |
| 500 | `server error` (details only in function logs) |
| 502 | HubSpot refused the cross (row stays pending). Rule questions and medium rows never return this |

On a 401, sso.js-style handling clears `jf_token` and sends the user to `index.html`.

---

## 7. Data

- **Table `public.bad_data_review`:** migrations `bad_data_review_queue`, `bad_data_review_medium_confidence`, and `bad_data_review_rule_questions` (v5: nullable `answer text`; `item_type` gains `rule_question`; `status` gains `answered`; check `bad_data_review_rule_required`; check `bad_data_review_type_status_check`; partial unique index `bad_data_review_pending_rule_uq`). RLS is on with no policies, and all privileges are revoked from anon and authenticated, so only the service role inside the function can touch it.
- **Table `public.bad_data_review_bot_keys`:** SHA-256 of the bot keys only. Same lock-down.
- **HubSpot token:** the function reads the same Supabase secret as `hygiene`: env `Revops CRM Hygiene`, falling back to `HUBSPOT_TOKEN`. On 2026-11-23 its scopes included `crm.objects.contacts.write`. Answering a rule question does not read or write HubSpot.

### Deploy order

Apply these in order. The page's answer button returns 400 until the function that knows `verdict: "answer"` is deployed, and that function cannot insert a rule question until the migration has added the column and the check constraints.

1. Run `supabase/migrations/20261125164000_bad_data_review_rule_questions.sql` on project `ottvswkgqohurzilfafu`.
2. Deploy the edge function `bad-data-review` from `supabase/functions/bad-data-review/index.ts` with `verify_jwt = false` (same as today).
3. Publish `revops.html` (merge to `main` so GitHub Pages updates).

Do not put the bot key in the page or in git.

---

## 8. Panel

`revops.html` shows three kinds of pending rows behind All / Bad data / Medium / Rules.

- Bad data and medium rows are unchanged: tick/cross, or Confirm/Reject. A cross on bad data still asks for confirmation before setting Contact.RTB Bad Contact = True. A confirmed medium row is still the fishing bot's yes.
- A rule question is a separate row (blue rail, "Rule question" badge, the slug, the question, and any context). It has a required answer box and **Submit answer**, not tick/cross. Empty text is rejected in the page. Ctrl/Cmd+Enter submits.
- Answered questions appear under **Recently reviewed** with the question, the context, and the answer.
- View-only accounts can read the queue and cannot tick, cross, confirm, reject, or answer.
