/* ---------- RevOps L10: RTB waterfall (2026-11-24) ----------
   One cohort per period: the companies hit in that period, followed to today.
   Website visitors -> companies identified -> MSPs -> where each MSP stood in HubSpot on the hit day ->
   handed to a rep (owned deals: the rep is DMed at the hit; everything else: when TVL hands it to a BDR) ->
   worked (first call, outgoing email or meeting on the company after the hit) -> worked within 1 business day -> booked a call.
   Data: lb-auto GET /rtb = Supabase rtb_l10_payload() (same feed as the Sales L10 rows, n8n MG3H1WGmKz9AsL0X daily 7:45).
     hits  [date, domain, seg, cst, class, stage, routed, first hit time, first touch time, touch type, touched by]
     down  [date, domain, t|c]     books [booking day, company domain]
     src   [date, site jf|cst, domain, sources, flags]  (11-24) every company the product team identified, before our engine
           (n8n hGVLl6MHWvYTqBd6 copies the product MariaDB daily 7:30). flags: 1 product scored MSP, 2 person email,
           4 seen on an earlier day, 8 already in the product leads table (the bridge never forwards it),
           16 our engine received it (JF stream), 32 received as a CST cross-seed */
(function(){
"use strict";
const API = ((window.JF_CONFIG||{}).API_BASE||"").replace(/\/jf-sso$/, "/lb-auto");
const FROM = "2026-08-17", BOOK_DAYS = 90;
const $ = id => document.getElementById(id);
const h = s => String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const token = () => { try{ return localStorage.getItem("jf_token"); }catch(e){ return null; } };
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* how each HubSpot bucket is handed to a rep (same rule as the RTB engine v3, Step 2 R3aV88O9ze7MLnGQ) */
const BUCKETS = [
  {k:"missed_deal",   label:"Missed meeting deal",       how:"dm",  tip:"Open deal in Reschedule Needed or Proposal No-Show. The BDR is DMed at the hit to rebook."},
  {k:"stale_deal",    label:"Stalled deal",              how:"dm",  tip:"Open AE-stage deal past the live window (disco over 45 days, no call, meeting or email in 30). DMed at the hit."},
  {k:"reengage_deal", label:"Re-engage deal",            how:"dm",  tip:"Open deal tagged Historical / Re-engage. Its BDR is DMed at the hit."},
  {k:"live_deal",     label:"Live deal (AE)",            how:"dm",  tip:"Open deal inside the live window. The AE is DMed at the hit. Left out of hit → booked."},
  {k:"net_new",       label:"Net new",                   how:"tvl", tip:"Not in HubSpot. Waits for TVL (contacts verified), then a BDR gets it in the digest."},
  {k:"crm_no_deal",   label:"In HubSpot, no deal",       how:"tvl", tip:"In HubSpot with no sales deal. Waits for TVL."},
  {k:"lost_deal",     label:"Lost deal (reactivation)",  how:"tvl", tip:"Last deal closed lost. Waits for TVL."},
  {k:"long_term",     label:"Long Term Pipeline",        how:"tvl", tip:"Open deal parked in Long Term Pipeline. Waits for TVL."},
  {k:"client",        label:"Client",                    how:"out", tip:"Closed-won before the hit. Not routed."},
  {k:"dq_deal",       label:"DQ'd deal",                 how:"out", tip:"DQ'd before the hit. Not routed."},
  {k:"",              label:"Stage not checked yet",     how:"out", tip:"The 7:45 job hasn't looked it up yet."},
];
const BK = Object.fromEntries(BUCKETS.map(b=>[b.k, b]));
const NO_BOOK = new Set(["live_deal","client","dq_deal",""]);

const S = { data:null, view:"week", site:"jf", idx:0, open:null, err:"" };
const F = { MSP:1, EMAIL:2, SEEN:4, LEAD:8, JF:16, CS:32 };
const SRC_LABEL = { "SRC-B":"Source B · company only (no contact)", "SRC-C":"Source C · visitor ID (VV)", "SRC-F":"Source F · Vector", "SRC-X":"Source X", "SRC-A":"Source A" };
const srcName = k => SRC_LABEL[k] || (k ? "Source "+k.replace(/^SRC-/,"") : "No source");

/* ---------- dates (Toronto) ---------- */
const d2s = d => d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
const s2d = s => new Date(Date.UTC(+s.slice(0,4), +s.slice(5,7)-1, +s.slice(8,10)));
const add = (s,n) => { const d = s2d(s); d.setUTCDate(d.getUTCDate()+n); return d2s(d); };
const lbl = s => MON[+s.slice(5,7)-1]+" "+(+s.slice(8,10));
const torNow = () => new Date().toLocaleDateString("en-CA", {timeZone:"America/Toronto"});
const days = (a,b) => Math.round((s2d(b)-s2d(a))/864e5);
// wall-clock parts in Toronto for an instant
const TZF = new Intl.DateTimeFormat("en-US", {timeZone:"America/Toronto", hour12:false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", weekday:"short"});
function tor(ms){ const o = {}; TZF.formatToParts(new Date(ms)).forEach(p=>o[p.type]=p.value);
  return {day:o.year+"-"+o.month+"-"+o.day, mins:(+o.hour%24)*60 + +o.minute, wd:o.weekday}; }
const OPEN = 9*60, CLOSE = 18*60;   // business hours: 9am-6pm Toronto, Mon-Fri
const isBiz = wd => wd!=="Sat" && wd!=="Sun";
/* business minutes between two instants (9-6 ET, weekdays). A weekend or evening hit starts the clock at the next opening. */
function bizMins(a, b){
  if(!(b > a)) return 0;
  const A = tor(a), B = tor(b); let total = 0;
  for(let d = A.day; d <= B.day; d = add(d,1)){
    const wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][s2d(d).getUTCDay()]; if(!isBiz(wd)) continue;
    const s = Math.max(OPEN, d===A.day ? A.mins : 0), e = Math.min(CLOSE, d===B.day ? B.mins : 24*60);
    if(e > s) total += e - s;
    if(d > A.day && days(A.day, d) > 120) break;
  }
  return total;
}
const fmtBiz = m => m==null ? "–" : m < 60 ? Math.round(m)+" min" : m < 9*60 ? (Math.round(m/6)/10)+" h" : (Math.round(m/54)/10)+" days";   // business time

/* ---------- periods ---------- */
function periods(){
  const today = torNow(), out = [];
  if(S.view==="week"){
    let mon = add(today, -((s2d(today).getUTCDay()+6)%7));
    while(mon >= add(FROM,-6)){ const end = add(mon,6); out.push({start:mon<FROM?FROM:mon, end, label:"Week of "+lbl(mon)+(end>=today?" (so far)":"")}); mon = add(mon,-7); }
  } else {
    let y = +today.slice(0,4), m = +today.slice(5,7);
    while(true){ const start = y+"-"+String(m).padStart(2,"0")+"-01"; if(start < "2026-08-01") break;
      const end = d2s(new Date(Date.UTC(y, m, 0)));
      out.push({start:start<FROM?FROM:start, end, label:MON[m-1]+" "+y+(end>=today?" (so far)":"")+(start<FROM?" (from Aug 17)":"")});
      m--; if(!m){ m = 12; y--; } }
  }
  return out;
}

/* ---------- the cohort for one period ---------- */
function cohort(p){
  const D = S.data, by = new Map();
  D.hits.forEach(x=>{
    if(x.d < p.start || x.d > p.end) return;
    const c = by.get(x.dom);
    if(!c){ by.set(x.dom, {...x, first:x.d}); return; }
    c.seg = Math.max(c.seg, x.seg); c.cst = c.cst && x.cst;
    if(x.cls==="msp" || (!c.cls && x.cls)) c.cls = x.cls;
    if(!c.stage && x.stage) c.stage = x.stage;
    if(!c.touch && x.touch){ c.touch = x.touch; c.ttype = x.ttype; c.tby = x.tby; }
  });
  const all = [...by.values()], jf = all.filter(c=>c.seg!==2), msp = jf.filter(c=>c.cls==="msp");
  const today = torNow();
  msp.forEach(c=>{
    const b = BK[c.stage||""] || BK[""]; c.how = b.how;
    const tv = ((D.down.get(c.dom)||{}).t||[]).filter(d=>d>=c.first)[0] || null;
    c.tvl = tv;
    c.handed = c.how==="dm" ? c.first : c.how==="tvl" ? tv : null;
    c.waitTvl = c.how==="tvl" && !tv;
    c.hitMs = Date.parse(c.at || (c.first+"T12:00:00-05:00"));
    c.touchMs = c.touch ? Date.parse(c.touch) : null;
    c.biz = c.touchMs ? bizMins(c.hitMs, c.touchMs) : null;
    // open clock for untouched ones (business time since the hit, up to now)
    c.bizOpen = c.touchMs ? null : bizMins(c.hitMs, Date.now());
    c.fast = c.biz != null && c.biz <= 9*60;
    c.dueYet = c.bizOpen == null || c.bizOpen > 9*60;   // has a full business day passed (or been touched)?
    c.booked = (D.books.get(c.dom)||[]).some(d=>d>=c.first && days(c.first, d) <= BOOK_DAYS);
  });
  const act = msp.filter(c=>c.how!=="out"), bookable = msp.filter(c=>!NO_BOOK.has(c.stage||""));
  return { p, today, vis:visitors(p), all, jf, msp, non:jf.filter(c=>c.cls==="non"), act,
    handed:act.filter(c=>c.handed), waiting:act.filter(c=>c.waitTvl),
    worked:act.filter(c=>c.touchMs), fast:act.filter(c=>c.fast), due:act.filter(c=>c.dueYet),
    bookable, booked:bookable.filter(c=>c.booked) };
}
/* ---------- the product side for one period: every company the product team identified on this site ---------- */
function srcCohort(p){
  const by = new Map();
  S.data.src.forEach(r=>{
    if(r.site!==S.site || r.d < p.start || r.d > p.end) return;
    let c = by.get(r.dom);
    if(!c){ c = {dom:r.dom, first:r.d, srcs:new Set(), f0:r.f, f:0, days:0}; by.set(r.dom, c); }
    c.days++; c.f |= r.f; r.srcs.forEach(s=>c.srcs.add(s));
    if(r.d < c.first){ c.first = r.d; c.f0 = r.f; }
  });
  const all = [...by.values()];
  all.forEach(c=>{
    c.msp = !!(c.f & F.MSP);
    c.seen = !!(c.f0 & F.SEEN);                     // visited on an earlier day, before its first hit in this period
    c.lead = !!(c.f0 & F.LEAD);                     // already a lead in the product DB: the bridge never forwards it
    c.email = !!(c.f & F.EMAIL);
    c.reached = !!(c.f & (F.JF|F.CS));
    c.branch = c.lead ? "lead" : c.email ? "email" : "noemail";
  });
  const msp = all.filter(c=>c.msp);
  return { all, seen:all.filter(c=>c.seen), msp, non:all.filter(c=>!c.msp),
    lead:msp.filter(c=>c.branch==="lead"), noemail:msp.filter(c=>c.branch==="noemail"), email:msp.filter(c=>c.branch==="email"),
    reached:msp.filter(c=>c.reached) };
}
/* ---------- trend (JF site): one point per period, oldest -> newest ---------- */
const FIX_DAY = "2026-11-24";   // bridge + Step 1 fixes went live (repeat visitors, company-only hits, bridge posts)
function trend(){
  const keep = S.site; S.site = "jf";
  const P = periods().slice(0, S.view==="week" ? 12 : 12).reverse();
  const rows = P.map(p=>{ const y = srcCohort(p), x = cohort(p);
    const r = (a,b) => b ? Math.round(100*a/b) : null;
    return { p, label: S.view==="week" ? lbl(p.start) : MON[+p.start.slice(5,7)-1], so: p.end >= torNow(),
      fix: p.start <= FIX_DAY && p.end >= FIX_DAY, after: p.start > FIX_DAY,
      msp: y.msp.length, reached: y.reached.length, reachPct: r(y.reached.length, y.msp.length),
      workPct: r(x.worked.length, x.act.length), fastPct: r(x.fast.length, x.due.length), bookPct: r(x.booked.length, x.bookable.length),
      n: { act:x.act.length, due:x.due.length, book:x.bookable.length, worked:x.worked.length, fast:x.fast.length, booked:x.booked.length } }; });
  S.site = keep;
  return rows;
}
function chartSvg(id, rows, series, pct){
  const W = S.chartW || 560, H = 240, ml = 38, mr = 92, mt = 24, mb = 26, n = rows.length;
  const vals = series.flatMap(s=>rows.map(r=>r[s.k])).filter(v=>v!=null);
  let top = pct ? 100 : Math.max(4, ...vals);
  if(!pct){ const raw = top/4, m = Math.pow(10, Math.floor(Math.log10(raw))), st = [1,2,2.5,5,10].map(k=>k*m).find(k=>k>=raw); top = st*4; }   // 4 whole-number gridlines
  const iw = W-ml-mr, ih = H-mt-mb, step = n>1 ? iw/(n-1) : 0;
  const X = i => ml + (n>1 ? i*step : iw/2), Y = v => mt + ih - ih*v/top;
  let s = '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+h(series.map(x=>x.name).join(", "))+' by '+(S.view==="week"?"week":"month")+'">';
  for(let t=0; t<=4; t++){ const v = top*t/4, y = Y(v);
    s += '<line class="grid" x1="'+ml+'" x2="'+(W-mr)+'" y1="'+y+'" y2="'+y+'"/><text x="'+(ml-6)+'" y="'+(y+4)+'" text-anchor="end">'+(pct?Math.round(v)+"%":Math.round(v))+'</text>'; }
  const lw = Math.max(...rows.map(r=>r.label.length+1)) * 6.5 + 12;   // rough label width, so x labels never collide
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / lw) + 1)));
  rows.forEach((r,i)=>{ if((n-1-i) % every === 0) s += '<text x="'+X(i)+'" y="'+(H-8)+'" text-anchor="middle">'+h(r.label)+(r.so?"*":"")+'</text>'; });
  const fi = rows.findIndex(r=>r.fix), ai = rows.findIndex(r=>r.after);
  const mi = fi >= 0 ? fi : ai;
  if(mi >= 0){ const x = X(mi) - (fi >= 0 ? 0 : step/2);
    s += '<line class="fix" x1="'+x+'" x2="'+x+'" y1="'+(mt-6)+'" y2="'+(mt+ih)+'"/><text class="fixl" x="'+(x+4)+'" y="'+(mt-9)+'">Fixes live Nov 24</text>'; }
  const ends = [];
  // the period still in progress is drawn dashed with hollow points: its numbers are not final
  const live = rows.length && rows[n-1].so ? n-1 : -1;
  series.forEach(se=>{
    let d = "", pen = false, dl = "";
    rows.forEach((r,i)=>{ const v = r[se.k]; if(v==null){ pen = false; return; }
      if(i===live){ for(let j=i-1;j>=0;j--) if(rows[j][se.k]!=null){ dl = 'M'+X(j).toFixed(1)+' '+Y(rows[j][se.k]).toFixed(1)+'L'+X(i).toFixed(1)+' '+Y(v).toFixed(1); break; } return; }
      d += (pen?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1); pen = true; });
    s += '<path d="'+d+'" fill="none" stroke="var('+se.c+')" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    if(dl) s += '<path d="'+dl+'" fill="none" stroke="var('+se.c+')" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round"/>';
    rows.forEach((r,i)=>{ const v = r[se.k]; if(v!=null) s += i===live
      ? '<circle cx="'+X(i)+'" cy="'+Y(v)+'" r="4" fill="var(--panel)" stroke="var('+se.c+')" stroke-width="2"/>'
      : '<circle cx="'+X(i)+'" cy="'+Y(v)+'" r="4" fill="var('+se.c+')" stroke="var(--panel)" stroke-width="2"/>'; });
    for(let i=n-1;i>=0;i--){ if(rows[i][se.k]!=null){ ends.push({y:Y(rows[i][se.k]), t:(pct?rows[i][se.k]+"% ":rows[i][se.k]+" ")+se.short}); break; } }
  });
  // end labels: keep 14px apart and inside the plot
  ends.sort((a,b)=>a.y-b.y);
  for(let i=1;i<ends.length;i++) if(ends[i].y - ends[i-1].y < 14) ends[i].y = ends[i-1].y + 14;
  const over = ends.length ? ends[ends.length-1].y - (mt+ih) : 0;
  if(over > 0) ends.forEach(e=>e.y -= over);
  ends.forEach(e=>{ s += '<text class="end" x="'+(W-mr+8)+'" y="'+(e.y+4)+'">'+h(e.t)+'</text>'; });
  s += '<line class="xh" x1="0" x2="0" y1="'+mt+'" y2="'+(mt+ih)+'"/>';
  rows.forEach((r,i)=>{ const w = n>1 ? step : iw; s += '<rect class="hit" data-c="'+id+'" data-i="'+i+'" x="'+(X(i)-w/2)+'" y="'+mt+'" width="'+w+'" height="'+ih+'"/>'; });
  return s + '</svg>';
}
const TREND_COUNT = [ {k:"msp", name:"Scored MSP by the product", short:"MSPs", c:"--c-msp"}, {k:"reached", name:"Reached our engine", short:"reached", c:"--c-reach"} ];
const TREND_RATE = [ {k:"reachPct", name:"Reached our engine", short:"reached", c:"--c-reach"}, {k:"workPct", name:"Worked by a rep", short:"worked", c:"--c-work"},
  {k:"fastPct", name:"Worked within 1 business day", short:"≤1 day", c:"--c-fast"}, {k:"bookPct", name:"Booked a call", short:"booked", c:"--c-book"} ];
