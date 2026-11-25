// Contract tests for bad-data-review. Fetch is replaced with an in-memory PostgREST
// subset, so nothing talks to Supabase or HubSpot. Run:
//   deno test --allow-env supabase/functions/bad-data-review/index.test.ts

Deno.env.set("SUPABASE_URL", "http://supabase.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
Deno.env.set("HUBSPOT_TOKEN", "hs-test-token");

const { handler } = await import("./index.ts");

const BOT_KEY = "rule-question-test-key-0001";
const enc = new TextEncoder();

function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function signToken(email: string, exp = Math.floor(Date.now() / 1000) + 3600) {
  const raw = b64u(enc.encode(JSON.stringify({ email, exp })));
  const key = await crypto.subtle.importKey(
    "raw", enc.encode("jf-sso:" + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(raw)));
  return raw + "." + b64u(sig);
}

type Row = Record<string, any>;
const state: {
  rows: Row[];
  nextId: number;
  hubspot: { url: string; body: string }[];
  failInsert: boolean;
} = { rows: [], nextId: 1, hubspot: [], failInsert: false };

const roster: Row[] = [
  { email: "revops@jumpfactor.net", role: "admin", access: ["revops"] },
  { email: "reviewer@jumpfactor.net", role: "user", access: ["revops"] },
  { email: "view@jumpfactor.net", role: "view", access: ["revops"] },
  { email: "nope@jumpfactor.net", role: "ae", access: ["bdr"] },
];
let botKeys: Row[] = [];

function reset() {
  state.rows = [];
  state.nextId = 1;
  state.hubspot = [];
  state.failInsert = false;
}

function splitTop(s: string): string[] {
  const out: string[] = [];
  let cur = "", depth = 0, quote = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && s[i - 1] !== "\\") quote = !quote;
    else if (!quote && c === "(") depth++;
    else if (!quote && c === ")") depth--;
    if (c === "," && depth === 0 && !quote) { out.push(cur); cur = ""; }
    else cur += c;
  }
  if (cur) out.push(cur);
  return out;
}
function splitOp(expr: string): [string, string] {
  const i = expr.indexOf(".");
  return [expr.slice(0, i), expr.slice(i + 1)];
}
function parseList(v: string): string[] {
  const inner = v.startsWith("(") && v.endsWith(")") ? v.slice(1, -1) : v;
  if (!inner) return [];
  return splitTop(inner).map((x) => x.trim().replace(/^"|"$/g, "").replace(/\\"/g, '"'));
}
function likeToReg(pat: string): RegExp {
  const esc = pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("\\*", "*").replace(/\*/g, ".*");
  return new RegExp("^" + esc + "$");
}
function matchExpr(row: Row, expr: string): boolean {
  if (expr.startsWith("and(") && expr.endsWith(")")) {
    return splitTop(expr.slice(4, -1)).every((part) => matchExpr(row, part));
  }
  const dot = expr.indexOf(".");
  const col = expr.slice(0, dot);
  const [op, value] = splitOp(expr.slice(dot + 1));
  const cur = row[col];
  if (op === "eq") return String(cur) === value;
  if (op === "is" && value === "null") return cur == null;
  if (op === "gte") return cur != null && String(cur) >= value;
  if (op === "in") return parseList(value).includes(String(cur));
  if (op === "like") return cur != null && likeToReg(value).test(String(cur));
  throw new Error("unhandled op " + expr);
}
function matchParams(row: Row, params: URLSearchParams): boolean {
  for (const [k, v] of params.entries()) {
    if (k === "select" || k === "order" || k === "limit") continue;
    if (k === "or") {
      const inner = v.startsWith("(") && v.endsWith(")") ? v.slice(1, -1) : v;
      if (!splitTop(inner).some((part) => matchExpr(row, part))) return false;
      continue;
    }
    if (!matchExpr(row, k + "." + v)) return false;
  }
  return true;
}
function orderRows(rows: Row[], expr: string | null): Row[] {
  if (!expr) return rows;
  const keys = expr.split(",").map((part) => {
    const [col, dir] = part.split(".");
    return { col, dir: dir === "asc" ? 1 : -1 };
  });
  return rows.slice().sort((a, b) => {
    for (const k of keys) {
      const av = a[k.col] == null ? "" : String(a[k.col]);
      const bv = b[k.col] == null ? "" : String(b[k.col]);
      if (av < bv) return -1 * k.dir;
      if (av > bv) return 1 * k.dir;
    }
    return 0;
  });
}
function project(row: Row, select: string | null): Row {
  if (!select || select === "*") return { ...row };
  const out: Row = {};
  for (const col of select.split(",")) out[col] = row[col] ?? null;
  return out;
}

function installFetch() {
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname === "api.hubapi.com") {
      const body = String(init?.body ?? "");
      if (url.pathname.includes("/crm/v3/objects/contacts/")) state.hubspot.push({ url: url.pathname, body });
      if (url.pathname.includes("access-token-info")) {
        return new Response(JSON.stringify({ scopes: ["crm.objects.contacts.write"] }), { status: 200 });
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.hostname !== "supabase.test") {
      return new Response("unexpected " + url.href, { status: 500 });
    }
    const table = url.pathname.replace(/^\/rest\/v1\//, "");
    const method = (init?.method ?? "GET").toUpperCase();
    const params = url.searchParams;
    const source = table === "sso_roster" ? roster : table === "bad_data_review_bot_keys" ? botKeys : state.rows;
    if (table !== "bad_data_review" && table !== "sso_roster" && table !== "bad_data_review_bot_keys") {
      return new Response("unknown table " + table, { status: 500 });
    }
    if (method === "GET") {
      let rows = source.filter((row) => matchParams(row, params));
      rows = orderRows(rows, params.get("order"));
      const lim = Number(params.get("limit") ?? rows.length) || rows.length;
      return new Response(JSON.stringify(rows.slice(0, lim).map((row) => project(row, params.get("select")))), { status: 200 });
    }
    if (method === "POST" && table === "bad_data_review") {
      if (state.failInsert) {
        state.failInsert = false;
        return new Response(JSON.stringify({ code: "23505", message: "duplicate key" }), { status: 409 });
      }
      const body = JSON.parse(String(init?.body ?? "{}"));
      const row: Row = {
        answer: null, hubspot_updated: false, hubspot_error: null, status: "pending",
        run_date: new Date().toISOString().slice(0, 10), created_at: new Date().toISOString(),
        reviewed_by: null, reviewed_at: null, ...body, id: state.nextId++,
      };
      const clash = state.rows.some((have) => {
        if (have.status !== "pending" || row.status !== "pending") return false;
        if (row.item_type === "rule_question" && have.item_type === "rule_question" && have.lead_key === row.lead_key) return true;
        if (row.item_type === "bad_data" && have.item_type === "bad_data" && row.contact_id && have.contact_id === row.contact_id) return true;
        if (row.item_type === "medium_confidence" && have.item_type === "medium_confidence" && row.lead_key && have.lead_key === row.lead_key) return true;
        return false;
      });
      if (clash) return new Response(JSON.stringify({ code: "23505" }), { status: 409 });
      state.rows.push(row);
      return new Response(JSON.stringify([project(row, params.get("select"))]), { status: 201 });
    }
    if (method === "PATCH" && table === "bad_data_review") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const hit = state.rows.filter((row) => matchParams(row, params));
      for (const row of hit) Object.assign(row, body);
      return new Response(JSON.stringify(hit.map((row) => project(row, params.get("select")))), { status: 200 });
    }
    if (method === "DELETE" && table === "bad_data_review") {
      const hit = state.rows.filter((row) => matchParams(row, params));
      state.rows = state.rows.filter((row) => !hit.includes(row));
      return new Response(JSON.stringify(hit.map((row) => project(row, params.get("select")))), { status: 200 });
    }
    return new Response("unhandled " + method + " " + url.pathname, { status: 500 });
  }) as typeof fetch;
}

