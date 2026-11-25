// bad-data-review: backend for the RTB Review Panel on the RevOps L10 page.
// v4 (2026-11-24) medium-confidence leads. v5 (2026-11-25) rule questions.
// Three item types (column item_type):
//   bad_data           a contact flagged as bad data (needs contact_id). cross -> HubSpot contactrtb_bad_contact='True'. tick -> nothing.
//   medium_confidence  a MEDIUM-confidence lead for a human to judge fit (needs linkedin_url + a name; contact_id optional).
//                      tick = confirmed (bot enriches it), cross = rejected. Neither verdict writes to HubSpot.
//   rule_question      a general rule question, not a lead (needs a question and lead_key 'rule:<slug>'; no contact).
//                      verdict 'answer' stores the free text, sets status answered, and never writes to HubSpot or enriches.
//                      Answering again is 409. Tick and cross are rejected.
// verify_jwt=false: it does its own auth, same as bdr-report. People: the jf-sso session token (same key derivation),
// sso_roster re-read on every call; access = role admin, or "revops" in sso_roster.access. View-only accounts can read, not decide.
//   GET  /list                       pending rows + what was decided in the last 7 days (ticked, crossed, answered)
//   POST /verdict                    {id, verdict:'tick'|'cross'|'answer', note?, answer?} reviewer = the signed-in person
//                                    tick  -> row ticked, no HubSpot write (bad_data or medium_confidence)
//                                    cross -> bad_data: HubSpot contact contactrtb_bad_contact = 'True' (portal 1905790), then row crossed
//                                             medium_confidence: row crossed (rejected), no HubSpot write
//                                    answer -> rule_question only: row answered, answer stored, no HubSpot write
//                                    Same tick/cross again = no-op (idempotent). A decided row cannot be flipped here.
//                                    A rule question that is already answered is 409, even with the same text.
//                                    Test rows (contact_id or lead_key 'TEST-...', or rule lead_key 'rule:TEST-...') never call HubSpot.
// BOT ROUTES (fishing queue bots, no Google sign-in). Header  X-JF-Bot-Key: <key>  (SHA-256 in bad_data_review_bot_keys, revoked_at null)
//   POST /bot/items                  {items:[...]} bad_data and medium_confidence unchanged.
//                                    rule_question: {item_type, question|reason, context?|note?, lead_key:'rule:<slug>', source_queue?, run_date?}
//                                    skipped if that lead_key already has a pending rule question. contact_id and linkedin_url are ignored.
//   GET  /bot/list?status=&item_type=&limit=   rows (default pending), newest first. answer is on every row (null until a rule question is answered).
//                                    item_type omitted = bad_data and medium_confidence only, same as before. rule_question is opt-in.
//   POST /bot/test-verdict           same body as /verdict, TEST rows only (never calls HubSpot)
//   POST /bot/delete-test            removes TEST rows only
//   GET  /bot/health                 is the HubSpot token set + its scopes (token never returned)
// HubSpot token: same env as hygiene ("Revops CRM Hygiene", fallback HUBSPOT_TOKEN). Only contactrtb_bad_contact is ever written,
// and only when a bad_data row is crossed.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HS_TOKEN = Deno.env.get("Revops CRM Hygiene") ?? Deno.env.get("HUBSPOT_TOKEN") ?? "";
const HS_BASE = "https://api.hubapi.com";
const HS_PROP = "contactrtb_bad_contact";
const QUESTION_MAX = 2000;
const CONTEXT_MAX = 2000;
const ANSWER_MAX = 4000;
const RULE_KEY = /^rule:[A-Za-z0-9][A-Za-z0-9_.:-]{0,194}$/;
const TEST_RULE_KEY = /^rule:TEST-[A-Za-z0-9-]{1,40}$/;

const ORIGIN_OK = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https:\/\/revops-tracker\.github\.io$/,
  /^https:\/\/([a-z0-9-]+\.)*jumpfactor\.(net|co)$/,
];
function corsFor(req: Request): Record<string, string> {
  const o = req.headers.get("origin") ?? "";
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
  if (ORIGIN_OK.some((r) => r.test(o))) h["Access-Control-Allow-Origin"] = o;
  return h;
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsFor(req) },
  });
}