function trendHtml(){
  const rows = trend(); S.trendRows = rows; const unit = S.view==="week" ? "week" : "month";
  // draw each chart at its real width so text stays 11px (two side by side when there is room)
  const bw = ($("wfBody").clientWidth || 800), cols = bw >= 2*420 + 12 ? 2 : 1;
  S.chartW = Math.max(300, Math.round((bw - (cols-1)*12) / cols - 30));
  const legend = L => '<div class="wf-legend">'+L.map(s=>'<span><i style="background:var('+s.c+')"></i>'+h(s.name)+'</span>').join("")+'</div>';
  const tbl = '<details class="wf-data"><summary>Show the numbers</summary><div class="table-wrap"><table class="wf-tbl small"><thead><tr><th>'+(unit==="week"?"Week of":"Month")+'</th><th>MSPs</th><th>Reached</th><th>Reached %</th><th>Worked %</th><th>≤1 business day %</th><th>Booked %</th></tr></thead><tbody>'+
    rows.slice().reverse().map(r=>'<tr><td>'+h(r.label)+(r.so?" (so far)":"")+(r.fix?" · fixes live":"")+'</td><td>'+r.msp+'</td><td>'+r.reached+'</td><td>'+(r.reachPct??"–")+(r.reachPct!=null?"%":"")+'</td><td>'+(r.workPct??"–")+(r.workPct!=null?"%":"")+'</td><td>'+(r.fastPct??"–")+(r.fastPct!=null?"%":"")+'</td><td>'+(r.bookPct??"–")+(r.bookPct!=null?"%":"")+'</td></tr>').join("")+'</tbody></table></div></details>';
  return '<div class="wf-trends">'+
    '<div class="wf-chart" data-chart="cnt"><h4>MSPs identified vs reached our engine</h4><p>Companies per '+unit+', JF site</p>'+legend(TREND_COUNT)+chartSvg("cnt", rows, TREND_COUNT, false)+'<div class="wf-tip" role="status"></div></div>'+
    '<div class="wf-chart" data-chart="rate"><h4>Where the rate drops</h4><p>% of the step before, per '+unit+'</p>'+legend(TREND_RATE)+chartSvg("rate", rows, TREND_RATE, true)+'<div class="wf-tip" role="status"></div></div>'+
    '</div>'+tbl;
}
function trendHover(e){
  const t = e.target.closest && e.target.closest("rect.hit"); const card = e.target.closest && e.target.closest(".wf-chart");
  document.querySelectorAll("#wfSec .wf-chart").forEach(c=>{ if(c!==card){ const tp = c.querySelector(".wf-tip"); if(tp) tp.style.display = "none"; const xh = c.querySelector(".xh"); if(xh) xh.style.opacity = 0; } });
  if(!t || !card) return;
  const r = (S.trendRows||[])[+t.dataset.i]; if(!r) return;
  const L = t.dataset.c==="cnt" ? TREND_COUNT : TREND_RATE, pct = t.dataset.c!=="cnt";
  const tip = card.querySelector(".wf-tip"), svg = card.querySelector("svg"), xh = card.querySelector(".xh");
  const cx = +t.getAttribute("x") + (+t.getAttribute("width"))/2; xh.setAttribute("x1", cx); xh.setAttribute("x2", cx); xh.style.opacity = .5;
  tip.innerHTML = '<b>'+h((S.view==="week"?"Week of ":"")+r.label+(r.so?" (so far)":""))+(r.fix||r.after?' · <span style="display:inline;color:var(--ahead)">after fixes</span>':'')+'</b>'+
    L.map(s=>'<span><span style="display:inline"><i style="display:inline-block;width:10px;height:3px;border-radius:2px;background:var('+s.c+');vertical-align:middle;margin-right:5px"></i>'+h(s.name)+'</span><em>'+(r[s.k]==null?"–":r[s.k]+(pct?"%":""))+'</em></span>').join("");
  const box = svg.getBoundingClientRect(), cb = card.getBoundingClientRect(), sx = box.width/(S.chartW || 560);
  tip.style.display = "block";
  let left = box.left - cb.left + cx*sx + 12; if(left + tip.offsetWidth > cb.width - 4) left = box.left - cb.left + cx*sx - tip.offsetWidth - 12;
  tip.style.left = Math.max(4, left)+"px"; tip.style.top = (box.top - cb.top + 8)+"px";
}
function visitors(p){
  const G = S.data.ga, k = p.start+"|all", y = add(torNow(),-1), end = p.end > y ? y : p.end;
  const st = s2d(p.start), whole = S.view==="week" ? (st.getUTCDay()===1 && p.end <= y) : (p.start.slice(8)==="01" && p.end <= y);
  if(whole && G.agg.has((S.view==="week"?"w":"m")+"|"+k)) return {...G.agg.get((S.view==="week"?"w":"m")+"|"+k), exact:true};
  let s = 0, u = 0, n = 0; G.d.forEach(x=>{ if(x.grp==="all" && x.start>=p.start && x.start<=end){ s+=x.s; u+=x.u; n++; } });
  return n ? {s, u, exact:false} : null;
}
const median = a => { if(!a.length) return null; const s = a.slice().sort((x,y)=>x-y), m = s.length>>1; return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
const pct = (a,b) => b ? Math.round(100*a/b)+"%" : "–";

/* ---------- render ---------- */
function render(){
  const body = $("wfBody");
  if(S.err){ body.innerHTML = '<div class="wf-empty"><b>Could not load the RTB numbers.</b>'+h(S.err)+'</div>'; return; }
  if(!S.data){ body.innerHTML = '<div class="wf-empty"><b>Loading the RTB waterfall…</b></div>'; return; }
  const P = periods(); S.idx = Math.min(Math.max(S.idx,0), P.length-1);
  const p = P[S.idx]; $("wfPeriod").textContent = p.label;
  $("wfPrev").disabled = S.idx >= P.length-1; $("wfNext").disabled = S.idx <= 0;
  const x = cohort(p), y = srcCohort(p), jf = S.site==="jf";
  const fastBase = x.due.length;
  const med = median(x.worked.map(c=>c.biz));
  const eng = jf ? x.jf : x.all.filter(c=>c.seg===2);            // what our engine received for this site
  const engMsp = eng.filter(c=>c.cls==="msp");
  const prodMsp = new Set(y.msp.map(c=>c.dom)), fromMsp = eng.filter(c=>prodMsp.has(c.dom)).length;
  const back = L => L.filter(c=>c.reached).length;
  const reachTone = y.msp.length ? (y.reached.length/y.msp.length >= .9 ? "ahead" : "behind") : "";
  const tiles = [
    {n:y.all.length, l:"Companies identified", s:y.msp.length+" scored MSP by the product team"},
    {n:pct(y.reached.length, y.msp.length), l:jf ? "MSPs that reached our engine" : "MSPs that reached us as cross-seeds", s:y.reached.length+" of "+y.msp.length+" identified MSPs", tone:reachTone},
  ].concat(jf ? [
    {n:pct(x.worked.length, x.act.length), l:"Worked by a rep", s:x.worked.length+" of "+x.act.length+" routable MSPs", tone:x.act.length ? (x.worked.length/x.act.length >= .8 ? "ahead" : "behind") : ""},
    {n:pct(x.fast.length, fastBase), l:"Worked within 1 business day", s:fastBase ? x.fast.length+" of "+fastBase+" past their first business day" : "none due yet", tone:fastBase ? (x.fast.length/fastBase >= .8 ? "ahead" : "behind") : ""},
    {n:med==null ? "–" : fmtBiz(med), l:"Median time to first touch", s:"business time, 9 to 6 ET, weekdays"},
    {n:pct(x.booked.length, x.bookable.length), l:"Hit → call booked", s:x.booked.length+" of "+x.bookable.length+" (live deals, clients, DQ left out)"},
  ] : [
    {n:eng.length, l:"Cross-seeds received", s:engMsp.length+" confirmed MSP by our check"},
  ]);
  const vis = x.vis;
  const bySrc = {}; y.all.forEach(c=>c.srcs.forEach(s=>bySrc[s]=(bySrc[s]||0)+1));
  const srcLine = Object.keys(bySrc).sort().map(k=>k.replace(/^SRC-/,"")+" "+bySrc[k]).join(" · ");
  const P1 = y.all.length, P2 = Math.max(1, eng.length);
  const steps = [
    {div:"Before our engine · identified by the product team"},
    jf ? {k:"vis", l:"Website visitors (unique)", n:vis ? vis.u : null, sub:vis ? vis.s.toLocaleString()+" sessions"+(vis.exact?"":" · sum of daily uniques") : "GA not loaded", noList:true, cls:"vis", w:100} : null,
    {k:"id", l:"Companies identified", n:y.all.length, of:jf && vis ? vis.u : null, list:y.all, src:true, max:P1, sub:srcLine ? "By source: "+srcLine : "none"},
    {k:"seen", l:"Visited on an earlier day", n:y.seen.length, of:y.all.length, list:y.seen, src:true, max:P1, cls:"sub info", sub:"Repeat visitors (any earlier hit in the product's history)"},
    {k:"pmsp", l:"Scored MSP by the product", n:y.msp.length, of:y.all.length, list:y.msp, src:true, max:P1, sub:y.non.length.toLocaleString()+" scored not MSP: the bridge never sends those to us"},
    {k:"lead", l:"Already a lead in the product DB", n:y.lead.length, of:y.msp.length, list:y.lead, src:true, max:P1, cls:"sub leak",
      sub:"Until Nov 24 the bridge never forwarded a company twice · "+back(y.lead)+" reached us", warn:y.lead.length-back(y.lead)},
    {k:"noemail", l:"No contact email", n:y.noemail.length, of:y.msp.length, list:y.noemail, src:true, max:P1, cls:"sub leak",
      sub:"Until Nov 24 sent to Clay only · "+back(y.noemail)+" reached us", warn:y.noemail.length-back(y.noemail)},
    {k:"email", l:"With a contact email", n:y.email.length, of:y.msp.length, list:y.email, src:true, max:P1, cls:"sub",
      sub:(jf ? "Posted straight to our engine (dropped by a Step 1 bug until Nov 24) · " : "Posted to the cross-seed webhooks · ")+back(y.email)+" arrived"},
    {k:"reached", l:jf ? "Reached our engine" : "Reached us as cross-seeds", n:y.reached.length, of:y.msp.length, list:y.reached, src:true, max:P1,
      sub:(y.msp.length-y.reached.length)+" MSPs lost before the engine", warn:y.msp.length-y.reached.length},
    {div:"Inside our engine"},
    {k:"recv", l:jf ? "Companies received by the engine" : "Cross-seeds received", n:eng.length, list:eng, max:P2,
      sub:fromMsp+" were product MSPs this period, "+(eng.length-fromMsp)+" came in otherwise (product non-MSPs, earlier hits)"},
    {k:"msp", l:"Confirmed MSP by our check", n:engMsp.length, of:eng.length, list:engMsp, max:P2,
      sub:jf ? x.non.length+" not MSPs, "+(x.jf.length-x.msp.length-x.non.length)+" unclear or clients" : "CST cross-seeds are routed by the CST engine"},
  ].concat(jf ? [
    {k:"act", l:"Routable to a rep", n:x.act.length, of:x.msp.length, list:x.act, max:P2, sub:(x.msp.length-x.act.length)+" clients, DQ'd or not checked"},
    {k:"handed", l:"Handed to a rep", n:x.handed.length, of:x.act.length, list:x.handed, max:P2, sub:x.waiting.length ? x.waiting.length+" still waiting for TVL" : "none waiting for TVL", warn:x.waiting.length},
    {k:"worked", l:"Worked (call, email or meeting after the hit)", n:x.worked.length, of:x.act.length, list:x.worked, max:P2, sub:(x.act.length-x.worked.length)+" with no touch yet"},
    {k:"fast", l:"Worked within 1 business day", n:x.fast.length, of:fastBase, list:x.fast, max:P2, sub:"of the "+fastBase+" whose first business day has passed"},
    {k:"booked", l:"Booked a call (within 90 days)", n:x.booked.length, of:x.bookable.length, list:x.bookable, max:P2, sub:"of "+x.bookable.length+" not already a live deal, client or DQ"},
  ] : []).filter(Boolean);
  const stepRow = s => {
    if(s.div) return '<li class="wf-div" aria-hidden="false">'+h(s.div)+'</li>';
    const w = s.w!=null ? s.w : Math.max(2, Math.round(100*(s.n||0)/Math.max(1, s.max||1)));
    return '<li class="wf-step'+(s.cls?" "+s.cls:"")+'">'+
      '<button type="button" class="wf-stepbtn" data-step="'+s.k+'"'+(s.noList?" disabled":"")+' aria-expanded="'+(S.open===s.k)+'">'+
      '<span class="wf-l">'+h(s.l)+(s.sub?'<small class="'+(s.warn?"warn":"")+'">'+h(s.sub)+'</small>':'')+'</span>'+
      '<span class="wf-bar"><span style="width:'+w+'%"></span></span>'+
      '<span class="wf-n">'+(s.n==null?"–":Number(s.n).toLocaleString())+(s.of!=null?'<small>'+pct(s.n, s.of)+'</small>':'')+'</span></button>'+
      (S.open===s.k ? (s.src ? listSrcHtml(s.list) : listHtml(s.list, s.k)) : "")+'</li>';
  };
  // by source: where each feed falls off before our engine
  const srcKeys = Object.keys(bySrc).sort();
  const srcRow = (label, L) => { const M = L.filter(c=>c.msp), ld = M.filter(c=>c.branch==="lead"), ne = M.filter(c=>c.branch==="noemail"), em = M.filter(c=>c.branch==="email"), r = M.filter(c=>c.reached);
    return '<tr><th scope="row">'+label+'</th><td>'+L.length+'</td><td>'+L.filter(c=>c.seen).length+'</td><td>'+M.length+'</td>'+
      '<td class="'+(ld.length?"leak":"")+'">'+ld.length+'</td><td class="'+(ne.length?"leak":"")+'">'+ne.length+'</td><td>'+em.length+'</td>'+
      '<td>'+r.length+' <small>'+pct(r.length, M.length)+'</small></td></tr>'; };
  const srcRows = srcKeys.map(k=>srcRow(h(srcName(k)), y.all.filter(c=>c.srcs.has(k)))).join("") +
    (srcKeys.length > 1 ? srcRow("All sources", y.all) : "");
  // per-bucket table: where the leaks are
  const rows = BUCKETS.map(b=>{
    const L = x.msp.filter(c=>(c.stage||"")===b.k || (b.k==="" && c.stage==="error")); if(!L.length) return "";
    const handed = L.filter(c=>c.handed).length, worked = L.filter(c=>c.touchMs), due = L.filter(c=>c.dueYet), fast = L.filter(c=>c.fast).length;
    const m = median(worked.map(c=>c.biz)), bk = NO_BOOK.has(b.k) ? null : L.filter(c=>c.booked).length;
    const out = b.how==="out";
    return '<tr><th scope="row" title="'+h(b.tip)+'">'+h(b.label)+'<small>'+(b.how==="dm"?"DM at the hit":b.how==="tvl"?"after TVL":"not routed")+'</small></th>'+
      '<td>'+L.length+'</td><td>'+(out?"–":handed+(handed<L.length?' <small class="warn">'+(L.length-handed)+' waiting</small>':""))+'</td>'+
      '<td>'+(out?"–":worked.length+' <small>'+pct(worked.length, L.length)+'</small>')+'</td>'+
      '<td>'+(out?"–":due.length?fast+' <small>'+pct(fast, due.length)+'</small>':"–")+'</td>'+
      '<td>'+(out?"–":m==null?"–":fmtBiz(m))+'</td><td>'+(bk==null?"–":bk+' <small>'+pct(bk, L.length)+'</small>')+'</td></tr>';
  }).join("");
  // who did the first touch
  const who = {}; x.worked.forEach(c=>{ const k = c.tby || "Unknown owner"; (who[k] = who[k] || []).push(c); });
  const whoRows = Object.keys(who).sort((a,b)=>who[b].length-who[a].length).map(k=>{ const L = who[k];
    return '<tr><th scope="row">'+h(k)+'</th><td>'+L.length+'</td><td>'+L.filter(c=>c.fast).length+'</td><td>'+fmtBiz(median(L.map(c=>c.biz)))+'</td><td>'+
      ["call","email","meeting"].map(t=>{ const n = L.filter(c=>c.ttype===t).length; return n ? n+" "+t+(n>1?"s":"") : ""; }).filter(Boolean).join(", ")+'</td></tr>'; }).join("");
  body.innerHTML =
    '<div class="wf-tiles">'+tiles.map(t=>'<div class="wf-tile"><div class="wf-tn '+(t.tone||"")+'">'+h(t.n)+'</div><div class="wf-tl">'+h(t.l)+'</div><div class="wf-ts">'+h(t.s)+'</div></div>').join("")+'</div>'+
    (jf ? (p.end < FIX_DAY ? '<div class="wf-mark before"><b>Before the Nov 24 fixes.</b> Repeat visitors, company-only hits and direct bridge posts were not reaching our engine in this period.</div>'
      : '<div class="wf-mark"><b>'+(p.start <= FIX_DAY ? "Fixes went live Nov 24, in this period." : "After the Nov 24 fixes.")+'</b> Repeat visitors, company-only MSP hits and bridge posts now reach our engine; emails count as touches.</div>') : '')+
    '<div class="wf-card"><ol class="wf-steps">'+steps.map(s=>stepRow(s)).join("")+'</ol></div>'+
    (jf ? '<h3 class="wf-h3">Trend: is the drop-off shrinking?</h3>'+trendHtml() : '')+
    '<h3 class="wf-h3">By source: where each feed drops off before our engine</h3>'+
    '<div class="table-wrap"><table class="wf-tbl"><thead><tr><th>Source</th><th>Companies identified</th><th>Visited before</th><th>Scored MSP</th><th>MSP: already a lead</th><th>MSP: no contact email</th><th>MSP: with email</th><th>MSPs that reached us</th></tr></thead><tbody>'+
      (srcRows || '<tr><td colspan="8">No identified companies in this period.</td></tr>')+'</tbody></table></div>'+
    (jf ? '<h3 class="wf-h3">Where the MSPs stood, and what happened next</h3>'+
    '<div class="table-wrap"><table class="wf-tbl"><thead><tr><th>HubSpot on the hit day</th><th>MSPs</th><th>Handed to a rep</th><th>Worked</th><th>Within 1 business day</th><th>Median to first touch</th><th>Booked</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    (whoRows ? '<h3 class="wf-h3">Who made the first touch</h3><div class="table-wrap"><table class="wf-tbl"><thead><tr><th>Rep</th><th>First touches</th><th>Within 1 business day</th><th>Median time</th><th>How</th></tr></thead><tbody>'+whoRows+'</tbody></table></div>' : "") : "")+
    '<p class="wf-foot">'+(jf ? 'Trend: one point per '+(S.view==="week"?"week":"month")+' (* = still in progress). Each rate is % of the step before it, so the latest points read low until they mature: worked needs a business day, booked up to 90 days. ' : '')+'Before our engine: every company the product team identified on the '+(jf?"JF":"CST")+' site in the period (their hits database, copied daily at 7:30). '+
    'A company counts once per period; a company seen by two feeds counts under each source in the source table. '+
    '"Already a lead" = the company was in the product leads table before its first hit in the period: the bridge workflow (n8n tchdb48F6TpJ4081) did not forward it until Nov 24, so repeat visitors were lost. '+
    '"No contact email" = until Nov 24 the bridge sent it to Clay only, and it reached us only if Clay sent it back. '+
    'Since Nov 24 both go straight to our engine, and Step 1 reads the bridge posts it used to drop. '+
    'Reached = our engine logged the company from the day before to 3 days after the hit, on '+(jf?"any RTB stream":"any stream (cross-seed or JF)")+'. '+
    (jf ? 'Inside our engine: '+'Cohort: companies hit in the period, followed to today, one line per company (its first hit in the period decides the stage). ' : '')+
    'Worked = the first call (any attempt), outgoing email or meeting logged on the company in HubSpot after the hit, by anyone. Times are business time: 9am to 6pm Toronto, Monday to Friday (1 day = 9 hours). '+
    'Owned deals (missed, stalled, re-engage, live) are DMed to the rep at the hit; everything else is handed over only after TVL. Data from Aug 17, refreshed daily at 7:45am.</p>';
}
function listSrcHtml(list){
  if(!list || !list.length) return '<div class="wf-list"><p class="wf-none">None</p></div>';
  const L = list.slice().sort((a,b)=>a.first<b.first?1:a.first>b.first?-1:a.dom<b.dom?-1:1), CAP = 400;
  const yes = (v, bad) => v ? (bad ? '<span class="warn">Yes</span>' : "Yes") : "–";
  return '<div class="wf-list"><table class="wf-tbl small"><thead><tr><th>Company</th><th>First hit</th><th>Sources</th><th>MSP</th><th>Visited before</th><th>Already a lead</th><th>Contact email</th><th>Reached us</th></tr></thead><tbody>'+
    L.slice(0, CAP).map(c=>'<tr><td><b>'+h(c.dom)+'</b></td><td>'+lbl(c.first)+(c.days>1?' <small>+'+(c.days-1)+' days</small>':'')+'</td><td>'+h([...c.srcs].map(s=>s.replace(/^SRC-/,"")).join(", ")||"–")+'</td>'+
      '<td>'+(c.msp?"Yes":"–")+'</td><td>'+yes(c.seen)+'</td><td>'+yes(c.lead && c.msp, true)+'</td><td>'+yes(c.email)+'</td>'+
      '<td>'+(c.reached?"Yes":(c.msp?'<span class="warn">No</span>':"–"))+'</td></tr>').join("")+
    '</tbody></table>'+(L.length > CAP ? '<p class="wf-none">Showing the latest '+CAP+' of '+L.length.toLocaleString()+'.</p>' : '')+'</div>';
}
function listHtml(list, k){
  if(!list || !list.length) return '<div class="wf-list"><p class="wf-none">None</p></div>';
  const L = list.slice().sort((a,b)=>a.first<b.first?1:-1);
  return '<div class="wf-list"><table class="wf-tbl small"><thead><tr><th>Company</th><th>Hit</th><th>HubSpot</th><th>Handed</th><th>First touch</th>'+(k==="booked"?"<th>Booked</th>":"")+'</tr></thead><tbody>'+
    L.map(c=>{ const b = BK[c.stage||""] || BK[""];
      const handed = c.cls!=="msp" ? "–" : c.how==="dm" ? "DM at the hit" : c.how==="tvl" ? (c.tvl ? "TVL "+lbl(c.tvl) : '<span class="warn">waiting for TVL</span>') : "not routed";
      const t = c.touchMs ? h(c.ttype)+" by "+h(c.tby||"?")+" · "+fmtBiz(c.biz) : (c.cls==="msp" && c.how!=="out" ? '<span class="warn">none yet'+(c.bizOpen!=null?" ("+fmtBiz(c.bizOpen)+" open)":"")+'</span>' : "–");
      return '<tr><td><b>'+h(c.dom)+'</b></td><td>'+lbl(c.first)+'</td><td>'+(c.cls==="msp"?h(b.label):h(c.cls||"not classified"))+'</td><td>'+handed+'</td><td>'+t+'</td>'+
        (k==="booked"?'<td>'+(c.booked?"Yes":"–")+'</td>':"")+'</tr>'; }).join("")+'</tbody></table></div>';
}

/* ---------- load + events ---------- */
async function load(){
  S.err = ""; render();
  try{
    const r = await fetch(API+"/rtb?since="+FROM, {headers:{Authorization:"Bearer "+token()}, cache:"no-store"});
    const j = await r.json().catch(()=>({}));
    if(!r.ok || j.ok===false) throw new Error(j.error || "Request failed ("+r.status+")");
    const ga = {d:[], agg:new Map()};
    (j.ga||[]).forEach(([g, start, grp, s, u])=>{ if(g==="d") ga.d.push({start, grp, s, u}); else ga.agg.set(g+"|"+start+"|"+grp, {s, u}); });
    const hits = (j.hits||[]).map(([d, dom, seg, cst, cls, stage, routed, at, touch, ttype, tby])=>({d, dom, seg, cst, cls, stage, routed, at, touch, ttype, tby}));
    const down = new Map(); (j.down||[]).forEach(([d, dom, k])=>{ const x = down.get(dom) || {t:[], c:[]}; x[k].push(d); down.set(dom, x); });
    const books = new Map(); (j.books||[]).forEach(([d, dom])=>{ (books.get(dom) || books.set(dom, []).get(dom)).push(d); });
    const src = (j.src||[]).map(([d, site, dom, s, f])=>({d, site, dom, srcs:String(s||"").split(",").filter(Boolean), f:+f||0}));
    S.data = {ga, hits, down, books, src};
  }catch(e){ S.err = e.message; }
  render();
}
$("wfBody").addEventListener("mousemove", trendHover);
// charts are sized to their real width, so redraw when the RTB tab is opened (it may have rendered while hidden)
const rtbTab = document.getElementById("tab-rtb"); if(rtbTab) rtbTab.addEventListener("click", ()=>setTimeout(()=>{ if(S.data) render(); }, 0));
let rsz = null; window.addEventListener("resize", ()=>{ clearTimeout(rsz); rsz = setTimeout(()=>{ if(S.data && !$("wfSec").hidden) render(); }, 200); });
$("wfBody").addEventListener("mouseleave", ()=>trendHover({target:document.body}));
$("wfSite").addEventListener("click", e=>{ const b = e.target.closest("button[data-s]"); if(!b) return;
  S.site = b.dataset.s; S.open = null;
  $("wfSite").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", String(x===b))); render(); });
$("wfView").addEventListener("click", e=>{ const b = e.target.closest("button[data-v]"); if(!b) return;
  S.view = b.dataset.v; S.idx = 0; S.open = null;
  $("wfView").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", String(x===b))); render(); });
$("wfPrev").addEventListener("click", ()=>{ S.idx++; S.open = null; render(); });
$("wfNext").addEventListener("click", ()=>{ S.idx--; S.open = null; render(); });
$("wfBody").addEventListener("click", e=>{ const b = e.target.closest("button[data-step]"); if(!b || b.disabled) return;
  S.open = S.open===b.dataset.step ? null : b.dataset.step; render(); });
// last week is the default view: this week is usually too fresh to read
S.idx = 1;
load();
})();