async function api(method: string, path: string, opts: { token?: string; bot?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = "Bearer " + opts.token;
  if (opts.bot) headers["x-jf-bot-key"] = opts.bot;
  const res = await handler(new Request("http://local/bad-data-review" + path, {
    method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }));
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

let reviewerToken = "";
let viewToken = "";
let outsiderToken = "";

installFetch();
botKeys = [{ label: "grok-fishing-queue", revoked_at: null, key_sha256: await sha256hex(BOT_KEY) }];
reviewerToken = await signToken("reviewer@jumpfactor.net");
viewToken = await signToken("view@jumpfactor.net");
outsiderToken = await signToken("nope@jumpfactor.net");

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(msg + "\nactual: " + a + "\nexpected: " + b);
}

Deno.test("bots post a rule question and read the answer back", async () => {
  reset();
  const posted = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: {
      item_type: "rule-question",
      question: "Does a personal email on a company domain still count as bad data?",
      context: "Example: jane@gmail.com at Acme. Ruleset rtb-v3. Related lead TEST-1.",
      lead_key: "rule:personal-email-on-company-domain",
      source_queue: "JF",
      run_date: "2026-11-25",
      contact_id: "999",
      linkedin_url: "https://www.linkedin.com/in/ignored",
    },
  });
  eq(posted.status, 200, "post status");
  eq(posted.json.added.length, 1, "one added");
  eq(posted.json.added[0].item_type, "rule_question", "type stored");
  eq(posted.json.added[0].contact_id, null, "contact ignored");
  eq(posted.json.added[0].lead_key, "rule:personal-email-on-company-domain", "lead key stored");
  const row = state.rows[0];
  eq(row.reason, "Does a personal email on a company domain still count as bad data?", "question stored in reason");
  eq(row.note, "Example: jane@gmail.com at Acme. Ruleset rtb-v3. Related lead TEST-1.", "context stored in note");
  eq(row.source_queue, "20129", "queue alias");
  eq(row.linkedin_url, null, "linkedin ignored");
  eq(row.answer, null, "no answer yet");
  eq(row.status, "pending", "pending");

  const again = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [{ item_type: "rule_question", question: "Same question, new wording", lead_key: "rule:personal-email-on-company-domain" }] },
  });
  eq(again.json.added, [], "duplicate not added");
  eq(again.json.skipped[0].reason, "already pending", "skipped pending");
  eq(again.json.skipped[0].id, row.id, "points at the pending row");
  eq(state.rows.length, 1, "still one row");

  const answered = await api("POST", "/verdict", {
    token: reviewerToken,
    body: { id: row.id, verdict: "answer", answer: "  Only when the mailbox itself bounced.  " },
  });
  eq(answered.status, 200, "answer status");
  eq(answered.json.hubspot, "not written (rule question)", "no hubspot");
  eq(answered.json.item.status, "answered", "answered");
  eq(answered.json.item.answer, "Only when the mailbox itself bounced.", "trimmed answer");
  eq(answered.json.item.reviewed_by, "reviewer@jumpfactor.net", "reviewer");
  assert(answered.json.item.reviewed_at, "reviewed_at set");
  eq(state.hubspot, [], "hubspot not called");

  const second = await api("POST", "/verdict", {
    token: reviewerToken,
    body: { id: row.id, verdict: "answer", answer: "Only when the mailbox itself bounced." },
  });
  eq(second.status, 409, "re-answer is final");
  assert(String(second.json.error).includes("already answered"), "409 names the answer");
  eq(state.rows[0].answer, "Only when the mailbox itself bounced.", "answer unchanged");

  const listed = await api("GET", "/bot/list?item_type=rule_question&status=all", { bot: BOT_KEY });
  eq(listed.status, 200, "list status");
  eq(listed.json.items.length, 1, "one item");
  eq(listed.json.items[0].answer, "Only when the mailbox itself bounced.", "bot sees the answer");
  eq(listed.json.items[0].status, "answered", "bot sees answered");
});