// ---- session token (same format as jf-sso) ----
const enc = new TextEncoder();
const unb64u = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
let keyPromise: Promise<CryptoKey> | null = null;
function hmacKey() {
  keyPromise ??= crypto.subtle.importKey("raw", enc.encode("jf-sso:" + SRK), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return keyPromise;
}
async function verify(token: string): Promise<{ email: string } | null> {
  try {
    const [raw, sig] = token.split(".");
    if (!raw || !sig) return null;
    if (!(await crypto.subtle.verify("HMAC", await hmacKey(), unb64u(sig), enc.encode(raw)))) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64u(raw)));
    return p.exp > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}

// ---- Supabase REST ----
async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error("db " + res.status + ": " + text);
  return text ? JSON.parse(text) : null;
}

async function personUser(req: Request): Promise<{ email: string; role: string; access: string[] } | null> {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer (.+)$/);
  if (!m) return null;
  const p = await verify(m[1]);
  if (!p) return null;
  const rows = await rest("sso_roster?select=email,role,access&email=eq." + encodeURIComponent(String(p.email).toLowerCase()));
  const r = rows?.[0];
  return r ? { email: r.email, role: r.role, access: r.access ?? [] } : null;
}

async function botUser(req: Request): Promise<string | null> {
  const k = (req.headers.get("x-jf-bot-key") ?? "").trim();
  if (k.length < 20) return null;
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(k))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const rows = await rest("bad_data_review_bot_keys?select=label&revoked_at=is.null&key_sha256=eq." + hash);
  return rows?.[0]?.label ? "bot:" + rows[0].label : null;
}

// ---- validation ----
const COLS = "id,item_type,contact_id,contact_name,first_name,last_name,title,company_id,company_name,domain,linkedin_url,lead_key,source_queue,reason,run_date,status,reviewed_by,reviewed_at,hubspot_updated,hubspot_error,note,answer,added_by,created_at";
const TYPES = ["bad_data", "medium_confidence", "rule_question"];
const STATUSES = ["pending", "ticked", "crossed", "answered", "all"];
const REAL_ID = /^\d{1,20}$/;
const TEST_ID = /^TEST-[A-Za-z0-9-]{1,40}$/;
const isTest = (id: unknown) => typeof id === "string" && TEST_ID.test(id);
// rule:TEST-... is a test row only when the row itself is a rule question, so a bad_data
// lead_key that happens to look like that still crosses through HubSpot as before.
const isTestRow = (r: any) => !!r && (isTest(r.contact_id) || isTest(r.lead_key) || (r.item_type === "rule_question" && typeof r.lead_key === "string" && TEST_RULE_KEY.test(r.lead_key)));
// linkedin.com/in/<slug> (lowercase, no protocol/www/query/trailing slash); null if it is not a LinkedIn URL
function normLinkedIn(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|[a-z]{2})\./, "");
  if (host !== "linkedin.com") return null;
  const path = decodeURIComponent(u.pathname).replace(/\/+$/, "").toLowerCase();
  if (!/^\/(in|sales\/lead|sales\/people|pub)\/./.test(path)) return null;
  return "linkedin.com" + path;
}
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 300) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
function rawText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}
function normType(v: unknown): string {
  return String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}
