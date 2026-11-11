/* Sales L10: "Compare" on the Sales process switch. Before (old process) vs After (3-call close) side by side.
   reporting.html only, loaded after lb-l10.js.
   - Call metrics (books, show rates, volume) = what happened in each date window (before = up to the day before the cutover).
   - Conversion = a cohort per process: deals whose FIRST disco was in that process (eraOf), disco run in the window,
     followed for the same number of days, and only deals that have had that many days. Same age = fair comparison. */
(() => {
  document.getElementById("eraSeg").insertAdjacentHTML("beforeend", `<button type="button" data-era="compare" aria-pressed="false">Compare before vs after</button>`);
  document.getElementById("l10Era").insertAdjacentHTML("afterend", `
  <section id="cmpSec" class="l10-sec cmp-sec">
    <div class="sec-head">
      <h2>Before vs after the 3-call close</h2>
      <div class="sc-ctl cmp-ctl">
        <label class="ib-pick">Before = <select id="cmpOld">
          <option value="same">same number of days before</option>
          <option value="8w" selected>8 weeks before</option>
          <option value="jul">since Jul 1</option></select></label>
        <label class="ib-pick">Count a step within <select id="cmpAge">
          <option value="7">7 days of the disco</option>
          <option value="14" selected>14 days of the disco</option>
          <option value="21">21 days of the disco</option>
          <option value="30">30 days of the disco</option>
          <option value="0">any time (not same-age)</option></select></label>
        <label class="ib-pick">Leads <select id="cmpSrc">
          <option value="all">All</option>
          <option value="out">Outbound (BDR)</option>
          <option value="inb">Inbound</option></select></label>
      </div>
    </div>
    <div class="sc-wrap" id="cmpTable"></div>
    <p class="sc-note" id="cmpNote"></p>
    <details class="how"><summary>How this is counted</summary><div>
      <p><b>Before</b> = the old process (Disco &rarr; Design &rarr; Prop update &rarr; Contract), <b>After</b> = the 3-call close (Disco &rarr; Design/Audit &rarr; Prop Review/Contract) from the cutover date. Pick how far back Before goes.</p>
      <p><b>Volume and show rates</b> = what happened in each date window, per week so windows of different lengths compare. Show rates use the same rules as the Scorecard (per call; 1st-time show three ways).</p>
      <p><b>Conversion</b> = deals whose first discovery call was in that process and ran in the window, one per deal. A step counts only if it happened within the chosen number of days of the disco, and only deals that have had that many days are included, so new deals aren't compared against old deals that had months to close. "Any time" drops that rule (Before will look better simply because its deals are older). Second meeting = Design held (before) or Audit run (after); proposal meeting = Prop update held or Prop review run. Small numbers swing a lot: read the "x of y" under each rate.</p>
      <p><b>Audit / prop review show rates</b> only exist for the new process (the AE tracker records no-shows); the old process didn't track design no-shows.</p>
      <p>Click any underlined number to see the deals.</p>
    </div></details>
  </section>`);
  document.querySelector('#eraSeg button[data-era="compare"]').onclick = () => {
    state.era = "compare"; try{ sessionStorage.setItem("l10-era", "compare"); }catch(e){}
    applyEra(); render();
  };
  ["cmpOld","cmpAge","cmpSrc"].forEach(id=>document.getElementById(id).onchange = renderCompare);
  document.getElementById("cmpTable").addEventListener("click", e=>{
    const b = e.target.closest("[data-cmp]"); if(!b) return;
    const x = CMP_LISTS.get(b.dataset.cmp); if(x) showDialog(x.title, x.sub, x.groups);
  });
})();

const CMP_LISTS = new Map();
const dayAdd = (ymdS, n) => { const d = new Date(ymdS+"T12:00:00"); d.setDate(d.getDate()+n); return ymd(d); };
const dayDiff = (a, b) => Math.round((Date.parse(b+"T12:00:00") - Date.parse(a+"T12:00:00"))/864e5);
const mkP = (start, end) => ({s:new Date(start+"T00:00:00"), e:new Date(end+"T00:00:00"), start, end,
  label:`${MON[+start.slice(5,7)-1]} ${+start.slice(8)} to ${MON[+end.slice(5,7)-1]} ${+end.slice(8)}`, now:new Date(end+"T00:00:00")});

