/* Sales L10 tabs (Scorecard / BDRs / Inbound / AEs / Trends / Deals). reporting.html only, loaded after lb-core.js. */
(() => {
  const tr = document.querySelector("section.tr-root");
  tr.insertAdjacentHTML("beforebegin", `
  <div class="l10-era" id="l10Era" role="group" aria-label="Sales process">
    <span class="lbl">Sales process</span>
    <div class="era-seg" id="eraSeg">
      <button type="button" data-era="all" aria-pressed="true">All deals</button>
      <button type="button" data-era="old" aria-pressed="false">Old process only (before Oct 27)</button>
      <button type="button" data-era="new" aria-pressed="false">3-call close only (from Oct 27)</button>
    </div>
    <details class="era-help"><summary>How deals are split</summary><p class="note" id="eraNote"></p></details>
  </div>
  <div class="l10-time" id="l10Time" role="group" aria-label="Time period">
    <span class="lbl">Period</span>
    <select id="gKind" aria-label="Period type">
      <option value="w">Week</option>
      <option value="m">Month</option>
      <option value="q">Quarter</option>
      <option value="ytd">Since Jan 1</option>
      <option value="custom">Custom dates…</option>
    </select>
    <div class="nav" id="gNav">
      <button type="button" id="gPrev" aria-label="Earlier">‹</button>
      <div class="period" id="gLabel" aria-live="polite"></div>
      <button type="button" id="gNext" aria-label="Later">›</button>
    </div>
    <span class="g-dates" id="gDates" hidden><input type="date" id="gFrom" aria-label="From"> to <input type="date" id="gTo" aria-label="To"></span>
    <label class="g-cmp">Compare with <select id="gCmpMode">
      <option value="">nothing</option>
      <option value="prev">the whole period before</option>
      <option value="same">the same days of the period before</option>
      <option value="custom">dates I pick…</option></select> <span id="gPrevLbl"></span></label>
    <span class="g-dates" id="gCmpDates" hidden><input type="date" id="gCf" aria-label="Compare from"> to <input type="date" id="gCt" aria-label="Compare to"></span>
    <span class="g-warn" id="gWarn"></span>
    <span class="g-hint" id="gHint"></span>
  </div>
  <nav class="l10-tabs" id="l10Tabs" role="tablist" aria-label="Sales L10 views">
    <button role="tab" data-t="sc" aria-selected="true">Scorecard</button>
    <button role="tab" data-t="pp" aria-selected="false">People</button>
    <button role="tab" data-t="tr" aria-selected="false">Trends</button>
    <button role="tab" data-t="cl" aria-selected="false">Deals</button>
    <button role="tab" data-t="cmp" aria-selected="false">Compare</button>
  </nav>
  <div class="pp-bar" id="ppBar" hidden>
    <div class="seg" id="ppSeg" role="group" aria-label="Whose numbers">
      <button data-p="bd" aria-pressed="true">BDRs</button>
      <button data-p="ax" aria-pressed="false">AEs</button>
      <button data-p="ib" aria-pressed="false">Inbound leads</button>
    </div>
    <button type="button" class="linkish" id="ppAll">Show all columns</button>
  </div>

  <section id="scSec" class="l10-sec" data-tab="sc">
    <div class="sec-head">
      <h2>Scorecard</h2>
      <div class="sc-ctl">
        <button type="button" class="linkish" id="scAll">Show all rows</button>
        <label class="ib-pick">View <select id="scView"></select></label>
        <label class="ib-pick" hidden>Range <select id="scRange">
          <option value="">Latest</option>
          <option value="q">This quarter</option>
          <option value="lq">Last quarter</option>
          <option value="ytd">Since Jan 1</option>
          <option value="custom">Custom dates…</option></select></label>
        <span class="sc-dates" id="scDates" hidden><input type="date" id="scFrom" aria-label="From"> to <input type="date" id="scTo" aria-label="To"></span>
        <div class="seg" id="scKind" role="group" aria-label="Columns">
          <button data-k="week" aria-pressed="true">Weekly</button>
          <button data-k="month" aria-pressed="false">Monthly</button>
          <button data-k="quarter" aria-pressed="false">Quarterly</button>
        </div>
        <div class="nav">
          <button type="button" id="scPrev" aria-label="Earlier">‹</button>
          <button type="button" id="scNext" aria-label="Later">›</button>
        </div>
      </div>
    </div>
    <div class="sc-wrap" id="scTable"></div>
    <p class="sc-note" id="scNote"></p>
    <details class="how"><summary>How this is counted</summary><div>
      One row per L10 metric, one column per week (Mon to Sun) or month, newest on the right. The shaded column is the period in progress: it is checked against where the goal should be by yesterday. <b>Green</b> = at or above goal, <b>red</b> = below. <b>Avg</b> = average of the finished columns shown.<br>
      <b>Dials, connects, conversations</b> come from the weekly Nooks upload (RevOps L10 tab); a week shows blank until it is uploaded. <b>Conversation → book</b> = BDR books ÷ Nooks conversations (the sheet's "complete to disco").<br>
      <b>Books</b> = new calls, counted on the day they were booked (a rebook only counts when it is booked 30+ days after the deal's last slot). <b>Runs due</b> = calls whose slot came up; <b>runs had</b> = calls that happened; <b>overall show</b> = calls held ÷ calls due, per call (a deal that no-shows and is rebooked = 2 calls due); <b>no-show recovery</b> = of deals that missed a call in the period, how many were held at a later slot (recent periods can still recover); <b>1st-time show</b> = held at the first slot ÷ new books whose first slot has passed, shown three ways: <b>excl. our cancels</b> (the headline: calls we pulled, e.g. not an MSP or DQ, are left out), <b>all</b> (nothing left out) and <b>excl. their cancels</b> (prospect cancels and reschedules before the call are left out). A booking moved before its first slot counts as a cancel. Who cancelled is decided by the who-cancelled check (open a deal and click <i>Why?</i>); <b>cancelled ahead, who unknown</b> stays in every view as a miss until someone picks ours or theirs. <b>Outbound</b> = a BDR booked it and the first touch is cold call / RTB; <b>inbound leads</b> = inbound first touch or self-booked / CloseBot, whoever booked it.<br>
      <b>AE time (slots)</b> (whole team and AE views): an AE slot = one AE + one start time that came up; it <b>ran</b> if at least one call in it was held. <b>Run rate per slot</b> = slots that ran ÷ slots that came up; <b>calls per slot</b> = calls due ÷ slots. The goal column shows the Jan 1 – Oct 4 baseline (before double booking); weeks marked <span style="color:var(--gold)">●</span> are double-booking weeks (from Oct 5). Before Oct 5, two deals on one slot means a cancelled call whose slot was rebooked but whose meeting was never marked cancelled.<br>
      Designs, designs held, diagnosis, prop updates, contracts and closes are counted on the day they happened; MRR is by close date. Click any number to see the deals.<br>
      <b>Goals</b> are weekly (monthly = ×4): per BDR 1,000 dials, 80 connects, 12 books, 8 runs had, 4 designs; per AE 20 runs, 5 designs held, 8 prop updates, 4 contracts, 2 closes, $10,750 MRR; 75% show; ratio goals from the L10 sheet (book → design 33%, run → design 50%, design → close 30%, contract → close 85%). Team goals = per-BDR goal × current BDRs.
    </div></details>
  </section>

  <section id="axSec" class="l10-sec" data-tab="ax" hidden>
    <div class="sec-head">
      <h2>AEs</h2>
      <div class="ib-ctl">
        <div class="seg" id="axKind" role="group" aria-label="Period">
          <button data-k="week" aria-pressed="false">Week</button>
          <button data-k="month" aria-pressed="true">Month</button>
          <button data-k="quarter" aria-pressed="false">Quarter</button>
        </div>
        <div class="nav">
          <button type="button" id="axPrev" aria-label="Previous period">‹</button>
          <div class="period" id="axPeriod" aria-live="polite"></div>
          <button type="button" id="axNext" aria-label="Next period">›</button>
        </div>
      </div>
    </div>
    <div class="table-wrap" id="axTable"></div>
    <div class="sec-head" style="margin:26px 0 10px">
      <div class="ib-h" style="margin:0">Trend</div>
      <div class="ib-ctl">
        <label class="ib-pick">Metric <select id="axMetric"></select></label>
        <label class="ib-pick">AE <select id="axWho"></select></label>
        <div class="seg" id="axScale" role="group" aria-label="Group by">
          <button data-s="week" aria-pressed="true">Weekly</button>
          <button data-s="month" aria-pressed="false">Monthly</button>
        </div>
      </div>
    </div>
    <div class="ax-key" id="axKey"></div>
    <div class="ax-chart" id="axChart"></div>
    <details class="how"><summary>How this is counted</summary><div>
      Each AE's numbers are the calls and deals assigned to them, whoever booked them. <b>AE slot</b> = one AE + one start time that came up; it <b>ran</b> if at least one call in it was held. <b>Run rate per slot</b> = slots that ran ÷ slots that came up: how much booked AE time turned into a conversation, the number double booking should lift. <b>Calls per slot</b> = calls due ÷ slots (1.0 = no double booking). <b>Overall show</b> = calls held ÷ calls due, per call (every slot that came up counts once); <b>no-show recovery</b> = deals that missed a call and were held at a later slot ÷ deals that missed a call; <b>1st-time show</b> = held at the first slot ÷ new books whose first slot has passed, shown three ways: <b>excl. our cancels</b> (the headline: calls we pulled, e.g. not an MSP or DQ, are left out), <b>all</b> (nothing left out) and <b>excl. their cancels</b> (prospect cancels and reschedules before the call are left out). A booking moved before its first slot counts as a cancel. Who cancelled is decided by the who-cancelled check (open a deal and click <i>Why?</i>); <b>cancelled ahead, who unknown</b> stays in every view as a miss until someone picks ours or theirs. <b>Run → design</b> = designs created ÷ runs had in the same period; <b>design → close</b> = closes ÷ designs created. The dashed line is the Jan 1 – Oct 4 average (before double booking); the shaded weeks are double booking (from Oct 5). The last point is the period in progress (hollow). Click a number or a point to see the deals.
    </div></details>
  </section>

`);
  tr.insertAdjacentHTML("afterend", `
  <section id="bdSec" class="l10-sec" data-tab="bd" hidden>
    <div class="sec-head">
      <h2>BDRs</h2>
      <div class="ib-ctl">
        <div class="seg" id="bdKind" role="group" aria-label="Period">
          <button data-k="week" aria-pressed="false">Week</button>
          <button data-k="month" aria-pressed="true">Month</button>
          <button data-k="quarter" aria-pressed="false">Quarter</button>
        </div>
        <div class="nav">
          <button type="button" id="bdPrev" aria-label="Previous period">‹</button>
          <div class="period" id="bdPeriod" aria-live="polite"></div>
          <button type="button" id="bdNext" aria-label="Next period">›</button>
        </div>
      </div>
    </div>
    <div class="ib-tiles" id="bdTiles"></div>
    <div class="ib-h">By rep</div>
    <div class="table-wrap" id="bdByRep"></div>
    <div class="sec-head" style="margin:22px 0 8px"><div class="ib-h" style="margin:0">By lead source (first touch)</div>
      <label class="ib-pick">Rep <select id="bdRep"></select></label></div>
    <div class="table-wrap" id="bdBySource"></div>
    <details class="how"><summary>How this is counted</summary><div>Every call a BDR booked (current BDRs and former BDRs), whatever the lead source. <b>Lead source</b> = the deal's first-touch UTM: cold call, RTB hit, or an inbound channel (an inbound lead a BDR converted). Pick a rep to see their sources. Inbound leads a BDR booked also appear in the Inbound section below, under "Booked by BDRs". Click any number to see the deals.</div></details>
  </section>

  <section id="ibSec" class="l10-sec" data-tab="ib" hidden>
    <div class="sec-head">
      <h2>Inbound</h2>
      <div class="ib-ctl">
        <div class="seg" id="ibWho" role="group" aria-label="Booked by">
          <button data-w="all" aria-pressed="true">All inbound leads</button>
          <button data-w="self" aria-pressed="false">Lead / CloseBot</button>
          <button data-w="bdr" aria-pressed="false">Booked by BDRs</button>
        </div>
        <div class="seg" id="ibKind" role="group" aria-label="Period">
          <button data-k="week" aria-pressed="false">Week</button>
          <button data-k="month" aria-pressed="true">Month</button>
          <button data-k="quarter" aria-pressed="false">Quarter</button>
        </div>
        <div class="nav">
          <button type="button" id="ibPrev" aria-label="Previous period">‹</button>
          <div class="period" id="ibPeriod" aria-live="polite"></div>
          <button type="button" id="ibNext" aria-label="Next period">›</button>
        </div>
      </div>
    </div>
    <div class="ib-tiles" id="ibTiles"></div>
    <div class="ib-h">By channel (first-touch UTM)</div>
    <div class="table-wrap" id="ibByChannel"></div>
    <div class="ib-h">By who booked the call</div>
    <div class="table-wrap" id="ibByPath"></div>
    <details class="how"><summary>How this is counted</summary><div><b>Inbound lead</b> = the deal's first touch is an inbound channel (form, ad, chat, organic…), or the lead booked the call themselves / through CloseBot. This includes inbound leads a BDR booked. An <b>RTB hit</b> first touch counts as outbound (it is an intent signal, not the lead reaching out). Use <b>Booked by</b> to split self-booked / CloseBot from BDR-booked. <b>Outbound calls</b> (grey) are there for comparison: cold-call and RTB leads a BDR booked. Same definitions everywhere: <b>Books</b> = new calls counted on the day they were booked; <b>Runs due</b> = calls whose slot came up; <b>Overall show</b> = calls held ÷ calls due (per call: a no-show that is rebooked and held = 2 calls, 1 held); <b>Recovery</b> = deals that missed a call and were held at a later slot ÷ deals that missed a call; <b>1st-time show</b> = held at the first slot ÷ new books whose first slot has passed, shown three ways: <b>excl. our cancels</b> (the headline: calls we pulled, e.g. not an MSP or DQ, are left out), <b>all</b> (nothing left out) and <b>excl. their cancels</b> (prospect cancels and reschedules before the call are left out). A booking moved before its first slot counts as a cancel. Who cancelled is decided by the who-cancelled check (open a deal and click <i>Why?</i>); <b>cancelled ahead, who unknown</b> stays in every view as a miss until someone picks ours or theirs. </div></details>
  </section>

  <section id="clSec" class="l10-sec" data-tab="cl" hidden>
    <div class="sec-head">
      <h2>Deals</h2>
      <div class="ib-ctl">
        <div class="seg" id="clKind" role="group" aria-label="Period">
          <button data-k="month" aria-pressed="false">Month</button>
          <button data-k="quarter" aria-pressed="true">Quarter</button>
          <button data-k="all" aria-pressed="false">Since Jan 1</button>
        </div>
        <div class="nav">
          <button type="button" id="clPrev" aria-label="Previous period">‹</button>
          <div class="period" id="clPeriod" aria-live="polite"></div>
          <button type="button" id="clNext" aria-label="Next period">›</button>
        </div>
      </div>
    </div>
    <div class="cl-panel">
      <div class="cl-row">
        <div class="seg" id="clLead" role="group" aria-label="Lead type">
          <button data-l="all" aria-pressed="true">All leads</button>
          <button data-l="Inbound" aria-pressed="false">Inbound</button>
          <button data-l="Outbound" aria-pressed="false">Outbound</button>
        </div>
        <label class="cl-f"><span>UTM</span><span class="cl-pair"><select id="clUtmMode" aria-label="Which UTM">
          <option value="first">First touch</option>
          <option value="last">Last touch</option>
          <option value="hist">History contains</option>
        </select><select id="clUtmVal" aria-label="UTM value"></select><input id="clUtmTxt" type="search" placeholder="e.g. Meta, RTB" aria-label="UTM history contains" hidden></span></label>
        <label class="cl-f"><span>Revenue band</span><span class="cl-pair"><select id="clBand" aria-label="Which revenue figure">
          <option value="self">Self-claimed</option>
          <option value="jf">JF verified</option>
        </select><select data-flt="band" aria-label="Revenue band"></select></span></label>
        <button type="button" class="linkish" id="clClear" hidden>Clear filters</button>
      </div>
      <details class="cl-more" id="clMore"><summary>More filters<span id="clMoreN"></span></summary>
      <div class="cl-row">
        <label class="cl-f"><span>Meta channel</span><select data-flt="mc"></select></label>
        <label class="cl-f"><span>Show-up confirmed</span><select data-flt="conf"></select></label>
        <label class="cl-f"><span>Pre-call VSL</span><select data-flt="vsl"></select></label>
        <label class="cl-f"><span>Audit videos</span><select data-flt="hw"></select></label>
        <label class="cl-f"><span>Audit videos watched</span><select data-flt="hwmax"></select></label>
        <label class="cl-f"><span>AE flag (asked on call)</span><select data-flt="aeflag"></select></label>
        <label class="cl-f"><span>Offer</span><select data-flt="offer"></select></label>
      </div></details>
    </div>
    <div class="ib-tiles" id="clTiles"></div>
    <div class="cl-by"><label class="cl-f cl-f-in"><span>Break down by</span><select id="clBy"></select></label></div>
    <div id="clTables"></div>
    <div class="cl-by" style="margin-top:26px"><div class="ib-h" style="margin:0">Highest to lowest closing segments</div>
      <label class="cl-f cl-f-in"><span>Min. runs</span><select id="clMin"><option value="5">5</option><option value="10" selected>10</option><option value="20">20</option></select></label></div>
    <p class="sc-note" style="margin:0 0 8px">Every segment from every breakdown above (with the current filters), ranked by close rate. Segments smaller than the minimum are left out so one lucky deal can't top the list.</p>
    <div id="clRank"></div>
    <details class="how"><summary>How this is counted</summary><div>
      <b>Runs</b> = deals whose disco was held in the period (one per deal). Each deal is followed forward: <b>Designs</b> = it reached Design / Prop Review, <b>Closes</b> = it closed won, whenever that happened. <b>Close rate</b> = closes ÷ runs (per disco run, never won ÷ lost), so recent periods keep rising as their deals close. <b>MRR</b> = closed-won amount (USD/month).<br>
      Everything else comes from the HubSpot deal, refreshed every morning. <b>Show-up confirmed</b> = replied YES to the reminder text, or clicked "I'll be there" on the thank-you or pre-call VSL page (one per deal, strongest first). <b>Pre-call VSL</b> = clicked the pre-call VSL link. <b>Audit videos</b> = the tracked pre-audit video page (6 Killers + Scaling &amp; Authority, live from Oct 27): Opened = entered their email, Started = watched part of a video, Watched = both videos 75%+. <b>Audit videos watched</b> = the most of either video. <b>AE flag</b> = what the AE recorded after asking on the call (HubSpot "Audit videos: AE flag"), kept separate from the tracking. <b>Revenue band</b> = self-claimed ARR, or JF verified ARR (the JF Verified ARR Band, else banded from the AE-entered JF Verified ARR amount; only filled on deals up to late Aug so far). <b>Offer</b> = HT / LT, set by the AE after the disco. Deals with no value get their own row, so the table always adds up to the total. Click any number to see the deals.
    </div></details>
  </section>
`);
  tr.id = "rpTrends"; tr.dataset.tab = "tr"; tr.hidden = true;
  const lg = tr.querySelector(":scope > .legend");
  lg.outerHTML = '<details class="how"><summary>How this is counted</summary><div>' + lg.innerHTML + '</div></details>';
})();
/* ---------- one time bar for every tab (11-11) ---------- */
// G.kind: w / m / q (+ offset, arrows) | ytd | custom (from/to). G.cmp = show change vs the previous period.
const G = (()=>{ const d = {kind:"m", off:0, from:"", to:"", cmp:"", cf:"", ct:""}; let g = d; try{ g = {...d, ...JSON.parse(sessionStorage.getItem("l10-time")||"{}")}; }catch(e){}
  if(g.cmp===true) g.cmp = "prev"; if(g.cmp===false) g.cmp = ""; return g; })();   // cmp: "" | "prev" (whole period before) | "same" (same days so far) | "custom" (cf..ct)