function queueOf(v: unknown): string | null | false {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim().toUpperCase();
  if (s === "20384" || s === "CST" || s.startsWith("CST")) return "20384";
  if (s === "20129" || s === "JF" || s.startsWith("JF")) return "20129";
  return false;
}
function cleanRuleQuestion(it: any): { row?: Record<string, unknown>; error?: string } {
  const question = rawText(it.question) ?? rawText(it.reason);
  if (!question) return { error: "rule_question items need a question" };
  if (question.length > QUESTION_MAX) return { error: "question is too long (max 2000 characters)" };
  const context = rawText(it.context) ?? rawText(it.note);
  if (context && context.length > CONTEXT_MAX) return { error: "context is too long (max 2000 characters)" };
  const lead_key = rawText(it.lead_key);
  if (!lead_key || !RULE_KEY.test(lead_key)) return { error: "rule_question items need lead_key like rule:<slug>" };
  const q = queueOf(it.source_queue);
  if (q === false) return { error: "source_queue must be 20384 (CST) or 20129 (JF RTB)" };
  const run_date = str(it.run_date, 10);
  if (run_date && !DATE.test(run_date)) return { error: "run_date must be YYYY-MM-DD" };
  // Contact and company fields are ignored. Related leads belong in context, and this row must never look like a HubSpot write.
  const row: Record<string, unknown> = {
    item_type: "rule_question",
    contact_id: null, contact_name: null, first_name: null, last_name: null, title: null,
    company_id: null, company_name: null, domain: null, linkedin_url: null, lead_key,
    source_queue: q, reason: question, note: context,
  };
  if (run_date) row.run_date = run_date;
  return { row };
}
function cleanItem(it: any): { row?: Record<string, unknown>; error?: string } {
  if (!it || typeof it !== "object") return { error: "not an object" };
  const item_type = str(it.item_type, 40)?.toLowerCase().replace(/[\s-]+/g, "_") ?? "bad_data";
  if (!TYPES.includes(item_type)) return { error: "item_type must be bad_data, medium_confidence, or rule_question" };
  if (item_type === "rule_question") return cleanRuleQuestion(it);
  const medium = item_type === "medium_confidence";
  const contact_id = str(it.contact_id, 60);
  if (!medium && !contact_id) return { error: "bad_data items need contact_id" };
  if (contact_id && !REAL_ID.test(contact_id) && !isTest(contact_id)) return { error: "contact_id must be a HubSpot contact id (digits) or TEST-..." };
  const first_name = str(it.first_name, 120), last_name = str(it.last_name, 120);
  const contact_name = str(it.contact_name) ?? (([first_name, last_name].filter(Boolean).join(" ")) || null);
  const rawLi = str(it.linkedin_url, 500);
  const li = rawLi ? normLinkedIn(rawLi) : null;
  if (rawLi && !li) return { error: "linkedin_url must be a LinkedIn profile URL (linkedin.com/in/...)" };
  let lead_key = str(it.lead_key, 200);
  if (medium) {
    if (!li) return { error: "medium_confidence items need linkedin_url" };
    if (!contact_name) return { error: "medium_confidence items need a name (contact_name, or first_name/last_name)" };
    lead_key ??= "li:" + li;
  }
  const q = queueOf(it.source_queue);
  if (q === false) return { error: "source_queue must be 20384 (CST) or 20129 (JF RTB)" };
  const company_id = str(it.company_id, 40);
  if (company_id && !REAL_ID.test(company_id) && !isTest(company_id)) return { error: "company_id must be digits" };
  const run_date = str(it.run_date, 10);
  if (run_date && !DATE.test(run_date)) return { error: "run_date must be YYYY-MM-DD" };
  const row: Record<string, unknown> = {
    item_type, contact_id, contact_name, first_name, last_name, title: str(it.title) ?? str(it.job_title), company_id, company_name: str(it.company_name),
    linkedin_url: rawLi ? (/^https?:\/\//i.test(rawLi) ? rawLi : "https://" + rawLi) : null, lead_key,
    domain: str(it.domain, 200)?.toLowerCase() ?? null, source_queue: q, reason: str(it.reason, 1000), note: str(it.note, 1000),
  };
  if (run_date) row.run_date = run_date;
  return { row };
}

// ---- HubSpot ----
async function markBadContact(contactId: string): Promise<{ ok: boolean; error?: string }> {
  if (!HS_TOKEN) return { ok: false, error: "HubSpot token is not configured" };
  const res = await fetch(HS_BASE + "/crm/v3/objects/contacts/" + encodeURIComponent(contactId), {
    method: "PATCH",
    headers: { Authorization: "Bearer " + HS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { [HS_PROP]: "True" } }),
  });
  if (res.ok) return { ok: true };
  const t = await res.text();
  let msg = t;
  try { const j = JSON.parse(t); msg = j.message ?? t; } catch { /* plain text */ }
  return { ok: false, error: "HubSpot " + res.status + ": " + String(msg).slice(0, 200) };
}

