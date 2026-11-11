/* Leaderboard engine, shared by leaderboard-auto.html (JF_PAGE 'leaderboard', reps) and reporting.html
   (JF_PAGE 'reporting', html.view-reporting, admins). Every metric / show-rate / who-cancelled / review change goes here ONCE.
   Sales L10 tabs live in lb-l10.js, which only reporting.html loads. REPORTING gates the few places the two views differ.
   Load order on both pages: lb-core.js (writes the page markup in place, then wires it) -> [lb-l10.js] -> render(); refresh();
   After editing, bump the ?v= on the <script>/<link> tags in BOTH html files (GitHub Pages caches ~10 min). */
document.currentScript.insertAdjacentHTML("beforebegin", `
<div class="wrap">
  <header class="top">
    <div>
      <h1 id="pageTitle">Sales floor leaderboard <span class="auto-tag">Auto</span></h1>
      <div class="live"><span class="dot" id="liveDot"></span><span id="liveText">Loading</span></div>
    </div>
    <button class="btn ghost" type="button" id="refreshBtn" hidden title="Pull the latest numbers from HubSpot now (Vianney / Max only)">Refresh now</button>
  </header>

  <div class="banner lb-only" id="banner">Every number here comes straight from HubSpot and refreshes at 8 AM each day, covering everything up to the end of yesterday. Click any underlined number to see the deals behind it. Reps: each morning, go through your new deals and mark each one <b>True</b> or <b>False</b> (Oct 1 to 8 is already confirmed). A "False" needs a short note and goes to Vianney or Max to approve before the numbers change.</div>
  <div id="reviewBar" class="lb-only"></div>

  <div class="controls lb-only">
    <div class="seg" role="group" aria-label="Period">
      <button data-p="week" aria-pressed="true">Week</button>
      <button data-p="month" aria-pressed="false">Month</button>
      <button data-p="quarter" aria-pressed="false">Quarter</button>
    </div>
    <div class="nav">
      <button id="prev" aria-label="Previous period">‹</button>
      <div class="period" id="periodLabel"></div>
      <button id="next" aria-label="Next period">›</button>
      <button class="btn ghost" id="today" style="margin-left:6px">Current</button>
    </div>
    <div class="pace-note" id="paceNote"></div>
  </div>

  <section class="lb-only">
    <div class="sec-head">
      <h2>BDRs</h2>
      <div class="chips" id="bdrChips" role="group" aria-label="Rank BDRs by"></div>
    </div>
    <div class="lanes" id="lanes"></div>
    <div class="tbl-toggle"><button class="btn ghost" type="button" id="bdrTableBtn" aria-expanded="false" aria-controls="bdrMetrics">Show metrics table</button></div>
    <div id="bdrMetrics" hidden>
    <div class="table-wrap" id="bdrTable"></div>
    <div class="legend"><b>Books</b>: new calls booked in the period, counted on the day they were booked (a rebook only counts as new when it is booked more than 30 days after the deal's last slot). <b>Runs due</b>: discovery calls whose slot arrived in the period, counted per call (a deal that no-shows and is rebooked into the same period = 2 calls due). <b>Runs had</b>: calls that were held. <b>Overall show</b> = runs had ÷ runs due. <b>No-show recovery</b>: of deals that missed a call in the period, the share held at a later slot (recent periods can still recover). <b>1st-time show</b> = held at the first slot ÷ new books whose first slot has passed, shown three ways: <b>excl. our cancels</b> (the headline: calls we pulled, e.g. not an MSP or DQ, are left out), <b>all</b> (nothing left out) and <b>excl. their cancels</b> (prospect cancels and reschedules before the call are left out). A booking moved before its first slot counts as a cancel. Who cancelled is decided by the who-cancelled check (open a deal and click <i>Why?</i>); <b>cancelled ahead, who unknown</b> stays in every view as a miss until someone picks ours or theirs. <b>Showed, then DQ'd</b>: of the calls held in the period, the share where the deal went to the DQ stage (showed up but was not a fit). Lower is better; a high number means the rep is booking people who show but do not qualify. <b>MRR generated</b>: monthly retainer (USD) of deals closed won in the period, credited to the rep who booked them. <b>Designs</b> (designs created): deals moved into the Design/Prop Review stage in HubSpot. <b>Designs held</b>: deals moved from Design on to a later stage (Prop Update or beyond).</div>
    </div>
  </section>


  <section class="lb-only">
    <div class="sec-head">
      <h2>AEs</h2>
      <div class="chips" id="aeChips" role="group" aria-label="Rank AEs by"></div>
    </div>
    <div class="lanes" id="aeLanes"></div>
    <div class="tbl-toggle"><button class="btn ghost" type="button" id="aeTableBtn" aria-expanded="false" aria-controls="aeMetrics">Show metrics table</button></div>
    <div id="aeMetrics" hidden>
      <div class="table-wrap" id="aeTable"></div>
      <div class="legend"><b>Discos run</b>: discovery calls held. <b>Designs held</b>: deals moved from Design to a later stage. <b>Closed won revenue</b>: monthly retainer (USD) by close date. Goals are weekly × the number of weeks in the period.</div>
    </div>
  </section>

  <section class="tr-root">
    <div class="sec-head">
      <h2>Team trends</h2>
      <div class="chips" id="trMetric" role="group" aria-label="Trend metric"></div>
    </div>
    <div class="tr-bar">
      <div class="tr-ctl">
        <div class="seg" id="trScale" role="group" aria-label="Group by">
          <button data-s="day" aria-pressed="false">Daily</button>
          <button data-s="week" aria-pressed="true">Weekly</button>
          <button data-s="month" aria-pressed="false">Monthly</button>
        </div>
        <div class="seg" id="trGroup" role="group" aria-label="Sources">
          <button data-g="all" aria-pressed="true">All sources</button>
          <button data-g="bdr" aria-pressed="false">BDRs only</button>
          <button data-g="inbound" aria-pressed="false">Inbound</button>
        </div>
        <label class="tr-range" id="trPickWrap" hidden><span id="trPickLbl">BDR</span>
          <select id="trPick"></select>
        </label>
        <label class="tr-range">Range
          <select id="trRange">
            <option value="ytd">Since Jan 1</option>
            <option value="thisq">This quarter</option>
            <option value="lastq">Last quarter</option>
            <option value="l14d">Last 14 days</option>
            <option value="l30d">Last 30 days</option>
            <option value="l8w">Last 8 weeks</option>
            <option value="l3m">Last 3 months</option>
            <option value="custom">Custom dates…</option>
          </select>
        </label>
        <span class="tr-custom" id="trCustom" hidden>
          <input type="date" id="trFrom" aria-label="From"> to <input type="date" id="trTo" aria-label="To">
        </span>
      </div>
      <button class="btn ghost" type="button" id="trTableBtn">Show table</button>
    </div>
    <div class="tr-card">
      <div class="tr-sub" id="trSub"></div>
      <div class="tr-legend" id="trLegend"></div>
      <div class="tr-plot" id="trend"></div>
      <div class="tr-tip" id="trTip"></div>
    </div>
    <div class="table-wrap" id="trTableWrap" hidden></div>
    <div class="legend">Each bar is split by who booked the deal. <b>BDRs only</b> = Brandon, Issa and former BDRs. <b>Inbound</b> = calls with no BDR (booked by the lead) plus CloseBot; under Inbound the bars are split by the deal's first-touch UTM source (pick one to see it alone, split into lead-booked vs CloseBot). Sources outside the main six are grouped as Other sources (hover the legend to see them). AE-booked calls only show under All sources. The number on top is the total. Closes and MRR are by close date. Click a coloured block to see the deals. * = period not finished or cut by the range.</div>
  </section>
</div>

<dialog id="dlg">
  <div class="dlg-head">
    <button class="dlg-x" type="button" id="dlgX" aria-label="Close">&times;</button>
    <h3 id="dlgTitle"></h3>
    <p id="dlgSub"></p>
  </div>
  <div id="dlgList"></div>
  <div class="dlg-foot"><button class="btn" type="button" id="closeBtn">Close</button></div>
</dialog>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
`);
const API = "https://ottvswkgqohurzilfafu.supabase.co/functions/v1/lb-auto";
const REPORTING = document.documentElement.classList.contains("view-reporting");
if(REPORTING) document.getElementById("pageTitle").innerHTML = 'Sales L10 <span class="auto-tag">Admins</span>';
const PORTAL = "1905790";
const TZ = "America/Toronto";

/* ---------- roster and goals (weekly goals from Max's leaderboard / L10 scorecard) ---------- */
const BDRS = [
  {key:"Brandon Cameron", name:"Brandon Cameron"},
  {key:"Issa Hattar",     name:"Issa Hattar"},
];
const AES = [{key:"Dipen Mistry", name:"Dipen Mistry"}];
const AE_RANK = [
  {id:"cwd",  label:"Closed won $",     goal:10750, fmt:"money", f:t=>t.cwd,           list:"won"},
  {id:"had",  label:"Discos run",       goal:20,    fmt:"n",     f:t=>t.had.length,    list:"had"},
  {id:"dheld",label:"Designs held",     goal:5,     fmt:"n",     f:t=>t.dheld.length,  list:"dheld"},
  {id:"prop", label:"Prop updates",     goal:8,     fmt:"n",     f:t=>t.prop.length,   list:"prop"},
  {id:"con",  label:"Contracts sent",   goal:4,     fmt:"n",     f:t=>t.con.length,    list:"con"},
  {id:"won",  label:"Closes",           goal:2,     fmt:"n",     f:t=>t.won.length,    list:"won"},
  {id:"show", label:"Overall show",     goal:null,  fmt:"pct",   f:t=>t.show,          list:"due"},
];
const DATA_FROM = "2026-01-01";   // history backfilled from Jan 1 2026 (was Jul 1 until 2026-11-11)
const NOT_A_BDR = new Set(["Inbound","CloseBot AI"]);
// Reps who have left (e.g. Jules, Hannah, Armin in Q3; Erich in Oct) are not shown by name: their numbers roll up into one "Former reps" bucket.
const FORMER = "Former reps", OTHER = "Other", INB_ALL = "All inbound", WHO_ALL = "Everyone";
const PRED = new Map();   // Sales L10 breakdown rows: person key -> predicate on a record
const CUR_BDR = new Set(BDRS.map(b=>b.key)), CUR_AE = new Set(AES.map(a=>a.key));
function whoMatches(r, person, role){
  if(person===WHO_ALL) return true;   // review-bar lists across every booker
  const v = role==="ae" ? r.ae : r.booker;
  if(person===INB_ALL) return role==="bdr" && NOT_A_BDR.has(v);
  if(PRED.has(person)) return role==="bdr" && PRED.get(person)(r);   // Sales L10 breakdown rows
  if(person===OTHER) return role==="bdr" && !!v && CUR_AE.has(v);   // calls an AE booked themselves
  if(person!==FORMER) return v===person;
  if(!v) return false;
  return role==="ae" ? !CUR_AE.has(v) : !CUR_BDR.has(v) && !CUR_AE.has(v) && !NOT_A_BDR.has(v);
}
function formerHasData(t){ return !!(t.books.length || t.due.length || t.des.length || t.dheld.length || t.diag.length || t.prop.length || t.con.length || t.won.length); }
const MULT = {week:1, month:4, quarter:12};
const BDR_RANK = [
  {id:"had",   label:"Runs had",      goal:8,  fmt:"n"},
  {id:"books", label:"Books (new)",   goal:12, fmt:"n"},
  {id:"show",  label:"Overall show",  goal:null, fmt:"pct"},
  {id:"first", label:"1st-time show (excl. our cancels)", goal:null, fmt:"pct"},
  {id:"dq",    label:"Showed, then DQ'd", goal:null, fmt:"pct", lower:true},
  {id:"des",   label:"Designs",       goal:4,  fmt:"n"},
];
const LABEL = {
  first_time_show:"Showed 1st time", moved_show:"Moved & showed", recovered_show:"Recovered (missed, then held)",
  cst_show:"Showed → sent to CST", no_show:"No-show", cancelled_ahead:"Cancelled / DQ'd ahead",
  closed_no_mtg:"Closed after slot, no meeting", cst_unverified:"CST at slot, unverified",
  pending:"Upcoming", pending_recovery:"Missed, rebook upcoming", awaiting:"Call passed, card not moved",
  awaiting_recovery:"Call passed, card not moved", not_a_booking:"Not a real booking",
};
const SHOWS = new Set(["first_time_show","moved_show","recovered_show","cst_show"]);
const GOOD = SHOWS, BAD = new Set(["no_show","cst_unverified","closed_no_mtg","awaiting","awaiting_recovery"]);
const EV_LABEL = {design:"Design created", dheld:"Design held", prop:"Prop update held", diag:"Moved to Diagnosis", contract:"Contract sent", won:"Closed won",
  abook:"Moved to Design/Audit", arun:"Audit held", ans:"Audit no-show", apend:"Audit: not confirmed yet", pbook:"Moved to Prop Review/Contract", prun:"Prop review held", pns:"Prop review no-show", ppend:"Prop review: not confirmed yet"};

