/* ---------- Sales L10: RTB waterfall (2026-11-12) ----------
   Website traffic -> companies identified -> MSP / not -> where each MSP stood in HubSpot on the day of the hit -> routed -> TVL -> contacts,
   plus "MSP hit -> call booked" with live deals and clients left out (they are already being worked).
   Data: lb-auto GET /rtb = Supabase rtb_l10_payload():
     ga   [grain d|w|m, start, grp all|core|city|paid, sessions, users]   (GA4 "Jumpfactor.net GA4" 324256089, n8n MG3H1WGmKz9AsL0X daily 7:45)
     hits [date, domain, seg, cst?, class, stage, routed]                 one row per company per day (rtb_funnel_events, Aug 17 on)
          seg 5 core site / 4 paid lander / 3 city page / 2 CST site / 1 page unknown
          class msp | non | client | unclear | ""      stage = deal bucket on the hit day (rtb_hit_stage, v3 rule = RTB engine: live = disco <=45d or call/meeting/email <=30d)
     down [date, domain, t|c]                                             TVL added / contact added
   Loaded only on the Sales L10 (reporting.html). Rows sit in the Scorecard on the "Whole team" view. */
const RTB_FROM = "2026-08-17";
const RTB_SEG = {5:"Core site", 4:"Paid lander", 3:"City page", 2:"CST site", 1:"Page unknown"};
const RTB_STAGE = {net_new:"Net new (not in HubSpot)", crm_no_deal:"In HubSpot, no deal", lost_deal:"Lost deal (reactivation)", stale_deal:"Stalled deal (past the live window)", long_term:"Long Term Pipeline deal",
  missed_deal:"Missed meeting (Reschedule / Proposal No-Show)", reengage_deal:"Re-engage deal (historical)", dq_deal:"DQ'd deal",
  live_deal:"Live deal (with the AE)", client:"Client", error:"Not checked yet", "":"Not checked yet"};