Deno.test("a rule question rejects tick, cross, a blank answer, and a bad key", async () => {
  reset();
  const made = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [{ item_type: "rule_question", question: "Which queue does this rule apply to?", lead_key: "rule:which-queue" }] },
  });
  const id = made.json.added[0].id;
  for (const verdict of ["tick", "cross"]) {
    const res = await api("POST", "/verdict", { token: reviewerToken, body: { id, verdict } });
    eq(res.status, 400, verdict + " rejected");
    assert(String(res.json.error).includes("text answer"), verdict + " message");
  }
  eq(state.rows[0].status, "pending", "still pending");
  eq(state.hubspot, [], "still no hubspot");
  const blank = await api("POST", "/verdict", { token: reviewerToken, body: { id, verdict: "answer", answer: "   " } });
  eq(blank.status, 400, "blank answer");
  eq(blank.json.error, "an answer is required", "blank message");
  const missing = await api("POST", "/bot/items", { bot: BOT_KEY, body: { items: [{ item_type: "rule_question", question: "No key" }] } });
  eq(missing.status, 400, "missing key rejected");
  assert(missing.json.invalid[0].error.includes("lead_key"), "key error");
  eq(state.rows.length, 1, "invalid batch added nothing");
  const badKey = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [{ item_type: "rule_question", question: "Bad key", lead_key: "personal-email" }] },
  });
  eq(badKey.status, 400, "prefix required");
});

