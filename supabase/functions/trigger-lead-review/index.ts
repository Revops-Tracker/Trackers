// trigger-lead-review: backend for the "Trigger lead review panel" on the RevOps L10 page.
// The Trigger Engine (Claude sessions / n8n) puts anything it cannot decide on its own into
// public.trigger_lead_review (service role, direct insert). A person answers it here.
//   lead_question  a question about one lead or company (domain? still an MSP? right size? which company?)
//   rule_question  a question about the process or a rule that is not tied to one lead
// Each row may carry `options` (a JSON array of short choices). The reviewer picks one and/or writes a note.
// An answer is final. Nothing here writes to HubSpot or Apollo: the engine reads the answers and applies them.
//   GET  /list      pending rows + what was answered in the last 14 days
//   POST /verdict   {id, option?, answer?}  at least one of option / answer. option must be one of the row's options.
// verify_jwt=false: own auth, same as bad-data-review. People: jf-sso session token (HMAC "jf-sso:"+service role key),
// sso_roster re-read on every call; access = role admin, or "revops" in sso_roster.access. role "view" can read, not answer.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANSWER_MAX = 4000;

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

const COLS = "id,item_type,lead_key,trigger_source,company_name,domain,hubspot_company_id,person_name,title,linkedin_url,priority,question,context,options,status,answer_option,answer,reviewed_by,reviewed_at,applied,added_by,created_at";

async function getRow(id: number) {
  return (await rest("trigger_lead_review?select=" + COLS + "&id=eq." + id))?.[0] ?? null;
}

async function verdict(req: Request, by: string) {
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  if (!Number.isInteger(id) || id <= 0) return json(req, { ok: false, error: "bad id" }, 400);
  const option = typeof b?.option === "string" ? b.option.trim() : "";
  const answer = typeof b?.answer === "string" ? b.answer.trim() : "";
  if (!option && !answer) return json(req, { ok: false, error: "pick an option or write an answer" }, 400);
  if (answer.length > ANSWER_MAX) return json(req, { ok: false, error: "answer is too long (max 4000 characters)" }, 400);
  const row = await getRow(id);
  if (!row) return json(req, { ok: false, error: "not in the review list" }, 404);
  const opts: string[] = Array.isArray(row.options) ? row.options.map(String) : [];
  if (option && !opts.includes(option)) return json(req, { ok: false, error: "that option is not on this question" }, 400);
  if (!option && opts.length && !answer) return json(req, { ok: false, error: "pick an option or write an answer" }, 400);
  if (row.status !== "pending")
    return json(req, { ok: false, error: "already answered by " + (row.reviewed_by ?? "someone") + "; it can't be changed here", item: row }, 409);
  const patch = { status: "answered", reviewed_by: by, reviewed_at: new Date().toISOString(), answer_option: option || null, answer: answer || null };
  // only a still-pending row changes, so two people answering at once cannot both win
  const upd = await rest("trigger_lead_review?id=eq." + id + "&status=eq.pending&select=" + COLS, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch),
  });
  if (!upd?.length) {
    const cur = await getRow(id);
    return json(req, { ok: false, error: "someone else answered it first", item: cur }, 409);
  }
  return json(req, { ok: true, item: upd[0] });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsFor(req) });
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^.*?\/trigger-lead-review/, "").replace(/\/+$/, "") || "/";
  try {
    const u = await personUser(req);
    if (!u) return json(req, { ok: false, error: "not signed in" }, 401);
    if (u.role !== "admin" && !u.access.includes("revops")) return json(req, { ok: false, error: "no access to the RevOps L10" }, 403);

    if (sub === "/list" && req.method === "GET") {
      const since = new Date(Date.now() - 14 * 86400e3).toISOString();
      const [pending, recent] = await Promise.all([
        rest("trigger_lead_review?select=" + COLS + "&status=eq.pending&order=created_at.desc&limit=500"),
        rest("trigger_lead_review?select=" + COLS + "&status=eq.answered&reviewed_at=gte." + encodeURIComponent(since) + "&order=reviewed_at.desc&limit=100"),
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