const RTB_CLASS = {msp:"MSP", non:"Not an MSP", client:"Client", unclear:"Unclear", "":"Not classified"};
async function loadRtb(){
  if(window.JF_DEMO){ state.rtb = {ga:[], hits:[], down:[], failed:true}; return; }
  const r = await call("/rtb?since="+RTB_FROM);
  if(!r.ok){ state.rtb = {ga:[], hits:[], down:[], failed:true}; renderScorecard(); return; }
  const ga = {d:[], w:new Map(), m:new Map()};
  (r.ga||[]).forEach(([g, start, grp, s, u])=>{ if(g==="d") ga.d.push({start, grp, s, u}); else ga[g].set(start+"|"+grp, {s, u}); });
  const hits = (r.hits||[]).map(([d, dom, seg, cst, cls, stage, routed])=>({d, dom, seg, cst, cls, stage, routed}));
  const down = new Map();
  (r.down||[]).forEach(([d, dom, k])=>{ const x = down.get(dom) || {t:[], c:[]}; x[k].push(d); down.set(dom, x); });
  // new books per company domain (deal attrs carry the company domain), for hit -> booked
  const books = new Map();
  effShowup().forEach(s=>{ if(s.dropped || !s.booked_at) return; const dom = String(attrOf(s.deal_id).company_domain||"").toLowerCase();
    if(!dom) return; (books.get(dom) || books.set(dom, []).get(dom)).push({d:torDay(s.booked_at), r:s}); });
  state.rtb = {ga, hits, down, books};
  renderScorecard();
}
// unique visitors: exact when the column is one whole GA week / month, otherwise the sum of daily uniques (a person on 2 days counts twice)
function rtbVisitors(p, grp){
  const y = scYest(), end = p.end > y ? y : p.end;
  const st = new Date(p.start+"T12:00:00"), isMon = st.getDay()===1, isFirst = st.getDate()===1;
  const fullW = isMon && Math.round((Date.parse(p.end) - Date.parse(p.start))/864e5)===6, fullM = isFirst && p.end.slice(0,7)===p.start.slice(0,7) && new Date(p.end+"T12:00:00").getDate()===new Date(+p.end.slice(0,4), +p.end.slice(5,7), 0).getDate();
  const G = state.rtb.ga, k = p.start+"|"+grp;
  if(fullW && G.w.has(k)) return {...G.w.get(k), exact:true};
  if(fullM && G.m.has(k)) return {...G.m.get(k), exact:true};
  let s = 0, u = 0, n = 0;
  G.d.forEach(x=>{ if(x.grp===grp && x.start>=p.start && x.start<=end){ s += x.s; u += x.u; n++; } });
  return n ? {s, u, exact:false} : null;
}
// everything the RTB rows need for one period: one entry per company (its first hit in the period decides the stage)
function scRtb(view, p){
  if(!view.rtb || !state.rtb || state.rtb.failed) return null;
  if(p.end < RTB_FROM) return null;
  const by = new Map();
  state.rtb.hits.forEach(h=>{
    if(h.d < p.start || h.d > p.end) return;
    const c = by.get(h.dom);
    if(!c){ by.set(h.dom, {...h, first:h.d, routedAny:!!h.routed}); return; }
    c.seg = Math.max(c.seg, h.seg); c.cst = c.cst && h.cst;
    if(h.cls==="msp" || (!c.cls && h.cls)) c.cls = h.cls;
    if(!c.stage && h.stage) c.stage = h.stage;
    if(h.routed) c.routedAny = true;
  });
  const all = [...by.values()], jf = all.filter(c=>c.seg!==2), cst = all.filter(c=>c.seg===2);
  const msp = jf.filter(c=>c.cls==="msp");
  const later = (dom, k, from) => ((state.rtb.down.get(dom)||{})[k]||[]).filter(d=>d>=from);
  const tvl = msp.filter(c=>later(c.dom, "t", c.first).length), con = jf.filter(c=>later(c.dom, "c", c.first).length);
  // hit -> booked: MSPs that weren't a live deal, a client or DQ'd on the hit day; a new book within 90 days after the first hit in the period
  const open = msp.filter(c=>["net_new","crm_no_deal","lost_deal","stale_deal","long_term","missed_deal","reengage_deal"].includes(c.stage));
  const bk = open.filter(c=>(state.rtb.books.get(c.dom)||[]).some(b=>b.d>=c.first && (Date.parse(b.d)-Date.parse(c.first))/864e5 <= RTB_DAYS));
  const vis = rtbVisitors(p, "all");
  return {
    p, vis, core:rtbVisitors(p, "core"), city:rtbVisitors(p, "city"), paid:rtbVisitors(p, "paid"),
    jf, cst, msp, non:jf.filter(c=>c.cls==="non"), unk:jf.filter(c=>c.cls!=="msp" && c.cls!=="non"),
    stage:k=>msp.filter(c=>(c.stage||"")===k || (k==="" && c.stage==="error")),
    routed:msp.filter(c=>c.routedAny), tvl, con, open, bk,
    seg:s=>jf.filter(c=>c.seg===s),
  };
}
const rtbVisSub = v => v ? v.s.toLocaleString("en-US")+" sessions"+(v.exact ? "" : " · sum of daily uniques") : "";
const rtbOfN = (a, b, what) => b ? Math.round(100*a/b)+"% of "+b+" "+what : "";
const SC_RTB_ROWS = [
  {grp:"RTB waterfall (website → MSP → TVL)"},
  {id:"rv",  rtb:true, core:true, label:"Website visitors (unique)", tip:"Unique people on jumpfactor.net (GA4, bots Google knows about are already removed). Exact for a whole week or month column; for part-periods it adds up daily uniques.", f:x=>x.vis ? x.vis.u : null, sub:x=>rtbVisSub(x.vis)},
  {id:"rvc", rtb:true, label:"· core site pages", tip:"Visitors who landed on the main site (home, services, case studies, blog). Not city pages or paid landers.", f:x=>x.core ? x.core.u : null, sub:x=>rtbVisSub(x.core)},
  {id:"rvt", rtb:true, label:"· city pages", tip:"Visitors who landed on a 'top managed IT services in <city>' page. Mostly end-buyers, not MSPs.", f:x=>x.city ? x.city.u : null, sub:x=>rtbVisSub(x.city)},
  {id:"rvp", rtb:true, label:"· paid landers & funnel pages", tip:"Visitors who landed on ad landers and funnel pages (/fbrtg-, /grtg-, *-50-leads, gppc, /7d, /call, /book-, /thank-you).", f:x=>x.paid ? x.paid.u : null, sub:x=>rtbVisSub(x.paid)},
  {id:"rco", rtb:true, core:true, list:"jf", label:"Companies identified", tip:"Companies the RTB tool identified on the JF site (one per company per period). CST-site companies are in their own row below.", f:x=>x.jf.length, sub:x=>x.vis && x.vis.u ? (Math.round(1000*x.jf.length/x.vis.u)/10)+"% of visitors" : ""},
  {id:"rcs", rtb:true, list:"seg5", label:"· on core site pages", tip:"Identified companies whose visit included a core site page (main site = JF lead if they are an MSP).", f:x=>x.seg(5).length},
  {id:"rcp", rtb:true, list:"seg4", label:"· on paid landers", tip:"Identified companies that only hit paid landers / funnel pages.", f:x=>x.seg(4).length},
  {id:"rct", rtb:true, list:"seg3", label:"· on city pages only", tip:"Identified companies that only hit city pages. An MSP here can still be a JF lead.", f:x=>x.seg(3).length},
  {id:"rcu", rtb:true, list:"seg1", label:"· page not recorded", tip:"Hit with no page recorded (low-intent hits with no contact).", f:x=>x.seg(1).length},
  {id:"rmsp",rtb:true, core:true, list:"msp", label:"MSPs", tip:"Identified companies the MSP scrubber confirmed as MSPs.", f:x=>x.msp.length, sub:x=>rtbOfN(x.msp.length, x.jf.length, "identified")},
  {id:"rnon",rtb:true, list:"non", label:"Not MSPs", tip:"Identified companies the scrubber says are not MSPs (end-buyers, vendors, ISPs, bots).", f:x=>x.non.length},
  {id:"runk",rtb:true, list:"unk", label:"Unclear / clients / not classified", tip:"Scrubber unsure, existing clients, or not classified yet.", f:x=>x.unk.length},
  {id:"rs1", rtb:true, list:"st:net_new", label:"MSP · net new (not in HubSpot)", tip:"Where the MSP stood in HubSpot on the day of the hit.", f:x=>x.stage("net_new").length},
  {id:"rs2", rtb:true, list:"st:crm_no_deal", label:"MSP · in HubSpot, no deal", tip:"Company in HubSpot with no sales deal before the hit (RTB, test, visID, referral and affiliate pipelines don't count as deals).", f:x=>x.stage("crm_no_deal").length},
  {id:"rs3", rtb:true, list:"st:lost_deal", label:"MSP · lost deal (reactivation)", tip:"Its last deal was closed lost before the hit.", f:x=>x.stage("lost_deal").length},
  {id:"rs8", rtb:true, list:"st:missed_deal", label:"MSP · missed meeting deal", tip:"Open deal in Reschedule Needed or Proposal No-Show on the hit day. Routed to the BDR to rebook.", f:x=>x.stage("missed_deal").length},
  {id:"rs4", rtb:true, list:"st:stale_deal", label:"MSP · stalled deal", tip:"Open AE-stage deal past the live window: disco more than 45 days before the hit and no call, meeting or email in the 30 days before (2026: 98% of closes happen within 45 days of the disco). Routed to the BDR (or to the AE when the AE owns it).", f:x=>x.stage("stale_deal").length},
  {id:"rs9", rtb:true, list:"st:reengage_deal", label:"MSP · re-engage deal (historical)", tip:"Open deal tagged Historical/Re-engage (Max's system, assigned to a BDR). Routed to that BDR.", f:x=>x.stage("reengage_deal").length},
  {id:"rs7", rtb:true, list:"st:long_term", label:"MSP · Long Term Pipeline deal", tip:"An open deal parked in the Long Term Pipeline stage. A site visit is the cue to re-engage, so these stay in hit → booked.", f:x=>x.stage("long_term").length},
  {id:"rs5", rtb:true, list:"st:live_deal", label:"MSP · live deal", tip:"Open AE-stage deal inside the live window on the hit day: disco 45 days or less before, or a call, meeting or email in the 30 days before (notes and stage changes don't count). Already being worked by the AE, so left out of hit → booked.", f:x=>x.stage("live_deal").length},
  {id:"rs6", rtb:true, list:"st:client", label:"MSP · client", tip:"A closed-won deal before the hit.", f:x=>x.stage("client").length},
  {id:"rs10", rtb:true, list:"st:dq_deal", label:"MSP · DQ'd deal", tip:"Its deal was DQ'd before the hit. Not routed and left out of hit → booked.", f:x=>x.stage("dq_deal").length},
  {id:"rs0", rtb:true, list:"st:", label:"MSP · stage not checked yet", tip:"The daily 7:45 job hasn't looked this one up yet (or HubSpot failed; it retries).", f:x=>x.stage("").length},
  {id:"rrt", rtb:true, list:"routed", label:"MSPs routed to reps", tip:"MSPs the RTB engine queued for a rep on the hit day.", f:x=>x.routed.length},
  {id:"rtv", rtb:true, core:true, list:"tvl", label:"MSPs distributed (TVL)", tip:"MSPs from the period that got TVL'd (contacts verified and handed to a BDR) on or after their hit, up to today.", f:x=>x.tvl.length, sub:x=>rtbOfN(x.tvl.length, x.msp.length, "MSPs")},
  {id:"rcn", rtb:true, list:"con", label:"Companies with contacts added", tip:"Identified companies that got at least one contact added to HubSpot on or after the hit.", f:x=>x.con.length},
  {id:"rbk", rtb:true, core:true, list:"bk", ratio:true, label:"MSP hit → call booked", tip:"Of MSPs hit in the period that were NOT a live deal, a client or DQ'd that day (net new, no deal, lost, stalled, missed-meeting, re-engage or Long Term deals count), how many booked a new call within 90 days after the hit (any route). Recent periods are still filling up.", f:x=>x.open.length ? x.bk.length/x.open.length : null, sub:x=>x.open.length ? x.bk.length+" of "+x.open.length+" MSPs" : ""},
  {id:"rcst",rtb:true, list:"cst", label:"CST site companies (cross-seed)", tip:"Companies identified on cloudsecuretech.com pages. Their traffic isn't in this GA property.", f:x=>x.cst.length},
];
// its own group at the bottom of the Scorecard
SC_ROWS_ALL.push(...SC_RTB_ROWS);
SC_ROWS = eraPick(SC_ROWS_ALL);