/* ---------- date helpers ---------- */
const pad = n => String(n).padStart(2,"0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const torDayFmt = new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"});
const torDay = iso => iso ? torDayFmt.format(new Date(iso)) : null;
const niceFmt = new Intl.DateTimeFormat("en-US",{timeZone:TZ,month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
const nice = iso => iso ? niceFmt.format(new Date(iso)) : "–";
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function periodFor(kind, offset){
  const now = new Date(); now.setHours(0,0,0,0);
  let s, e, label;
  if(kind==="week"){
    s = new Date(now); const dow=(s.getDay()+6)%7; s.setDate(s.getDate()-dow+offset*7);
    e = new Date(s); e.setDate(e.getDate()+6);
    label = `${MON[s.getMonth()]} ${s.getDate()} to ${MON[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  } else if(kind==="month"){
    s = new Date(now.getFullYear(), now.getMonth()+offset, 1);
    e = new Date(s.getFullYear(), s.getMonth()+1, 0);
    label = `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  } else {
    const q = Math.floor(now.getMonth()/3);
    s = new Date(now.getFullYear(), q*3 + offset*3, 1);
    e = new Date(s.getFullYear(), s.getMonth()+3, 0);
    label = `Q${Math.floor(s.getMonth()/3)+1} ${s.getFullYear()}`;
  }
  // data runs through yesterday
  const y = new Date(now); y.setDate(y.getDate()-1);
  return {s, e, start:ymd(s), end:ymd(e), label, now:y};
}
function bizDays(a,b){ let n=0; const d=new Date(a); while(d<=b){ const w=d.getDay(); if(w!==0&&w!==6)n++; d.setDate(d.getDate()+1);} return n; }
function paceFraction(p){
  if(p.now >= p.e) return 1;
  if(p.now < p.s) return 0;
  const total = bizDays(p.s,p.e); if(!total) return 1;
  return Math.min(1, bizDays(p.s,p.now)/total);
}

/* ---------- state ---------- */
const state = { kind:"week", offset:0, rank:"had", aeRank:"cwd", me:null, showup:[], events:[], ov:new Map(), pend:new Map(), reviews:new Map(), cattr:new Map(), lastRun:null,
  // Sales process era (Sales L10 only). Official switch to the 3-call close = lb_auto_config.process_cutover (2026-10-27).
  era:(()=>{ try{ return sessionStorage.getItem("l10-era2") || "all"; }catch(e){ return "all"; } })(), cutover:"2026-10-27", v2ev:[], cohort:new Map(), dealIdx:new Map() };
const REVIEW_SINCE = "2026-10-01";   // reps sign off on everything from here on
const REPS = ["Brandon","Issa","Dipen"];

/* ---------- corrections applied on top of the engine (approved only; pending ones are shown, not counted) ---------- */
function effShowup(){
  return state.showup.map(r=>{
    const key = `su:${r.deal_id}:${r.seg}`;
    const o = state.ov.get(key);
    const e = {...r, key, engineCat:r.cat, engineBooker:r.booker, ov:o||null, pend:state.pend.get(key)||null};
    if(o){
      if(o.booker) e.booker = o.booker;
      if(o.cat){
        e.cat = o.cat;
        if(SHOWS.has(o.cat) && !e.run_at){ const d=(e.due_ts||[]); e.run_at = d.length ? d[d.length-1] : e.first_slot; }
        if(!SHOWS.has(o.cat)) e.run_at = null;
        if(o.cat==="cst_show") e.cst = true;
        // the correction says what happened to the first slot, so it overrides the engine's "moved before it happened" flag
        // (e.g. corrected to Showed 1st time = the first slot was kept). Only a moved/cancelled-ahead label keeps it.
        if(o.cat!=="moved_show" && o.cat!=="cancelled_ahead") e.pushed = false;
      }
      if(o.exclude || o.cat==="not_a_booking") e.dropped = true;
    }
    // who cancelled (only for bookings that missed their FIRST slot ahead of time: cancelled or moved before it)
    e.ahead = e.cat==="cancelled_ahead" || !!e.pushed;
    e.ca = state.cattr.get(key) || null;
    e.who = e.ahead ? ((o && o.who) || (e.ca ? e.ca.verdict : "unknown")) : null;
    return e;
  });
}
function effEvents(){
  return state.events.map(r=>{
    const key = `ev:${r.id}`; const o = state.ov.get(key);
    const e = {...r, key, engineBooker:r.booker, ov:o||null, pend:state.pend.get(key)||null};
    if(o){ if(o.booker) e.booker = o.booker; if(o.exclude) e.dropped = true; }
    return e;
  });
}

/* ---------- sales process era: Old (before the cutover) vs New 3-call close ---------- */
// A deal belongs to the process it STARTED in: its first discovery call (held, or first slot) before the cutover = Old,
// on/after = New. So an October-disco deal that closes in November still counts as Old. Deals with no disco record fall
// back to the record's own date. REPORTING view only; the leaderboard always shows everything.
const AE_NAME = {Dipen:"Dipen Mistry", Armin:"Armin"};
function buildEra(r){
  state.cutover = r.cutover || "2026-10-27";
  const c = new Map(), put = (id, iso) => { const d = torDay(iso); if(!id || !d) return; const k = String(id); if(!c.has(k) || d < c.get(k)) c.set(k, d); };
  state.showup.forEach(x=>put(x.deal_id, x.run_at || x.first_slot));
  state.cohort = c;
  // new-process call + stage records from the AE tracker v2 job, with the AE's own corrections applied
  const ov = new Map((r.v2ov||[]).map(o=>[o.key, o]));
  const su = new Map(); state.showup.forEach(x=>{ const k=String(x.deal_id); if(!su.has(k) || (x.seg||0) > (su.get(k).seg||0)) su.set(k, x); });
  const KIND = {audit_booked:{"":"abook"}, prop_booked:{"":"pbook"}, audit_call:{held:"arun", noshow:"ans", pending:"apend"}, prop_call:{held:"prun", noshow:"pns", pending:"ppend"}};
  state.v2ev = !REPORTING ? [] : (r.v2||[]).map(x=>{
    const o = ov.get(x.key); if(o && o.exclude) return null;
    const st = (o && o.status) || x.status || "";
    const kind = KIND[x.kind] && KIND[x.kind][x.kind.endsWith("_booked") ? "" : st]; if(!kind) return null;
    const s0 = su.get(String(x.deal_id)) || {};
    return {id:"v2:"+x.key, key:"v2:"+x.key, v2:true, kind, deal_id:x.deal_id, deal_name:(x.deal_name||x.title||"Unlinked meeting").replace(/ ?-? ?(New )?Deal 2026 ?/,""), at:x.at,
      title:x.title||"", ae:AE_NAME[x.rep]||x.rep, booker:s0.booker||"Inbound", utm:s0.utm||null, edited:!!o};
  }).filter(Boolean);
  const idx = new Map(), add = (id, k, iso) => { const d = torDay(iso); if(!id || !d) return; const key = String(id); if(!idx.has(key)) idx.set(key, []); idx.get(key).push({k, d}); };
  state.v2ev.forEach(e=>add(e.deal_id, e.kind, e.at));
  state.events.forEach(e=>{ if(e.kind==="design") add(e.deal_id, "abook", e.at); if(e.kind==="won") add(e.deal_id, "won", e.at); });
  state.dealIdx = idx;
}
// did this deal reach any of these steps on/after the given time? (past tense conversion)
const reachedSince = (id, kinds, iso) => { const d = torDay(iso); return !!d && (state.dealIdx.get(String(id))||[]).some(x=>kinds.includes(x.k) && x.d >= d); };
const onePerDeal = (arr, at) => { const m = new Map(); arr.slice().sort((a,b)=>Date.parse(at(a))-Date.parse(at(b))).forEach(r=>{ const k=String(r.deal_id); if(!m.has(k)) m.set(k, r); }); return [...m.values()]; };
const eraOf = r => { const d = state.cohort.get(String(r.deal_id)) || torDay(r.at || r.run_at || r.first_slot); return d && d >= state.cutover ? "new" : "old"; };
const eraOk = r => !REPORTING || state.era==="all" || state.era==="compare" || eraOf(r)===state.era;
// metric lists: rows tagged era:"old" / era:"new" only show in that view (both in "Both")
// leaderboard: no toggle, the classic (old-process) metric set only
const eraPick = arr => arr.filter(x=>!REPORTING ? x.era!=="new" : (!x.era || state.era==="all" || state.era==="compare" || x.era===state.era));
const v2For = (person, role, p) => state.v2ev.filter(e=>whoMatches(e, person, role) && utmOk(e,p) && inP(e.at,p) && eraOk(e));

/* ---------- rep sign-off ---------- */
const firstName = s => String(s||"").split(" ")[0];
const credited = (r, rep) => !!rep && [r.booker, r.ae].some(n=>firstName(n)===rep);
// one reviewer per record: the BDR who booked it; deals with no BDR (inbound, CloseBot) go to the AE
const BDR_NAMES = [...BDRS.map(b=>b.key), "Erich Roeder"];   // former BDRs still own their records (no AE queue spill-over)
const reviewOwner = r => BDR_NAMES.includes(r.booker) ? firstName(r.booker) : firstName(r.ae);
const labelOf = r => r.kind ? r.kind : (r.dropped ? "not_a_booking" : r.cat);
const happened = r => r.kind ? torDay(r.at) >= REVIEW_SINCE
  : ((r.due_ts||[]).length>0 || !!r.run_at) && [r.first_slot, r.run_at, ...(r.due_ts||[])].some(t=>t && torDay(t) >= REVIEW_SINCE);
function reviewState(r, rep){
  const v = state.reviews.get(r.key+"|"+rep);
  if(r.pend) return "waiting";                                   // someone proposed a change: nothing to sign until it is decided
  if(r.ov) return "true";                                        // an approved/approver correction is final: signed off for the rep
  if(!v) return "todo";
  if(v.verdict==="true" && v.label_at_review===labelOf(r)) return "true";
  if(v.verdict==="false" && r.ov) return "true";                 // their correction was approved and is applied
  return "todo";                                                 // label changed since they confirmed it, or their "false" was rejected
}
function reviewables(rep){
  return [...effShowup(), ...effEvents()].filter(r=>reviewOwner(r)===rep && happened(r));
}
const todoFor = rep => reviewables(rep).filter(r=>reviewState(r, rep)==="todo");

/* ---------- aggregation ---------- */
const inP = (iso,p) => { const d = torDay(iso); return !!d && d>=p.start && d<=p.end; };
// a slot "passed" once it is before the end of the data (end of yesterday)
const slotPassed = iso => !!iso && !!state.lastRun && Date.parse(iso) < Date.parse(state.lastRun.window_end);
function showupStats(rows, p){
  // Books = NEW bookings counted on the day they were booked (a deal's first call, or one booked 30+ days after its last slot)
  const books = rows.filter(r=>inP(r.booked_at||r.first_slot,p) && slotPassed(r.booked_at||r.first_slot));   // through end of yesterday, like everything else
  const firsts = rows.filter(r=>inP(r.first_slot,p));
  // Overall show is PER CALL (v4.4): every slot that came up in the period is one call due; it was had if the meeting ran
  // at that slot. A deal that no-shows and is then held in the same period = 2 calls due, 1 had.
  const due = [], had = [], missed = [];   // due/had = deals (for lists); missed = one entry per missed call
  const near = (a,b) => Math.abs(Date.parse(a)-Date.parse(b)) <= 3*3600e3;
  rows.forEach(r=>{
    const ds = (r.due_ts||[]).filter(t=>inP(t,p));
    const ran = inP(r.run_at,p);
    if(!ds.length && !ran) return;
    due.push(r); if(ran) had.push(r);
    const miss = ds.filter(t=>!(r.run_at && near(t, r.run_at)));
    r._miss = miss;                         // missed slots in this period (shown in the deal list)
    miss.forEach(()=>missed.push(r));
  });
  const dueN = had.length + missed.length;
  // 1st-time show, three views (Vianney 11-10). Every new booking whose first slot has passed counts, including ones
  // moved before that slot (a prospect reschedule = their cancel). Ahead-of-time cancels/moves are sorted by the
  // "who cancelled" tree into ours / theirs / unknown; unknowns stay in every view and are shown as a count.
  const fall = firsts.filter(r=>slotPassed(r.first_slot));
  const f1 = fall.filter(r=>!r.pushed && r.cat==="first_time_show");
  const fOurs = fall.filter(r=>r.ahead && r.who==="ours"), fTheirs = fall.filter(r=>r.ahead && r.who==="theirs"), fUnk = fall.filter(r=>r.ahead && r.who==="unknown");
  const fdue = fall.filter(r=>!fOurs.includes(r));            // headline: everyone we expected to show
  const fdueT = fall.filter(r=>!fTheirs.includes(r));
  const notHad = due.filter(r=>r._miss && r._miss.length);   // deals with at least one missed call (may also have been held later)
  // No-show recovery: of deals that missed a call in the period, how many were held at a later slot (any time after)
  const rec = notHad, recBack = notHad.filter(r=>r.run_at && Date.parse(r.run_at) > Date.parse(r._miss[0]));
  const hdq = had.filter(r=>r.dq);   // held calls where the deal went to the DQ stage: showed up, then disqualified
  return { books, firsts, due, dueN, had, fdue, f1, notHad, missed, rec, recBack, hdq, fall, fdueT, fOurs, fTheirs, fUnk,
    firstAll: fall.length ? f1.length/fall.length : null,
    firstExT: fdueT.length ? f1.length/fdueT.length : null,
    dqRate: had.length ? hdq.length/had.length : null,
    ns: missed.filter(r=>r.cat!=="cancelled_ahead"),
    ca: missed.filter(r=>r.cat==="cancelled_ahead"),
    show: dueN ? had.length/dueN : null,
    recovery: rec.length ? recBack.length/rec.length : null,
    first: fdue.length ? f1.length/fdue.length : null };
}
const NO_UTM = "(no first-touch UTM)", NO_UTM_KEY = NO_UTM;
const attrOf = id => (state.attrs && state.attrs.get(String(id))) || {};
const META_UTM = "Inbound - META PPC";
// Sales L10 only: Meta PPC is split into Lead Form / VSL (HubSpot deal property meta_lead_channel, stamped by n8n 5vpYcV7EhNRUzi6X); unlabelled or unclear = Unclear
const META_CH = {lead_form:" - Lead Form", vsl:" - VSL"};
const utmOf = r => REPORTING && r.utm===META_UTM ? META_UTM + (META_CH[attrOf(r.deal_id).meta_lead_channel] || " - Unclear") : (r.utm || NO_UTM);
const utmOk = (r,p) => !p || p.utm==null || (Array.isArray(p.utm) ? p.utm.includes(utmOf(r)) : utmOf(r)===p.utm);
const utmName = u => u===NO_UTM ? "No UTM" : u.replace(/^Inbound - /,"");
// past-tense conversion: start from calls that ran (one per deal), then: has that deal reached the next step since?
function convOf(had, arun, prun){
  const cvD = onePerDeal(had, r=>r.run_at), cvA = onePerDeal(arun, e=>e.at), cvP = onePerDeal(prun, e=>e.at);
  return { cvD, cvA, cvP,
    cvDn: cvD.filter(r=>reachedSince(r.deal_id, ["abook","arun","ans","apend"], r.run_at)),
    cvDw: cvD.filter(r=>reachedSince(r.deal_id, ["won"], r.run_at)),
    cvAn: cvA.filter(e=>reachedSince(e.deal_id, ["pbook","prun","pns","ppend"], e.at)),
    cvPn: cvP.filter(e=>reachedSince(e.deal_id, ["won"], e.at)) };
}
function statsFor(person, role, p){
  const su = effShowup().filter(r=>!r.dropped && whoMatches(r, person, role) && utmOk(r,p) && eraOk(r));
  const ev = effEvents().filter(r=>!r.dropped && whoMatches(r, person, role) && utmOk(r,p) && inP(r.at,p) && eraOk(r));
  const s = showupStats(su, p);
  const k = kind => ev.filter(e=>e.kind===kind);
  const v2 = v2For(person, role, p), k2 = kind => v2.filter(e=>e.kind===kind);
  return {...s, des:k("design"), dheld:k("dheld"), prop:k("prop"), diag:k("diag"), con:k("contract"), won:k("won"),
    cwd: k("won").reduce((a,e)=>a+(Number(e.amount)||0),0),
    abook:k2("abook"), arun:k2("arun"), ans:k2("ans"), apend:k2("apend"), pbook:k2("pbook"), prun:k2("prun"), pns:k2("pns"), ppend:k2("ppend"),
    ...convOf(s.had, k2("arun"), k2("prun"))};
}
const valOf = (t,id) => id==="had"?t.had.length : id==="books"?t.books.length : id==="des"?t.des.length : id==="show"?t.show : id==="dq"?t.dqRate : t.first;

/* ---------- render helpers ---------- */
const fmt = (v,money) => money ? "$"+Math.round(v).toLocaleString() : (Math.round(v*10)/10).toLocaleString();
const pctS = v => v==null ? "–" : Math.round(v*100)+"%";
const esc = s => String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function barHTML(value, goal, pace, scaleMax){
  const max = goal || scaleMax || 1;
  const w = Math.max(0, Math.min(100, value/max*100));
  let html = `<div class="bar"><div class="bar-fill" style="width:${w}%"></div>`;
  if(goal){ html += `<div class="bar-pace" style="left:calc(${pace*100}% - 1px)" title="Where you should be by yesterday"></div>`; }
  return html + `</div>`;
}
function paceText(value, goal, pace){
  if(!goal) return "";
  if(pace===0) return `<span>Goal ${fmt(goal)}</span>`;
  const diff = value - goal*pace;
  if(value >= goal) return `<span class="ahead">Goal hit</span>`;
  return diff >= 0 ? `<span class="ahead">${fmt(diff)} ahead of pace</span>` : `<span class="behind">${fmt(-diff)} behind pace</span>`;
}
const num = (v, person, role, metric, title) => `<span class="click" data-person="${esc(person)}" data-role="${role}" data-metric="${metric}" data-title="${esc(title)}">${v}</span>`;

/* ---------- render ---------- */
function render(){
  const p = periodFor(state.kind, state.offset);
  const pace = paceFraction(p);
  const mult = MULT[state.kind];
  document.getElementById("periodLabel").textContent = p.label;
  document.getElementById("paceNote").textContent =
    pace===1 ? "Period complete. Bars show final results against goal."
    : pace===0 ? "This period hasn't started yet (data runs through yesterday)."
    : `${Math.round(pace*100)}% of selling days done through yesterday. The dark tick on each bar marks where you need to be.`;
  document.querySelectorAll(".seg button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.p===state.kind));
  document.getElementById("bdrChips").innerHTML = BDR_RANK.map(r=>`<button data-r="${r.id}" aria-pressed="${r.id===state.rank}">${r.label}</button>`).join("");

  // BDR lanes
  const metric = BDR_RANK.find(r=>r.id===state.rank);
  const isPct = metric.fmt==="pct";
  const goal = metric.goal ? metric.goal*mult : null;
  document.getElementById("prev").disabled = p.start <= DATA_FROM;
  const bdrs = BDRS.map(b=>{ const t=statsFor(b.key,"bdr",p); return {...b, t, v:valOf(t,metric.id)}; })
    .sort((a,b)=>(metric.lower ? ((a.v??2)-(b.v??2)) : ((b.v??-1)-(a.v??-1))) || a.name.localeCompare(b.name));
  const topV = Math.max(...bdrs.map(b=>b.v||0), 0);
  let rank=0, prev=null;
  document.getElementById("lanes").innerHTML = bdrs.map((b,i)=>{
    if(b.v!==prev){ rank=i+1; prev=b.v; }
    const lead = rank===1 && (metric.lower ? b.v!=null : (b.v||0)>0);
    const t = b.t;
    const shown = isPct ? pctS(b.v) : fmt(b.v||0);
    const metricKey = {had:"had",books:"books",des:"des",show:"due",first:"fdue",dq:"dq"}[metric.id];
    return `<div class="lane${lead?" lead":""}">
      <div class="rank">${rank}</div>
      <div class="who"><div class="name">${esc(b.name)}</div>
        <div class="sub"><button class="linkish" data-person="${esc(b.key)}" data-role="bdr" data-metric="all" data-title="${esc(b.name)}: all deals">See deals</button></div></div>
      <div class="track">${isPct ? barHTML((b.v||0)*100, null, pace, 100) : barHTML(b.v||0, goal, pace, topV)}
        <div class="bar-meta">${isPct && metric.id==="dq" ? `<span>${t.hdq.length} of ${t.had.length} held calls ended in DQ</span>` : isPct ? `<span>${t.had.length} of ${t.dueN} calls due held · 1st-time ${t.f1.length} of ${t.fdue.length}</span>` : (goal?`<span>Goal ${fmt(goal)}</span>${paceText(b.v||0, goal, pace)}`:"")}</div>
        <div class="stats"><span>Books <b>${t.books.length}</b></span><span>Due <b>${t.dueN}</b></span><span>Had <b>${t.had.length}</b></span><span>Show <b>${pctS(t.show)}</b></span><span title="1st-time show excl. our cancels; all = nothing left out; excl. theirs = prospect cancels left out">1st-time <b>${pctS(t.first)}</b> <small>(all ${pctS(t.firstAll)} · excl. theirs ${pctS(t.firstExT)})</small></span><span>DQ'd <b>${pctS(t.dqRate)}</b></span><span>Designs <b>${t.des.length}</b></span></div>
      </div>
      <div class="score">${num(shown, b.key, "bdr", metricKey, `${b.name}: ${metric.label}`)}<small>${metric.label.toLowerCase()}</small></div>
    </div>`;
  }).join("");

  // BDR scorecard
  const rows = [
    ["Books (new)", t=>t.books.length, "books", 12],
    ["Runs due (calls)", t=>t.dueN, "due", null],
    ["Runs had", t=>t.had.length, "had", 8],
    ["Overall show", t=>pctS(t.show), "due", null],
    ["1st-time show (excl. our cancels)", t=>pctS(t.first), "fdue", null],
    ["1st-time show, all", t=>pctS(t.firstAll), "fall", null],
    ["1st-time show (excl. their cancels)", t=>pctS(t.firstExT), "fext", null],
    ["Cancelled ahead, who unknown", t=>t.fUnk.length, "cunk", null],
    ["Showed, then DQ'd", t=>pctS(t.dqRate), "dq", null],
    ["No-shows", t=>t.ns.length, "ns", null],
    ["Cancelled / DQ'd ahead", t=>t.ca.length, "ca", null],
    ["No-show recovery", t=>pctS(t.recovery), "rec", null],
    ["Designs created", t=>t.des.length, "des", 4],
    ["Designs held", t=>t.dheld.length, "dheld", null],
    ["Closed won", t=>t.won.length, "won", null],
    ["MRR generated (USD/mo)", t=>fmt(t.cwd,true), "won", null],
  ];
  const team = BDRS.map(b=>({...b, t:statsFor(b.key,"bdr",p)}));
  const inb = statsFor("Inbound","bdr",p);
  const fmr = statsFor(FORMER,"bdr",p), showF = formerHasData(fmr);
  document.getElementById("bdrTable").innerHTML = `<table><thead><tr><th>Metric</th>${team.map(b=>`<th>${esc(b.name.split(" ")[0])}</th>`).join("")}<th>Inbound</th>${showF?`<th>Former reps</th>`:""}<th>Goal</th></tr></thead><tbody>
    ${rows.map(([lbl,f,m,g])=>`<tr><td>${lbl}</td>${team.map(b=>`<td>${num(f(b.t), b.key, "bdr", m, `${b.name}: ${lbl}`)}</td>`).join("")}<td>${num(f(inb),"Inbound","bdr",m,`Inbound: ${lbl}`)}</td>${showF?`<td>${num(f(fmr),FORMER,"bdr",m,`Former reps: ${lbl}`)}</td>`:""}<td class="goal">${g?fmt(g*mult):"–"}</td></tr>`).join("")}
  </tbody></table>`;

  // AE lanes (same layout as the BDR lanes) + show/hide metrics table
  const aeM = AE_RANK.find(r=>r.id===state.aeRank);
  document.getElementById("aeChips").innerHTML = AE_RANK.map(r=>`<button data-ar="${r.id}" aria-pressed="${r.id===state.aeRank}">${r.label}</button>`).join("");
  const aeGoal = aeM.goal ? aeM.goal*mult : null, aePct = aeM.fmt==="pct", aeMoney = aeM.fmt==="money";
  const aes = AES.map(a=>{ const t=statsFor(a.key,"ae",p); return {...a, t, v:aeM.f(t)}; })
    .sort((a,b)=>((b.v??-1)-(a.v??-1)) || a.name.localeCompare(b.name));
  const aeTop = Math.max(...aes.map(a=>a.v||0), 0);
  const moneyPace = (v,g) => paceText(Math.round(v), g, pace).replace(/([\d,.]+) (ahead|behind)/, (m,n,w)=>"$"+Math.round(Number(n.replace(/,/g,""))).toLocaleString()+" "+w);
  let aRank=0, aPrev=null;
  document.getElementById("aeLanes").innerHTML = aes.map((a,i)=>{
    if(a.v!==aPrev){ aRank=i+1; aPrev=a.v; }
    const t = a.t, lead = aRank===1 && (a.v||0)>0;
    const shown = aePct ? pctS(a.v) : fmt(a.v||0, aeMoney);
    return `<div class="lane${lead?" lead":""}">
      <div class="rank">${aRank}</div>
      <div class="who"><div class="name">${esc(a.name)}</div>
        <div class="sub"><button class="linkish" data-person="${esc(a.key)}" data-role="ae" data-metric="all" data-title="${esc(a.name)}: all deals">See deals</button></div></div>
      <div class="track">${aePct ? barHTML((a.v||0)*100, null, pace, 100) : barHTML(a.v||0, aeGoal, pace, aeTop)}
        <div class="bar-meta">${aePct ? `<span>${t.had.length} of ${t.dueN} calls due held</span>` : (aeGoal?`<span>Goal ${fmt(aeGoal, aeMoney)}</span>${aeMoney ? moneyPace(a.v||0, aeGoal) : paceText(a.v||0, aeGoal, pace)}`:"")}</div>
        <div class="stats"><span>Run <b>${t.had.length}</b></span><span>No-shows <b>${t.ns.length}</b></span><span>Show <b>${pctS(t.show)}</b></span><span>Designs held <b>${t.dheld.length}</b></span><span>Props <b>${t.prop.length}</b></span><span>Contracts <b>${t.con.length}</b></span><span>Closes <b>${t.won.length}</b></span><span>MRR <b>${fmt(t.cwd,true)}</b></span></div>
      </div>
      <div class="score">${num(shown, a.key, "ae", aeM.list, `${a.name}: ${aeM.label}`)}<small>${aeM.label.toLowerCase()}</small></div>
    </div>`;
  }).join("");
  const aeRows = [
    ["Discos run (runs had)", t=>t.had.length, "had", 20],
    ["Runs due (calls)", t=>t.dueN, "due", null],
    ["Disco no-shows", t=>t.ns.length, "ns", null],
    ["Overall show", t=>pctS(t.show), "due", null],
    ["1st-time show (excl. our cancels)", t=>pctS(t.first), "fdue", null],
    ["1st-time show, all", t=>pctS(t.firstAll), "fall", null],
    ["1st-time show (excl. their cancels)", t=>pctS(t.firstExT), "fext", null],
    ["Cancelled ahead, who unknown", t=>t.fUnk.length, "cunk", null],
    ["Showed, then DQ'd", t=>pctS(t.dqRate), "dq", null],
    ["Moved to Diagnosis", t=>t.diag.length, "diag", null],
    ["Designs created", t=>t.des.length, "des", null],
    ["Designs held", t=>t.dheld.length, "dheld", 5],
    ["Prop updates held", t=>t.prop.length, "prop", 8],
    ["Contracts sent", t=>t.con.length, "con", 4],
    ["Closed won (#)", t=>t.won.length, "won", 2],
    ["Closed won revenue (USD/mo)", t=>fmt(t.cwd,true), "won", 10750, true],
  ];
  const aeTeam = AES.map(a=>({...a, t:statsFor(a.key,"ae",p)}));
  const aeF = statsFor(FORMER,"ae",p), aeShowF = formerHasData(aeF);
  document.getElementById("aeTable").innerHTML = `<table><thead><tr><th>Metric</th>${aeTeam.map(a=>`<th>${esc(a.name.split(" ")[0])}</th>`).join("")}${aeShowF?`<th>Former reps</th>`:""}<th>Goal</th></tr></thead><tbody>
    ${aeRows.map(([lbl,f,m,g,money])=>`<tr><td>${lbl}</td>${aeTeam.map(a=>`<td>${num(f(a.t), a.key, "ae", m, `${a.name}: ${lbl}`)}</td>`).join("")}${aeShowF?`<td>${num(f(aeF),FORMER,"ae",m,`Former reps: ${lbl}`)}</td>`:""}<td class="goal">${g?fmt(g*mult, money):"–"}</td></tr>`).join("")}
  </tbody></table>`;
  updateLive();
  renderReviewBar();
  document.getElementById("refreshBtn").hidden = !(state.me && state.me.approver);
  renderTrends();
  if(REPORTING) renderL10();
}

function renderReviewBar(){
  const me = state.me, el = document.getElementById("reviewBar");
  if(!me){ el.innerHTML = ""; return; }
  const parts = [];
  if(me.rep && REPS.includes(me.rep)){
    const all = reviewables(me.rep), todo = all.filter(r=>reviewState(r, me.rep)==="todo"), done = all.filter(r=>reviewState(r, me.rep)==="true");
    parts.push(todo.length
      ? `<div class="rv todo"><b>${todo.length} new deal${todo.length>1?"s":""} to confirm</b><span class="prog">${done.length} of ${all.length} confirmed since Oct 1</span><button class="btn" data-queue="${esc(me.rep)}">Review now</button></div>`
      : `<div class="rv"><span class="ok">You're all caught up.</span><span class="prog">${all.length} deal${all.length===1?"":"s"} confirmed since Oct 1</span></div>`);
  }
  if(me.approver){
    const n = state.pend.size;
    parts.push(`<div class="rv${n?" todo":""}"><b>${n} correction${n===1?"":"s"} waiting for approval</b>${n?`<button class="btn" data-approvals="1">Review</button>`:""}</div>`);
    parts.push(`<div class="rv"><span class="prog">Rep sign-off since Oct 1:</span>${REPS.map(rep=>{const a=reviewables(rep), d=a.filter(r=>reviewState(r,rep)==="true"); return `<button class="linkish" data-queue="${rep}">${rep} ${d.length}/${a.length}</button>`;}).join("")}</div>`);
  }
  parts.push(...whoUnknownBar(me));
  el.innerHTML = parts.join("");
}
// Cancels/moves before the first slot that the who-cancelled check couldn't call (last 30 days). Approvers see everyone's; reps see their own.
function last30(){ const y=new Date(); y.setHours(0,0,0,0); y.setDate(y.getDate()-1); const s=new Date(y); s.setDate(s.getDate()-29); return {s, e:y, start:ymd(s), end:ymd(y), label:"last 30 days", now:y}; }
function whoUnknownBar(me){
  const who = me.approver ? WHO_ALL : (me.rep && REPS.includes(me.rep) ? me.rep : null);
  if(!who) return [];
  const unk = showupStats(effShowup().filter(r=>!r.dropped && whoMatches(r, who, "bdr")), last30()).fUnk;
  let ran = null; state.cattr.forEach(c=>{ if(c.decided_at && (!ran || c.decided_at>ran)) ran = c.decided_at; });
  const n = unk.length, scope = who===WHO_ALL ? "" : " you booked";
  return [`<div class="rv${n?" todo":""}"><b>${n ? n+" cancel"+(n===1?"":"s")+scope+": nobody can tell who cancelled" : "Who cancelled: all sorted"}</b><span class="prog">last 30 days${ran?" · checked "+nice(ran)+" ET":""}</span>${n?`<button class="btn" data-cunk="${esc(who)}">Pick ours or theirs</button>`:""}</div>`];
}

function updateLive(){
  const dot=document.getElementById("liveDot"), txt=document.getElementById("liveText");
  const r = state.lastRun;
  if(!r){ dot.classList.remove("on"); txt.textContent = "No refresh has run yet"; return; }
  const through = new Date(new Date(r.window_end).getTime()-1);
  dot.classList.add("on");
  txt.textContent = `Data through ${torDayFmt.format(through)} · refreshed ${nice(r.ran_at)} ET`;
}

/* ---------- deal list + corrections ---------- */
function canFix(rec){
  const me = state.me; if(!me || me.role==="view") return false;
  return !!me.approver || credited(rec, me.rep);
}
function whyShowup(r){
  const bits = [];
  if(r.booked_at) bits.push(`Booked ${nice(r.booked_at)}`);
  bits.push(`First slot ${nice(r.first_slot)}`);
  if(r.run_at) bits.push(`held ${nice(r.run_at)}`);
  const due = (r.due_ts||[]).filter(t=>!r.run_at || Math.abs(Date.parse(t)-Date.parse(r.run_at))>3*3600e3);
  if(due.length) bits.push(`${r.run_at?"missed slot":"slot"}${due.length>1?"s":""} that came due: ${due.map(nice).join(", ")}`);
  if(r.pushed) bits.push("first slot was moved before it happened");
  if(r.flags) bits.push(r.flags);
  if(r.dq) bits.push("deal went to DQ");
  return bits.join(" · ");
}
function dealHTML(r, isEv){
  const link = `https://app.hubspot.com/contacts/${PORTAL}/record/0-3/${r.deal_id}`;
  const lbl = isEv ? EV_LABEL[r.kind] : (LABEL[r.cat]||r.cat);
  const cls = isEv ? "good" : (GOOD.has(r.cat)?"good":(BAD.has(r.cat)?"bad":""));
  const why = isEv ? `${nice(r.at)}${r.title?" · "+esc(r.title):""}${r.amount?" · $"+Math.round(r.amount).toLocaleString():""} · AE ${esc(r.ae||"–")} · booked by ${esc(r.booker)}`
                   : `${esc(whyShowup(r))} · booked by ${esc(r.booker)}${r.ae?" · AE "+esc(r.ae):""}`;
  const what = o => `${o.cat?` to <b>${esc(LABEL[o.cat]||o.cat)}</b> (engine said ${esc(LABEL[r.engineCat]||r.engineCat)})`:""}${o.booker?`, credit to <b>${esc(o.booker)}</b>`:""}${o.exclude?", <b>not counted</b>":""}: “${esc(o.note)}”`;
  const corr = (r.ov ? `<div class="corr">Corrected by ${esc(r.ov.by_email)}${what(r.ov)}${r.ov.decided_by&&r.ov.decided_by!==r.ov.by_email?` · approved by ${esc(r.ov.decided_by)}`:""}</div>` : "")
             + (r.pend ? `<div class="pend">Proposed by ${esc(r.pend.by_email)}${what(r.pend)} · <b>waiting for Vianney or Max to approve</b></div>` : "");
  const me = r.v2 ? {} : (state.me || {});
  const acts = [];
  if(r.v2) acts.push(`<span class="prog">${r.edited?"Set by the AE on the AE tracker. ":""}Fix this on the <a href="ae.html">AE tracker</a>.</span>`);
  if(me.rep && reviewOwner(r)===me.rep && happened(r)){
    const st = reviewState(r, me.rep);
    if(st==="true") acts.push(`<span class="ok">✓ You confirmed this</span>`);
    else if(st==="todo") acts.push(`<span class="tf"><button class="t" data-true="${esc(r.key)}" data-label="${esc(labelOf(r))}">True</button><button class="f" data-fix="${esc(r.key)}" data-ev="${isEv?1:0}">False</button></span>`);
  }
  // approvers can sign off for the rep who owns the record (e.g. confirming a deal with them)
  { const ow = reviewOwner(r); if(me.approver && ow && ow!==me.rep && REPS.includes(ow) && happened(r)){ const st = reviewState(r, ow);
    if(st==="true") acts.push(`<span class="ok">✓ ${esc(ow)} confirmed</span>`);
    else if(st==="todo") acts.push(`<span class="tf"><button class="t" data-true="${esc(r.key)}" data-label="${esc(labelOf(r))}" data-rep="${esc(ow)}">Confirm for ${esc(ow)}</button></span>`); } }
  if(me.approver && r.pend) acts.push(`<span class="tf"><button class="t" data-approve="${esc(r.key)}">Approve</button><button class="f" data-reject="${esc(r.key)}">Reject</button></span>`);
  if(me.approver) acts.push(`<button class="linkish" data-fix="${esc(r.key)}" data-ev="${isEv?1:0}">${r.ov?"Change correction":"Correct"}</button>`);
  if((me.approver && r.ov) || (r.pend && r.pend.by_email===me.email)) acts.push(`<button class="linkish" data-undo="${esc(r.key)}">${r.pend&&!me.approver?"Withdraw my correction":"Undo correction"}</button>`);
  if(!me.approver && me.rep && reviewOwner(r)===me.rep && reviewState(r, me.rep)==="true") acts.push(`<button class="linkish" data-fix="${esc(r.key)}" data-ev="${isEv?1:0}">Actually, this is wrong</button>`);
  const fix = acts.length ? `<div class="fix">${acts.join("")}</div><div class="fixslot" id="fix-${esc(r.key)}"></div>` : "";
  return `<li class="deal${r.dropped?" dropped":""}"><div class="top"><span class="nm"><a href="${link}" target="_blank" rel="noopener">${esc(r.deal_name)}</a></span><span class="pill ${cls}">${esc(lbl)}${r.dropped?" · not counted":""}</span></div>
    <div class="why">${why}</div>${isEv?"":whoHTML(r)}${corr}${fix}</li>`;
}
/* ---------- who cancelled: verdict + the decision tree + evidence, and a one-click flip (same as the leaderboard) ---------- */
const WC_SRC = {hs_stage:"HubSpot stage", msp_verify:"MSP Verify", slack_slotguard:"Slack slot guard", slack_icp:"Slack ICP alert", gcal:"Calendar",
  ghl_appt:"GHL appointment", ghl_sms:"GHL text", ghl_email:"GHL email", ghl_call:"GHL call", hs_email:"HubSpot email", hs_note:"HubSpot note", hs_call:"HubSpot call log", ai:"AI"};
const WC_WHO = {ours:"Our cancel", theirs:"Their cancel", unknown:"Who cancelled: unknown"};
function whoHTML(r){
  if(!r.ahead) return "";
  const c = r.ca, ov = r.ov && r.ov.who ? r.ov : null, pend = r.pend && r.pend.who ? r.pend : null;
  const kind = r.pushed ? "moved before its first slot" : "cancelled before its first slot";
  const head = `<span class="tag ${r.who}">${WC_WHO[r.who]}</span><span>${esc(ov ? "Set by "+ov.by_email : (c ? c.reason : "Not sorted yet (runs weekday mornings)"))}${c&&!ov&&c.step?` · step ${c.step}`:""}</span>${c||pend?`<span class="more">Why?</span>`:""}`;
  const stepCls = a => (a==="yes"||a==="us"||a==="prospect") ? "yes" : (a||"no");
  const steps = c ? (c.path||[]).map(s=>`<div class="step ${stepCls(s.a)}"><span class="n">${typeof s.step==="number"?s.step:(s.step==="first"?"⇄":"AI")}</span><span><span class="q">${esc(s.q)}</span>${s.a?`<span class="a">${esc(s.a)}</span>`:""}</span><span class="w">${esc(s.why)}</span></div>`).join("") : "";
  const evs = c ? (c.evidence||[]).slice(0,10).map(e=>`<li class="${e.used?"used":""}"><span class="src">${e.used?"✓ ":""}${esc(WC_SRC[e.src]||e.src)}${e.at?" · "+nice(e.at):""}${e.side&&e.side!=="system"?" · "+esc(e.side):""}:</span> ${esc(e.text)}${e.url?` <a href="${esc(e.url)}" target="_blank" rel="noopener">open</a>`:""}</li>`).join("") : "";
  const conf = c && (c.conflicts||[]).length ? `<div class="w" style="margin-top:6px"><b>Pointed the other way:</b> ${c.conflicts.map(e=>esc((WC_SRC[e.src]||e.src)+": "+e.text)).join(" · ")}</div>` : "";
  const me = state.me||{};
  const canFlip = me.approver || (me.rep && credited(r, me.rep));
  const btn = (w, t) => `<button class="btn ghost" type="button" data-who="${w}" data-key="${esc(r.key)}" data-label="${esc(labelOf(r))}">${t}</button>`;
  const flip = canFlip ? `<div class="flip"><span>Wrong?</span>${r.who!=="ours"?btn("ours","It was us"):""}${r.who!=="theirs"?btn("theirs","It was them"):""}${pend?`<span>Waiting for approval: ${esc(pend.who==="ours"?"our cancel":"their cancel")}</span>`:""}</div>` : "";
  return `<details class="wc"><summary>${head}</summary><div class="tree"><div class="w" style="margin-bottom:4px">This call was ${kind}. The checks run in order and stop at the first yes: 1 not a fit (ours) → 2 the prospect acted on the calendar (theirs) → 3 the prospect said so in a message (theirs) → 4 we moved it (ours) → otherwise unknown. If both sides acted, whoever acted first decides.</div>${steps}${evs?`<ul class="ev">${evs}</ul>`:""}${conf}${flip}</div></details>`;
}
let lastOpen = null;
function openList(person, role, metric, title, pOverride){
  lastOpen = {person, role, metric, title, pOverride};
  const p = pOverride || periodFor(state.kind, state.offset);
  const allSu = effShowup().filter(r=>whoMatches(r, person, role) && utmOk(r,p) && eraOk(r));
  const live = allSu.filter(r=>!r.dropped);
  const s = showupStats(live, p);
  const ev = effEvents().filter(r=>whoMatches(r, person, role) && utmOk(r,p) && inP(r.at,p) && eraOk(r));
  const v2 = v2For(person, role, p), v2Of = (...k) => v2.filter(e=>k.includes(e.kind));
  const dropped = allSu.filter(r=>r.dropped && (inP(r.booked_at,p) || inP(r.first_slot,p) || (r.due_ts||[]).some(t=>inP(t,p))));
  const groups = [];
  const evOf = k => ev.filter(e=>e.kind===k);
  if(metric==="books") groups.push(["New books (booked in period)", s.books]);
  else if(metric==="had") groups.push(["Runs had", s.had]);
  else if(metric==="due") groups.push(["Held", s.had], ["Missed calls (a deal can be in both lists)", s.notHad]);
  else if(metric==="rec") groups.push(["Missed, then held at a later slot", s.recBack], ["Missed, not held since", s.rec.filter(r=>!s.recBack.includes(r))]);
  else if(metric==="dq") groups.push(["Showed, then DQ'd", s.hdq], ["Showed, not DQ'd", s.had.filter(r=>!s.hdq.includes(r))]);
  else if(["fdue","fall","fext","cunk"].includes(metric)){
    const missF = s.fall.filter(r=>!s.f1.includes(r) && !r.ahead);
    if(metric==="cunk") groups.push(["Cancelled or moved ahead, nobody can tell who yet (pick ours or theirs)", s.fUnk]);
    else groups.push(["Held at first slot", s.f1], ["No-show at first slot", missF],
      ["Cancelled or moved ahead by the prospect" + (metric==="fext" ? " (not counted in this view)" : ""), s.fTheirs],
      ["Cancelled or moved ahead by us" + (metric==="fdue" ? " (not counted in this view)" : ""), s.fOurs],
      ["Cancelled or moved ahead, who unknown (counted as a miss)", s.fUnk]);
  }
  else if(metric==="ns") groups.push(["No-shows (one per missed call)", [...new Set(s.ns)]]);
  else if(metric==="ca") groups.push(["Cancelled / DQ'd ahead", [...new Set(s.ca)]]);
  else if(["arun","ans","ashow"].includes(metric)) groups.push(["Audits held", v2Of("arun")], ["Audit no-shows", v2Of("ans")], ["Not confirmed yet (the AE answers on the AE tracker)", v2Of("apend")]);
  else if(["prun","pns","pshow"].includes(metric)) groups.push(["Prop reviews held", v2Of("prun")], ["Prop review no-shows", v2Of("pns")], ["Not confirmed yet (the AE answers on the AE tracker)", v2Of("ppend")]);
  else if(metric==="pbook") groups.push([null, v2Of("pbook")]);
  else if(["cvd","cva","cvp","cvw"].includes(metric)){
    const t = statsFor(person, role, p), not = (all, yes) => all.filter(x=>!yes.includes(x));
    if(metric==="cvd") groups.push(["Discos run, since moved to Design/Audit", t.cvDn], ["Discos run, not moved on yet", not(t.cvD, t.cvDn)]);
    if(metric==="cva") groups.push(["Audits run, since moved to Prop Review", t.cvAn], ["Audits run, not moved on yet", not(t.cvA, t.cvAn)]);
    if(metric==="cvp") groups.push(["Prop reviews run, since closed", t.cvPn], ["Prop reviews run, not closed yet", not(t.cvP, t.cvPn)]);
    if(metric==="cvw") groups.push(["Discos run, since closed", t.cvDw], ["Discos run, not closed yet", not(t.cvD, t.cvDw)]);
  }
  else if(["des","dheld","prop","diag","con","won"].includes(metric)) groups.push([null, evOf({des:"design",dheld:"dheld",prop:"prop",diag:"diag",con:"contract",won:"won"}[metric])]);
  else {
    groups.push(["Held", s.had], ["Due but not held", s.notHad], ["Booked, not due yet", s.books.filter(r=>!s.due.includes(r))]);
    if(ev.length) groups.push(["Pipeline", ev]);
    if(v2.length) groups.push(["New-process calls", v2]);
  }
  if(dropped.length && ["all","books","due","fdue","fall","fext"].includes(metric)) groups.push(["Not counted (corrected out)", dropped]);
  showDialog(title, `${p.label}. Click a deal name to open it in HubSpot.`, groups);
}
function openQueue(rep){
  lastOpen = {queue:rep};
  const all = reviewables(rep);
  const todo = all.filter(r=>reviewState(r,rep)==="todo"), wait = all.filter(r=>reviewState(r,rep)==="waiting"), done = all.filter(r=>reviewState(r,rep)==="true");
  const mine = state.me && state.me.rep===rep;
  showDialog(mine ? "Your deals to confirm" : `${rep}: sign-off`, (mine?"Deals you need to confirm":"Deals "+rep+" needs to confirm")+" (BDRs: deals they booked. Dipen: deals with no BDR, like inbound). Oct 1 to 8 was confirmed by RevOps, so only newer deals, or deals whose label has changed since, show up here. True = the label is right. False = tell us what really happened (goes to Vianney or Max to approve).",
    [["To confirm", todo], ["Waiting for approval", wait], ["Confirmed", done]].filter(g=>g[1].length || g[0]==="To confirm"));
}
function openApprovals(){
  lastOpen = {approvals:true};
  const all = [...effShowup(), ...effEvents()].filter(r=>r.pend);
  showDialog("Corrections waiting for approval", "Approve to apply the rep's correction to the numbers. Reject to keep the engine's label (the deal goes back to the rep's queue).", [[null, all]]);
}
function showDialog(title, sub, groups){
  document.getElementById("dlgTitle").textContent = title;
  document.getElementById("dlgSub").textContent = sub;
  const html = groups.map(([g, list])=>`${g?`<h4 class="grp">${esc(g)} (${list.length})</h4>`:""}<ul class="deal-list">${list.length?list.map(r=>dealHTML(r, !!r.kind)).join(""):`<li class="deal empty">None</li>`}</ul>`).join("");
  document.getElementById("dlgList").innerHTML = html;
  const d = document.getElementById("dlg"); if(!d.open) d.showModal();
}
function fixForm(key, isEv){
  const slot = document.getElementById("fix-"+key); if(!slot) return;
  const rec = (isEv?effEvents():effShowup()).find(r=>r.key===key);
  const approver = !!(state.me && state.me.approver);
  const cats = ["first_time_show","moved_show","recovered_show","cst_show","no_show","cancelled_ahead","closed_no_mtg","pending","not_a_booking"];
  const prev = rec.pend || rec.ov;
  slot.innerHTML = `<div class="fixbox">
    ${isEv ? `<label><span><input type="checkbox" id="fx-ex" checked> <b>Remove this</b>: it should not count at all (e.g. the deal was moved to this stage by mistake)</span></label>`
           : `<label>What actually happened<select id="fx-cat">${cats.map(c=>`<option value="${c}" ${(rec.cat===c)?"selected":""}>${LABEL[c]}</option>`).join("")}</select></label>`}
    <label>Credit to<select id="fx-bk">${["Inbound","Brandon Cameron","Issa Hattar"].map(n=>`<option ${rec.booker===n?"selected":""}>${n}</option>`).join("")}</select></label>
    <label>Why (required, e.g. "prospect joined late, Fathom missed it")<textarea id="fx-note">${esc(prev?prev.note:"")}</textarea></label>
    <div class="err" id="fx-err" style="padding:0"></div>
    <div class="row"><button class="btn ghost" type="button" data-cancel="1">Cancel</button><button class="btn" type="button" id="fx-save">${approver?"Save correction":"Send for approval"}</button></div></div>`;
  slot.querySelector("[data-cancel]").onclick = ()=>{ slot.innerHTML=""; };
  slot.querySelector("#fx-save").onclick = async ()=>{
    const body = {key, note: slot.querySelector("#fx-note").value, label: labelOf(rec)};
    if(isEv) body.exclude = slot.querySelector("#fx-ex").checked;
    else { const c = slot.querySelector("#fx-cat").value; if(c!==rec.engineCat) body.cat = c; if(c==="not_a_booking"){ body.exclude = true; } }
    const bk = slot.querySelector("#fx-bk"); if(bk && bk.value!==rec.engineBooker) body.booker = bk.value;
    if(!body.cat && !body.booker && !body.exclude){ slot.querySelector("#fx-err").textContent = isEv ? "Nothing to change yet. Tick “Remove this” to take it out, or pick who should get the credit. If it is right as it is, use Confirm instead." : "That is what it already says. If it is right, use Confirm instead."; return; }
    if(!body.note.trim()){ slot.querySelector("#fx-err").textContent = "Please add a short reason."; return; }
    const r = await call("/correct", body);
    if(r.ok){ toast(approver?"Correction saved":"Sent to Vianney / Max for approval"); await refresh(); reopen(); }
    else slot.querySelector("#fx-err").textContent = r.error || "Could not save";
  };
}
async function act(path, body, msg){
  const r = await call(path, body);
  if(r.ok){ toast(msg); await refresh(); reopen(); } else toast(r.error||"Something went wrong");
}
const undo = key => act("/correct", {key, clear:true}, "Correction removed");
function reopen(){
  if(!lastOpen || !document.getElementById("dlg").open) return;
  if(lastOpen.queue) openQueue(lastOpen.queue);
  else if(lastOpen.approvals) openApprovals();
  else openList(lastOpen.person,lastOpen.role,lastOpen.metric,lastOpen.title,lastOpen.pOverride);
}

/* ---------- data ---------- */
function token(){ try { return localStorage.getItem("jf_token"); } catch(e){ return null; } }
async function call(path, body){
  if(window.JF_DEMO) return path.startsWith("/state") ? {ok:true, ...(await (await fetch("demo-l10.json")).json())} : {ok:false, error:"Demo mode: nothing saved"};
  try{
    const res = await fetch(API+path, body ? {method:"POST", headers:{"Content-Type":"application/json", Authorization:"Bearer "+token()}, body:JSON.stringify(body)}
                                           : {headers:{Authorization:"Bearer "+token()}, cache:"no-store"});
    if(res.status===401){ location.replace("index.html"); return {ok:false}; }
    const j = await res.json().catch(()=>({}));
    return res.ok ? {ok:true, ...j} : {ok:false, ...j};
  }catch(e){ return {ok:false, error:"Network error"}; }
}
async function refresh(){
  const r = await call("/state?since=2025-12-01");   // a month before DATA_FROM so early-January reschedules have their first slot
  if(!r.ok){ document.getElementById("liveText").textContent = r.error || "Could not load numbers"; return; }
  state.me = r.me; state.showup = r.showup||[]; state.events = r.events||[]; state.lastRun = r.lastRun;
  state.ov = new Map((r.overrides||[]).filter(o=>o.status==="approved").map(o=>[o.key,o]));
  state.pend = new Map((r.overrides||[]).filter(o=>o.status==="pending").map(o=>[o.key,o]));
  state.reviews = new Map((r.reviews||[]).map(v=>[v.key+"|"+v.rep, v]));
  state.cattr = new Map((r.cattr||[]).map(c=>[c.key, c]));
  state.attrs = new Map((r.attrs||[]).map(a=>[String(a.deal_id), a.p||{}]));
  buildEra(r);
  applyEra();
  render();
  if(REPORTING && !state.act) loadActivity();
}
// Nooks dials / connects / conversations (weekly upload on the RevOps L10 tab), for the Sales L10 scorecard
async function loadActivity(){
  try{
    const base = ((window.JF_CONFIG||{}).API_BASE||"").replace(/\/jf-sso$/, "/bdr-report");
    const res = await fetch(base+"/state", {headers:{Authorization:"Bearer "+token()}, cache:"no-store"});
    const j = await res.json().catch(()=>({}));
    if(!res.ok || j.ok===false) throw new Error(j.error||res.status);
    state.act = {rows: j.connectRate||[], target: parseFloat((j.config||{}).connect_rate_target||"0.03")};
  }catch(e){ console.warn("activity", e); state.act = {rows:[], target:0.03, failed:true}; }
  renderScorecard();
}
function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200); }

/* ---------- sales process toggle (Sales L10) ---------- */
function applyEra(){
  TR_METRICS = eraPick(TR_METRICS_ALL);
  if(REPORTING){ BK_COLS = eraPick(BK_COLS_ALL); CL_COLS = eraPick(CL_COLS_ALL); SC_ROWS = eraPick(SC_ROWS_ALL); AX_COLS = eraPick(AX_COLS_ALL); }
  if(!TR_METRICS.some(x=>x.id===trend.metric)) trend.metric = TR_METRICS[0].id;
  if(typeof AX!=="undefined" && !AX_COLS.some(x=>x.id===AX.metric)) AX.metric = AX_COLS[4].id;
  const d = new Date(state.cutover+"T12:00:00"), cut = MON[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear();
  document.querySelectorAll("#eraSeg button").forEach(b=>{
    b.setAttribute("aria-pressed", b.dataset.era===state.era);
    if(b.dataset.era==="old") b.textContent = "Old process only (before "+MON[d.getMonth()]+" "+d.getDate()+")";
    if(b.dataset.era==="new") b.textContent = "3-call close only (from "+MON[d.getMonth()]+" "+d.getDate()+")";
  });
  const el = document.getElementById("eraNote");
  if(el) el.textContent = state.era==="compare"
    ? "Before (old process) and after (3-call close, from "+cut+") side by side. Conversion compares deals of the same age."
    : state.era==="all"
    ? "Showing every deal. Old and new metrics sit side by side; rates mix both processes."
    : "Official switch to the 3-call close (Disco → Design/Audit → Prop Review/Contract): "+cut+". A deal counts in the process its first discovery call was in, so an older deal that closes after "+cut+" still counts as Old."
      + (state.era==="new" ? " Audit and prop review calls come from the AE tracker (no-shows the AE confirms there)." : "");
}

/* ---------- events ---------- */
document.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{state.kind=b.dataset.p; state.offset=0; render();});
document.getElementById("prev").onclick=()=>{ if(periodFor(state.kind, state.offset).start > DATA_FROM){ state.offset--; render(); } };
document.getElementById("next").onclick=()=>{state.offset++; render();};
document.getElementById("today").onclick=()=>{state.offset=0; render();};
document.getElementById("aeChips").onclick=e=>{const b=e.target.closest("button[data-ar]"); if(b){state.aeRank=b.dataset.ar; render();}};
document.getElementById("bdrChips").onclick=e=>{const b=e.target.closest("button[data-r]"); if(b){state.rank=b.dataset.r; render();}};
document.addEventListener("click", e=>{
  const n = e.target.closest("[data-metric]");
  if(n){ openList(n.dataset.person, n.dataset.role, n.dataset.metric, n.dataset.title); return; }
  const f = e.target.closest("[data-fix]"); if(f){ fixForm(f.dataset.fix, f.dataset.ev==="1"); return; }
  const u = e.target.closest("[data-undo]"); if(u){ undo(u.dataset.undo); return; }
  const w = e.target.closest("[data-who]"); if(w){ act("/correct", {key:w.dataset.key, who:w.dataset.who, label:w.dataset.label}, state.me && state.me.approver ? "Saved: "+(w.dataset.who==="ours"?"our cancel":"their cancel") : "Sent to Vianney / Max for approval"); return; }
  const t = e.target.closest("[data-true]"); if(t){ act("/review", t.dataset.rep ? {key:t.dataset.true, label:t.dataset.label, rep:t.dataset.rep} : {key:t.dataset.true, label:t.dataset.label}, t.dataset.rep ? "Confirmed for "+t.dataset.rep : "Confirmed"); return; }
  const ap = e.target.closest("[data-approve]"); if(ap){ act("/decide", {key:ap.dataset.approve, approve:true}, "Approved, numbers updated"); return; }
  const rj = e.target.closest("[data-reject]"); if(rj){ act("/decide", {key:rj.dataset.reject, approve:false}, "Rejected, back to the rep"); return; }
  const q = e.target.closest("[data-queue]"); if(q){ openQueue(q.dataset.queue); return; }
  const aq = e.target.closest("[data-approvals]"); if(aq){ openApprovals(); return; }
  const cu = e.target.closest("[data-cunk]"); if(cu){ openList(cu.dataset.cunk, "bdr", "cunk", "Who cancelled? Nobody can tell yet (last 30 days)", last30()); return; }
});
/* ---------- team trends: stacked bars by source, any range since Jan 1 ---------- */
const TR_METRICS_ALL = [
  {id:"books", label:"Books",           f:t=>t.books.length, list:"books"},
  {id:"had",   label:"Runs had",        f:t=>t.had.length,   list:"had"},
  {id:"des",   label:"Designs created", f:t=>t.des.length,   list:"des", era:"old"},
  {id:"dheld", label:"Designs held",    f:t=>t.dheld.length, list:"dheld", era:"old"},
  {id:"desn",  label:"Moved to Design/Audit", f:t=>t.des.length, list:"des", era:"new"},
  {id:"arun",  label:"Audits run",      f:t=>t.arun.length,  list:"arun", era:"new"},
  {id:"prun",  label:"Prop reviews run", f:t=>t.prun.length, list:"prun", era:"new"},
  {id:"won",   label:"Closes",          f:t=>t.won.length,   list:"won"},
  {id:"mrr",   label:"MRR generated",   f:t=>t.cwd,          list:"won", money:true},
];
let TR_METRICS = eraPick(TR_METRICS_ALL);
// fixed colour per source (never by rank). Stack order + slots validated for colour-blind separation in light and dark.
const TR_SOURCES = [
  {key:"Brandon Cameron", name:"Brandon",     g:"bdr",     c:"var(--s1)"},
  {key:"Issa Hattar",     name:"Issa",        g:"bdr",     c:"var(--s3)"},
  {key:FORMER,            name:"Former BDRs", g:"bdr",     c:"var(--s7)"},
  {key:"Inbound",         name:"Inbound",     g:"inbound", c:"var(--s4)"},
  {key:"CloseBot AI",     name:"CloseBot",    g:"inbound", c:"var(--s5)"},
  {key:OTHER,             name:"AE-booked",   g:"other",   c:"var(--s6)"},
];
const TR_UTM = REPORTING ? [
  {utm:"Inbound - META PPC - Lead Form", c:"var(--s1)"},
  {utm:"Inbound - META PPC - VSL",       c:"var(--s2)"},
  {utm:"Inbound - META PPC - Unclear",   c:"var(--s8)"},
  {utm:"Inbound - Website Price Request", c:"var(--s3)"},
  {utm:"Inbound - Website Contact Us",    c:"var(--s4)"},
  {utm:NO_UTM_KEY,                        c:"var(--s7)"},
  {utm:"Inbound - META Organic",          c:"var(--s5)"},
  {utm:"Inbound - Google PPC",            c:"var(--s6)"},
] : [
  {utm:"Inbound - META PPC",              c:"var(--s1)"},
  {utm:"Inbound - Website Price Request", c:"var(--s2)"},
  {utm:"Inbound - Website Contact Us",    c:"var(--s3)"},
  {utm:NO_UTM_KEY,                        c:"var(--s7)"},
  {utm:"Inbound - META Organic",          c:"var(--s4)"},
  {utm:"Inbound - Google PPC",            c:"var(--s5)"},
];
function utmSeries(from, to){
  const known = new Set(TR_UTM.map(u=>u.utm));
  const rest = inboundUtms(from, to).filter(u=>!known.has(u));
  const out = TR_UTM.map(u=>({key:"utm:"+u.utm, who:INB_ALL, utm:u.utm, name:utmName(u.utm), c:u.c}));
  if(rest.length) out.push({key:"utm:other", who:INB_ALL, utm:rest, name:"Other sources", c:REPORTING ? "var(--s9)" : "var(--s6)", title:rest.map(utmName).join(", ")});
  return out;
}
const ALWAYS = new Set(["Brandon Cameron","Issa Hattar","Inbound"]);   // shown in legend/table even at zero
const trend = {metric:"books", scale:"week", group:"all", pick:"", range:"ytd", from:null, to:null, table:false};
const trVal = (v,m) => m.money ? fmt(v,true) : fmt(v);
const dOf = s => new Date(s+"T00:00:00");
function trYesterday(){ const y=new Date(); y.setHours(0,0,0,0); y.setDate(y.getDate()-1); return y; }
function trendRange(){
  const y = trYesterday(); let f, t = new Date(y);
  const qStart = d => new Date(d.getFullYear(), Math.floor(d.getMonth()/3)*3, 1);
  if(trend.range==="thisq") f = qStart(y);
  else if(trend.range==="lastq"){ const q = qStart(y); f = new Date(q.getFullYear(), q.getMonth()-3, 1); t = new Date(q); t.setDate(0); }
  else if(trend.range==="l14d"){ f = new Date(y); f.setDate(f.getDate()-13); }
  else if(trend.range==="l30d"){ f = new Date(y); f.setDate(f.getDate()-29); }
  else if(trend.range==="l8w"){ f = new Date(y); f.setDate(f.getDate()-((f.getDay()+6)%7)-49); }
  else if(trend.range==="l3m") f = new Date(y.getFullYear(), y.getMonth()-2, 1);
  else if(trend.range==="custom"){ f = trend.from ? dOf(trend.from) : dOf(DATA_FROM); t = trend.to ? dOf(trend.to) : y; }
  else f = dOf(DATA_FROM);   // "ytd" = since Jan 1 (any old saved "q3" lands here too)
  if(f < dOf(DATA_FROM)) f = dOf(DATA_FROM);
  if(t > y) t = y;
  if(t < f) t = new Date(f);
  return {f, t};
}
function trendBuckets(scale){
  const {f:from, t:to} = trendRange();
  let s = new Date(from);
  if(scale==="week"){ s.setDate(s.getDate()-((s.getDay()+6)%7)); } else if(scale==="month") s.setDate(1);
  const out = [];
  while(s<=to){
    const e = new Date(s); if(scale==="week") e.setDate(e.getDate()+6); else if(scale==="month") e.setMonth(e.getMonth()+1,0);
    const s2 = s<from ? from : s, e2 = e>to ? to : e;
    out.push({start:ymd(s2), end:ymd(e2), partial: s<from || e>to,
      weekend: scale==="day" && (s2.getDay()===0 || s2.getDay()===6),
      short: scale==="month" ? MON[s2.getMonth()] : `${MON[s2.getMonth()]} ${s2.getDate()}`,
      label: scale==="day" ? `${DOW[s2.getDay()]}, ${MON[s2.getMonth()]} ${s2.getDate()}` : scale==="week" ? `Week of ${MON[s2.getMonth()]} ${s2.getDate()}` : `${MONTHS[s2.getMonth()]} ${s2.getFullYear()}`});
    s = new Date(e); s.setDate(s.getDate()+1);
  }
  return {buckets:out, from, to};
}
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function niceStep(raw){ if(raw<=0) return 1; const p=10**Math.floor(Math.log10(raw)), f=raw/p; return (f<=1?1:f<=2?2:f<=5?5:10)*p; }
const trSources = () => TR_SOURCES.filter(s=> (trend.group==="all" || s.g===trend.group) && !(trend.group==="bdr" && trend.pick && s.key!==trend.pick));
// first-touch UTM values among inbound-booked deals in the range, most common first
function inboundUtms(from, to){
  const P = {start:ymd(from), end:ymd(to)}, n = {};
  const inb = r => !r.dropped && TR_SOURCES.some(s=>s.g==="inbound" && whoMatches(r, s.key, "bdr"));
  effShowup().filter(r=>inb(r) && (inP(r.first_slot,P) || inP(r.run_at,P))).forEach(r=>{ n[utmOf(r)]=(n[utmOf(r)]||0)+1; });
  effEvents().filter(r=>inb(r) && inP(r.at,P)).forEach(r=>{ n[utmOf(r)]=(n[utmOf(r)]||0)+0.001; });
  return Object.keys(n).sort((a,b)=>(a===NO_UTM)-(b===NO_UTM) || n[b]-n[a] || a.localeCompare(b));
}
function trPickRender(from, to){
  const wrap = document.getElementById("trPickWrap"), sel = document.getElementById("trPick");
  wrap.hidden = trend.group==="all";
  if(trend.group==="all") return;
  let opts;
  if(trend.group==="bdr"){ document.getElementById("trPickLbl").textContent = "BDR"; opts = [["","All BDRs"], ...TR_SOURCES.filter(s=>s.g==="bdr").map(s=>[s.key, s.name])]; }
  else { document.getElementById("trPickLbl").textContent = "Source"; const u = inboundUtms(from, to); if(trend.pick && !u.includes(trend.pick)) u.push(trend.pick); opts = [["","All inbound"], ...u.map(x=>[x, utmName(x)])]; }
  sel.innerHTML = opts.map(([v,l])=>`<option value="${esc(v)}"${v===trend.pick?" selected":""}>${esc(l)}</option>`).join("");
}
function renderTrends(){
  const el = document.getElementById("trend"); if(!el) return;
  const m = TR_METRICS.find(x=>x.id===trend.metric);
  document.getElementById("trMetric").innerHTML = TR_METRICS.map(x=>`<button data-tm="${x.id}" aria-pressed="${x.id===trend.metric}">${x.label}</button>`).join("");
  document.querySelectorAll("#trScale button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.s===trend.scale));
  document.querySelectorAll("#trGroup button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.g===trend.group));
  document.getElementById("trRange").value = trend.range;
  document.getElementById("trCustom").hidden = trend.range!=="custom";
  const {buckets, from, to} = trendBuckets(trend.scale);
  const fi = document.getElementById("trFrom"), ti = document.getElementById("trTo");
  fi.min = ti.min = DATA_FROM; fi.max = ti.max = ymd(trYesterday());
  if(trend.range==="custom"){ fi.value = ymd(from); ti.value = ymd(to); }
  trPickRender(from, to);
  const utmF = trend.group==="inbound" && trend.pick ? trend.pick : null;
  if(utmF) buckets.forEach(b=>{ b.utm = utmF; });
  const byUtm = trend.group==="inbound" && !trend.pick;
  const srcs = byUtm ? utmSeries(from, to) : trSources();
  const B = buckets.map(b=>{
    const v = {}; srcs.forEach(src=>{ v[src.key] = m.f(statsFor(src.who||src.key, "bdr", src.utm ? {...b, utm:src.utm} : b)); });
    return {...b, v, total: srcs.reduce((a,src)=>a+v[src.key],0)};
  });
  const used = srcs.filter(src=> (!byUtm && ALWAYS.has(src.key)) || srcs.length===1 || B.some(b=>b.v[src.key]));
  state.trendRows = B; state.trendUsed = used;
  const pickName = trend.group==="bdr" ? (TR_SOURCES.find(s=>s.key===trend.pick)||{}).name : utmF && "Inbound: "+utmName(utmF);
  const grpName = pickName || {all:"all sources", bdr:"BDRs only", inbound:"Inbound only"}[trend.group];
  document.getElementById("trSub").textContent = `${m.label}, ${grpName}, ${MON[from.getMonth()]} ${from.getDate()} to ${MON[to.getMonth()]} ${to.getDate()}, ${to.getFullYear()} · total ${trVal(B.reduce((a,b)=>a+b.total,0),m)}`;
  document.getElementById("trLegend").innerHTML = used.map(s=>`<span${s.title?` title="${esc(s.title)}"`:""}><i style="background:${s.c}"></i>${esc(s.name)}</span>`).join("");

  // geometry
  // every bar gets its total on top: full value when it fits, compact ($5k) when the bar is narrow, turned upright when even that won't fit
  const W = Math.max(320, el.clientWidth || 800), L = m.money ? 64 : 36, R = 6, Bm = 30;
  const band = (W-L-R)/Math.max(1,B.length), bw = Math.min(56, band*0.62);
  const compact = v => !m.money ? fmt(v) : v>=1000 ? "$"+(Math.round(v/100)/10).toString().replace(/[.]0$/,"")+"k" : "$"+Math.round(v);
  const totFs = band>=34 ? 12 : 10, cw = totFs*0.62;
  const full = B.map(b=>trVal(b.total,m)), fitsFull = full.every(t=>t.length*cw <= band-2);
  const totTxt = fitsFull ? full : B.map(b=>compact(b.total));
  const upright = !fitsFull && totTxt.some(t=>t.length*cw > band-2);
  const T = upright ? 14 + Math.max(0,...totTxt.map(t=>t.length))*cw : 22, H = 280 + (upright ? T-22 : 0);
  const max = Math.max(0, ...B.map(b=>b.total));
  const step = niceStep(max/4 || 1), ymax = Math.max(step, Math.ceil(max/step)*step);
  const y = v => T + (H-T-Bm) * (1 - v/ymax);
  const everyN = Math.ceil(B.length / Math.max(1, Math.floor((W-L-R)/58)));   // thin axis labels on small screens
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m.label)} by ${trend.scale}, stacked by source">`;
  for(let v=0; v<=ymax+1e-9; v+=step){
    svg += `<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"${v===0?' style="stroke:var(--muted)"':""}/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${trVal(v,m)}</text>`;
  }
  B.forEach((b,i)=>{
    const cx = L + band*i + band/2, x = cx - bw/2;
    svg += `<g class="col" data-i="${i}"><rect class="hit" x="${L+band*i}" y="${T}" width="${band}" height="${H-T-Bm}" fill="${b.weekend?"currentColor":"transparent"}"${b.weekend?' fill-opacity=".05"':""} rx="${b.weekend?0:6}"/>`;
    let acc = 0; const segs = used.filter(s=>b.v[s.key]>0);
    segs.forEach((s,k)=>{
      const y0 = y(acc), y1 = y(acc + b.v[s.key]); acc += b.v[s.key];
      const top = k===segs.length-1, gap = k>0 ? 2 : 0;          // 2px surface gap between stacked fills
      const h = Math.max(1, y0 - y1 - gap), yy = y1, r = top ? Math.min(4, h, bw/2) : 0;
      const d = `M${x},${yy+h} V${yy+r} Q${x},${yy} ${x+r},${yy} H${x+bw-r} Q${x+bw},${yy} ${x+bw},${yy+r} V${yy+h} Z`;
      svg += `<path class="seg-r" d="${d}" fill="${s.c}" opacity="${b.partial?0.55:1}" data-src="${esc(s.key)}" data-i="${i}"/>`;
    });
    if(b.total>0) svg += upright
      ? `<text class="tot" style="font-size:${totFs}px" transform="translate(${cx+totFs*0.35},${y(b.total)-4}) rotate(-90)" text-anchor="start">${totTxt[i]}</text>`
      : `<text class="tot" style="font-size:${totFs}px" x="${cx}" y="${y(b.total)-6}" text-anchor="middle">${totTxt[i]}</text>`;
    if((B.length-1-i) % everyN === 0) svg += `<text x="${cx}" y="${H-Bm+16}" text-anchor="middle">${b.short}${b.partial?"*":""}</text>`;
    svg += `</g>`;
  });
  el.innerHTML = svg + `</svg>`;

  // table view (also the accessible / exact-number view)
  const tw = document.getElementById("trTableWrap");
  tw.hidden = !trend.table;
  document.getElementById("trTableBtn").textContent = trend.table ? "Hide table" : "Show table";
  if(trend.table){
    tw.innerHTML = `<table><thead><tr><th>${esc(m.label)}</th>${B.map(b=>`<th>${b.short}${b.partial?"*":""}</th>`).join("")}<th>Total</th></tr></thead><tbody>
      ${used.map(s=>`<tr><td>${esc(s.name)}</td>${B.map((b,i)=>`<td>${b.v[s.key]?`<span class="click" data-trsrc="${esc(s.key)}" data-tri="${i}">${trVal(b.v[s.key],m)}</span>`:"0"}</td>`).join("")}<td><b>${trVal(B.reduce((a,b)=>a+b.v[s.key],0),m)}</b></td></tr>`).join("")}
      <tr><td><b>Total</b></td>${B.map(b=>`<td><b>${trVal(b.total,m)}</b></td>`).join("")}<td><b>${trVal(B.reduce((a,b)=>a+b.total,0),m)}</b></td></tr></tbody></table>`;
  }
}
function trendTip(e){
  const tip = document.getElementById("trTip"), g = e.target.closest && e.target.closest(".col");
  if(!g || !state.trendRows){ tip.style.display="none"; return; }
  const b = state.trendRows[+g.dataset.i], m = TR_METRICS.find(x=>x.id===trend.metric);
  tip.innerHTML = `<div class="h">${esc(b.label)}${b.partial?" (partial)":""}</div>` +
    [...state.trendUsed].reverse().map(s=>`<div class="r"><span><i style="background:${s.c}"></i>${esc(s.name)}</span><b>${trVal(b.v[s.key],m)}</b></div>`).join("") +
    `<div class="r t"><span>Total</span><b>${trVal(b.total,m)}</b></div>`;
  const card = tip.parentElement.getBoundingClientRect();
  tip.style.display = "block";
  let left = e.clientX - card.left + 14; if(left + tip.offsetWidth > card.width) left = e.clientX - card.left - tip.offsetWidth - 14;
  tip.style.left = Math.max(4,left)+"px"; tip.style.top = Math.max(4, e.clientY - card.top - tip.offsetHeight/2)+"px";
}
function trendOpen(srcKey, i){
  const b = state.trendRows[i], m = TR_METRICS.find(x=>x.id===trend.metric), s = state.trendUsed.find(x=>x.key===srcKey);
  if(s.utm) openList(s.who, "bdr", m.list, `Inbound, ${s.name}: ${m.label}`, {...b, utm:s.utm});
  else openList(srcKey, "bdr", m.list, `${s.name}${b.utm?" ("+utmName(b.utm)+")":""}: ${m.label}`, b);
}
document.getElementById("trMetric").onclick = e=>{ const b=e.target.closest("button[data-tm]"); if(b){ trend.metric=b.dataset.tm; renderTrends(); } };
document.getElementById("trScale").onclick = e=>{ const b=e.target.closest("button[data-s]"); if(!b) return;
  if(b.dataset.s==="day" && trend.scale!=="day" && ["ytd","q3","thisq","lastq","l3m"].includes(trend.range)) trend.range="l30d";
  trend.scale=b.dataset.s; renderTrends(); };
document.getElementById("trGroup").onclick = e=>{ const b=e.target.closest("button[data-g]"); if(b && b.dataset.g!==trend.group){ trend.group=b.dataset.g; trend.pick=""; renderTrends(); } };
document.getElementById("trPick").onchange = e=>{ trend.pick=e.target.value; renderTrends(); };
document.getElementById("trRange").onchange = e=>{ trend.range=e.target.value; if(trend.range==="custom" && !trend.from){ trend.from=DATA_FROM; trend.to=ymd(trYesterday()); } renderTrends(); };
document.getElementById("trFrom").onchange = e=>{ if(e.target.value){ trend.from=e.target.value; renderTrends(); } };
document.getElementById("trTo").onchange = e=>{ if(e.target.value){ trend.to=e.target.value; renderTrends(); } };
document.getElementById("trTableBtn").onclick = ()=>{ trend.table=!trend.table; renderTrends(); };
const trPlot = document.getElementById("trend");
trPlot.addEventListener("mousemove", trendTip);
trPlot.addEventListener("mouseleave", ()=>{ document.getElementById("trTip").style.display="none"; });
trPlot.addEventListener("click", e=>{ const p=e.target.closest("[data-src]"); if(p) trendOpen(p.dataset.src, +p.dataset.i); });
document.getElementById("trTableWrap").addEventListener("click", e=>{ const c=e.target.closest("[data-trsrc]"); if(c){ e.stopPropagation(); trendOpen(c.dataset.trsrc, +c.dataset.tri); } });
let trResize; window.addEventListener("resize", ()=>{ clearTimeout(trResize); trResize=setTimeout(renderTrends,150); });
// metrics tables: collapsed by default, each viewer's choice remembered on their device
function tableToggle(btnId, boxId, key){
  const btn = document.getElementById(btnId), box = document.getElementById(boxId);
  let open = false; try { open = localStorage.getItem(key)==="1"; } catch(e){}
  const apply = ()=>{ box.hidden = !open; btn.textContent = open ? "Hide metrics table" : "Show metrics table"; btn.setAttribute("aria-expanded", open); };
  btn.onclick = ()=>{ open = !open; try { localStorage.setItem(key, open?"1":"0"); } catch(e){} apply(); };
  apply();
}
tableToggle("bdrTableBtn", "bdrMetrics", "lb_bdr_table");
tableToggle("aeTableBtn", "aeMetrics", "lb_ae_table");
// admin-only: re-run the HubSpot pull now, then reload once the new run lands
document.getElementById("refreshBtn").onclick = async ()=>{
  const btn = document.getElementById("refreshBtn");
  const before = state.lastRun ? state.lastRun.ran_at : null;
  btn.disabled = true; btn.textContent = "Refreshing…";
  const r = await call("/refresh", {});
  if(!r.ok){ toast(r.error || "Could not start the refresh"); btn.disabled = false; btn.textContent = "Refresh now"; return; }
  toast("Pulling from HubSpot, about a minute");
  for(let i=0; i<16; i++){
    await new Promise(res=>setTimeout(res, 15000));
    await refresh();
    if(state.lastRun && state.lastRun.ran_at !== before){ toast("Numbers updated"); break; }
  }
  btn.disabled = false; btn.textContent = "Refresh now";
};
document.getElementById("closeBtn").onclick=()=>document.getElementById("dlg").close();
document.getElementById("dlgX").onclick=()=>document.getElementById("dlg").close();
// clicking the dark area outside the box also closes it
document.getElementById("dlg").addEventListener("click", e=>{ if(e.target.id==="dlg") e.target.close(); });
