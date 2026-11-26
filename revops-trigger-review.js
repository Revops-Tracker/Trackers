/* Trigger Engine part of the Review Panel (RevOps L10): sits under the RTB rows in the same panel/tab.
   The Trigger Engine (Claude sessions / n8n) posts anything it cannot decide on its own to
   public.trigger_lead_review. A person answers here (pick an option and/or write a note).
   Two kinds of rows: lead_question (about one lead or company) and rule_question (about the process).
   An answer is final and writes nothing to HubSpot: the engine reads the answer and applies it.
   Backend: Supabase edge function trigger-lead-review. Same jf_token as the rest of the page. */
(function(){
"use strict";
const API = ((window.JF_CONFIG||{}).API_BASE||"").replace(/\/jf-sso$/, "/trigger-lead-review");
const PORTAL = "1905790";
const $ = id => document.getElementById(id);
const h = s => String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const token = () => { try{ return localStorage.getItem("jf_token"); }catch(e){ return null; } };
const say = m => { if(typeof toast === "function") toast(m); };
const clean = v => v == null ? "" : String(v).trim();
const S = { pending:[], recent:[], canReview:true, loaded:false, sawList:false, loadError:"", picks:{}, notes:{}, errors:{}, busy:null, recentOpen:false, filter:"all" };

async function call(path, opts){
  opts = opts || {};
  const headers = Object.assign({ Authorization: "Bearer " + token() }, opts.headers || {});
  const r = await fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body, cache: "no-store" });
  const j = await r.json().catch(()=>({}));
  if(r.status === 401) return null;
  if(!r.ok || j.ok === false){
    const err = new Error(j.error || ("Request failed (" + r.status + ")"));
    err.status = r.status; err.body = j;
    throw err;
  }
  return j;
}