Deno.test("bad_data and medium_confidence verdicts are unchanged, including medium tick as the yes", async () => {
  reset();
  const posted = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [
      { contact_id: "263999222663", contact_name: "Donja Andrews", title: "COO", company_name: "Pivital", source_queue: "20129", reason: "bounced", run_date: "2026-11-25" },
      { item_type: "medium_confidence", first_name: "Jane", last_name: "Doe", job_title: "COO", company_name: "Pivital", linkedin_url: "https://www.linkedin.com/in/jane-doe/", source_queue: "20384", reason: "Verifier reasoning: title is close" },
      { item_type: "rule_question", question: "Ignore me", lead_key: "rule:ignore-me" },
    ] },
  });
  eq(posted.status, 200, "mixed batch");
  eq(posted.json.added.map((r: Row) => r.item_type), ["bad_data", "medium_confidence", "rule_question"], "all three added");
  const bad = state.rows.find((r) => r.item_type === "bad_data")!;
  const med = state.rows.find((r) => r.item_type === "medium_confidence")!;
  eq(med.lead_key, "li:linkedin.com/in/jane-doe", "medium key default");
  eq(med.contact_name, "Jane Doe", "medium name");

  const confirmed = await api("POST", "/verdict", { token: reviewerToken, body: { id: med.id, verdict: "tick" } });
  eq(confirmed.status, 200, "confirm");
  eq(confirmed.json.hubspot, "not needed", "confirm writes nothing");
  eq(confirmed.json.item.status, "ticked", "medium yes is still ticked");
  eq(confirmed.json.item.answer, null, "medium has no answer");
  eq(state.hubspot, [], "confirm did not call hubspot");

  const unfiltered = await api("GET", "/bot/list?status=all", { bot: BOT_KEY });
  eq(unfiltered.json.items.map((r: Row) => r.item_type).sort(), ["bad_data", "medium_confidence"], "default list stays the two lead types");
  const yes = await api("GET", "/bot/list?item_type=medium_confidence&status=ticked", { bot: BOT_KEY });
  eq(yes.json.items.map((r: Row) => r.id), [med.id], "fishing bot still reads the yes");
  eq(yes.json.items[0].status, "ticked", "status ticked");
  eq(yes.json.items[0].answer, null, "answer null on medium");

  const crossed = await api("POST", "/verdict", { token: reviewerToken, body: { id: bad.id, verdict: "cross" } });
  eq(crossed.status, 200, "cross");
  eq(crossed.json.hubspot, "updated", "bad data still updates hubspot");
  eq(crossed.json.item.status, "crossed", "crossed");
  eq(crossed.json.item.hubspot_updated, true, "flag");
  eq(state.hubspot.length, 1, "one hubspot call");
  assert(state.hubspot[0].url.endsWith("/263999222663"), "contact id");
  assert(state.hubspot[0].body.includes('"contactrtb_bad_contact":"True"'), "property");

  const same = await api("POST", "/verdict", { token: reviewerToken, body: { id: bad.id, verdict: "cross" } });
  eq(same.status, 200, "same cross");
  eq(same.json.unchanged, true, "idempotent cross");
  eq(state.hubspot.length, 1, "no second hubspot call");

  const flip = await api("POST", "/verdict", { token: reviewerToken, body: { id: bad.id, verdict: "tick" } });
  eq(flip.status, 409, "cannot flip");

  const wrong = await api("POST", "/verdict", { token: reviewerToken, body: { id: bad.id, verdict: "answer", answer: "nope" } });
  eq(wrong.status, 400, "answer is not for a lead");
  eq(wrong.json.error, "only rule questions take a text answer", "message");
  eq(state.rows.find((r) => r.id === bad.id)!.status, "crossed", "lead status untouched");
});

