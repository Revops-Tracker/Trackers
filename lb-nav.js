/* Sales L10 navigation (2026-11-18): tabs named for the question you are asking, a line that says what you are looking at,
   a "find a number" box, and one place (To review) for things a person has to confirm.
   reporting.html only. Loaded after lb-l10.js. It reuses the scorecard (renderScorecard) with a different row set per tab (SC.only / SC.full / SC.relabel),
   and leaves every other section (People, Deals, Trends, Old vs 3-call close) exactly as it was. */
(function(){
  if(window.JF_PAGE !== "reporting" || typeof l10Tab !== "function" || typeof SC === "undefined") return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  // which scorecard rows belong to which stage
  const ROWS = {
    bk:["dials","connects","rate","conv","c2b","books","rtbl","rtb"],
    su:["due","had","ns","ca","show","rec","first","firstAll","firstExT","cunk","dq"],
    pl:["des","b2d","r2d","dheld","diag","prop","con","arun","ans","ashow","pbook","prun","pns","pshow","slots","cps","sran","rps","cvd","cva","cvp"],
    rv:["won","cwd","crate","cvw","d2w","c2w"],
  };
  const TABS = [
    {id:"ov",  label:"Overview",  kind:"sc", title:"Overview", desc:"The headline numbers for the whole sales process, one column per week or month. Click a group to see more rows, or open one of the stage tabs to go deeper."},
    {id:"bk",  label:"Bookings",  kind:"sc", rows:ROWS.bk, title:"Bookings", relabel:{"Activity (Nooks)":"Calling activity (Nooks)", "Discovery calls":"Calls booked"}, desc:"Calling and booking: how much we dial, how many conversations that creates, and how many discovery calls get booked. Below the table: how long the booking call was against whether the prospect showed up."},
    {id:"su",  label:"Show-up",   kind:"sc", rows:ROWS.su, title:"Show-up", relabel:{"Discovery calls":"Did the prospect show up?"}, desc:"Of the calls that were booked, how many happened, who cancelled, how many were no-shows, and how many came back."},
    {id:"pl",  label:"Pipeline",  kind:"sc", rows:ROWS.pl, title:"Pipeline", relabel:{"Pipeline":"After the discovery call","Conversion (from calls that ran)":"Stage to stage conversion"}, desc:"What happens after the discovery call: designs and audits, prop reviews, contracts, AE time, and how deals convert from one stage to the next."},
    {id:"rv",  label:"Revenue",   kind:"sc", rows:ROWS.rv, title:"Revenue", relabel:{"Revenue":"Closed business"}, desc:"Deals closed won, the monthly revenue they bring, and close rates."},
    {id:"pp",  label:"People",    kind:"o",  title:"People", desc:"One row per person or channel: each BDR, each AE, and each inbound channel."},
    {id:"cl",  label:"Deals",     kind:"o",  title:"Deals", desc:"The deals behind the numbers. Filter by lead type, UTM or revenue band; see close rate by revenue band, why deals were DQ'd or lost, and how long deals take to close."},
    {id:"tr",  label:"Trends",    kind:"o",  title:"Trends", desc:"The same numbers as charts over time."},
    {id:"cmp", label:"Old vs 3-call close", kind:"o", title:"Old vs 3-call close", desc:"The old sales process next to the new 3-call close."},
    {id:"rw",  label:"To review", kind:"rw", title:"To review", desc:"Things only a person can settle. Accepting a deal here writes to HubSpot; settling a cancel here changes the leaderboard."},
  ];
  const OLD = {sc:"ov", bd:"pp", ib:"pp", ax:"pp"};
  const orig = l10Tab;
  let cur = "ov";

  // ---------- page layout: tabs first, then what you are looking at, then the filters, then the data ----------
  const nav = $("l10Tabs"), era = $("l10Era"), tm = $("l10Time");
  nav.innerHTML = TABS.map(t=>`<button role="tab" data-t="${t.id}" aria-selected="false">${esc(t.label)}${t.id==="rw"?'<span class="nv-badge" id="nvBadge" hidden></span>':""}</button>`).join("");
  nav.setAttribute("aria-label", "Sales L10: what do you want to look at?");
  era.parentNode.insertBefore(nav, era);
  const now = document.createElement("div"); now.id = "navNow";
  now.innerHTML = `<div class="nn-top"><div class="nn-desc" id="nnDesc"></div>
      <label class="nn-find"><span>Find a number</span><input id="nnFind" list="nnList" type="search" placeholder="e.g. 1st-time show, MRR, DQ reasons" autocomplete="off"></label><datalist id="nnList"></datalist></div>
    <div class="nn-scope" id="nnScope"></div>`;
  nav.after(now);

  // To review: one home for everything a person has to confirm
  const rw = document.createElement("section"); rw.id = "rwSec"; rw.className = "l10-sec"; rw.dataset.tab = "rw"; rw.hidden = true;
  rw.innerHTML = `<div class="sec-head"><h2>To review</h2></div><p class="sc-note">Nothing here changes by itself: you accept or correct each item.</p><div id="rwMount"></div>`;
  $("scSec").before(rw);
  // booking call length vs show-up lives under Bookings
  const bkx = document.createElement("div"); bkx.id = "bkExtra"; bkx.hidden = true; $("scNote").after(bkx);
  // who the numbers are for sits with the Sales process filter
  const who = $("scView").closest("label");
  if(who){ if(who.firstChild && who.firstChild.nodeType===3) who.firstChild.textContent = "Who "; who.classList.add("nn-who"); era.insertBefore(who, era.querySelector(".era-help")); }

  const css = document.createElement("style");
  css.textContent = `
  html.view-reporting .l10-tabs{margin:0 0 10px;gap:2px 4px}
  .l10-tabs button{position:relative}
  .nv-badge{display:inline-block;margin-left:6px;min-width:18px;padding:0 6px;border-radius:999px;background:var(--gold);color:#fff;font-size:12px;font-weight:700;line-height:18px;text-align:center}
  #navNow{margin:0 0 14px}
  #navNow .nn-top{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:flex-start;justify-content:space-between}
  #navNow .nn-desc{flex:1 1 420px;font-size:15px;line-height:1.45;color:var(--ink);max-width:78ch}
  #navNow .nn-find{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted);flex:0 1 280px}
  #navNow .nn-find input{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:8px;padding:7px 10px;font:inherit;font-size:14px;width:100%}
  #navNow .nn-scope{margin-top:8px;font-size:13px;color:var(--muted)}
  #navNow .nn-scope b{color:var(--ink);font-weight:600}
  .nn-who select{margin-left:2px}
  .l10-era[hidden],.l10-time[hidden],.nn-who[hidden]{display:none!important}
  tr.nn-flash td{animation:nnflash 2.2s ease-out}
  @keyframes nnflash{0%,40%{background:color-mix(in srgb,var(--gold) 35%,transparent)}100%{background:transparent}}
  .nn-flash-box{outline:2px solid var(--gold);outline-offset:4px;border-radius:8px}
  #rwSec #rwMount .rv{margin-bottom:12px}
  `;
  document.head.appendChild(css);

  // ---------- find a number ----------
  const tabOfRow = id => Object.keys(ROWS).find(k=>ROWS[k].includes(id));
  const IDX = []; const seen = new Set();
  (typeof SC_ROWS_ALL !== "undefined" ? SC_ROWS_ALL : []).forEach(m=>{ if(!m.id || !m.label || seen.has(m.label)) return; const t = tabOfRow(m.id); if(!t) return; seen.add(m.label); IDX.push({label:m.label, tab:t, row:m.label}); });
  [["Booking call length vs show-up","bk","#ctPanel"],["Who cancelled (ours or theirs)","su",null],["Deals to review (ARR, DQ, closed lost)","rw",null],["Cancelled calls to settle","rw",null],
   ["Close rate by revenue band","cl","#bnTables"],["Why deals were DQ'd or lost","cl","#dqTables"],["Time and calls to close","cl","#tcTiles"],
   ["BDRs, one row per rep","pp",null],["AEs, one row per AE","pp",null],["Inbound channels","pp",null],["Charts over time","tr",null],["Old vs 3-call close","cmp",null]]
    .forEach(([label,tab,sel])=>IDX.push({label,tab,sel}));
  $("nnList").innerHTML = IDX.map(x=>`<option value="${esc(x.label)}">${esc((TABS.find(t=>t.id===x.tab)||{}).label||"")}</option>`).join("");
  function flash(el, row){ if(!el) return; el.scrollIntoView({block:"center", behavior:"smooth"}); const c = row ? "nn-flash" : "nn-flash-box"; el.classList.add(c); setTimeout(()=>el.classList.remove(c), 2300); }
  function find(q){
    q = (q||"").trim().toLowerCase(); if(!q) return;
    const hit = IDX.find(x=>x.label.toLowerCase()===q) || IDX.find(x=>x.label.toLowerCase().startsWith(q)) || IDX.find(x=>x.label.toLowerCase().includes(q));
    if(!hit){ $("nnFind").setCustomValidity("Nothing called that. Try a word from a row name."); $("nnFind").reportValidity(); setTimeout(()=>$("nnFind").setCustomValidity(""), 1500); return; }
    go(hit.tab);
    setTimeout(()=>{
      if(hit.row){ const r = [...document.querySelectorAll("#scTable tbody tr")].find(tr=>!tr.classList.contains("grp") && tr.firstElementChild.textContent.trim().startsWith(hit.row)); flash(r, true); }
      else if(hit.sel){ flash(document.querySelector(hit.sel), false); }
    }, 120);
    $("nnFind").value = "";
  }
  $("nnFind").addEventListener("change", e=>find(e.target.value));
  $("nnFind").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); find(e.target.value); } });

  // ---------- the line that says what you are looking at ----------
  function scopeNow(){
    const T = TABS.find(t=>t.id===cur) || TABS[0];
    const bits = [];
    if(T.kind==="sc"){ const s = $("scView"); if(s && s.selectedOptions[0]) bits.push(`<b>${esc(s.selectedOptions[0].textContent)}</b>`); }
    if(T.kind!=="rw"){
      const lab = $("gLabel"); if(lab) bits.push(`<b>${esc(lab.textContent)}</b>`);
      const era = document.querySelector("#eraSeg [aria-pressed=true]"); if(era) bits.push(`<b>${esc(era.textContent.replace(/\s*\(.*\)/,""))}</b>`);
      const cmp = $("gCmpMode") && $("gCmpMode").value, pv = $("gPrevLbl") && $("gPrevLbl").textContent.replace(/[()]/g,"").trim();
      if(cmp && pv && !/nothing earlier/.test(pv)) bits.push(`compared with ${esc(pv)}`);
    }
    $("nnScope").innerHTML = bits.length ? "Showing: " + bits.join(" · ") : "";
  }
  const later = (()=>{ let q; return ()=>{ clearTimeout(q); q = setTimeout(scopeNow, 30); }; })();
  ["gLabel","gPrevLbl","scView"].forEach(id=>{ const el = $(id); if(el) new MutationObserver(later).observe(el, {childList:true, subtree:true, characterData:true}); });
  new MutationObserver(later).observe($("eraSeg"), {attributes:true, subtree:true, attributeFilter:["aria-pressed"]});
  document.addEventListener("change", later); document.addEventListener("click", later);

  // ---------- review badge ----------
  function badge(){ let n = 0; document.querySelectorAll("#rwMount .rv.todo b").forEach(b=>{ const m = (b.textContent||"").match(/^\s*(\d+)/); if(m) n += +m[1]; });
    const el = $("nvBadge"); if(el){ el.textContent = n; el.hidden = !n; } }
  new MutationObserver(badge).observe($("rwMount"), {childList:true, subtree:true, characterData:true});

  // ---------- switching tabs ----------
  function go(id){
    id = OLD[id] || id;
    if(["bd","ib","ax"].includes(id)) return orig(id);
    const T = TABS.find(t=>t.id===id) || TABS[0];
    cur = T.id;
    if(T.kind==="sc"){
      SC.only = T.rows ? new Set(T.rows) : null; SC.full = !!T.rows; SC.relabel = T.relabel || null;
      rw.hidden = true; orig("sc");
      if(document.querySelector("#scTable table") && typeof renderScorecard==="function") renderScorecard();
    } else if(T.kind==="rw"){
      orig("sc"); document.querySelectorAll("section[data-tab]").forEach(s=>s.hidden = true); rw.hidden = false;
      const pb = $("ppBar"); if(pb) pb.hidden = true;
    } else { rw.hidden = true; orig(T.id); }
    nav.querySelectorAll("button").forEach(b=>b.setAttribute("aria-selected", String(b.dataset.t===cur)));
    try{ localStorage.setItem("jf_l10_tab", cur); }catch(e){}
    const h2 = document.querySelector("#scSec .sec-head h2"); if(h2 && T.kind==="sc") h2.textContent = T.title;
    $("nnDesc").textContent = T.desc;
    bkx.hidden = cur!=="bk";
    era.hidden = tm.hidden = T.kind==="rw";   // the filters do not apply to the review list
    if(who) who.hidden = T.kind!=="sc";
    // hints under the time bar used the old tab ids
    ["ov","bk","su","pl","rv"].forEach(k=>{ if(typeof G_HINT!=="undefined") G_HINT[k] = G_HINT.sc; });
    if(typeof G_HINT!=="undefined"){ G_HINT.rw = ""; }
    if(typeof gUI==="function") gUI();
    scopeNow(); badge();
  }
  window.l10Tab = go; l10Tab = go;
  nav.querySelectorAll("button").forEach(b=>b.onclick = ()=>go(b.dataset.t));
  window.JF_NAV = {go, tabs:TABS};

  // restore the saved tab (old ids map to the new ones)
  let t0 = "ov"; try{ t0 = localStorage.getItem("jf_l10_tab") || "ov"; }catch(e){}
  go(TABS.some(t=>t.id===t0) ? t0 : (OLD[t0] || "ov"));
})();