function mayReview(){
  if(window.JF_USER && window.JF_USER.role === "view") return false;
  return S.canReview !== false;
}
const sid = id => String(id);
const isRule = it => !!(it && it.item_type === "rule_question");
function optionsOf(it){ return Array.isArray(it && it.options) ? it.options.map(String) : []; }
function companyHref(id){
  const s = clean(id);
  return /^\d+$/.test(s) ? "https://app.hubspot.com/contacts/" + PORTAL + "/record/0-2/" + s : "";
}
function liHref(u){
  const s = clean(u);
  return /^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/(in|company|pub|sales)\//i.test(s) ? s : "";
}
function fmtWhen(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit", timeZone:"America/Toronto" }) + " ET";
}
function fmtDay(s){
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||""));
  if(!m) return "";
  return new Date(Date.UTC(+m[1], +m[2]-1, +m[3])).toLocaleDateString("en-US", { month:"short", day:"numeric", timeZone:"UTC" });
}
function srcLabel(s){
  const k = clean(s).replace(/^trigger-/, "");
  const map = { hiring:"#9 Hiring", jobchange:"#10 Job change", ma:"#12 M&A", competitor:"#1/#2 Competitor", process:"Process" };
  return map[k] || (k ? k : "");
}
function leadCell(it){
  if(isRule(it)){
    const slug = clean(it.lead_key).replace(/^rule:/, "");
    return '<div class="rtb-id"><div class="rtb-name">Process rule</div><span class="rtb-slug">'+h(slug)+'</span></div>';
  }
  const name = clean(it.company_name) || "Unknown company";
  const href = companyHref(it.hubspot_company_id);
  const bits = [];
  if(clean(it.domain)) bits.push(h(clean(it.domain)));
  const src = srcLabel(it.trigger_source);
  const meta = [];
  if(clean(it.priority)) meta.push('<span class="pill type-med">'+h(it.priority)+'</span>');
  if(src) meta.push('<span class="pill">'+h(src)+'</span>');
  const li = liHref(it.linkedin_url);
  if(li) meta.push('<a class="rtb-li" href="'+h(li)+'" target="_blank" rel="noopener">LinkedIn</a>');
  const person = [clean(it.person_name), clean(it.title)].filter(Boolean).join(" · ");
  return '<div class="rtb-id"><div class="rtb-name">'+(href ? '<a href="'+href+'" target="_blank" rel="noopener">'+h(name)+'</a>' : h(name))+'</div>' +
    (bits.length ? '<div class="rtb-co">'+bits.join('<span class="rtb-sep">·</span>')+'</div>' : '') +
    (person ? '<span class="rtb-title">'+h(person)+'</span>' : '') +
    (meta.length ? '<div class="rtb-meta">'+meta.join("")+'</div>' : '') + '</div>';
}
function rowHTML(it){
  const key = sid(it.id);
  const busy = S.busy === key;
  const opts = optionsOf(it);
  const pick = S.picks[key] || "";
  const note = S.notes[key] || "";
  const err = S.errors[key];
  const dis = (!mayReview() || busy) ? " disabled" : "";
  const optsHTML = opts.length
    ? '<div class="trg-opts" role="group" aria-label="Choices">' + opts.map(o =>
        '<button type="button" class="trg-opt" data-opt="'+h(o)+'" aria-pressed="'+(pick===o?"true":"false")+'"'+dis+'>'+h(o)+'</button>').join("") + '</div>'
    : "";
  const ctx = clean(it.context);
  const acts = busy
    ? '<div class="rtb-saving"><span class="rtb-spin" aria-hidden="true"></span>Saving…</div>'
    : '<button type="button" class="rtb-btn answer" data-submit="1"'+(mayReview() ? "" : " disabled")+'>Submit answer</button>';
  return '<div class="rtb-row '+(isRule(it) ? "is-rule" : "is-med")+(busy ? " is-busy" : "")+'" data-id="'+h(key)+'">' +
    leadCell(it) +
    '<div><div class="rtb-reason rtb-question">'+h(it.question)+'</div>' +
    (ctx ? '<div class="rtb-context">'+h(ctx)+'</div>' : "") +
    '<div class="rtb-sub">Raised '+h(fmtDay(it.created_at))+' by '+h(clean(it.added_by) || "the engine")+'</div></div>' +
    '<div class="rtb-acts">' + optsHTML +
    '<textarea class="rtb-note trg-note" rows="3" maxlength="4000" placeholder="'+(opts.length ? "Optional note or a different answer" : "Your answer")+'" aria-label="Note"'+dis+'>'+h(note)+'</textarea>' +
    '<p class="rtb-hint">'+(opts.length ? "Pick a choice, or write your own answer. " : "")+'An answer is final. Nothing is written to HubSpot.</p>' +
    acts + '</div>' +
    (err ? '<div class="rtb-err" role="alert">'+h(err)+'</div>' : "") + '</div>';
}
function doneHTML(it){
  const who = clean(it.reviewed_by) || "unknown";
  const when = fmtWhen(it.reviewed_at);
  const name = isRule(it) ? "Process rule" : (clean(it.company_name) || "Unknown company");
  const bits = [];
  if(clean(it.answer_option)) bits.push('<b>'+h(it.answer_option)+'</b>');
  if(clean(it.answer)) bits.push(h(it.answer));
  return '<div class="rtb-done"><span class="pill type-med">Answered</span><div>' +
    '<div class="rtb-done-top">'+h(name)+(isRule(it) ? '<span class="rtb-slug">'+h(clean(it.lead_key).replace(/^rule:/, ""))+'</span>' : "")+'</div>' +
    '<div class="rtb-who">Answered by '+h(who)+(when ? " · "+h(when) : "")+(it.applied ? " · applied by the engine" : " · not applied yet")+'</div>' +
    '<div class="rtb-sub rtb-question">'+h(it.question)+'</div>' +
    (bits.length ? '<div class="rtb-answered">'+bits.join(" · ")+'</div>' : "") + '</div></div>';
}
function visiblePending(){
  return S.pending.filter(it => S.filter === "all" || (S.filter === "rule_question" ? isRule(it) : !isRule(it)));
}
function emptyHTML(){
  return '<div class="rtb-empty"><div class="rtb-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div><b>Nothing pending</b><span>The Trigger Engine has no open questions.</span></div>';
}
function setCount(){
  const el = $("trgCount");
  const n = S.pending.length;
  if(el){ el.textContent = S.loaded && S.sawList && n ? n + " Trigger " + (n === 1 ? "question" : "questions") : ""; el.classList.toggle("has", n > 0); el.hidden = !el.textContent; }

}
function render(){
  const body = $("trgBody");
  if(!body) return;
  try{
    setCount();
    const showQueue = token() && S.loaded && (S.sawList || !S.loadError);
    const banner = (S.loaded && !mayReview()) ? '<div class="rtb-banner" role="note">View-only account. You can see the queue, but you can\'t answer.</div>' : "";
    let main;
    if(!token()) main = '<div class="rtb-empty"><b>Sign in to open the Trigger lead review panel.</b></div>';
    else if(!S.loaded) main = '<div class="rtb-empty"><span class="rtb-spin" aria-hidden="true"></span><b>Loading the review queue…</b></div>';
    else if(S.loadError && !S.sawList) main = '<div class="rtb-empty"><b>Could not load the review queue</b><span>'+h(S.loadError)+'</span><button class="btn ghost" type="button" id="trgRetry">Try again</button></div>';
    else if(!S.pending.length) main = emptyHTML();
    else {
      const rows = visiblePending();
      main = rows.length
        ? '<div class="rtb-cols" aria-hidden="true"><span>Lead or rule</span><span>Question</span><span>Your answer</span></div><div class="rtb-list">'+rows.map(rowHTML).join("")+'</div>'
        : '<div class="rtb-empty"><b>Nothing pending in this filter</b><span>Other rows may still be waiting.</span></div>';
    }
    const recent = showQueue
      ? '<details class="rtb-recent" id="trgRecent"'+(S.recentOpen ? " open" : "")+'><summary><span class="rtb-sum-l"><i class="rtb-caret" aria-hidden="true">›</i>Recently answered</span><span class="rtb-sum-r">'+S.recent.length+' in the last 14 days</span></summary>' +
        (S.recent.length ? '<div class="rtb-done-wrap">'+S.recent.map(doneHTML).join("")+'</div>' : '<div class="rtb-none">Nothing answered yet.</div>') + '</details>'
      : "";
    // keep the typed text and the scroll position when re-rendering
    const list = body.querySelector(".rtb-list"); const top = list ? list.scrollTop : 0;
    body.innerHTML = banner + main + recent;
    const nl = body.querySelector(".rtb-list"); if(nl) nl.scrollTop = top;
    const det = $("trgRecent");
    if(det) det.addEventListener("toggle", () => { S.recentOpen = det.open; });
  }catch(e){
    console.error("Trigger lead review panel", e);
    body.innerHTML = '<div class="rtb-empty"><b>Could not show the review queue.</b></div>';
  }
}