const gSave = () => { try{ sessionStorage.setItem("l10-time", JSON.stringify(G)); }catch(e){} };
const gYest = () => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-1); return ymd(d); };
const gMk = (start, end) => { const s = new Date(start+"T00:00:00"), e = new Date(end+"T00:00:00"), y = new Date(gYest()+"T00:00:00");
  const lab = d => MON[d.getMonth()]+" "+d.getDate();
  return {s, e, start, end, now:y, label: lab(s)+(start===end ? "" : " to "+lab(e))+", "+e.getFullYear()}; };
const G_KIND = {w:"week", m:"month", q:"quarter"};
function gP(){
  const y = gYest();
  if(G.kind==="ytd") return gMk(DATA_FROM, y);
  if(G.kind==="custom"){ const c = v => v < DATA_FROM ? DATA_FROM : v > y ? y : v; let a = c(G.from || DATA_FROM), b = c(G.to || y); if(a > b) [a, b] = [b, a]; return gMk(a, b); }
  return periodFor(G_KIND[G.kind], G.off);
}
// the period before. "prev" = the whole period before (Q4 so far vs all of Q3); "same" (and the Compare tab when nothing is picked) =
// a period still in progress is compared with the same number of days of the one before (Q4 Oct 1–Nov 10 vs Jul 1–Aug 10).
function gPrev(){
  const p = gP(), y = gYest();
  if(G.cmp==="custom"){ const c = v => v < DATA_FROM ? DATA_FROM : v > y ? y : v; let a = c(G.cf || DATA_FROM), b = c(G.ct || y); if(a > b) [a, b] = [b, a]; return gMk(a, b); }
  if(G.kind==="ytd") return null;
  if(G.kind==="custom"){ const n = Math.round((p.e - p.s)/864e5) + 1, e = new Date(p.s); e.setDate(e.getDate()-1); const s = new Date(e); s.setDate(s.getDate()-n+1);
    if(ymd(e) < DATA_FROM) return null; return gMk(ymd(s) < DATA_FROM ? DATA_FROM : ymd(s), ymd(e)); }
  const q = periodFor(G_KIND[G.kind], G.off-1);
  if(q.end < DATA_FROM) return null;
  if(p.end > y && G.cmp!=="prev"){ const n = Math.round((new Date(y+"T00:00:00") - p.s)/864e5); const e = new Date(q.s); e.setDate(e.getDate()+n); return gMk(q.start < DATA_FROM ? DATA_FROM : q.start, ymd(e) < q.end ? ymd(e) : q.end); }
  return q.start < DATA_FROM ? gMk(DATA_FROM, q.end) : q;
}
const gCmpOn = () => !!G.cmp && !!gPrev();
// change vs the previous period, as a small line under a number. o: {pct, money, lower}
function dl(cur, prev, o){
  if(!gCmpOn() || cur==null || prev==null || (typeof cur==="number" && isNaN(cur))) return "";
  const pctT = o && o.pct, d = cur - prev;
  if(Math.abs(d) < (pctT ? 0.005 : 0.5)) return `<small class="dlt eq" title="Previous period: ${pctT?pctS(prev):o&&o.money?fmt(prev,true):fmt(prev)}">= same</small>`;
  const good = (d > 0) !== !!(o && o.lower);
  const txt = pctT ? Math.round(Math.abs(d)*100)+" pts" : o && o.money ? fmt(Math.abs(d),true) : fmt(Math.abs(Math.round(d*10)/10));
  return `<small class="dlt ${good?"up":"dn"}" title="Previous period: ${pctT?pctS(prev):o&&o.money?fmt(prev,true):fmt(prev)}">${d>0?"▲":"▼"} ${txt}</small>`;
}
const G_HINT = {sc:"Scorecard: the columns lead up to the chosen period (Weekly / Monthly / Quarterly sets the columns). Pick “Compare with” to add a Chosen period column showing the change.", tr:"Trends: the chart covers the chosen period.",
  scCmp:"", cmp:"Compare: pick “the period in the time bar” to compare it with the one before, or choose any two ranges.", ax:"The AE trend chart below the table always shows since Jan 1."};
function gUI(){
  const p = gP(), pv = gPrev(), y = gYest(), arrows = !!G_KIND[G.kind];
  document.getElementById("gKind").value = G.kind;
  document.getElementById("gLabel").textContent = p.label + (arrows && p.end > y ? " (so far)" : "");
  document.getElementById("gPrev").disabled = !arrows || p.start <= DATA_FROM;
  document.getElementById("gNext").disabled = !arrows || G.off >= 0;
  document.getElementById("gNav").classList.toggle("no-arrows", !arrows);
  const dt = document.getElementById("gDates"); dt.hidden = G.kind!=="custom";
  if(G.kind==="custom"){ const f = document.getElementById("gFrom"), t = document.getElementById("gTo"); [f,t].forEach(el=>{ el.min = DATA_FROM; el.max = y; }); f.value = p.start; t.value = p.end; }
  document.getElementById("gCmpMode").value = G.cmp;
  document.getElementById("gPrevLbl").textContent = !G.cmp ? "" : pv ? (G.cmp==="prev" || G.cmp==="same" ? "("+pv.label+")" : "") : "(nothing earlier: data starts Jan 1)";
  document.getElementById("gCmpDates").hidden = G.cmp!=="custom";
  if(G.cmp==="custom" && pv){ const f = document.getElementById("gCf"), t = document.getElementById("gCt"); [f,t].forEach(el=>{ el.min = DATA_FROM; el.max = y; }); f.value = pv.start; t.value = pv.end; }
  let tab = (document.querySelector("#l10Tabs [aria-selected=true]")||{}).dataset?.t; if(tab==="pp") tab = PP.sub;
  document.getElementById("gHint").textContent = G_HINT[tab] || "";
  const cut = state.cutover, cutD = new Date(cut+"T12:00:00"), cutT = MON[cutD.getMonth()]+" "+cutD.getDate();
  document.getElementById("gWarn").textContent =
      state.era==="new" && p.start < cut ? "Filtered to the 3-call close: only deals whose first disco was on or after "+cutT+" are counted, so anything before that is missing. Pick “All deals” to see everything."
    : state.era==="old" && p.end >= cut ? "Filtered to the old process: deals that started on or after "+cutT+" are left out. Pick “All deals” to see everything." : "";
}
function gChanged(retrend){
  gSave(); if(retrend) G.retrend = true;
  // long ranges read better as monthly scorecard columns
  if(retrend && (G.kind==="ytd" || G.kind==="custom") && SC.kind!=="quarter"){ const p = gP(); SC.kind = (p.e - p.s)/864e5 > 120 ? "month" : "week"; }
  else if(retrend && (G.kind==="w")) SC.kind = "week";
  render();
  const tab = (document.querySelector("#l10Tabs [aria-selected=true]")||{}).dataset?.t;
  if(tab==="tr") renderTrends();
}
document.getElementById("gKind").onchange = e=>{ G.kind = e.target.value; G.off = 0;
  if(G.kind==="custom" && !G.from){ G.from = periodFor("month", -1).start; G.to = gYest(); }
  gChanged(true); };
document.getElementById("gPrev").onclick = ()=>{ G.off--; gChanged(true); };
document.getElementById("gNext").onclick = ()=>{ if(G.off<0){ G.off++; gChanged(true); } };
document.getElementById("gFrom").onchange = e=>{ if(e.target.value){ G.from = e.target.value; gChanged(true); } };
document.getElementById("gTo").onchange = e=>{ if(e.target.value){ G.to = e.target.value; gChanged(true); } };
document.getElementById("gCmpMode").onchange = e=>{ G.cmp = e.target.value;
  if(G.cmp==="custom" && !G.cf){ const q = periodFor(G_KIND[G.kind]||"month", (G.off||0)-1); G.cf = q.start < DATA_FROM ? DATA_FROM : q.start; G.ct = q.end; }
  gChanged(false); };
document.getElementById("gCf").onchange = e=>{ if(e.target.value){ G.cf = e.target.value; gChanged(false); } };
document.getElementById("gCt").onchange = e=>{ if(e.target.value){ G.ct = e.target.value; gChanged(false); } };
// Trends (lb-core) follows the time bar on the Sales L10; its own range picker is hidden here
if(REPORTING){ const base = renderTrends; renderTrends = function(){
  const p = gP(); trend.range = "custom"; trend.from = p.start; trend.to = p.end < gYest() ? p.end : gYest();
  if(G.retrend){ const n = Math.round((p.e - p.s)/864e5) + 1; trend.scale = n <= 16 ? "day" : n <= 120 ? "week" : "month"; G.retrend = false; }
  return base.apply(this, arguments); }; }