function renderCompare(){
  const on = REPORTING && state.era === "compare";
  document.documentElement.classList.toggle("cmp-mode", on);
  if(!on || !state.lastRun) return;
  const yest = (() => { const d = new Date(); d.setDate(d.getDate()-1); return ymd(d); })();
  const cut = state.cutover, newDays = dayDiff(cut, yest) + 1;
  const oldSel = document.getElementById("cmpOld").value;
  const oldStart = oldSel === "jul" ? DATA_FROM : dayAdd(cut, oldSel === "same" ? -newDays : -56);
  const P = { old: mkP(oldStart < DATA_FROM ? DATA_FROM : oldStart, dayAdd(cut, -1)), new: mkP(cut, yest) };
  const age = +document.getElementById("cmpAge").value;
  const src = document.getElementById("cmpSrc").value;
  const srcOk = r => src === "all" || (src === "out" ? isOutb(r) : isLeadIn(r));
  const weeks = p => (dayDiff(p.start, p.end) + 1) / 7;

  // per-deal step index (old + new stage records)
  const idx = new Map(), add = (id, k, at, amt) => { const d = torDay(at); if(!id || !d) return; const key = String(id); if(!idx.has(key)) idx.set(key, []); idx.get(key).push({k, d, amt}); };
  const evs = effEvents().filter(e=>!e.dropped);
  evs.forEach(e=>add(e.deal_id, e.kind, e.at, Number(e.amount)||0));
  state.v2ev.forEach(e=>add(e.deal_id, e.kind, e.at));
  const STEP = {
    b2:   {kinds:["design","abook"], label:"Next meeting booked", note:"Design (before) / Design/Audit (after)"},
    h2:   {kinds:["dheld","arun"],   label:"2nd meeting held", note:"Design held / Audit run"},
    h3:   {kinds:["prop","prun"],    label:"Proposal meeting held", note:"Prop update / Prop review run"},
    con:  {kinds:["contract"],       label:"Contract sent"},
    won:  {kinds:["won"],            label:"Closed won = close rate"},
  };
  const firstStep = (id, kinds, from) => {
    const to = age ? dayAdd(from, age) : "9999-12-31";
    return (idx.get(String(id))||[]).filter(x=>kinds.includes(x.k) && x.d >= from && x.d <= to).sort((a,b)=>a.d<b.d?-1:1)[0] || null;
  };

  const col = {};
  ["old","new"].forEach(era=>{
    const p = P[era];
    const su = effShowup().filter(r=>!r.dropped && srcOk(r));
    const s = showupStats(su, p);
    const won = evs.filter(e=>e.kind==="won" && inP(e.at, p) && srcOk(e));
    const v2 = state.v2ev.filter(e=>inP(e.at, p) && srcOk(e)), k2 = k => v2.filter(e=>e.kind===k);
    // conversion cohort: first disco in this process, run in the window, old enough to have had `age` days
    const lastRun = age ? dayAdd(yest, -age) : yest;
    const cohort = onePerDeal(s.had.filter(r=>eraOf(r)===era && torDay(r.run_at) <= lastRun), r=>r.run_at);
    const steps = {};
    Object.entries(STEP).forEach(([k, st])=>{
      const yes = [], no = [];
      cohort.forEach(r=>{ const hit = firstStep(r.deal_id, st.kinds, torDay(r.run_at)); (hit ? yes : no).push(hit ? {...r, _hit:hit} : r); });
      steps[k] = {yes, no};
    });
    const wonC = steps.won.yes;
    col[era] = { p, s, won, cohort, steps, wk: weeks(p),
      mrr: won.reduce((a,e)=>a+(Number(e.amount)||0),0),
      arun:k2("arun"), ans:k2("ans"), prun:k2("prun"), pns:k2("pns"),
      days: wonC.length ? wonC.reduce((a,r)=>a+dayDiff(torDay(r.run_at), r._hit.d),0)/wonC.length : null,
      avgMrr: wonC.length ? wonC.reduce((a,r)=>a+(r._hit.amt||0),0)/wonC.length : null,
      lastRun };
  });

  CMP_LISTS.clear();
  const cell = (era, id, shown, sub, groups, title) => {
    if(groups){ CMP_LISTS.set(era+"|"+id, {title:(era==="old"?"Before: ":"After: ")+title, sub:col[era].p.label+". Click a deal name to open it in HubSpot.", groups}); }
    return `<td>${groups?`<span class="click" data-cmp="${era}|${id}">${shown}</span>`:shown}${sub?`<small>${sub}</small>`:""}</td>`;
  };
  const pt = v => v==null ? null : Math.round(v*100);
  const chg = (a, b, kind, lower) => {
    if(a==null || b==null) return `<td class="chg">–</td>`;
    let txt, d;
    if(kind==="pct"){ d = pt(b) - pt(a); txt = (d>0?"+":"")+d+" pts"; }
    else { if(!a) return `<td class="chg">–</td>`; d = (b-a)/a; txt = (d>0?"+":"")+Math.round(d*100)+"%"; }
    if(Math.abs(d) < (kind==="pct"?1:0.005)) return `<td class="chg">no change</td>`;
    const good = lower ? d < 0 : d > 0;
    return `<td class="chg ${good?"ok":"bad"}">${txt}</td>`;
  };
  const rows = [];
  const grp = t => rows.push(`<tr class="grp"><td colspan="4">${t}</td></tr>`);
  // metric row: f(era) -> {v, shown, sub, groups, title}
  const row = (label, id, f, kind, lower, note) => {
    const a = f("old"), b = f("new");
    rows.push(`<tr><td>${label}${note?`<small>${note}</small>`:""}</td>${cell("old", id, a.shown, a.sub, a.groups, label)}${cell("new", id, b.shown, b.sub, b.groups, label)}${(a.n!=null && a.n<5) || (b.n!=null && b.n<5) ? `<td class="chg">too few deals</td>` : chg(a.v, b.v, kind, lower)}</tr>`);
  };
  const perWk = (n, era) => n / col[era].wk;
  const fmt1 = v => (Math.round(v*10)/10).toLocaleString();

  grp("Volume (per week)");
  row("Books (new)", "books", e=>{ const n=col[e].s.books.length; return {v:perWk(n,e), shown:fmt1(perWk(n,e)), sub:n+" total", groups:[[null, col[e].s.books]]}; }, "n");
  row("Discos run", "had", e=>{ const n=col[e].s.had.length; return {v:perWk(n,e), shown:fmt1(perWk(n,e)), sub:n+" total", groups:[[null, col[e].s.had]]}; }, "n");
  row("Closed won (by close date)", "wonv", e=>{ const n=col[e].won.length; return {v:perWk(n,e), shown:fmt1(perWk(n,e)), sub:n+" total", groups:[[null, col[e].won]]}; }, "n", false, "includes older deals closing in the window");
  row("MRR closed", "mrr", e=>{ const m=col[e].mrr; return {v:perWk(m,e), shown:fmt(perWk(m,e), true), sub:fmt(m, true)+" total", groups:[[null, col[e].won]]}; }, "n");

  grp("Discovery show rates");
  const sOf = e => col[e].s;
  row("Overall show", "show", e=>({v:sOf(e).show, shown:pctS(sOf(e).show), sub:sOf(e).dueN?sOf(e).had.length+" of "+sOf(e).dueN+" calls":"", groups:[["Held", sOf(e).had], ["Missed calls", sOf(e).notHad]]}), "pct");
  const fGroups = e => { const s=sOf(e); return [["Held at first slot", s.f1], ["No-show at first slot", s.fall.filter(r=>!s.f1.includes(r) && !r.ahead)], ["Cancelled or moved ahead by the prospect", s.fTheirs], ["Cancelled or moved ahead by us", s.fOurs], ["Cancelled or moved ahead, who unknown", s.fUnk]]; };
  row("1st-time show (excl. our cancels)", "first", e=>({v:sOf(e).first, shown:pctS(sOf(e).first), sub:sOf(e).fdue.length?sOf(e).f1.length+" of "+sOf(e).fdue.length:"", groups:fGroups(e)}), "pct");
  row("1st-time show, all", "firstAll", e=>({v:sOf(e).firstAll, shown:pctS(sOf(e).firstAll), sub:sOf(e).fall.length?sOf(e).f1.length+" of "+sOf(e).fall.length:"", groups:fGroups(e)}), "pct");
  row("1st-time show (excl. their cancels)", "firstExT", e=>({v:sOf(e).firstExT, shown:pctS(sOf(e).firstExT), sub:sOf(e).fdueT.length?sOf(e).f1.length+" of "+sOf(e).fdueT.length:"", groups:fGroups(e)}), "pct");
  row("No-show recovery", "rec", e=>({v:sOf(e).recovery, shown:pctS(sOf(e).recovery), sub:sOf(e).rec.length?sOf(e).recBack.length+" of "+sOf(e).rec.length:"", groups:[["Missed, then held later", sOf(e).recBack], ["Missed, not held since", sOf(e).rec.filter(r=>!sOf(e).recBack.includes(r))]]}), "pct", false, "recent weeks can still recover");
  row("Showed, then DQ'd", "dq", e=>({v:sOf(e).dqRate, shown:pctS(sOf(e).dqRate), sub:sOf(e).had.length?sOf(e).hdq.length+" of "+sOf(e).had.length:"", groups:[["Showed, then DQ'd", sOf(e).hdq]]}), "pct", true);

  grp("Later meetings: show rate");
  const shRow = (label, id, run, ns) => row(label, id, e=>{
    if(e==="old") return {v:null, shown:"not tracked", sub:""};
    const r=col[e][run], n=col[e][ns], v=(r.length+n.length)?r.length/(r.length+n.length):null;
    return {v, shown:pctS(v), sub:(r.length+n.length)?r.length+" of "+(r.length+n.length):"", groups:[["Held", r], ["No-show", n]]};
  }, "pct");
  shRow("Audit show rate", "ashow", "arun", "ans");
  shRow("Prop review show rate", "pshow", "prun", "pns");

  grp(`Conversion from discos run (${age ? "within "+age+" days" : "any time"})`);
  Object.entries(STEP).forEach(([k, st])=>row("Disco → "+st.label.charAt(0).toLowerCase()+st.label.slice(1), "cv"+k, e=>{
    const x = col[e].steps[k], n = col[e].cohort.length, v = n ? x.yes.length/n : null;
    return {v, n, shown:pctS(v), sub:n?x.yes.length+" of "+n:"", groups:[["Reached it"+(age?" within "+age+" days":""), x.yes], ["Not (yet)", x.no]]};
  }, "pct", false, st.note));
  row("Days from disco to close", "days", e=>({n:col[e].steps.won.yes.length, v:col[e].days, shown:col[e].days==null?"–":fmt1(col[e].days)+" days", sub:col[e].steps.won.yes.length?"avg of "+col[e].steps.won.yes.length+" closes":""}), "n", true);
  row("MRR per close", "avgmrr", e=>({n:col[e].steps.won.yes.length, v:col[e].avgMrr, shown:col[e].avgMrr==null?"–":fmt(col[e].avgMrr, true), sub:""}), "n");

  const head = era => { const c = col[era]; return `<th>${era==="old"?"Before":"After"}<small>${c.p.label}</small><small>${era==="old"?"old process":"3-call close"}</small></th>`; };
  document.getElementById("cmpTable").innerHTML = `<table class="sc-tbl cmp-tbl"><thead><tr><th></th>${head("old")}${head("new")}<th>Change</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
  const n = col.new.cohort.length;
  document.getElementById("cmpNote").textContent = age
    ? `Conversion only includes deals whose disco ran at least ${age} days ago (after: discos up to ${col.new.lastRun}, ${n} deal${n===1?"":"s"}). With few deals, one close moves the rate a lot; the "x of y" is the real story until the After group grows.`
    : `Any time: Before deals have had weeks or months longer to move, so Before will look better on conversion. Use a day limit for a fair read.`;
}
(() => { const base = render; render = function(){ base.apply(this, arguments); renderCompare(); }; })();