async function getRow(id: number) {
  return (await rest("bad_data_review?select=" + COLS + "&id=eq." + id))?.[0] ?? null;
}

// Rule questions never reach markBadContact. Tick/cross on one is a 400, and answer only patches this row.
async function answerRule(req: Request, by: string, row: any, id: number, v: string, b: any) {
  if (row.item_type !== "rule_question") return json(req, { ok: false, error: "only rule questions take a text answer" }, 400);
  if (v !== "answer") return json(req, { ok: false, error: "rule questions take a text answer, not tick or cross" }, 400);
  const answer = rawText(b?.answer);
  if (!answer) return json(req, { ok: false, error: "an answer is required" }, 400);
  if (answer.length > ANSWER_MAX) return json(req, { ok: false, error: "answer is too long (max 4000 characters)" }, 400);
  if (row.status !== "pending")
    return json(req, { ok: false, error: "already " + row.status + " by " + (row.reviewed_by ?? "someone") + "; it can't be changed here", item: row }, 409);
  const now = new Date().toISOString();
  const patch = { status: "answered", reviewed_by: by, reviewed_at: now, answer };
  const upd = await rest("bad_data_review?id=eq." + id + "&status=eq.pending&select=" + COLS, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch),
  });
  if (!upd?.length) {
    const cur = await getRow(id);
    const error = cur?.status === "answered"
      ? "already answered by " + (cur.reviewed_by ?? "someone") + "; it can't be changed here"
      : "someone else decided it first";
    return json(req, { ok: false, error, item: cur }, 409);
  }
  return json(req, { ok: true, hubspot: "not written (rule question)", item: upd[0] });
}

async function verdict(req: Request, by: string) {
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const v = String(b?.verdict ?? "");
  if (!Number.isInteger(id) || id <= 0) return json(req, { ok: false, error: "bad id" }, 400);
  if (v !== "tick" && v !== "cross" && v !== "answer") return json(req, { ok: false, error: "verdict must be tick or cross" }, 400);
  const row = await getRow(id);
  if (!row) return json(req, { ok: false, error: "not in the review list" }, 404);
  if (row.item_type === "rule_question" || v === "answer") return answerRule(req, by, row, id, v, b);

  const note = str(b?.note, 1000);
  const want = v === "tick" ? "ticked" : "crossed";

  if (row.status === want) return json(req, { ok: true, unchanged: true, item: row });
  if (row.status !== "pending")
    return json(req, { ok: false, error: "already " + row.status + " by " + (row.reviewed_by ?? "someone") + "; it can't be changed here", item: row }, 409);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: want, reviewed_by: by, reviewed_at: now };
  if (note) patch.note = row.note ? row.note + " · " + note : note;
  let hubspot = "not needed";
  if (want === "crossed" && row.item_type === "medium_confidence") {
    hubspot = "not written (medium confidence: cross = rejected)";
  } else if (want === "crossed") {
    if (isTestRow(row)) {
      hubspot = "skipped (test row)";
    } else {
      const r = await markBadContact(row.contact_id);
      if (!r.ok) {
        await rest("bad_data_review?id=eq." + id, { method: "PATCH", body: JSON.stringify({ hubspot_error: r.error }) });
        return json(req, { ok: false, error: "HubSpot did not accept it: " + r.error + ". The row is still pending; try again." }, 502);
      }
      hubspot = "updated";
      patch.hubspot_updated = true;
      patch.hubspot_error = null;
    }
  }
  // only a still-pending row is changed, so two people deciding at once can't both win
  const upd = await rest("bad_data_review?id=eq." + id + "&status=eq.pending&select=" + COLS, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch),
  });
  if (!upd?.length) {
    const cur = await getRow(id);
    if (cur?.status === want) return json(req, { ok: true, unchanged: true, hubspot, item: cur });
    return json(req, { ok: false, error: "someone else decided it first", hubspot, item: cur }, 409);
  }
  return json(req, { ok: true, hubspot, item: upd[0] });
}