if(state.era==="compare") state.era = "all";
/* ---------- Sales process toggle buttons (applyEra lives in lb-core.js) ---------- */
document.querySelectorAll("#eraSeg button").forEach(b=>b.onclick=()=>{
  state.era = b.dataset.era; try{ sessionStorage.setItem("l10-era2", state.era); }catch(e){}
  applyEra(); render(); if(typeof renderScorecard==="function" && state.act) renderScorecard();
});
/* ---------- Sales L10: BDR + Inbound breakdowns (same table engine) ---------- */
const RTB_UTM = "Inbound - RTB Hit";
const isBdrBooked = r => !!r.booker && !NOT_A_BDR.has(r.booker) && !CUR_AE.has(r.booker);
const isInbLead = r => NOT_A_BDR.has(r.booker) || (/^Inbound - /.test(r.utm||"") && r.utm!==RTB_UTM);   // RTB hit = outbound
const repOf = r => CUR_BDR.has(r.booker) ? r.booker : FORMER;
const srcName = u => u===NO_UTM ? "No UTM" : u.replace(/^(Inbound|Outbound) - /,"");
const BK_COLS_ALL = [
  {label:"Books", core:true,           f:t=>t.books.length, list:"books"},
  {label:"Runs due",        f:t=>t.dueN,         list:"due"},
  {label:"Runs had", core:true,        f:t=>t.had.length,   list:"had"},
  {label:"Overall show", core:true,    f:t=>t.show,  pct:true, list:"due",  sub:t=>t.dueN?t.had.length+" of "+t.dueN:""},
  {label:"1st-time show (excl. our cancels)", core:true, f:t=>t.first, pct:true, list:"fdue", sub:t=>t.fdue.length?t.f1.length+" of "+t.fdue.length:""},
  {label:"1st-time show, all", f:t=>t.firstAll, pct:true, list:"fall", sub:t=>t.fall.length?t.f1.length+" of "+t.fall.length:""},
  {label:"1st-time show (excl. their cancels)", f:t=>t.firstExT, pct:true, list:"fext", sub:t=>t.fdueT.length?t.f1.length+" of "+t.fdueT.length:""},
  {label:"Showed, DQ'd",   f:t=>t.dqRate, pct:true, lower:true, list:"dq", sub:t=>t.had.length?t.hdq.length+" of "+t.had.length:""},
  {label:"No-shows",        f:t=>t.ns.length,    lower:true, list:"ns"},
  {label:"Cancelled ahead", f:t=>t.ca.length,    lower:true, list:"ca"},
  {label:"Recovery",        f:t=>t.recovery, pct:true, list:"rec", sub:t=>t.rec.length?t.recBack.length+" of "+t.rec.length:""},
  {label:"Designs", core:true,         f:t=>t.des.length,   list:"des", era:"old"},
  {label:"Design/Audit", core:true,    f:t=>t.des.length,   list:"des", era:"new"},
  {label:"Audits run", core:true,      f:t=>t.arun.length,  list:"arun", era:"new"},
  {label:"Closes", core:true,          f:t=>t.won.length,   list:"won"},
  {label:"MRR", core:true,             f:t=>t.cwd, money:true, list:"won"},
];
let BK_COLS = eraPick(BK_COLS_ALL);
const bkShown = (c,v) => c.pct ? pctS(v) : c.money ? fmt(v||0,true) : fmt(v||0);
// People tab: which group is shown + whether every column shows
const PP = (()=>{ const d = {sub:"bd", all:false}; try{ return {...d, ...JSON.parse(localStorage.getItem("l10-pp")||"{}")}; }catch(e){ return d; } })();
const ppSave = () => { try{ localStorage.setItem("l10-pp", JSON.stringify({sub:PP.sub, all:PP.all})); }catch(e){} };
const ppCol = c => PP.all || c.core;
const L10 = {
  bd: {kind:"month", offset:0, rep:"all", rows:{}},
  ib: {kind:"month", offset:0, who:"all", rows:{}},
};
// a breakdown row = {key, name, pred, cls}; its predicate is registered so statsFor / openList can use it like a person
function bkRow(sec, key, name, pred, cls){ const pk = "l10:"+sec+":"+key; PRED.set(pk, pred); const r = {key, pk, name, cls}; L10[sec].rows[key] = r; return r; }
const bkStats = (r, p) => statsFor(r.pk, "bdr", p);
function bkTable(sec, rows, p){
  const pp = gCmpOn() ? gPrev() : null;
  return `<table class="ib-tbl"><thead><tr><th></th>${BK_COLS.map(c=>ppCol(c)?`<th>${c.label}</th>`:"").join("")}</tr></thead><tbody>${rows.map(r=>{
    const t = bkStats(r, p), tp = pp ? bkStats(r, pp) : null;
    return `<tr class="${r.cls||""}"><td>${esc(r.name)}</td>${BK_COLS.map((c,i)=>!ppCol(c) ? "" : `<td><span class="click" data-bk="${sec}|${esc(r.key)}" data-bkc="${i}">${bkShown(c, c.f(t))}</span>${c.sub&&c.sub(t)?`<small>${c.sub(t)}</small>`:""}${tp?dl(c.f(t), c.f(tp), {pct:c.pct, money:c.money, lower:c.lower}):""}</td>`).join("")}</tr>`;
  }).join("") || `<tr><td class="empty" colspan="${BK_COLS.length+1}">Nothing in this period.</td></tr>`}</tbody></table>`;
}
function bkTiles(sec, row, bench, benchName, p){
  const a = bkStats(row, p), b = bkStats(bench, p), pp = gCmpOn() ? gPrev() : null, q = pp ? bkStats(row, pp) : null;
  const ci = lbl => BK_COLS.findIndex(c=>c.label===lbl);
  const tile = (k,v,sub,lbl,d) => `<div class="ib-tile"><div class="k">${k}</div><div class="v"><span class="click" data-bk="${sec}|${row.key}" data-bkc="${ci(lbl)}">${v}</span></div>${d||""}<div class="s">${sub}</div></div>`;
  const D = (f, o) => q ? dl(f(a), f(q), o) : "";
  return tile("Books (new)", fmt(a.books.length), benchName+" "+fmt(b.books.length), "Books", D(t=>t.books.length)) +
    tile("Runs had", fmt(a.had.length), "of "+a.dueN+" calls due", "Runs had", D(t=>t.had.length)) +
    tile("Overall show", pctS(a.show), benchName+" "+pctS(b.show), "Overall show", D(t=>t.show, {pct:true})) +
    tile("1st-time show (excl. our cancels)", pctS(a.first), "all "+pctS(a.firstAll)+" · excl. theirs "+pctS(a.firstExT)+" · "+benchName+" "+pctS(b.first), "1st-time show (excl. our cancels)", D(t=>t.first, {pct:true})) +
    tile("Showed, DQ'd", pctS(a.dqRate), benchName+" "+pctS(b.dqRate), "Showed, DQ'd", D(t=>t.dqRate, {pct:true, lower:true})) +
    tile("Closes", fmt(a.won.length), benchName+" "+fmt(b.won.length), "Closes", D(t=>t.won.length)) +
    tile("MRR", fmt(a.cwd,true), benchName+" "+fmt(b.cwd,true), "MRR", D(t=>t.cwd, {money:true}));
}
// first-touch sources seen on records matching pred in the period, busiest first, "No UTM" last
function bkSources(pred, p){
  const n = {}, add = r => { const u = utmOf(r); n[u] = (n[u]||0) + 1; };
  effShowup().filter(r=>!r.dropped && pred(r) && (inP(r.booked_at,p) || inP(r.first_slot,p) || inP(r.run_at,p) || (r.due_ts||[]).some(t=>inP(t,p)))).forEach(add);
  effEvents().filter(r=>!r.dropped && pred(r) && inP(r.at,p)).forEach(add);
  return Object.keys(n).sort((a,b)=>((a===NO_UTM)-(b===NO_UTM)) || (n[b]-n[a]) || a.localeCompare(b));
}
function bkPeriodUI(sec){
  const st = L10[sec], p = gP();   // the time bar decides the period
  document.getElementById(sec+"Period").textContent = p.label;
  document.querySelectorAll("#"+sec+"Kind button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.k===st.kind));
  document.getElementById(sec+"Prev").disabled = p.start <= DATA_FROM;
  document.getElementById(sec+"Next").disabled = st.offset >= 0;
  return p;
}
function renderBdrBreakdown(){
  const st = L10.bd; st.rows = {};
  const p = bkPeriodUI("bd");
  const team = bkRow("bd", "team", "BDR team", isBdrBooked, "tot");
  const reps = [...BDRS.map(b=>bkRow("bd", b.key, b.name, r=>isBdrBooked(r) && r.booker===b.key)),
                bkRow("bd", "former", "Former BDRs", r=>isBdrBooked(r) && !CUR_BDR.has(r.booker))];
  const shown = reps.filter(r=>r.key!=="former" || formerHasData(bkStats(r,p)));
  const inb = bkRow("bd", "inb", "Inbound (lead / CloseBot)", r=>NOT_A_BDR.has(r.booker), "bench");
  document.getElementById("bdTiles").innerHTML = bkTiles("bd", team, inb, "Inbound", p);
  document.getElementById("bdByRep").innerHTML = bkTable("bd", [...shown, team, inb], p);
  // rep picker (keeps the choice while it is still on the list)
  const sel = document.getElementById("bdRep");
  const opts = [["all","All BDRs"], ...shown.map(r=>[r.key, r.name])];
  if(!opts.some(o=>o[0]===st.rep)) st.rep = "all";
  sel.innerHTML = opts.map(([v,l])=>`<option value="${esc(v)}"${v===st.rep?" selected":""}>${esc(l)}</option>`).join("");
  const base = st.rep==="all" ? team : reps.find(r=>r.key===st.rep);
  const srcRows = bkSources(PRED.get(base.pk), p).map(u=>bkRow("bd", "src:"+u, srcName(u)+(/^Inbound - /.test(u)&&u!==RTB_UTM?" (inbound lead)":""), r=>PRED.get(base.pk)(r) && utmOf(r)===u));
  const tot = bkRow("bd", "srctot", (st.rep==="all"?"All BDRs":base.name)+": all sources", PRED.get(base.pk), "tot");
  document.getElementById("bdBySource").innerHTML = bkTable("bd", srcRows.length ? [...srcRows, tot] : [], p);
}
function renderInboundBreakdown(){
  const st = L10.ib; st.rows = {};
  const p = bkPeriodUI("ib");
  document.querySelectorAll("#ibWho button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.w===st.who));
  const whoOk = st.who==="self" ? (r=>NOT_A_BDR.has(r.booker)) : st.who==="bdr" ? isBdrBooked : (r=>NOT_A_BDR.has(r.booker) || isBdrBooked(r));
  const whoName = {all:"All inbound leads", self:"Inbound: lead / CloseBot", bdr:"Inbound leads booked by BDRs"}[st.who];
  const base = r => isInbLead(r) && whoOk(r);
  const all = bkRow("ib", "all", whoName, base, "tot");
  const out = bkRow("ib", "out", "Outbound calls (for comparison)", r=>isBdrBooked(r) && !isInbLead(r), "bench");
  document.getElementById("ibTiles").innerHTML = bkTiles("ib", all, out, "Outbound", p);
  const srcs = bkSources(base, p), nMeta = srcs.filter(u=>u.startsWith(META_UTM)).length;
  const ch = srcs.flatMap(u=>[...(nMeta>1 && u===srcs.find(x=>x.startsWith(META_UTM)) ? [bkRow("ib", "ch:metaall", "META PPC (all)", r=>base(r) && r.utm===META_UTM, "tot")] : []),
    bkRow("ib", "ch:"+u, srcName(u), r=>base(r) && utmOf(r)===u)]);
  document.getElementById("ibByChannel").innerHTML = bkTable("ib", ch.length ? [...ch, all, out] : [], p);
  const paths = [bkRow("ib", "self", "Lead booked themselves", r=>isInbLead(r) && r.booker==="Inbound"),
                 bkRow("ib", "cb", "CloseBot", r=>isInbLead(r) && r.booker==="CloseBot AI"),
                 ...BDRS.map(b=>bkRow("ib", "p:"+b.key, "Booked by "+b.name.split(" ")[0], r=>isInbLead(r) && r.booker===b.key)),
                 bkRow("ib", "p:former", "Booked by former BDRs", r=>isInbLead(r) && isBdrBooked(r) && !CUR_BDR.has(r.booker))]
    .filter(r=>r.key!=="p:former" || formerHasData(bkStats(r,p)));
  const allLeads = bkRow("ib", "allleads", "All inbound leads", r=>isInbLead(r) && (NOT_A_BDR.has(r.booker) || isBdrBooked(r)), "tot");
  document.getElementById("ibByPath").innerHTML = bkTable("ib", [...paths, allLeads], p);
}
function renderL10(){
  if(!document.getElementById("bdSec")) return;
  gUI();
  for(const k of [...PRED.keys()]) if(k.startsWith("l10:")) PRED.delete(k);
  renderScorecard(); renderBdrBreakdown(); renderInboundBreakdown(); renderAEs(); renderCloses();
}
for(const sec of ["bd","ib"]){
  const st = L10[sec], draw = sec==="bd" ? renderBdrBreakdown : renderInboundBreakdown;
  document.querySelectorAll("#"+sec+"Kind button").forEach(b=>b.onclick=()=>{ st.kind=b.dataset.k; st.offset=0; draw(); });
  document.getElementById(sec+"Prev").onclick = ()=>{ st.offset--; draw(); };
  document.getElementById(sec+"Next").onclick = ()=>{ if(st.offset<0){ st.offset++; draw(); } };
  document.getElementById(sec+"Sec").addEventListener("click", e=>{
    const c = e.target.closest("[data-bk]"); if(!c) return;
    const [s2, key] = c.dataset.bk.split("|"); const r = L10[s2].rows[key], col = BK_COLS[+c.dataset.bkc]; if(!r || !col) return;
    openList(r.pk, "bdr", col.list, r.name+": "+col.label, gP());
  });
}
document.querySelectorAll("#ibWho button").forEach(b=>b.onclick=()=>{ L10.ib.who=b.dataset.w; renderInboundBreakdown(); });
document.getElementById("bdRep").onchange = e=>{ L10.bd.rep = e.target.value; renderBdrBreakdown(); };
/* ---------- Sales L10: Deals tab (close rate per disco run, filtered + broken down by deal attributes) ---------- */
// Cohort = deals whose disco was held in the period (one per deal); each is followed forward to design / close, whenever that happened.
// Attributes come from lb_auto_deal_attr (n8n GFmBhA4xG16yAgWS, daily 8:30am): lead type, UTMs, show-up confirmation, VSL click, audit video %, ARR band.
const CL = {kind:"quarter", offset:0, lead:"all", utmMode:"first", utmVal:"", utmTxt:"", band:"self", by:"conf", flt:{}, rows:{}};
const UNK = "(no value)";
const BANDS = ["<$250k","$250k-$500K","$500k-$750K","$750k-$1.2M","$1.2M-$3M","$3M-$5M","$5M-$10M","$3M-$10M","$10M+"];
const WATCH = ["75%+","50–74%","25–49%","Under 25%","Not watched"];
const pctBand = v => { const n = Number(v)||0; return n>=75 ? "75%+" : n>=50 ? "50–74%" : n>=25 ? "25–49%" : n>0 ? "Under 25%" : "Not watched"; };
// JF Verified ARR Band: picked by the AE, else stamped daily from the call transcript
const jfBand = a => a.jf_verified_arr_band;
// every dimension can be a breakdown; the ones with filter:true also get a dropdown in the filter bar
const CL_DIMS = [
  {id:"conf", title:"Show-up confirmed", filter:true, order:["Replied YES to the reminder text","Clicked \"I'll be there\" (thank-you page)","Clicked \"I'll be there\" (pre-call VSL page)","Tapped Confirm via Text, no YES","No confirmation"],
    f:a => a.showup_confirmed_replied_yes==="Yes" ? "Replied YES to the reminder text" : a.showup_confirmed_thankyou_page==="Yes" ? "Clicked \"I'll be there\" (thank-you page)"
      : a.showup_confirmed_vsl_page==="Yes" ? "Clicked \"I'll be there\" (pre-call VSL page)" : a.showup_thankyou_text_clicked==="Yes" ? "Tapped Confirm via Text, no YES" : "No confirmation"},
  {id:"vsl", title:"Pre-call VSL link", filter:true, order:["Clicked","Not clicked"], f:a => a.precall_vsl_link_clicked==="Yes" ? "Clicked" : "Not clicked"},
  {id:"hw", title:"Audit videos", filter:true, order:["Watched (both 75%+)","Started","Opened (entered email)","Not opened"],
    f:a => ({watched:"Watched (both 75%+)", started:"Started", opted_in:"Opened (entered email)"})[a.video_homework_status] || "Not opened"},
  {id:"hwmax", title:"Audit videos watched (most of either)", filter:true, order:WATCH,
    f:a => pctBand(Math.max(Number(a.video_6_killers_watch_pct)||0, Number(a.video_scaling_authority_watch_pct)||0))},
  {id:"aeflag", title:"Audit videos: AE flag", filter:true, order:["Watched both","Watched 6 Killers only","Watched Scaling & Authority only","Started, did not finish","Did not watch","Not flagged"],
    f:a => ({watched_both:"Watched both", watched_6_killers:"Watched 6 Killers only", watched_scaling:"Watched Scaling & Authority only", partial:"Started, did not finish", not_watched:"Did not watch"})[a.audit_videos_ae_flag] || "Not flagged"},
  {id:"k6", title:"6 Killers watched", order:WATCH, f:a => pctBand(a.video_6_killers_watch_pct)},
  {id:"sa", title:"Scaling & Authority watched", order:WATCH, f:a => pctBand(a.video_scaling_authority_watch_pct)},
  {id:"band", title:"Revenue band", filter:true, order:[...BANDS, UNK], f:a => String((CL.band==="jf" ? jfBand(a) : a.self_claimed_msp_arr) || UNK).split(";")[0]},
  {id:"offer", title:"Offer", filter:true, order:["High ticket (HT)","Low ticket (LT)","Not set"], f:a => ({ht:"High ticket (HT)", lt:"Low ticket (LT)"})[a.offer] || "Not set"},
  // Meta PPC deals labelled from the booking note by n8n 5vpYcV7EhNRUzi6X (HubSpot deal property meta_lead_channel), hourly
  {id:"mc", title:"Meta channel", filter:true, order:["Meta Lead Form","Meta VSL","Meta, unclear","Meta, not labelled yet","Not Meta PPC"],
    f:a => ({lead_form:"Meta Lead Form", vsl:"Meta VSL", unclear:"Meta, unclear"})[a.meta_lead_channel]
      || (a.utm_first_touch==="Inbound - META PPC" || a.utm_last_touch==="Inbound - META PPC" ? "Meta, not labelled yet" : "Not Meta PPC")},
  {id:"lead", title:"Lead type", order:["Inbound","Outbound",UNK], f:a => a.lead_type__outbound_inbound_ || UNK},
  {id:"utm1", title:"First-touch UTM", order:null, f:a => a.utm_first_touch || UNK},
  {id:"utml", title:"Last-touch UTM", order:null, f:a => a.utm_last_touch || UNK},
];
const dimOf = id => CL_DIMS.find(d=>d.id===id);
function clPeriod(){
  if(REPORTING) return gP();
  if(CL.kind==="all"){ const y = new Date(); y.setHours(0,0,0,0); y.setDate(y.getDate()-1); return {start:DATA_FROM, end:ymd(y), label:"Jan 1 to "+MON[y.getMonth()]+" "+y.getDate()+", "+y.getFullYear()}; }
  return periodFor(CL.kind, CL.offset);
}
// one cohort row per deal: the held disco, plus that deal's design / close events (any date)
function clCohort(p){
  const ev = effEvents().filter(e=>!e.dropped);
  const byDeal = k => { const m = new Map(); ev.filter(e=>e.kind===k).forEach(e=>{ if(!m.has(e.deal_id)) m.set(e.deal_id, e); }); return m; };
  const des = byDeal("design"), won = byDeal("won");
  const seen = new Set(), out = [];
  effShowup().filter(r=>!r.dropped && r.run_at && inP(r.run_at, p) && eraOk(r)).sort((a,b)=>Date.parse(a.run_at)-Date.parse(b.run_at)).forEach(r=>{
    if(seen.has(r.deal_id)) return; seen.add(r.deal_id);
    out.push({run:r, a:attrOf(r.deal_id), des:des.get(r.deal_id)||null, won:won.get(r.deal_id)||null});
  });
  return out;
}
// skip = a filter id to ignore (so each dropdown's counts reflect the other filters)
function clFilter(rows, skip){
  return rows.filter(x=>{
    const a = x.a;
    if(CL.lead!=="all" && a.lead_type__outbound_inbound_!==CL.lead) return false;
    if(skip!=="utm"){
      if(CL.utmMode==="hist"){ const q = CL.utmTxt.trim().toLowerCase(); if(q && !String(a.utm_history||"").toLowerCase().includes(q)) return false; }
      else if(CL.utmVal){ const v = (CL.utmMode==="last" ? a.utm_last_touch : a.utm_first_touch) || UNK; if(v!==CL.utmVal) return false; }
    }
    for(const [id, v] of Object.entries(CL.flt)) if(v && id!==skip && dimOf(id).f(a)!==v) return false;
    return true;
  });
}
const clStats = rows => { const d = rows.filter(x=>x.des), w = rows.filter(x=>x.won); const mrr = w.reduce((s,x)=>s+(Number(x.won.amount)||0),0);
  return {rows, n:rows.length, d, w, mrr, rate: rows.length ? w.length/rows.length : null, drate: rows.length ? d.length/rows.length : null}; };
const CL_COLS_ALL = [
  {label:"Runs", f:t=>fmt(t.n), list:"runs"},
  {label:"Designs", core:true, f:t=>fmt(t.d.length), list:"des", era:"old"},
  {label:"Run → design", f:t=>pctS(t.drate), list:"des", era:"old"},
  {label:"Design/Audit", core:true, f:t=>fmt(t.d.length), list:"des", era:"new"},
  {label:"Run → Design/Audit", f:t=>pctS(t.drate), list:"des", era:"new"},
  {label:"Closes", core:true, f:t=>fmt(t.w.length), list:"won"},
  {label:"Close rate", f:t=>pctS(t.rate), list:"won", sub:t=>t.n ? t.w.length+" of "+t.n : ""},
  {label:"MRR", f:t=>fmt(t.mrr,true), list:"won"},
];
let CL_COLS = eraPick(CL_COLS_ALL);
const clKeys = (dim, g) => { const keys = dim.order ? dim.order.filter(k=>g.has(k)) : [...g.keys()].sort((a,b)=>((a===UNK)-(b===UNK)) || g.get(b).length-g.get(a).length || a.localeCompare(b));
  [...g.keys()].forEach(k=>{ if(!keys.includes(k)) keys.push(k); }); return keys; };   // any value not in the fixed order still shows
const groupBy = (dim, rows) => { const g = new Map(); rows.forEach(x=>{ const k = dim.f(x.a); if(!g.has(k)) g.set(k, []); g.get(k).push(x); }); return g; };
function clTable(dim, rows){
  const g = groupBy(dim, rows), keys = clKeys(dim, g);
  const maxRate = Math.max(0.0001, ...keys.map(k=>{ const s = clStats(g.get(k)); return s.n>=3 ? s.rate||0 : 0; }));
  const tr = (key, name, list, cls) => { const t = clStats(list); CL.rows[key] = {name, list};
    return `<tr class="${cls||""}"><td>${esc(name===UNK?"No value":name)}</td>${CL_COLS.map((c,i)=>`<td><span class="click" data-cl="${esc(key)}" data-clc="${i}">${c.f(t)}</span>${c.sub&&c.sub(t)?`<small>${c.sub(t)}</small>`:""}</td>`).join("")}<td class="cl-bc">${cls!=="tot"&&t.n?`<div class="cl-bar" style="width:${Math.round(100*(t.rate||0)/maxRate)}%;opacity:${t.n<3?.35:1}" title="Close rate ${pctS(t.rate)}${t.n<3?" (fewer than 3 runs)":""}"></div>`:""}</td></tr>`; };
  const body = keys.map(k=>tr(dim.id+"|"+k, k, g.get(k))).join("") + tr(dim.id+"|__tot", "Total", rows, "tot");
  return `<div class="table-wrap"><table class="ib-tbl cl-tbl"><thead><tr><th>${esc(dim.title)}</th>${CL_COLS.map(c=>`<th>${c.label}</th>`).join("")}<th aria-label="Close rate bar"></th></tr></thead><tbody>${rows.length?body:`<tr><td class="empty" colspan="${CL_COLS.length+2}">No runs match these filters.</td></tr>`}</tbody></table></div>`;
}
// every segment of every breakdown (minus the ones a filter already pins down), ranked by close rate
function clRank(rows){
  const min = +document.getElementById("clMin").value || 10, all = [];
  CL_DIMS.filter(d=>!CL.flt[d.id] && !(d.id==="lead" && CL.lead!=="all") && !(d.id==="utm1" && CL.utmMode==="first" && CL.utmVal) && !(d.id==="utml" && CL.utmMode==="last" && CL.utmVal))
    .forEach(d=>groupBy(d, rows).forEach((list, k)=>{ const t = clStats(list); if(t.n >= min) all.push({d, k, t, list}); }));
  all.sort((a,b)=>(b.t.rate-a.t.rate) || (b.t.n-a.t.n));
  if(!all.length) return `<p class="sc-note">No segment has ${min}+ runs with these filters. Lower the minimum or widen the period.</p>`;
  const top = Math.max(0.0001, all[0].t.rate || 0), base = clStats(rows).rate;
  const body = all.map((x,i)=>{ const key = "rank|"+x.d.id+"|"+x.k; CL.rows[key] = {name:x.d.title+": "+(x.k===UNK?"No value":x.k), list:x.list};
    const cells = [fmt(x.t.n), fmt(x.t.w.length), pctS(x.t.rate), fmt(x.t.mrr,true)], ci = [0,3,4,5];
    const vs = base==null || x.t.rate==null ? "" : x.t.rate > base ? "above" : x.t.rate < base ? "below" : "";
    return `<tr><td class="cl-rk">${i+1}</td><td class="cl-seg"><span class="cl-dim">${esc(x.d.title)}</span>${esc(x.k===UNK?"No value":x.k)}</td>${cells.map((v,j)=>`<td><span class="click" data-cl="${esc(key)}" data-clc="${ci[j]}">${v}</span>${j===2&&x.t.n?`<small>${x.t.w.length} of ${x.t.n}</small>`:""}</td>`).join("")}<td class="cl-bc"><div class="cl-bar${vs==="below"?" lo":""}" style="width:${Math.round(100*(x.t.rate||0)/top)}%" title="${vs?vs+" the "+pctS(base)+" average":""}"></div></td></tr>`; }).join("");
  return `<div class="table-wrap"><table class="ib-tbl cl-tbl"><thead><tr><th>#</th><th class="cl-seg">Segment</th><th>Runs</th><th>Closes</th><th>Close rate</th><th>MRR</th><th aria-label="Close rate bar"></th></tr></thead><tbody>${body}</tbody></table></div>
    <p class="sc-note">Average for these runs: ${pctS(base)}. Bars in grey are below it. A deal appears once per breakdown, so segments overlap.</p>`;
}
function clOptions(sel, values, cnt, cur, anyLabel){
  sel.innerHTML = `<option value="">${anyLabel||"Any"}</option>` + values.map(v=>`<option value="${esc(v)}"${v===cur?" selected":""}>${esc(v===UNK?"No value":v)} (${cnt[v]||0})</option>`).join("");
}
function renderCloses(){
  if(!document.getElementById("clSec")) return;
  const p = clPeriod();
  document.getElementById("clPeriod").textContent = p.label;
  document.querySelectorAll("#clKind button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.k===CL.kind));
  document.querySelectorAll("#clLead button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.l===CL.lead));
  document.getElementById("clPrev").disabled = CL.kind==="all" || p.start <= DATA_FROM;
  document.getElementById("clNext").disabled = CL.kind==="all" || CL.offset >= 0;
  const cohort = clCohort(p);
  // UTM picker: values left after the other filters, busiest first
  const hist = CL.utmMode==="hist";
  document.getElementById("clUtmTxt").hidden = !hist; document.getElementById("clUtmVal").hidden = hist;
  if(!hist){
    const base = clFilter(cohort, "utm"), cnt = {};
    base.forEach(x=>{ const v = (CL.utmMode==="last" ? x.a.utm_last_touch : x.a.utm_first_touch) || UNK; cnt[v] = (cnt[v]||0)+1; });
    const vals = Object.keys(cnt).sort((a,b)=>((a===UNK)-(b===UNK)) || cnt[b]-cnt[a] || a.localeCompare(b));
    if(CL.utmVal && !vals.includes(CL.utmVal)) vals.push(CL.utmVal);
    clOptions(document.getElementById("clUtmVal"), vals, cnt, CL.utmVal, "Any UTM");
  }
  // attribute dropdowns (counts = runs left after the other filters)
  document.querySelectorAll("#clSec select[data-flt]").forEach(sel=>{
    const dim = dimOf(sel.dataset.flt), g = groupBy(dim, clFilter(cohort, dim.id)), cnt = {};
    g.forEach((v,k)=>cnt[k]=v.length);
    const keys = clKeys(dim, g); const cur = CL.flt[dim.id]||""; if(cur && !keys.includes(cur)) keys.push(cur);
    clOptions(sel, keys, cnt, cur);
  });
  const filtered = !!(CL.lead!=="all" || CL.utmVal || (hist && CL.utmTxt.trim()) || Object.values(CL.flt).some(Boolean));
  document.getElementById("clClear").hidden = !filtered;
  const moreOn = Object.entries(CL.flt).filter(([k,v])=>v && k!=="band").length;
  document.getElementById("clMoreN").textContent = moreOn ? " ("+moreOn+" on)" : "";
  const rows = clFilter(cohort), t = clStats(rows);
  CL.rows = {}; CL.rows["__all"] = {name:"All runs shown", list:rows};
  const pp = gCmpOn() ? gPrev() : null, tq = pp ? clStats(clFilter(clCohort(pp))) : null;
  const D = (f, o) => tq ? dl(f(t), f(tq), o) : "";
  const tile = (k, v, s, ci, d) => `<div class="ib-tile"><div class="k">${k}</div><div class="v"><span class="click" data-cl="__all" data-clc="${ci}">${v}</span></div>${d||""}<div class="s">${s}</div></div>`;
  document.getElementById("clTiles").innerHTML =
    tile("Discos run", fmt(t.n), filtered ? "of "+cohort.length+" before filters" : "deals, one per deal", 0, D(x=>x.n)) +
    tile("Designs", fmt(t.d.length), pctS(t.drate)+" of runs", 1, D(x=>x.d.length)) +
    tile("Closes", fmt(t.w.length), "won, any date after", 3, D(x=>x.w.length)) +
    tile("Close rate", pctS(t.rate), "closes ÷ runs", 4, D(x=>x.rate, {pct:true})) +
    tile("MRR", fmt(t.mrr,true), t.w.length ? "avg "+fmt(t.mrr/t.w.length,true)+" per close" : "USD/month", 5, D(x=>x.mrr, {money:true}));
  const by = document.getElementById("clBy");
  by.innerHTML = CL_DIMS.map(d=>`<option value="${d.id}"${d.id===CL.by?" selected":""}>${esc(d.title)}</option>`).join("");
  const unseen = rows.filter(x=>!state.attrs || !state.attrs.has(String(x.run.deal_id))).length;
  document.getElementById("clTables").innerHTML = clTable(dimOf(CL.by), rows)
    + (unseen ? `<p class="sc-note">${unseen} deal${unseen>1?"s":""} not yet read from HubSpot: shown as "No value" / "Not clicked" until the next morning refresh.</p>` : "");
  document.getElementById("clRank").innerHTML = clRank(rows);
}
function clOpen(key, ci){
  const r = CL.rows[key], c = CL_COLS[ci]; if(!r || !c) return;
  const list = r.list, p = clPeriod();
  const groups = c.list==="runs" ? [["Discos run", list.map(x=>x.run)]]
    : c.list==="des" ? [["Reached Design", list.filter(x=>x.des).map(x=>x.des)], ["Ran, no design yet", list.filter(x=>!x.des).map(x=>x.run)]]
    : [["Closed won", list.filter(x=>x.won).map(x=>x.won)], ["Ran, not closed (yet)", list.filter(x=>!x.won).map(x=>x.run)]];
  showDialog((r.name===UNK?"No value":r.name)+": "+c.label, `Deals whose disco was held ${p.label}. Click a deal name to open it in HubSpot.`, groups);
}
document.querySelectorAll("#clKind button").forEach(b=>b.onclick=()=>{ CL.kind=b.dataset.k; CL.offset=0; renderCloses(); });
document.querySelectorAll("#clLead button").forEach(b=>b.onclick=()=>{ CL.lead=b.dataset.l; renderCloses(); });
document.getElementById("clPrev").onclick = ()=>{ CL.offset--; renderCloses(); };
document.getElementById("clNext").onclick = ()=>{ if(CL.offset<0){ CL.offset++; renderCloses(); } };
document.getElementById("clUtmMode").onchange = e=>{ CL.utmMode=e.target.value; CL.utmVal=""; renderCloses(); };
document.getElementById("clUtmVal").onchange = e=>{ CL.utmVal=e.target.value; renderCloses(); };
document.getElementById("clUtmTxt").oninput = e=>{ CL.utmTxt=e.target.value; clearTimeout(CL.tm); CL.tm=setTimeout(renderCloses, 250); };
document.getElementById("clBand").onchange = e=>{ CL.band=e.target.value; CL.flt.band=""; renderCloses(); };
document.querySelectorAll("#clSec select[data-flt]").forEach(sel=>sel.onchange=()=>{ CL.flt[sel.dataset.flt]=sel.value; renderCloses(); });
document.getElementById("clBy").onchange = e=>{ CL.by=e.target.value; renderCloses(); };
document.getElementById("clMin").onchange = ()=>renderCloses();
document.getElementById("clClear").onclick = ()=>{ CL.lead="all"; CL.utmVal=""; CL.utmTxt=""; document.getElementById("clUtmTxt").value=""; CL.flt={}; renderCloses(); };
document.getElementById("clSec").addEventListener("click", e=>{ const c = e.target.closest("[data-cl]"); if(c) clOpen(c.dataset.cl, +c.dataset.clc); });
/* ---------- Sales L10: scorecard (one row per L10 metric, one column per week / month) ---------- */
const SC = {kind:"week", shift:0, view:"team", cols:[], range:"", from:"", to:"",
  open:(()=>{ try{ return new Set(JSON.parse(localStorage.getItem("l10-sc-open")||"[]")); }catch(e){ return new Set(); } })()};   // scorecard groups shown in full
const scSaveOpen = () => { try{ localStorage.setItem("l10-sc-open", JSON.stringify([...SC.open])); }catch(e){} };
const SC_N = {week:8, month:6, quarter:4};
const scHead = (s, e, clipped) => SC.kind==="week" ? [MON[s.getMonth()]+" "+s.getDate(), "to "+(e.getMonth()===s.getMonth()?e.getDate():MON[e.getMonth()]+" "+e.getDate())]
  : SC.kind==="quarter" ? ["Q"+(Math.floor(s.getMonth()/3)+1), clipped ? MON[s.getMonth()]+" "+s.getDate()+"–"+MON[e.getMonth()]+" "+e.getDate() : String(s.getFullYear())]
  : [MONTHS[s.getMonth()], clipped ? s.getDate()+"–"+e.getDate() : String(s.getFullYear())];
const isOutb = r => isBdrBooked(r) && !isInbLead(r);
const isLeadIn = r => isInbLead(r) && (NOT_A_BDR.has(r.booker) || isBdrBooked(r) || CUR_AE.has(r.booker) || !r.booker);
// views: who the numbers are for. key = person key for statsFor/openList, nooks = which BDRs' activity counts
function scViews(){
  const v = [
    {id:"team", name:"Whole team", key:"sc:team", pred:r=>true, nooks:"all", split:true, slots:true, g:"team"},
    {id:"bdrs", name:"BDR team", key:"sc:bdrs", pred:isBdrBooked, nooks:"all", g:"bdrteam"},
    ...BDRS.map(b=>({id:b.key, name:b.name, key:"sc:"+b.key, pred:r=>r.booker===b.key, nooks:firstName(b.key), g:"bdr"})),
    {id:"inb", name:"Inbound leads", key:"sc:inb", pred:isLeadIn, g:"inb"},
    ...AES.map(a=>({id:"ae:"+a.key, name:a.name+" (AE)", ae:a.key, slots:true, g:"ae"})),
  ];
  v.forEach(x=>{ if(x.pred) PRED.set(x.key, x.pred); });
  return v;
}
// weekly goals (monthly = x MULT.month). From the L10 sheet + the leaderboard goals.
const SC_GOAL = {
  bdr:     {dials:1000, connects:80, books:12, had:8, des:4},
  ae:      {had:20, dheld:5, prop:8, con:4, won:2, cwd:10750, des:5},
  inb:     {},
};
const SC_RATIO = {rate:null, show:0.75, b2d:0.33, r2d:0.5, d2w:0.3, c2w:0.85};
function scGoal(m, g){
  if(m.ratio) return m.id==="rate" ? (state.act ? state.act.target : 0.03) : SC_RATIO[m.id] ?? null;
  const nB = BDRS.length;
  if(g==="bdr") return SC_GOAL.bdr[m.id] ?? null;
  if(g==="ae") return SC_GOAL.ae[m.id] ?? null;
  if(g==="bdrteam") return SC_GOAL.bdr[m.id]!=null ? SC_GOAL.bdr[m.id]*nB : null;
  if(g==="team"){
    if(["dials","connects","books","had"].includes(m.id)) return SC_GOAL.bdr[m.id]*nB;
    if(m.id==="des") return SC_GOAL.bdr.des*nB;
    return SC_GOAL.ae[m.id] ?? null;
  }
  return null;
}
const SC_ROWS_ALL = [
  {grp:"Activity (Nooks)"},
  {id:"dials",    label:"Dials", core:true, tip:"Nooks dials (weekly upload)",                 act:true, f:a=>a.d},
  {id:"connects", label:"Connects", core:true, tip:"Nooks connects",              act:true, f:a=>a.c},
  {id:"rate",     label:"Connect rate", tip:"Connects ÷ dials",          act:true, ratio:true, f:a=>a.d?a.c/a.d:null, sub:a=>a.d?a.c+" of "+a.d.toLocaleString():""},
  {id:"conv",     label:"Conversations", tip:"Nooks meaningful conversations",         act:true, f:a=>a.v},
  {id:"c2b",      label:"Conversation → book", tip:"Outbound BDR books (cold call / RTB, any sales process) ÷ Nooks conversations. Nooks data starts in June.",   act:true, ratio:true, f:(a,t)=>a.v?t.bdrBooks/a.v:null, sub:(a,t)=>a.v?t.bdrBooks+" of "+a.v:""},
  {grp:"Discovery calls"},
  {id:"books",    label:"Books (new)", core:true, tip:"New calls booked, counted on the day they were booked",           f:t=>t.books.length, list:"books", split:true},
  {id:"due",      label:"Runs due (calls)", tip:"Calls whose slot came up (a no-show that is rebooked counts again)",      f:t=>t.dueN, list:"due"},
  {id:"had", core:true,      label:"Runs had", core:true, tip:"Calls that happened",              f:t=>t.had.length, list:"had", split:true},
  {id:"ns",       label:"No-shows", tip:"Slot came up, prospect did not show",              f:t=>t.ns.length, list:"ns", lower:true},
  {id:"ca",       label:"Cancelled ahead", tip:"Cancelled before the slot",       f:t=>t.ca.length, list:"ca", lower:true},
  {id:"show", core:true,     label:"Overall show", core:true, tip:"Calls held ÷ calls due",          ratio:true, f:t=>t.show, list:"due", sub:t=>t.dueN?t.had.length+" of "+t.dueN:"", split:true},
  {id:"rec",      label:"No-show recovery", tip:"Deals that missed a call and were held at a later slot",      ratio:true, f:t=>t.recovery, list:"rec", sub:t=>t.rec.length?t.recBack.length+" of "+t.rec.length:""},
  {id:"first", core:true,    label:"1st-time show (excl. our cancels)", core:true, tip:"Held at the first slot ÷ new books whose first slot passed. Calls we pulled (not an MSP, DQ) are left out. The headline show rate.", ratio:true, f:t=>t.first, list:"fdue", sub:t=>t.fdue.length?t.f1.length+" of "+t.fdue.length:""},
  {id:"firstAll", label:"1st-time show, all", tip:"Held at the first slot ÷ new books whose first slot passed, nothing left out",    ratio:true, f:t=>t.firstAll, list:"fall", sub:t=>t.fall.length?t.f1.length+" of "+t.fall.length:""},
  {id:"firstExT", label:"1st-time show (excl. their cancels)", tip:"Same, with prospect cancels and reschedules left out", ratio:true, f:t=>t.firstExT, list:"fext", sub:t=>t.fdueT.length?t.f1.length+" of "+t.fdueT.length:""},
  {id:"cunk",     label:"Cancelled ahead, who unknown", tip:"Cancels nobody has marked ours or theirs yet (count as a miss)", f:t=>t.fUnk.length, list:"cunk", lower:true},
  {id:"dq",       label:"Showed, then DQ'd", tip:"Calls held where the deal was then disqualified",     ratio:true, lower:true, f:t=>t.dqRate, list:"dq", sub:t=>t.had.length?t.hdq.length+" of "+t.had.length:""},
  {grp:"Pipeline"},
  {id:"des", core:true,      label:"Designs created", core:true, tip:"Deals moved to Design",       f:t=>t.des.length, list:"des", era:"old"},
  {id:"b2d",      label:"Book → design", tip:"Designs ÷ books",         ratio:true, f:t=>t.books.length?t.des.length/t.books.length:null, list:"des", era:"old"},
  {id:"r2d",      label:"Run → design", tip:"Designs ÷ runs had",          ratio:true, f:t=>t.had.length?t.des.length/t.had.length:null, list:"des", era:"old"},
  {id:"dheld", core:true,    label:"Designs held", core:true, tip:"Design calls that happened",          f:t=>t.dheld.length, list:"dheld", era:"old"},
  {id:"diag",     label:"Moved to diagnosis", tip:"Deals moved to Diagnosis",    f:t=>t.diag.length, list:"diag", era:"old"},
  {id:"prop",     label:"Prop updates held", tip:"Prop update calls that happened",     f:t=>t.prop.length, list:"prop", era:"old"},
  {id:"con",      label:"Contracts sent", core:true, tip:"Contracts sent",        f:t=>t.con.length, list:"con", era:"old"},
  {id:"des", core:true,      label:"Moved to Design/Audit", core:true, tip:"Deals moved to the Design/Audit stage (audit booked)", f:t=>t.des.length, list:"des", era:"new"},
  {id:"arun", core:true,     label:"Audits run", core:true, tip:"Audit calls that happened (from the AE tracker)",            f:t=>t.arun.length, list:"arun", era:"new"},
  {id:"ans",      label:"Audit no-shows", tip:"Audit calls the prospect missed",        f:t=>t.ans.length, list:"ans", lower:true, era:"new"},
  {id:"ashow",    label:"Audit show rate", tip:"Audits run ÷ (run + no-shows)",       ratio:true, f:t=>(t.arun.length+t.ans.length)?t.arun.length/(t.arun.length+t.ans.length):null, list:"ashow", sub:t=>(t.arun.length+t.ans.length)?t.arun.length+" of "+(t.arun.length+t.ans.length):"", era:"new"},
  {id:"pbook",    label:"Moved to Prop Review/Contract", tip:"Deals moved to Prop Review / Contract (call booked)", f:t=>t.pbook.length, list:"pbook", era:"new"},
  {id:"prun", core:true,     label:"Prop reviews run", core:true, tip:"Prop review calls that happened (from the AE tracker)",      f:t=>t.prun.length, list:"prun", era:"new"},
  {id:"pns",      label:"Prop review no-shows", tip:"Prop review calls the prospect missed",  f:t=>t.pns.length, list:"pns", lower:true, era:"new"},
  {id:"pshow",    label:"Prop review show rate", tip:"Prop reviews run ÷ (run + no-shows)", ratio:true, f:t=>(t.prun.length+t.pns.length)?t.prun.length/(t.prun.length+t.pns.length):null, list:"pshow", sub:t=>(t.prun.length+t.pns.length)?t.prun.length+" of "+(t.prun.length+t.pns.length):"", era:"new"},
  {grp:"AE time (slots)"},
  {id:"slots", label:"AE slots that came up", tip:"One AE + one start time that came up", slot:true, f:x=>x.slots},
  {id:"cps",   label:"Calls per slot", tip:"Calls due ÷ slots (1.0 = no double booking)",        slot:true, dec:true, base:true, f:x=>x.slots?x.calls/x.slots:null, sub:x=>x.slots?x.calls+" calls":""},
  {id:"sran",  label:"Slots that ran", tip:"Slots where at least one call was held",        slot:true, f:x=>x.used},
  {id:"rps", core:true,   label:"Run rate per slot", core:true, tip:"Slots that ran ÷ slots that came up",     slot:true, ratio:true, base:true, f:x=>x.slots?x.used/x.slots:null, sub:x=>x.slots?x.used+" of "+x.slots:""},
  {grp:"Revenue"},
  {id:"won", core:true,      label:"Closed won", core:true, tip:"Deals closed won, by close date",            f:t=>t.won.length, list:"won"},
  {id:"cwd", core:true,      label:"MRR closed", core:true, tip:"Closed-won MRR (USD/month), by close date",            money:true, f:t=>t.cwd, list:"won"},
  {id:"d2w",      label:"Design → close", tip:"Closes ÷ designs",        ratio:true, f:t=>t.des.length?t.won.length/t.des.length:null, list:"won", era:"old"},
  {id:"c2w",      label:"Contract → close", tip:"Closes ÷ contracts",      ratio:true, f:t=>t.con.length?t.won.length/t.con.length:null, list:"won", era:"old"},
  {grp:"Conversion (from calls that ran)", era:"new"},
  {id:"cvd", label:"Disco → Design/Audit", tip:"Of discos run in the period, how many have since moved to Design/Audit", ratio:true, f:t=>t.cvD.length?t.cvDn.length/t.cvD.length:null, list:"cvd", sub:t=>t.cvD.length?t.cvDn.length+" of "+t.cvD.length+" discos run":"", era:"new"},
  {id:"cva", label:"Design/Audit → Prop Review/Contract", tip:"Of audits run, how many have since moved to Prop Review/Contract", ratio:true, f:t=>t.cvA.length?t.cvAn.length/t.cvA.length:null, list:"cva", sub:t=>t.cvA.length?t.cvAn.length+" of "+t.cvA.length+" audits run":"", era:"new"},
  {id:"cvp", label:"Prop Review/Contract → Closed won", tip:"Of prop reviews run, how many have since closed won", ratio:true, f:t=>t.cvP.length?t.cvPn.length/t.cvP.length:null, list:"cvp", sub:t=>t.cvP.length?t.cvPn.length+" of "+t.cvP.length+" prop reviews run":"", era:"new"},
  {id:"cvw", label:"Disco → Closed won", core:true, tip:"Of discos run in the period, how many have since closed won", ratio:true, f:t=>t.cvD.length?t.cvDw.length/t.cvD.length:null, list:"cvw", sub:t=>t.cvD.length?t.cvDw.length+" of "+t.cvD.length+" discos run":"", era:"new"},
];
let SC_ROWS = eraPick(SC_ROWS_ALL);
const SC_SPLIT = [
  {key:"sc:split:out", name:"Outbound (BDR)", pred:isOutb},
  {key:"sc:split:inb", name:"Inbound leads",  pred:isLeadIn},
  {key:"sc:split:ae",  name:"AE-booked outbound", pred:r=>CUR_AE.has(r.booker) && !isInbLead(r)},
];
SC_SPLIT.forEach(x=>PRED.set(x.key, x.pred));
function scActivity(view, p){
  const a = {d:0, c:0, v:0, n:0};
  if(!state.act || !view.nooks) return null;
  state.act.rows.forEach(r=>{
    if(r.week_ending < p.start || r.week_ending > p.end) return;
    if(view.nooks!=="all" && r.bdr!==view.nooks) return;
    a.d += r.dials||0; a.c += r.connects||0; a.v += r.meaningful_dispositions||0; a.n++;
  });
  return a.n ? a : null;
}
// AE slot = one AE + one exact start time that came up. It "ran" if at least one call in it was held.
// Since double booking (week of Oct 5) a slot can hold two calls; before that, two deals on one slot = a cancelled call whose slot was rebooked.
const DOUBLE_BOOK_FROM = "2026-10-05", SLOT_BASE = {start:"2026-01-01", end:"2026-10-04"};
function scSlots(view, p){
  if(!view.slots) return null;
  const m = new Map();
  effShowup().forEach(r=>{
    if(r.dropped || !r.ae || (view.ae && r.ae!==view.ae)) return;
    const run = r.run_at ? Date.parse(r.run_at) : null;
    (r.due_ts||[]).forEach(t=>{
      if(!inP(t,p)) return;
      const ms = Date.parse(t), k = r.ae+"|"+ms, o = m.get(k) || {c:0, h:0};
      o.c++; if(run!=null && Math.abs(run-ms) <= 3*3600e3) o.h++;
      m.set(k, o);
    });
  });
  let calls = 0, used = 0; m.forEach(o=>{ calls += o.c; if(o.h) used++; });
  return {slots:m.size, calls, used};
}
function scStats(view, p){
  const t = view.ae ? statsFor(view.ae, "ae", p) : statsFor(view.key, "bdr", p);
  if(!view.ae && view.nooks){
    // Nooks counts every cold call whatever the deal's process, so the books here ignore the Sales process filter
    const key = view.id==="team"||view.id==="bdrs" ? "sc:split:out" : "sc:out:"+view.id;
    if(!PRED.has(key)) PRED.set(key, r=>r.booker===view.id && !isInbLead(r));
    const e0 = state.era; state.era = "all";
    try{ t.bdrBooks = statsFor(key, "bdr", p).books.length; } finally { state.era = e0; }
  } else t.bdrBooks = 0;
  return t;
}
// one column = a period. The in-progress one is compared against the goal pro-rated to yesterday.
const scYest = () => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-1); return ymd(d); };
function scSyncG(){
  if(!REPORTING) return;
  if(G.kind==="w" || G.kind==="m"){
    SC.range = ""; const end = gP().end < gYest() ? gP().end : gYest();
    let off = 0; while(off > -400 && periodFor(SC.kind, off).start > end) off--; SC.shift = off;
  } else if(G.kind==="q"){ const p = gP(); SC.range = "custom"; SC.from = p.start; SC.to = p.end; }
  else if(G.kind==="ytd") SC.range = "ytd";
  else { SC.range = "custom"; SC.from = G.from; SC.to = G.to; }
}
function scRange(){
  const y = scYest(), clamp = v => v < DATA_FROM ? DATA_FROM : v > y ? y : v;
  if(SC.range==="ytd") return {start:DATA_FROM, end:y};
  if(SC.range==="q"){ const p = periodFor("quarter", 0); return {start:p.start, end:y}; }
  if(SC.range==="lq"){ const p = periodFor("quarter", -1); return {start:clamp(p.start), end:p.end}; }
  if(SC.range==="custom"){
    let a = clamp(SC.from || DATA_FROM), b = clamp(SC.to || y); if(a > b) [a, b] = [b, a];
    return {start:a, end:b};
  }
  return null;
}
function scColumns(){
  const R = scRange();
  if(R){
    const out = [], day = s => new Date(s+"T00:00:00");
    for(let off = 0; off > -400; off--){
      const p = periodFor(SC.kind, off);
      if(p.start > R.end) continue;
      if(p.end < R.start) break;
      const s = p.start < R.start ? day(R.start) : p.s, e = p.end > R.end ? day(R.end) : p.e;
      const q = {s, e, start:ymd(s), end:ymd(e), now:p.now, label:p.label};
      const clipped = q.start!==p.start || q.end!==p.end;
      const full = bizDays(p.s, p.e) || 1, part = bizDays(s, e);
      const pace = paceFraction(q) * (clipped ? part/full : 1);   // goal pro-rated to the days the column covers
      const [head, sub] = scHead(s, e, clipped);
      out.unshift({p:q, off, pace, cur: paceFraction(q)<1, head, sub});
    }
    return out;
  }
  const n = SC_N[SC.kind], out = [];
  for(let i=n-1;i>=0;i--){
    const off = -i + SC.shift, p = periodFor(SC.kind, off);
    if(p.end < DATA_FROM) continue;
    const pace = paceFraction(p);
    const s = p.s, e = p.e;
    const [head, sub] = scHead(s, e, false);
    out.push({p, off, pace, cur: pace<1, head, sub});
  }
  return out;
}
const scFmt = (m, v) => v==null ? "–" : m.dec ? v.toFixed(2) : m.ratio ? (m.id==="rate" ? (Math.round(v*1000)/10)+"%" : pctS(v)) : m.money ? fmt(v,true) : Math.abs(v)>=100 ? Math.round(v).toLocaleString() : fmt(v);
function scCell(m, v, goal, pace, sub, clickAttr){
  const has = v!=null && !(m.act && v===undefined);
  let cls = "";
  if(has && goal!=null){
    const target = (m.ratio||m.dec) ? goal : goal*pace;
    if(!(m.ratio===undefined && pace===0)) cls = (m.lower ? v<=target : v>=target) ? "ok" : "bad";
  }
  const shown = !has ? "–" : scFmt(m, v);
  const inner = clickAttr && has ? `<span class="click" ${clickAttr}>${shown}</span>` : shown;
  return `<td class="${cls}">${inner}${sub?`<small>${sub}</small>`:""}</td>`;
}
function renderScorecard(){
  const box = document.getElementById("scTable"); if(!box) return;
  scSyncG();
  const views = scViews();
  if(!views.some(v=>v.id===SC.view)) SC.view = "team";
  const view = views.find(v=>v.id===SC.view);
  const sel = document.getElementById("scView");
  sel.innerHTML = views.map(v=>`<option value="${esc(v.id)}"${v.id===SC.view?" selected":""}>${esc(v.name)}</option>`).join("");
  document.querySelectorAll("#scKind button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.k===SC.kind));
  const cols = scColumns(); SC.cols = cols;
  const ranged = !!SC.range;
  document.getElementById("scRange").value = SC.range;
  document.getElementById("scDates").hidden = SC.range!=="custom";
  document.querySelector("#scSec .sc-ctl .nav").hidden = ranged;
  if(SC.range==="custom"){ const fi = document.getElementById("scFrom"), ti = document.getElementById("scTo"), y = scYest();
    [fi, ti].forEach(el=>{ el.min = DATA_FROM; el.max = y; }); const R = scRange(); fi.value = R.start; ti.value = R.end; }
  document.getElementById("scNext").disabled = SC.shift >= 0;
  document.getElementById("scPrev").disabled = !cols.length || cols[0].p.start <= DATA_FROM;
  const mult = SC.kind==="month" ? MULT.month : SC.kind==="quarter" ? MULT.quarter : 1;
  const done = cols.filter(c=>!c.cur);
  const avgP = done.length ? {start:done[0].p.start, end:done[done.length-1].p.end, label:"Average of "+done.length+" "+(SC.kind==="week"?"weeks":"months")} : null;
  // stats per column (+ the average span)
  const T = cols.map(c=>scStats(view, c.p)), A = cols.map(c=>scActivity(view, c.p)), SL = cols.map(c=>scSlots(view, c.p));
  const avgT = avgP ? scStats(view, avgP) : null, avgA = avgP ? scActivity(view, avgP) : null, avgSL = avgP ? scSlots(view, avgP) : null;
  const baseSL = scSlots(view, SLOT_BASE);
  const SRC = {act:{cols:A, avg:avgA, show:!!view.nooks}, slot:{cols:SL, avg:avgSL, show:!!view.slots}};
  const n = done.length;
  const showAct = !!view.nooks;
  const CMP = REPORTING && gCmpOn() ? {p:gP(), q:gPrev()} : null;
  let html = `<table class="sc-tbl"><thead><tr><th>${esc(view.name)}</th><th class="goal">Goal<small>per ${SC.kind}</small></th>${cols.map(c=>`<th class="${c.cur?"cur":""}">${c.p.end>=DOUBLE_BOOK_FROM?'<span class="db" title="Double booking on">● </span>':""}${c.head}<small>${c.cur?"so far":c.sub}</small></th>`).join("")}<th class="avg">Avg</th>${CMP?`<th class="cmpc">Chosen period<small>${esc(CMP.p.label)}</small><small>vs ${esc(CMP.q.label)}</small></th>`:""}</tr></thead><tbody>`;
  const cut = state.cutover, cutTxt = (d=>MON[d.getMonth()]+" "+d.getDate())(new Date(cut+"T12:00:00"));
  // a column the chosen process can't fill: New + before the cutover, Old + after it; 3-call-close rows before the cutover
  const offEra = c => (state.era==="new" && c.p.end < cut) || (state.era==="old" && c.p.start >= cut);
  const rowOff = (m, c) => !m.act && !m.slot && (offEra(c) || (m.era==="new" && c.p.end < cut));
  const offTitle = c => c.p.end < cut ? "Before the 3-call close started ("+cutTxt+"): only deals that moved into it show here" : "After the switch: only old-process deals still moving show here";
  const stCache = new Map(), stAt = (key, sp) => { const k = key+"|"+sp.start+"|"+sp.end; if(!stCache.has(k)) stCache.set(k, key===null ? scStats(view, sp) : statsFor(key, "bdr", sp)); return stCache.get(k); };
  // average over the finished columns this row can use (counts = per column, ratios pooled over the span)
  const rowAvg = (m, key) => { const ok = done.filter(c=>!rowOff(m,c)); if(!ok.length) return null;
    const v = m.f(stAt(key, {start:ok[0].p.start, end:ok[ok.length-1].p.end})); return v==null ? null : m.ratio ? v : v/ok.length; };
  // value of a row over any span (for the chosen-period column)
  const valAt = (m, key, sp) => { if(m.act){ const a = scActivity(view, sp); return a ? m.f(a, stAt(null, sp)) : null; }
    if(m.slot){ const x = scSlots(view, sp); return x ? m.f(x) : null; } return m.f(stAt(key, sp)); };
  const cmpCell = (m, key) => { if(!CMP) return ""; const v = valAt(m, key, CMP.p), w = valAt(m, key, CMP.q);
    return `<td class="cmpc">${scFmt(m, v)}${dl(v, w, {pct:m.ratio, money:m.money, lower:m.lower})}</td>`; };
  const offCell = (m, v, sub, click, c) => { const z = v==null || v===0, shown = z ? "–" : scFmt(m, v);
    return `<td class="${c.cur?"cur ":""}pre" title="${esc(offTitle(c))}">${!z && click ? `<span class="click" ${click}>${shown}</span>` : shown}${!z && sub ? `<small>${sub}</small>` : ""}</td>`; };
  const splitRows = view.split ? SC_SPLIT.filter(x=>x.key!=="sc:split:ae" || cols.some(c=>statsFor(x.key,"bdr",c.p).books.length || statsFor(x.key,"bdr",c.p).had.length)) : [];
  const groups = []; let grp = null;
  SC_ROWS.forEach((m, mi)=>{
    if(m.grp){ grp = {name:m.grp, rows:[]}; groups.push(grp); return; }
    const src = m.act ? "act" : m.slot ? "slot" : null;
    if(src && !SRC[src].show) return;
    grp.rows.push({m, mi});
  });
  const shown = groups.filter(g=>g.rows.length);
  SC.groups = shown.filter(g=>g.rows.some(r=>!r.m.core)).map(g=>g.name);
  document.getElementById("scAll").textContent = SC.groups.every(n=>SC.open.has(n)) ? "Headline rows only" : "Show all rows";
  shown.forEach(gr=>{
  const open = SC.open.has(gr.name), more = gr.rows.filter(r=>!r.m.core).length;
  html += `<tr class="grp${more?" tog":""}"${more?` data-grp="${esc(gr.name)}" title="${open?"Show headline rows only":"Show all "+gr.name+" rows"}"`:""}><td colspan="${cols.length+3+(CMP?1:0)}"><span class="grp-lbl">${gr.name}${more?`<span class="grp-more">${open?"fewer ▴":more+" more ▾"}</span>`:""}</span></td></tr>`;
  gr.rows.forEach(({m, mi})=>{
    if(!open && !m.core) return;
    const src = m.act ? "act" : m.slot ? "slot" : null;
    const g = m.base ? (baseSL ? m.f(baseSL) : null) : scGoal(m, view.g), goal = g==null ? null : ((m.ratio||m.dec) ? g : g*mult);
    const goalTxt = goal==null ? "" : scFmt(m, goal) + (m.base ? "<small>Jan 1–Oct 4</small>" : "");
    html += `<tr><td>${m.label}${m.tip?`<button type="button" class="tip" data-tip="${esc(m.tip)}" aria-label="What is ${esc(m.label)}?">ⓘ</button>`:""}</td><td class="goal">${goalTxt}</td>`;
    cols.forEach((c,ci)=>{
      const t = T[ci], a = src ? SRC[src].cols[ci] : null;
      if(src){
        const v = a ? m.f(a, t) : null;
        html += scCell(m, v, goal, c.pace, a && m.sub ? m.sub(a,t) : "", "").replace("<td class=\"", `<td class="${c.cur?"cur ":""}`);
      } else {
        const v = m.f(t);
        const click = m.list ? `data-sc="${mi}|${ci}|"` : "";
        if(rowOff(m, c)){ html += offCell(m, v, m.sub ? m.sub(t) : "", click, c); return; }
        html += scCell(m, v, goal, c.pace, m.sub ? m.sub(t) : "", click).replace("<td class=\"", `<td class="${c.cur?"cur ":""}`);
      }
    });
    // average of finished columns: counts / n, ratios pooled over the span
    let av = null, avSub = "";
    if(n){
      if(src){
        // only the finished columns that have this data (Nooks uploads start in June), so the books side matches
        const okc = cols.filter((c,ci)=>!c.cur && SRC[src].cols[ci]);
        if(okc.length){ const sp = {start:okc[0].p.start, end:okc[okc.length-1].p.end};
          const aa = src==="act" ? scActivity(view, sp) : scSlots(view, sp), v = aa ? m.f(aa, stAt(null, sp)) : null;
          av = v==null ? null : (m.ratio||m.dec) ? v : v/okc.length; } }
      else av = rowAvg(m, null);
    }
    const avTxt = scFmt(m, av);
    let avCls = "";
    if(av!=null && goal!=null) avCls = (m.lower ? av<=goal : av>=goal) ? "ok" : "bad";
    html += `<td class="avg ${avCls}">${avTxt}</td>${cmpCell(m, null)}</tr>`;
    // Whole team: split books / runs had / show into outbound vs inbound leads
    if(open && m.split && splitRows.length){
      splitRows.forEach(x=>{
        html += `<tr class="sub"><td>${x.name}</td><td class="goal"></td>`;
        cols.forEach((c,ci)=>{
          const t = statsFor(x.key, "bdr", c.p), v = m.f(t);
          if(rowOff(m, c)){ html += offCell(m, v, m.sub ? m.sub(t) : "", `data-sc="${mi}|${ci}|${x.key}"`, c); return; }
          html += scCell({...m}, v, null, c.pace, m.sub ? m.sub(t) : "", `data-sc="${mi}|${ci}|${x.key}"`).replace("<td class=\"", `<td class="${c.cur?"cur ":""}`);
        });
        const av2 = n ? rowAvg(m, x.key) : null;
        html += `<td class="avg">${scFmt(m, av2)}</td>${cmpCell(m, x.key)}</tr>`;
      });
    }
  });
  });
  html += `</tbody></table>`;
  box.innerHTML = html;
  box.scrollLeft = box.scrollWidth;   // newest columns (and the chosen-period column) in view
  const last = (state.act && state.act.rows.length) ? state.act.rows.reduce((a,r)=>r.week_ending>a?r.week_ending:a, "") : null;
  document.getElementById("scNote").textContent = !showAct ? "" :
    !state.act ? "Loading Nooks activity…" : state.act.failed ? "Could not load Nooks activity (dials, connects)." :
    last ? "Nooks activity uploaded through the week ending "+last+". Upload a new week on the RevOps L10 tab." : "No Nooks uploads yet.";
}
document.getElementById("scView").onchange = e=>{ SC.view = e.target.value; renderScorecard(); };
document.querySelectorAll("#scKind button").forEach(b=>b.onclick=()=>{ SC.kind=b.dataset.k; SC.shift=0; renderScorecard(); });
document.getElementById("scRange").onchange = e=>{ SC.range = e.target.value; SC.shift = 0;
  if(SC.range==="custom" && !SC.from){ const p = periodFor("month", -1); SC.from = p.start; SC.to = scYest(); }
  if(SC.range==="ytd" || SC.range==="q" || SC.range==="lq") SC.kind = SC.range==="ytd" ? "month" : "week";
  renderScorecard(); };
["scFrom","scTo"].forEach(id=>document.getElementById(id).onchange = e=>{ SC[id==="scFrom"?"from":"to"] = e.target.value; renderScorecard(); });
document.getElementById("scPrev").onclick = ()=>{ SC.shift -= Math.max(1, SC_N[SC.kind]-2); renderScorecard(); };
document.getElementById("scNext").onclick = ()=>{ SC.shift = Math.min(0, SC.shift + Math.max(1, SC_N[SC.kind]-2)); renderScorecard(); };
document.getElementById("scAll").onclick = ()=>{ const all = SC.groups.every(n=>SC.open.has(n)); SC.groups.forEach(n=>all ? SC.open.delete(n) : SC.open.add(n)); scSaveOpen(); renderScorecard(); };
document.getElementById("scSec").addEventListener("click", e=>{
  const g = e.target.closest("tr[data-grp]");
  if(g){ const k = g.dataset.grp; SC.open.has(k) ? SC.open.delete(k) : SC.open.add(k); scSaveOpen(); renderScorecard(); return; }
  const c = e.target.closest("[data-sc]"); if(!c) return;
  const [mi, ci, sub] = c.dataset.sc.split("|"); const m = SC_ROWS[+mi], col = SC.cols[+ci]; if(!m || !col) return;
  const view = scViews().find(v=>v.id===SC.view);
  const subName = sub ? " · "+SC_SPLIT.find(x=>x.key===sub).name : "";
  if(sub) openList(sub, "bdr", m.list, m.label+subName, col.p);
  else if(view.ae) openList(view.ae, "ae", m.list, view.name+": "+m.label, col.p);
  else openList(view.key, "bdr", m.list, view.name+": "+m.label, col.p);
});

/* ---------- Sales L10: AEs tab (per-AE table + rate trends) ---------- */
const AX = {kind:"month", offset:0, metric:"rps", who:"all", scale:"week"};
// who: "all" = every AE (team), an AE key, or FORMER (AEs who have left)
const axView = who => who==="all" ? {slots:true, key:"sc:team", name:"All AEs"} : who===FORMER ? {slots:true, aeFormer:true, name:"Former AEs"} : {slots:true, ae:who, name:who};
function axSlots(v, p){
  if(!v.aeFormer) return scSlots(v, p);
  const m = new Map();
  effShowup().forEach(r=>{
    if(r.dropped || !r.ae || CUR_AE.has(r.ae)) return;
    const run = r.run_at ? Date.parse(r.run_at) : null;
    (r.due_ts||[]).forEach(t=>{ if(!inP(t,p)) return; const ms = Date.parse(t), k = r.ae+"|"+ms, o = m.get(k)||{c:0,h:0}; o.c++; if(run!=null && Math.abs(run-ms)<=3*3600e3) o.h++; m.set(k,o); });
  });
  let calls = 0, used = 0; m.forEach(o=>{ calls += o.c; if(o.h) used++; });
  return {slots:m.size, calls, used};
}
const axStats = (v, p) => v.ae ? statsFor(v.ae, "ae", p) : v.aeFormer ? statsFor(FORMER, "ae", p) : statsFor(v.key, "bdr", p);
const AX_COLS_ALL = [
  {id:"due",   label:"Runs due",        f:t=>t.dueN, list:"due"},
  {id:"had", core:true,   label:"Runs had",        f:t=>t.had.length, list:"had"},
  {id:"slots", label:"Slots",           slot:true, f:x=>x.slots},
  {id:"cps",   label:"Calls per slot",  slot:true, dec:true, f:x=>x.slots?x.calls/x.slots:null},
  {id:"rps", core:true,   label:"Run rate per slot", slot:true, ratio:true, f:x=>x.slots?x.used/x.slots:null, sub:x=>x.slots?x.used+" of "+x.slots:""},
  {id:"show", core:true,  label:"Overall show",    ratio:true, f:t=>t.show, list:"due", sub:t=>t.dueN?t.had.length+" of "+t.dueN:""},
  {id:"rec",   label:"No-show recovery", ratio:true, f:t=>t.recovery, list:"rec", sub:t=>t.rec.length?t.recBack.length+" of "+t.rec.length:""},
  {id:"first", core:true, label:"1st-time show (excl. our cancels)", ratio:true, f:t=>t.first, list:"fdue", sub:t=>t.fdue.length?t.f1.length+" of "+t.fdue.length:""},
  {id:"firstAll", label:"1st-time show, all", ratio:true, f:t=>t.firstAll, list:"fall", sub:t=>t.fall.length?t.f1.length+" of "+t.fall.length:""},
  {id:"firstExT", label:"1st-time show (excl. their cancels)", ratio:true, f:t=>t.firstExT, list:"fext", sub:t=>t.fdueT.length?t.f1.length+" of "+t.fdueT.length:""},
  {id:"dq",    label:"Showed, then DQ'd", ratio:true, f:t=>t.dqRate, list:"dq", sub:t=>t.had.length?t.hdq.length+" of "+t.had.length:""},
  {id:"des", core:true,   label:"Designs",         f:t=>t.des.length, list:"des", era:"old"},
  {id:"r2d",   label:"Run → design",    ratio:true, f:t=>t.had.length?t.des.length/t.had.length:null, list:"des", era:"old"},
  {id:"dheld", core:true, label:"Designs held",    f:t=>t.dheld.length, list:"dheld", era:"old"},
  {id:"prop",  label:"Prop updates",    f:t=>t.prop.length, list:"prop", era:"old"},
  {id:"con",   label:"Contracts",       f:t=>t.con.length, list:"con", era:"old"},
  {id:"desn", core:true,  label:"Design/Audit",    f:t=>t.des.length, list:"des", era:"new"},
  {id:"arun", core:true,  label:"Audits run",      f:t=>t.arun.length, list:"arun", era:"new"},
  {id:"ans",   label:"Audit no-shows",  f:t=>t.ans.length, list:"ans", era:"new"},
  {id:"prun", core:true,  label:"Prop reviews run", f:t=>t.prun.length, list:"prun", era:"new"},
  {id:"pns",   label:"Prop review no-shows", f:t=>t.pns.length, list:"pns", era:"new"},
  {id:"won", core:true,   label:"Closes",          f:t=>t.won.length, list:"won"},
  {id:"d2w",   label:"Design → close",  ratio:true, f:t=>t.des.length?t.won.length/t.des.length:null, list:"won", era:"old"},
  {id:"cvd", label:"Disco → Design/Audit", ratio:true, f:t=>t.cvD.length?t.cvDn.length/t.cvD.length:null, list:"cvd", sub:t=>t.cvD.length?t.cvDn.length+" of "+t.cvD.length:"", era:"new"},
  {id:"cva", label:"Design/Audit → Prop Review", ratio:true, f:t=>t.cvA.length?t.cvAn.length/t.cvA.length:null, list:"cva", sub:t=>t.cvA.length?t.cvAn.length+" of "+t.cvA.length:"", era:"new"},
  {id:"cvp", label:"Prop Review → Closed won", ratio:true, f:t=>t.cvP.length?t.cvPn.length/t.cvP.length:null, list:"cvp", sub:t=>t.cvP.length?t.cvPn.length+" of "+t.cvP.length:"", era:"new"},
  {id:"cvw", label:"Disco → Closed won", ratio:true, f:t=>t.cvD.length?t.cvDw.length/t.cvD.length:null, list:"cvw", sub:t=>t.cvD.length?t.cvDw.length+" of "+t.cvD.length:"", era:"new"},
  {id:"cwd", core:true,   label:"MRR",             money:true, f:t=>t.cwd, list:"won"},
];
let AX_COLS = eraPick(AX_COLS_ALL);
const axVal = (c, v, p) => c.slot ? c.f(axSlots(v, p)) : c.f(axStats(v, p));
const axSub = (c, v, p) => !c.sub ? "" : c.slot ? c.sub(axSlots(v, p)) : c.sub(axStats(v, p));
function axWhoList(p){
  const out = [...AES.map(a=>a.key)];
  const fs0 = axSlots(axView(FORMER), p), ft = axStats(axView(FORMER), p);
  if(fs0.slots || formerHasData(ft)) out.push(FORMER);
  return out;
}
function renderAEs(){
  const box = document.getElementById("axTable"); if(!box) return;
  const p = gP(), pp = gCmpOn() ? gPrev() : null;
  document.getElementById("axPeriod").textContent = p.label;
  document.querySelectorAll("#axKind button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.k===AX.kind));
  document.getElementById("axPrev").disabled = p.start <= DATA_FROM;
  document.getElementById("axNext").disabled = AX.offset >= 0;
  const rows = [...axWhoList(p).map(w=>({who:w, ...axView(w)})), {who:"all", ...axView("all"), cls:"tot"}];
  box.innerHTML = `<table class="ib-tbl"><thead><tr><th></th>${AX_COLS.map(c=>ppCol(c)?`<th>${c.label}</th>`:"").join("")}</tr></thead><tbody>${rows.map(r=>
    `<tr class="${r.cls||""}"><td>${esc(r.name)}</td>${AX_COLS.map((c,ci)=>{
      if(!ppCol(c)) return "";
      const v = axVal(c, r, p), sub = axSub(c, r, p);
      const txt = scFmt(c, v);
      const cell = c.list && v!=null ? `<span class="click" data-ax="${esc(r.who)}|${ci}">${txt}</span>` : txt;
      const d = pp ? dl(v, axVal(c, r, pp), {pct:c.ratio, money:c.money, lower:["dq","ans","pns"].includes(c.id)}) : "";
      return `<td>${cell}${sub?`<small>${sub}</small>`:""}${d}</td>`;
    }).join("")}</tr>`).join("")}</tbody></table>`;
  // trend controls
  const whoOpts = [["all","All AEs"], ...AES.map(a=>[a.key, a.name]), [FORMER, "Former AEs"]];
  if(!whoOpts.some(o=>o[0]===AX.who)) AX.who = "all";
  document.getElementById("axWho").innerHTML = whoOpts.map(([k,l])=>`<option value="${esc(k)}"${k===AX.who?" selected":""}>${esc(l)}</option>`).join("");
  document.getElementById("axMetric").innerHTML = AX_COLS.map(c=>`<option value="${c.id}"${c.id===AX.metric?" selected":""}>${c.label}</option>`).join("");
  document.querySelectorAll("#axScale button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.s===AX.scale));
  renderAxChart();
}
function axBuckets(scale){
  const out = [];
  for(let off=0; off>-60; off--){
    const p = periodFor(scale, off);
    if(p.end < DATA_FROM) break;
    out.unshift({p, cur: paceFraction(p) < 1});
  }
  return out;
}
let axPts = [];
function renderAxChart(){
  const el = document.getElementById("axChart"); if(!el || el.clientWidth < 200) return;   // hidden tab: drawn when the AEs tab opens
  const c = AX_COLS.find(x=>x.id===AX.metric) || AX_COLS[4], v = {who:AX.who, ...axView(AX.who)};
  const B = axBuckets(AX.scale);
  const vals = B.map(b=>axVal(c, v, b.p));
  const base = axVal(c, v, SLOT_BASE);
  const W = el.clientWidth - 28, H = 280, L = 44, R = 10, T = 18, Bm = 34, w = W - L - R, h = H - T - Bm;
  const nums = vals.filter(x=>x!=null).concat(base!=null && (c.ratio||c.dec) ? [base] : []);
  let max = Math.max(...nums, 0);
  if(c.ratio) max = Math.min(1, Math.max(0.1, Math.ceil(max*10)/10));
  else if(c.dec) max = Math.max(1.5, Math.ceil(max*4)/4);
  else max = niceStep(max/4)*4 || 1;
  const x = i => L + (B.length===1 ? w/2 : i*w/(B.length-1)), y = val => T + h - (val/max)*h;
  const fmtY = val => c.ratio ? Math.round(val*100)+"%" : c.money ? "$"+Math.round(val/1000)+"k" : c.dec ? val.toFixed(2) : Math.round(val);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.label)} trend">`;
  // double booking zone
  const dbI = B.findIndex(b=>b.p.end >= DOUBLE_BOOK_FROM);
  if(dbI >= 0){ const x0 = dbI===0 ? L : (x(dbI-1)+x(dbI))/2; svg += `<rect class="dbz" x="${x0}" y="${T}" width="${L+w-x0+R/2}" height="${h}"/>`; }
  for(let k=0;k<=4;k++){ const gv = max*k/4, gy = y(gv); svg += `<line class="grid" x1="${L}" x2="${L+w}" y1="${gy}" y2="${gy}"/><text x="${L-6}" y="${gy+4}" text-anchor="end">${fmtY(gv)}</text>`; }
  if(base!=null && (c.ratio||c.dec)) svg += `<line class="base" x1="${L}" x2="${L+w}" y1="${y(base)}" y2="${y(base)}"/>`;
  // line (skip gaps)
  let d = ""; vals.forEach((val,i)=>{ if(val==null){ d += " "; return; } d += (d.trim()&&vals[i-1]!=null ? " L" : " M")+x(i)+" "+y(val); });
  svg += `<path class="ln" d="${d.trim()}"/>`;
  const step = Math.max(1, Math.ceil(B.length/12));
  axPts = [];
  B.forEach((b,i)=>{
    const s0 = b.p.s, lab = AX.scale==="week" ? MON[s0.getMonth()]+" "+s0.getDate() : MON[s0.getMonth()];
    if(i%step===0 || i===B.length-1) svg += `<text x="${x(i)}" y="${H-12}" text-anchor="middle">${lab}${b.cur?"*":""}</text>`;
    if(vals[i]==null) return;
    axPts.push({i, b});
    svg += `<circle class="pt${b.cur?" cur":""}" cx="${x(i)}" cy="${y(vals[i])}" r="4.5" data-axp="${i}"><title>${esc(b.p.label)}: ${scFmt(c, vals[i])}${axSub(c, v, b.p)?" ("+axSub(c, v, b.p)+")":""}</title></circle>`;
    if(B.length <= 16) svg += `<text class="val" x="${x(i)}" y="${y(vals[i])-9}" text-anchor="middle">${scFmt(c, vals[i])}</text>`;
  });
  el.innerHTML = svg + "</svg>";
  el._axB = B; el._axC = c;
  document.getElementById("axKey").innerHTML = `<span><i></i>${esc(v.name)}: ${esc(c.label)}</span>` +
    (base!=null && (c.ratio||c.dec) ? `<span><i class="b"></i>Jan 1 – Oct 4 average: ${scFmt(c, base)}</span>` : "") +
    `<span><i class="z"></i>Double booking (from Oct 5)</span>`;
}
document.querySelectorAll("#axKind button").forEach(b=>b.onclick=()=>{ AX.kind=b.dataset.k; AX.offset=0; renderAEs(); });
document.getElementById("axPrev").onclick = ()=>{ AX.offset--; renderAEs(); };
document.getElementById("axNext").onclick = ()=>{ if(AX.offset<0){ AX.offset++; renderAEs(); } };
document.getElementById("axMetric").onchange = e=>{ AX.metric = e.target.value; renderAxChart(); };
document.getElementById("axWho").onchange = e=>{ AX.who = e.target.value; renderAxChart(); };
document.querySelectorAll("#axScale button").forEach(b=>b.onclick=()=>{ AX.scale=b.dataset.s; document.querySelectorAll("#axScale button").forEach(x=>x.setAttribute("aria-pressed", x.dataset.s===AX.scale)); renderAxChart(); });
document.getElementById("axSec").addEventListener("click", e=>{
  const pt = e.target.closest("[data-axp]");
  if(pt){
    const el = document.getElementById("axChart"), b = el._axB[+pt.dataset.axp], c = el._axC, v = axView(AX.who);
    const list = c.list || "due";
    if(v.ae) openList(v.ae, "ae", list, v.name+": "+c.label, b.p);
    else if(v.aeFormer) openList(FORMER, "ae", list, "Former AEs: "+c.label, b.p);
    else openList(v.key, "bdr", list, "All AEs: "+c.label, b.p);
    return;
  }
  const cell = e.target.closest("[data-ax]"); if(!cell) return;
  const [who, ci] = cell.dataset.ax.split("|"), c = AX_COLS[+ci], v = axView(who), p = gP();
  if(v.ae) openList(v.ae, "ae", c.list, v.name+": "+c.label, p);
  else if(v.aeFormer) openList(FORMER, "ae", c.list, "Former AEs: "+c.label, p);
  else openList(v.key, "bdr", c.list, "All AEs: "+c.label, p);
});
let axResize; window.addEventListener("resize", ()=>{ clearTimeout(axResize); axResize = setTimeout(renderAxChart, 150); });

/* ---------- Sales L10 tabs ---------- */
function l10Tab(t){
  if(["bd","ib","ax"].includes(t)){ PP.sub = t; ppSave(); t = "pp"; }   // old saved tabs / links land on People
  const show = t==="pp" ? PP.sub : t;
  document.querySelectorAll("#l10Tabs button").forEach(b=>b.setAttribute("aria-selected", b.dataset.t===t));
  document.querySelectorAll("section[data-tab]").forEach(sec=>sec.hidden = sec.dataset.tab!==show);
  document.getElementById("ppBar").hidden = t!=="pp";
  document.querySelectorAll("#ppSeg button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.p===PP.sub));
  document.getElementById("ppAll").textContent = PP.all ? "Key columns only" : "Show all columns";
  try{ localStorage.setItem("jf_l10_tab", t); }catch(e){}
  if(t==="tr") renderTrends();
  if(show==="ax") requestAnimationFrame(renderAEs);
  if(t==="cmp" && typeof renderCompare==="function") renderCompare();
  if(typeof gUI==="function") gUI();
}
document.querySelectorAll("#l10Tabs button").forEach(b=>b.onclick=()=>l10Tab(b.dataset.t));
document.querySelectorAll("#ppSeg button").forEach(b=>b.onclick=()=>{ PP.sub = b.dataset.p; ppSave(); l10Tab("pp"); });
document.getElementById("ppAll").onclick = ()=>{ PP.all = !PP.all; ppSave(); renderBdrBreakdown(); renderInboundBreakdown(); renderAEs(); l10Tab("pp"); };
if(REPORTING){ let t0 = "sc"; try{ t0 = localStorage.getItem("jf_l10_tab") || "sc"; }catch(e){} l10Tab(["sc","pp","bd","ib","ax","tr","cl","cmp"].includes(t0)?t0:"sc"); }

/* ---------- ⓘ definitions: hover or tap shows a bubble; a tap keeps it open until you tap elsewhere ---------- */
(() => {
  const pop = document.createElement("div"); pop.className = "tip-pop"; pop.hidden = true; pop.setAttribute("role", "tooltip"); document.body.appendChild(pop);
  let cur = null, pinned = false;
  const show = b => {
    cur = b; pop.textContent = b.dataset.tip; pop.hidden = false;
    const r = b.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const x = Math.max(8, Math.min(r.left + r.width/2 - w/2, innerWidth - w - 8));
    const y = r.bottom + 8 + h > innerHeight - 8 ? r.top - h - 8 : r.bottom + 8;
    pop.style.left = x + "px"; pop.style.top = y + "px";
  };
  const hide = () => { pop.hidden = true; cur = null; pinned = false; };
  document.addEventListener("click", e => {
    const b = e.target.closest(".tip[data-tip]");
    if(b){ e.stopPropagation(); e.preventDefault(); if(cur===b && pinned) hide(); else { show(b); pinned = true; } return; }
    if(!e.target.closest(".tip-pop")) hide();
  }, true);
  document.addEventListener("mouseover", e => { const b = e.target.closest(".tip[data-tip]"); if(b && !pinned) show(b); });
  document.addEventListener("mouseout", e => { const b = e.target.closest(".tip[data-tip]"); if(b && !pinned && !b.contains(e.relatedTarget)) hide(); });
  document.addEventListener("keydown", e => { if(e.key==="Escape") hide(); });
  addEventListener("scroll", () => { if(!pop.hidden) hide(); }, true);
})();