// click a number -> the companies behind it
function rtbList(m, x){
  const L = m.list; let list = [];
  if(L==="jf") list = x.jf; else if(L==="msp") list = x.msp; else if(L==="non") list = x.non; else if(L==="unk") list = x.unk;
  else if(L==="routed") list = x.routed; else if(L==="tvl") list = x.tvl; else if(L==="con") list = x.con; else if(L==="cst") list = x.cst;
  else if(L==="bk") list = x.open; else if(L.startsWith("seg")) list = x.seg(+L.slice(3)); else if(L.startsWith("st:")) list = x.stage(L.slice(3));
  const booked = new Set(x.bk.map(c=>c.dom));
  const li = c => { const t = (state.rtb.down.get(c.dom)||{t:[]}).t.filter(d=>d>=c.first)[0];
    return `<li class="deal"><div><b>${esc(c.dom)}</b> <small>${rtbDay(c.first)} · ${RTB_SEG[c.seg]} · ${RTB_CLASS[c.cls||""]}${c.cls==="msp" ? " · "+RTB_STAGE[c.stage||""] : ""}${t ? " · TVL "+rtbDay(t) : ""}${L==="bk" && booked.has(c.dom) ? " · <b>booked</b>" : ""}</small></div></li>`; };
  document.getElementById("dlgTitle").textContent = m.label.replace(/^· /,"")+" ("+list.length+")";
  document.getElementById("dlgSub").textContent = (x.p.label || (x.p.start+" to "+x.p.end))+". One line per company; the first hit in the period is shown.";
  const groups = L==="bk" ? [["Booked a call", list.filter(c=>booked.has(c.dom))], ["Not booked (yet)", list.filter(c=>!booked.has(c.dom))]] : [[null, list]];
  document.getElementById("dlgList").innerHTML = groups.map(([g, l])=>`${g?`<h4 class="grp">${esc(g)} (${l.length})</h4>`:""}<ul class="deal-list">${l.length ? l.slice().sort((a,b)=>a.first<b.first?1:-1).map(li).join("") : `<li class="deal empty">None</li>`}</ul>`).join("");
  const d = document.getElementById("dlg"); if(!d.open) d.showModal();
}
document.getElementById("scSec").addEventListener("click", e=>{
  const c = e.target.closest("[data-rtb]"); if(!c) return;
  e.stopPropagation();
  const [mi, ci] = c.dataset.rtb.split("|"); const m = SC_ROWS[+mi], col = SC.cols[+ci]; if(!m || !col) return;
  const x = scRtb({rtb:true}, col.p); if(x) rtbList(m, x);
}, true);