async function addItems(req: Request, by: string) {
  const b = await req.json().catch(() => null);
  const items = Array.isArray(b) ? b : Array.isArray(b?.items) ? b.items : b && typeof b === "object" && (b.contact_id || b.linkedin_url || normType(b.item_type) === "rule_question") ? [b] : null;
  if (!items) return json(req, { ok: false, error: "send {items:[...]}" }, 400);
  if (items.length > 200) return json(req, { ok: false, error: "at most 200 items per call" }, 400);
  const invalid: { index: number; error: string }[] = [];
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  type Skip = { item_type: string; contact_id: string | null; lead_key: string | null; reason: string; id?: number };
  const skipped: Skip[] = [];
  // dedupe keys: bad_data by contact_id; medium by lead_key and (if set) contact_id; rule questions by lead_key
  const keysOf = (r: Record<string, unknown>) => r.item_type === "medium_confidence"
    ? ["m:l:" + r.lead_key, ...(r.contact_id ? ["m:c:" + r.contact_id] : [])]
    : r.item_type === "rule_question"
    ? ["r:l:" + r.lead_key]
    : ["b:c:" + r.contact_id];
  const skipOf = (r: Record<string, unknown>, reason: string, id?: number): Skip =>
    ({ item_type: r.item_type as string, contact_id: (r.contact_id as string) ?? null, lead_key: (r.lead_key as string) ?? null, reason, ...(id ? { id } : {}) });
  items.forEach((it: any, i: number) => {
    const c = cleanItem(it);
    if (c.error) { invalid.push({ index: i, error: c.error }); return; }
    const k = keysOf(c.row!);
    if (k.some((x) => seen.has(x))) skipped.push(skipOf(c.row!, "duplicate in this request"));
    else { k.forEach((x) => seen.add(x)); rows.push({ ...c.row, added_by: by }); }
  });
  if (invalid.length) return json(req, { ok: false, error: "some items are invalid; nothing was added", invalid }, 400);
  const added: { id: number; item_type: string; contact_id: string | null; lead_key: string | null }[] = [];
  if (rows.length) {
    const q = (xs: string[]) => "(" + xs.map((x) => '"' + x.replace(/"/g, '\\"') + '"').join(",") + ")";
    const cids = [...new Set(rows.filter((r) => r.contact_id).map((r) => r.contact_id as string))];
    const lks = [...new Set(rows.filter((r) => r.lead_key && (r.item_type === "medium_confidence" || r.item_type === "rule_question")).map((r) => r.lead_key as string))];
    const ors: string[] = [];
    if (cids.length) ors.push("contact_id.in." + q(cids));
    if (lks.length) ors.push("lead_key.in." + q(lks));
    const pending = ors.length
      ? await rest("bad_data_review?select=id,item_type,contact_id,lead_key&status=eq.pending&or=" + encodeURIComponent("(" + ors.join(",") + ")"))
      : [];
    const have = new Map<string, number>();
    for (const p of pending ?? []) for (const k of keysOf(p)) have.set(k, p.id);
    for (const r of rows) {
      const hit = keysOf(r).find((k) => have.has(k));
      if (hit) { skipped.push(skipOf(r, "already pending", have.get(hit))); continue; }
      try {
        const ins = await rest("bad_data_review?select=id,item_type,contact_id,lead_key", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(r) });
        added.push(ins[0]);
      } catch (e) {
        if (String(e).includes("23505")) skipped.push(skipOf(r, "already pending"));
        else throw e;
      }
    }
  }
  return json(req, { ok: true, added, skipped });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsFor(req) });
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^.*?\/bad-data-review/, "") || "/";
  try {
    if (sub.startsWith("/bot/")) {
      const by = await botUser(req);
      if (!by) return json(req, { ok: false, error: "bad or missing X-JF-Bot-Key" }, 401);
      if (sub === "/bot/items" && req.method === "POST") return await addItems(req, by);
      if (sub === "/bot/list" && req.method === "GET") {
        const st = url.searchParams.get("status") ?? "pending";
        if (!STATUSES.includes(st)) return json(req, { ok: false, error: "bad status" }, 400);
        const lim = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 200) || 200, 1), 1000);
        const ty = url.searchParams.get("item_type");
        if (ty && !TYPES.includes(ty)) return json(req, { ok: false, error: "bad item_type" }, 400);
        // No item_type keeps the previous default: the two lead types only. Rule questions are opt-in,
        // so a fishing bot that lists pending or ticked rows does not have to ignore them.
        const typeFilter = ty ? "&item_type=eq." + ty : "&item_type=in.(bad_data,medium_confidence)";
        const rows = await rest("bad_data_review?select=" + COLS + (st === "all" ? "" : "&status=eq." + st) + typeFilter + "&order=created_at.desc&limit=" + lim);
        return json(req, { ok: true, items: rows });
      }
      if (sub === "/bot/test-verdict" && req.method === "POST") {
        // smoke test of the verdict path without a Google sign-in; TEST-... rows only, which never call HubSpot
        const b = await req.clone().json().catch(() => null);
        const row = Number.isInteger(Number(b?.id)) ? await getRow(Number(b.id)) : null;
        if (!row || !isTestRow(row)) return json(req, { ok: false, error: "test-verdict only works on TEST rows (contact_id or lead_key TEST-..., or rule:TEST-... for a rule question)" }, 400);
        return await verdict(req, by);
      }
      if (sub === "/bot/delete-test" && req.method === "POST") {
        const gone = await rest("bad_data_review?or=(contact_id.like.TEST-*,lead_key.like.TEST-*,and(item_type.eq.rule_question,lead_key.like.rule:TEST-*))&select=id,contact_id,lead_key", { method: "DELETE", headers: { Prefer: "return=representation" } });
        return json(req, { ok: true, deleted: gone?.length ?? 0 });
      }
      if (sub === "/bot/health" && req.method === "GET") {
        // scopes of the HubSpot token (private app token info); never returns the token itself
        let scopes: string[] | null = null, scopeError: string | null = null;
        if (HS_TOKEN) {
          const r = await fetch(HS_BASE + "/oauth/v2/private-apps/get/access-token-info", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokenKey: HS_TOKEN }),
          });
          if (r.ok) scopes = ((await r.json()).scopes ?? []).map(String);
          else scopeError = "token info " + r.status;
        }
        return json(req, {
          ok: true, hubspotTokenSet: !!HS_TOKEN, property: HS_PROP, scopes, scopeError,
          canWriteContacts: scopes ? scopes.includes("crm.objects.contacts.write") : null,
        });
      }
      return json(req, { ok: false, error: "not found" }, 404);
    }

    const u = await personUser(req);
    if (!u) return json(req, { ok: false, error: "not signed in" }, 401);
    if (u.role !== "admin" && !u.access.includes("revops")) return json(req, { ok: false, error: "no access to the RevOps L10" }, 403);

    if (sub === "/list" && req.method === "GET") {
      const since = new Date(Date.now() - 7 * 86400e3).toISOString();
      const [pending, recent] = await Promise.all([
        rest("bad_data_review?select=" + COLS + "&status=eq.pending&order=run_date.desc,created_at.desc&limit=500"),
        rest("bad_data_review?select=" + COLS + "&status=in.(ticked,crossed,answered)&reviewed_at=gte." + encodeURIComponent(since) + "&order=reviewed_at.desc&limit=100"),
      ]);
      return json(req, { ok: true, me: u.email, canReview: u.role !== "view", pending, recent });
    }
    if (sub === "/verdict" && req.method === "POST") {
      if (u.role === "view") return json(req, { ok: false, error: "view-only account" }, 403);
      return await verdict(req, u.email);
    }
    return json(req, { ok: false, error: "not found" }, 404);
  } catch (e) {
    console.log("error", String(e));
    return json(req, { ok: false, error: "server error" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