async function submit(id){
  if(!mayReview() || S.busy) return;
  const key = sid(id);
  const it = S.pending.find(x => sid(x.id) === key);
  const option = S.picks[key] || "";
  const answer = (S.notes[key] || "").trim();
  if(!option && !answer){ S.errors[key] = optionsOf(it).length ? "Pick a choice or write an answer first." : "Write an answer first."; render(); return; }
  S.busy = key; S.errors[key] = ""; render();
  try{
    const body = { id: it ? it.id : Number(key) };
    if(option) body.option = option;
    if(answer) body.answer = answer;
    const j = await call("/verdict", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
    if(!j) return;
    S.pending = S.pending.filter(x => sid(x.id) !== key);
    if(j.item) S.recent = [j.item].concat(S.recent.filter(x => sid(x.id) !== key)).slice(0, 100);
    delete S.errors[key]; delete S.notes[key]; delete S.picks[key];
    say("Answer saved. The engine will apply it on its next run.");
  }catch(e){
    const item = e.body && e.body.item;
    if(e.status === 409){
      if(item){ S.pending = S.pending.filter(x => sid(x.id) !== key); S.recent = [item].concat(S.recent.filter(x => sid(x.id) !== key)); }
      else S.errors[key] = e.message || "Already answered.";
      say(e.message || "Already answered.");
    }else if(e.status === 403){ S.canReview = false; S.errors[key] = e.message || "View-only account"; }
    else S.errors[key] = e.message || "Could not save. Try again.";
  }finally{ S.busy = null; render(); }
}

async function load(isRefresh){
  try{
    const j = await call("/list");
    if(!j) return;
    S.pending = Array.isArray(j.pending) ? j.pending : [];
    S.recent = Array.isArray(j.recent) ? j.recent : [];
    S.canReview = j.canReview !== false && !(window.JF_USER && window.JF_USER.role === "view");
    S.sawList = true; S.loadError = ""; S.loaded = true;
  }catch(e){
    if(S.sawList && isRefresh) say("Could not refresh. " + (e.message || "Try again."));
    else S.loadError = e.message || "Request failed";
    S.loaded = true;
  }finally{
    render();
  }
}

/* Panel-wide filter chips (All / Bad data / Medium / RTB rules / Trigger leads / Trigger rules).
   The RTB part keeps its own code: its own (hidden) filter buttons are clicked to match, so nothing in it changes. */
const TOP = {
  all:       { rtb:"all",               trg:"all",           showRtb:true,  showTrg:true  },
  bad_data:  { rtb:"bad_data",          trg:"all",           showRtb:true,  showTrg:false },
  medium:    { rtb:"medium_confidence", trg:"all",           showRtb:true,  showTrg:false },
  rtb_rules: { rtb:"rule_question",     trg:"all",           showRtb:true,  showTrg:false },
  trg_leads: { rtb:"all",               trg:"lead_question", showRtb:false, showTrg:true  },
  trg_rules: { rtb:"all",               trg:"rule_question", showRtb:false, showTrg:true  }
};
let topKey = "all";
function applyRtbFilter(){
  const c = TOP[topKey];
  if(!c.showRtb) return;
  const b = document.querySelector('#rtbBody [data-filter="'+c.rtb+'"]');
  if(b && b.getAttribute("aria-pressed") !== "true") b.click();
}
function applyTop(){
  const c = TOP[topKey], rb = $("rtbBody"), tg = $("trgGroup");
  if(rb) rb.hidden = !c.showRtb;
  if(tg) tg.hidden = !c.showTrg;
  document.querySelectorAll("#revTop [data-top]").forEach(b => b.setAttribute("aria-pressed", String(b.getAttribute("data-top") === topKey)));
  S.filter = c.trg;
  render();
  applyRtbFilter();
  try{ sessionStorage.setItem("rev_top", topKey); }catch(e){}
}
function initTop(){
  const bar = $("revTop"), rb = $("rtbBody");
  if(!bar) return;
  bar.addEventListener("click", e => {
    const b = e.target.closest("[data-top]");
    if(!b || !TOP[b.getAttribute("data-top")]) return;
    topKey = b.getAttribute("data-top");
    applyTop();
  });
  // the RTB part re-renders itself after loading: re-apply the chosen filter each time
  if(rb) new MutationObserver(applyRtbFilter).observe(rb, { childList:true });
  try{ const k = sessionStorage.getItem("rev_top"); if(k && TOP[k]) topKey = k; }catch(e){}
  applyTop();
}

function boot(){
  const body = $("trgBody");
  if(!body) return;
  // one Refresh for the whole panel: the RTB part refreshes itself, this adds the Trigger part
  const rbtn = $("rtbRefresh");
  if(rbtn) rbtn.addEventListener("click", () => { if(token() && !S.busy) load(true); });
  initTop();
  body.addEventListener("input", e => {
    const row = e.target.closest(".rtb-row"); if(!row) return;
    const ta = e.target.closest(".trg-note"); if(ta) S.notes[row.dataset.id] = ta.value;
  });
  body.addEventListener("keydown", e => {
    if(e.key !== "Enter" || (!e.metaKey && !e.ctrlKey)) return;
    const ta = e.target.closest(".trg-note"), row = e.target.closest(".rtb-row");
    if(!ta || !row || S.busy) return;
    e.preventDefault(); S.notes[row.dataset.id] = ta.value; submit(row.dataset.id);
  });
  body.addEventListener("click", e => {
    if(e.target.closest("#trgRetry")){ load(false); return; }
    const row = e.target.closest(".rtb-row");
    if(!row || S.busy) return;
    const id = row.dataset.id;
    const ta = row.querySelector(".trg-note"); if(ta) S.notes[id] = ta.value;
    const ob = e.target.closest("[data-opt]");
    if(ob){ const v = ob.getAttribute("data-opt"); S.picks[id] = S.picks[id] === v ? "" : v; S.errors[id] = ""; render(); return; }
    if(e.target.closest("[data-submit]")) submit(id);
  });
  if(!token()){ S.loaded = true; render(); return; }
  render(); load(false);
}
try{ boot(); }catch(e){ console.error("Trigger lead review panel", e); }
})();