Deno.test("a rejected medium row still does not write to HubSpot", async () => {
  reset();
  const posted = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [{ item_type: "medium_confidence", contact_name: "Jane Doe", linkedin_url: "linkedin.com/in/jane-doe", contact_id: "123" }] },
  });
  const id = posted.json.added[0].id;
  const rejected = await api("POST", "/verdict", { token: reviewerToken, body: { id, verdict: "cross" } });
  eq(rejected.status, 200, "reject");
  eq(rejected.json.hubspot, "not written (medium confidence: cross = rejected)", "message");
  eq(rejected.json.item.status, "crossed", "crossed");
  eq(state.hubspot, [], "no hubspot");
});

Deno.test("an invalid item still rejects the whole batch", async () => {
  reset();
  const res = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [
      { item_type: "rule_question", question: "Fine", lead_key: "rule:fine" },
      { contact_name: "Missing id" },
    ] },
  });
  eq(res.status, 400, "batch rejected");
  eq(state.rows.length, 0, "nothing stored");
  eq(res.json.invalid[0].error, "bad_data items need contact_id", "old validation");
});

Deno.test("duplicate rule keys in one request are skipped, and a decided question can be asked again", async () => {
  reset();
  const first = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [
      { item_type: "rule_question", question: "One", lead_key: "rule:once" },
      { item_type: "rule_question", question: "One again", lead_key: "rule:once" },
    ] },
  });
  eq(first.json.added.length, 1, "first kept");
  eq(first.json.skipped[0].reason, "duplicate in this request", "second skipped");
  await api("POST", "/verdict", { token: reviewerToken, body: { id: first.json.added[0].id, verdict: "answer", answer: "Yes." } });
  const repost = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [{ item_type: "rule_question", question: "One, again", lead_key: "rule:once" }] },
  });
  eq(repost.json.added.length, 1, "answered key can be pending again");
  eq(state.rows.filter((r) => r.lead_key === "rule:once").length, 2, "history kept");
});

Deno.test("a unique-index race is reported as already pending", async () => {
  reset();
  state.failInsert = true;
  const res = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [{ item_type: "rule_question", question: "Race", lead_key: "rule:race" }] },
  });
  eq(res.status, 200, "not a 500");
  eq(res.json.added, [], "not added");
  eq(res.json.skipped[0].reason, "already pending", "23505");
});

Deno.test("the panel list includes pending questions and answered ones from the last 7 days", async () => {
  reset();
  const posted = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [
      { item_type: "rule_question", question: "Open question", lead_key: "rule:open" },
      { contact_id: "55", contact_name: "Still pending", reason: "check" },
    ] },
  });
  const qid = posted.json.added.find((r: Row) => r.item_type === "rule_question").id;
  await api("POST", "/verdict", { token: reviewerToken, body: { id: qid, verdict: "answer", answer: "Use the bounced-mail rule." } });
  const list = await api("GET", "/list", { token: reviewerToken });
  eq(list.status, 200, "list");
  eq(list.json.canReview, true, "reviewer can answer");
  eq(list.json.pending.map((r: Row) => r.item_type), ["bad_data"], "question left the queue");
  eq(list.json.recent[0].item_type, "rule_question", "recent");
  eq(list.json.recent[0].answer, "Use the bounced-mail rule.", "recent answer");
  eq(list.json.recent[0].status, "answered", "recent status");
});

Deno.test("access rules match the other verdicts", async () => {
  reset();
  const posted = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [{ item_type: "rule_question", question: "Who can answer?", lead_key: "rule:who" }] },
  });
  const id = posted.json.added[0].id;
  const missing = await api("POST", "/verdict", { body: { id, verdict: "answer", answer: "no" } });
  eq(missing.status, 401, "no token");
  const outsider = await api("POST", "/verdict", { token: outsiderToken, body: { id, verdict: "answer", answer: "no" } });
  eq(outsider.status, 403, "no revops access");
  const view = await api("POST", "/verdict", { token: viewToken, body: { id, verdict: "answer", answer: "no" } });
  eq(view.status, 403, "view only");
  eq(view.json.error, "view-only account", "message");
  const readable = await api("GET", "/list", { token: viewToken });
  eq(readable.json.canReview, false, "view can read");
  eq(state.rows[0].status, "pending", "untouched");
  const badBot = await api("GET", "/bot/list?item_type=rule_question&status=all", { bot: "short" });
  eq(badBot.status, 401, "bad bot key");
});

Deno.test("test-verdict answers a rule:TEST row and delete-test removes only test rows", async () => {
  reset();
  const posted = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [
      { item_type: "rule_question", question: "Smoke", lead_key: "rule:TEST-smoke" },
      { item_type: "rule_question", question: "Real", lead_key: "rule:real-question" },
      { contact_id: "TEST-keep-or-not", contact_name: "Test contact", reason: "x" },
      { contact_id: "42", contact_name: "Real contact", reason: "x", lead_key: "rule:TEST-not-a-rule" },
    ] },
  });
  eq(posted.status, 200, "seed");
  const smoke = state.rows.find((r) => r.lead_key === "rule:TEST-smoke")!;
  const real = state.rows.find((r) => r.lead_key === "rule:real-question")!;
  const lead = state.rows.find((r) => r.contact_id === "42")!;
  const denied = await api("POST", "/bot/test-verdict", { bot: BOT_KEY, body: { id: real.id, verdict: "answer", answer: "no" } });
  eq(denied.status, 400, "real question is not a test row");
  const ok = await api("POST", "/bot/test-verdict", { bot: BOT_KEY, body: { id: smoke.id, verdict: "answer", answer: "Smoke answer" } });
  eq(ok.status, 200, "test answer");
  eq(ok.json.item.reviewed_by, "bot:grok-fishing-queue", "bot reviewer");
  eq(ok.json.item.answer, "Smoke answer", "stored");
  eq(state.hubspot, [], "test answer did not call hubspot");
  const crossed = await api("POST", "/verdict", { token: reviewerToken, body: { id: lead.id, verdict: "cross" } });
  eq(crossed.json.hubspot, "updated", "a lead_key of rule:TEST-... does not make bad_data a test row");
  eq(state.hubspot.length, 1, "hubspot called for the real contact");
  const deleted = await api("POST", "/bot/delete-test", { bot: BOT_KEY });
  eq(deleted.json.deleted, 2, "test contact and test question");
  eq(state.rows.map((r) => r.contact_id ?? r.lead_key), ["rule:real-question", "42"], "real rows remain");
});

Deno.test("bot list status=answered and a bad item_type still 400", async () => {
  reset();
  const posted = await api("POST", "/bot/items", {
    bot: BOT_KEY,
    body: { items: [{ item_type: "rule_question", reason: "From reason", lead_key: "rule:from-reason", source_queue: "CST" }] },
  });
  const id = posted.json.added[0].id;
  eq(state.rows[0].source_queue, "20384", "cst alias");
  eq(state.rows[0].reason, "From reason", "reason alias");
  const pending = await api("GET", "/bot/list?item_type=rule_question&status=answered", { bot: BOT_KEY });
  eq(pending.json.items, [], "not answered yet");
  await api("POST", "/verdict", { token: reviewerToken, body: { id, verdict: "answer", answer: "Because the ruleset says so." } });
  const got = await api("GET", "/bot/list?status=answered&item_type=rule_question", { bot: BOT_KEY });
  eq(got.json.items[0].answer, "Because the ruleset says so.", "answered filter");
  const bad = await api("GET", "/bot/list?item_type=rule-question", { bot: BOT_KEY });
  eq(bad.status, 400, "query param is exact");
  const worse = await api("GET", "/bot/list?status=maybe", { bot: BOT_KEY });
  eq(worse.status, 400, "bad status");
});
