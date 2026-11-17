/* Deal review: one shared list of deals whose fields (claimed ARR, verified band, best known, DQ / Closed lost reason)
   were proposed by the 7:30 evidence pack. Reviewers tick Accept, or change a value first. Accept writes to HubSpot.
   Shown only to the people in deal_review_reviewers (the edge function answers reviewer:false to everyone else).
   Loaded by leaderboard-auto.html and reporting.html AFTER lb-core.js. Self-contained: does not touch lb-core.js. */
(function(){
  const API = "https://ottvswkgqohurzilfafu.supabase.co/functions/v1/deal-review";
  const PORTAL = "1905790";
  const DEMO = /[?&]demo=1/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const S = {loaded:false, reviewer:false, pending:[], cancels:[], done:[], opts:{bands:[],dq:[],lost:[]}, hidden:new Set(), filter:"all", busy:false};
  const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const token = () => { try { return localStorage.getItem("jf_token"); } catch(e){ return null; } };
  const FIELD = {claimed:"Claimed ARR", verified:"JF verified band", best:"Best known", outcome:"Outcome"};
  const DQ_LABEL = {not_an_msp:"Not an MSP", geography:"Geography", cms:"CMS we cannot work on", msp_section_too_small:"MSP section too small", msp_out_of_scope:"MSP out of scope", niche_vertical_only:"Niche vertical only", other:"Other"};
  const CONF_RANK = {high:3, medium:2, low:1, "":3};

  const css = document.createElement("style");
  css.textContent = `
  #drBar{margin:0 0 12px}
  #drBar .rv{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 16px;font-size:15px}
  #drBar .rv.todo{border-color:var(--gold);background:color-mix(in srgb,var(--gold) 10%,var(--panel))}
  #drBar .prog{color:var(--muted);font-size:13px}
  #drDlg{width:min(860px,calc(100vw - 24px));max-height:calc(100vh - 32px)}
  #drDlg .dr-head{padding:16px 20px 8px;position:sticky;top:0;background:var(--panel);z-index:2;border-bottom:1px solid var(--line)}
  #drDlg h3{margin:0 0 4px;font-family:var(--display);font-size:24px}
  #drDlg .dr-sub{margin:0 0 10px;color:var(--muted);font-size:14px}
  #drDlg .dr-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  #drDlg .chip{border:1px solid var(--line);background:var(--chip);border-radius:999px;padding:4px 12px;font-size:13px;cursor:pointer}
  #drDlg .chip.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
  #drDlg .dr-x{position:absolute;right:12px;top:10px;border:0;background:transparent;font-size:26px;cursor:pointer;color:var(--muted)}
  #drList{padding:8px 20px 20px;overflow:auto;max-height:calc(100vh - 190px)}
  .dr-card{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0;background:var(--panel)}
  .dr-top{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:6px}
  .dr-top b{font-size:16px}
  .dr-top .m{color:var(--muted);font-size:13px}
  .dr-top a{font-size:13px}
  .dr-f{display:grid;grid-template-columns:20px 130px 1fr;gap:6px 10px;align-items:start;padding:6px 0;border-top:1px dashed var(--line)}
  .dr-f .lab{font-weight:600;font-size:14px}
  .dr-f .cur{color:var(--muted);font-size:13px}
  .dr-f select,.dr-f textarea{width:100%;max-width:100%;border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:var(--panel);color:var(--ink)}
  .dr-f textarea{min-height:54px;resize:vertical}
  .dr-f .ev{font-size:13px;color:var(--muted);margin-top:4px}
  .dr-f .ev q{color:var(--ink)}
  .dr-row2{display:flex;gap:8px;flex-wrap:wrap}
  .dr-badge{display:inline-block;border-radius:999px;padding:1px 9px;font-size:12px;font-weight:700;margin-left:6px}
  .dr-badge.high{background:color-mix(in srgb,var(--ahead) 18%,var(--panel));color:var(--ahead)}
  .dr-badge.medium{background:color-mix(in srgb,var(--gold) 22%,var(--panel));color:var(--gold)}
  .dr-badge.low{background:color-mix(in srgb,var(--behind) 18%,var(--panel));color:var(--behind)}
  .dr-act{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:8px}
  .dr-act .err{color:var(--behind);font-size:13px;margin-right:auto}
  .dr-empty{padding:28px 0;text-align:center;color:var(--muted)}
  @media (max-width:560px){.dr-f{grid-template-columns:20px 1fr}.dr-f .lab{grid-column:2}.dr-f .val{grid-column:1 / -1}}
  `;
  document.head.appendChild(css);

  async function call(path, body){
    if(DEMO){
      if(path.startsWith("/list")){ try{ return {ok:true, ...(await (await fetch("demo-review.json")).json())}; }catch(e){ return {ok:false}; } }
      return {ok:false, error:"Demo mode: nothing is written to HubSpot"};
    }
    try{
      const res = await fetch(API+path, body ? {method:"POST", headers:{"Content-Type":"application/json", Authorization:"Bearer "+token()}, body:JSON.stringify(body)}
                                             : {headers:{Authorization:"Bearer "+token()}, cache:"no-store"});
      const j = await res.json().catch(()=>({}));
      return res.ok ? {ok:true, ...j} : {ok:false, ...j};
    }catch(e){ return {ok:false, error:"Network error"}; }
  }
  const toast = m => { const t=document.getElementById("toast"); if(!t) return; t.textContent=m; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2600); };

  const visible = () => S.pending.filter(d=>!S.hidden.has(d.deal_id));
  const visCancels = () => S.cancels.filter(c=>!S.hidden.has(c.key));
  const cancelHigh = c => c.verdict!=="unknown" && c.confidence==="high";
  const total = () => visible().length + visCancels().length;
  const minConf = d => { let r=3; for(const k of Object.keys(d.proposals||{})){ const c=(d.proposals[k]||{}).confidence; if(k==="best"||c==null||c==="") continue; r=Math.min(r, CONF_RANK[c]||1); } return r; };
  const isHigh = d => minConf(d)===3 && !(d.proposals.outcome && d.proposals.outcome.flag);

  function renderBar(){
    let el = document.getElementById("drBar");
    if(!el){
      const anchor = document.getElementById("reviewBar");
      if(!anchor) return;
      el = document.createElement("div"); el.id = "drBar"; anchor.parentNode.insertBefore(el, anchor.nextSibling);
    }
    if(!S.reviewer){ el.innerHTML = ""; return; }
    const n = total(), d = S.done.length;
    el.innerHTML = n
      ? `<div class="rv todo"><b>${n} item${n>1?"s":""} to review</b><span class="prog">${d} reviewed in the last 3 days</span><button class="btn" id="drOpen">Review now</button></div>`
      : `<div class="rv"><span>All deals reviewed.</span><span class="prog">${d} reviewed in the last 3 days</span></div>`;
    const b = document.getElementById("drOpen"); if(b) b.onclick = openDlg;
  }

  function fieldRow(d, k){
    const p = d.proposals[k]; if(!p) return "";
    const id = d.deal_id;
    const conf = p.confidence ? `<span class="dr-badge ${esc(p.confidence)}">${esc(p.confidence)}</span>` : "";
    const ev = (p.quote ? `<div class="ev"><q>${esc(p.quote)}</q> <span>(${esc(p.source||"")})</span>${p.math?` <span>· ${esc(p.math)}</span>`:""}</div>` : (p.source?`<div class="ev">${esc(p.source)}</div>`:""));
    if(k==="claimed" || k==="verified"){
      const opts = S.opts.bands.map(b=>`<option ${b===p.proposed?"selected":""}>${esc(b)}</option>`).join("");
      return `<div class="dr-f" data-k="${k}"><input type="checkbox" checked aria-label="Write ${FIELD[k]}"><div class="lab">${FIELD[k]}${conf}</div>
        <div class="val"><div class="cur">now: ${esc(p.current||"blank")}</div><select data-v>${opts}</select>${ev}</div></div>`;
    }
    if(k==="best"){
      return `<div class="dr-f" data-k="best"><span></span><div class="lab">${FIELD.best}</div><div class="val"><div class="cur">now: ${esc(p.current||"blank")} &rarr; <b style="color:var(--ink)">${esc(p.proposed)}</b> (${p.source==="jf_verified"?"JF verified":"claimed"}, worked out when you accept)</div></div></div>`;
    }
    if(k==="outcome"){
      const stage = p.proposed_stage==="DQ" ? "DQ" : "Closed lost";
      let cat = p.proposed; if(cat==="superseded_active") cat = "Duplicate Deal";
      const catOpts = st => (st==="DQ"?S.opts.dq:S.opts.lost.filter(x=>x!=="superseded_active")).map(c=>`<option value="${esc(c)}" ${c===cat?"selected":""}>${esc(st==="DQ"?(DQ_LABEL[c]||c):c)}</option>`).join("");
      const resched = p.proposed_stage==="Reschedule needed";
      return `<div class="dr-f" data-k="outcome" data-cur-stage="${esc(p.current_stage)}"><input type="checkbox" ${resched?"":"checked"} aria-label="Write outcome"><div class="lab">${FIELD.outcome}${conf}</div>
        <div class="val"><div class="cur">now: ${esc(p.current_stage)} / ${esc(p.current||"no reason")}${resched?" &middot; AI says reschedule needed, handle by hand":""}</div>
        <div class="dr-row2"><select data-stage style="width:auto"><option ${stage==="DQ"?"selected":""}>DQ</option><option ${stage==="Closed lost"?"selected":""}>Closed lost</option></select>
        <select data-cat style="flex:1;min-width:160px">${catOpts(stage)}</select></div>
        <textarea data-note>${esc(p.note||"")}</textarea>${ev}${p.flag?`<div class="ev">Flag: ${esc(p.flag)}</div>`:""}</div></div>`;
    }
    return "";
  }

  function card(d){
    const link = `https://app.hubspot.com/contacts/${PORTAL}/record/0-3/${esc(d.deal_id)}`;
    const closed = d.closedate ? String(d.closedate).slice(0,10) : "";
    const rows = ["outcome","claimed","verified","best"].map(k=>fieldRow(d,k)).join("");
    return `<div class="dr-card" data-id="${esc(d.deal_id)}"><div class="dr-top"><b>${esc((d.company||d.deal_name||"").replace(/ Deal 20\d\d$/i,""))}</b><span class="m">${esc(d.stage||"")}${closed?" · closed "+esc(closed):""}</span><a href="${link}" target="_blank" rel="noopener">Open in HubSpot</a></div>
      ${rows}
      <div class="dr-act"><span class="err"></span><button class="btn ghost" data-skip>Skip</button><button class="btn" data-accept>Accept &amp; write</button></div></div>`;
  }

  function cancelCard(c){
    const slot = c.first_slot ? String(c.first_slot).slice(0,10) : "";
    const link = `https://app.hubspot.com/contacts/${PORTAL}/record/0-3/${esc(c.deal_id)}`;
    const conf = `<span class="dr-badge ${esc(c.confidence)}">${esc(c.confidence)}</span>`;
    const pre = c.verdict==="unknown" ? "" : c.verdict;
    return `<div class="dr-card" data-ckey="${esc(c.key)}"><div class="dr-top"><b>${esc((c.company||"Deal "+c.deal_id).replace(/ Deal 20\d\d$/i,""))}</b><span class="m">Who cancelled? · call ${esc(slot)}${c.booker?" · booked by "+esc(c.booker):""}</span><a href="${link}" target="_blank" rel="noopener">Open in HubSpot</a></div>
      <div class="dr-f" style="grid-template-columns:130px 1fr"><div class="lab">Who cancelled${conf}</div><div class="val">
        <div class="cur">The check says: ${c.verdict==="unknown"?"could not tell":esc(c.verdict==="ours"?"we cancelled or moved it":"they cancelled or moved it")}</div>
        <div class="dr-row2"><label><input type="radio" name="w-${esc(c.key)}" value="ours" ${pre==="ours"?"checked":""}> We did (we pulled or moved the call)</label><label><input type="radio" name="w-${esc(c.key)}" value="theirs" ${pre==="theirs"?"checked":""}> They did (prospect cancelled or rescheduled)</label></div>
        ${c.reason?`<div class="ev">${esc(c.reason)}</div>`:""}${c.evidence&&c.evidence!=='""'?`<details class="ev"><summary>Evidence</summary>${esc(c.evidence)}</details>`:""}</div></div>
      <div class="dr-act"><span class="err"></span><button class="btn ghost" data-skip>Skip</button><button class="btn" data-acceptc>Save</button></div></div>`;
  }
  async function acceptCancel(key, cardEl, quiet, forced){
    const c = S.cancels.find(x=>x.key===key); if(!c) return false;
    const err = cardEl && cardEl.querySelector(".err");
    const sel = forced || (cardEl && (cardEl.querySelector("input[type=radio]:checked")||{}).value);
    if(!sel){ if(err) err.textContent = "Pick who cancelled."; return false; }
    if(cardEl) cardEl.querySelectorAll("button").forEach(b=>b.disabled=true);
    const r = await call("/decide-cancel", {key, who:sel});
    if(r.ok){ S.cancels = S.cancels.filter(x=>x.key!==key); S.done.unshift({deal_id:c.deal_id, company:c.company, status:"accepted"}); if(!quiet){ toast("Saved"); renderBar(); renderList(); } return true; }
    if(err) err.textContent = r.error || "Could not save";
    if(cardEl) cardEl.querySelectorAll("button").forEach(b=>b.disabled=false);
    return false;
  }

  function renderList(){
    const list = document.getElementById("drList"); if(!list) return;
    let items = visible(), cits = visCancels();
    if(S.filter==="look"){ items = items.filter(d=>!isHigh(d)); cits = cits.filter(c=>!cancelHigh(c)); }
    if(S.filter==="high"){ items = items.filter(isHigh); cits = cits.filter(cancelHigh); }
    const nHigh = visible().filter(isHigh).length + visCancels().filter(cancelHigh).length;
    document.getElementById("drHigh").textContent = `Accept all high confidence (${nHigh})`;
    document.getElementById("drHigh").disabled = !nHigh || S.busy;
    document.querySelectorAll("#drDlg .chip").forEach(c=>c.classList.toggle("on", c.dataset.f===S.filter));
    list.innerHTML = (items.length||cits.length) ? items.map(card).join("")+cits.map(cancelCard).join("") : `<div class="dr-empty">${total()?"Nothing in this filter.":"All reviewed. Nice."}</div>`;
  }

  function collect(cardEl, d){
    const values = {};
    cardEl.querySelectorAll(".dr-f[data-k]").forEach(f=>{
      const k = f.dataset.k; const cb = f.querySelector("input[type=checkbox]"); if(!cb || !cb.checked) return;
      if(k==="claimed"||k==="verified") values[k] = f.querySelector("[data-v]").value;
      if(k==="outcome") values.outcome = {stage:f.querySelector("[data-stage]").value, category:f.querySelector("[data-cat]").value, note:f.querySelector("[data-note]").value};
    });
    if(d.proposals.best && (values.claimed||values.verified)) values._best = true;
    delete values._best;
    return values;
  }

  async function accept(id, cardEl, quiet){
    const d = S.pending.find(x=>x.deal_id===id); if(!d) return false;
    const err = cardEl && cardEl.querySelector(".err");
    const values = collect(cardEl, d);
    if(!Object.keys(values).length){ if(err) err.textContent = "Tick at least one field to write."; return false; }
    if(cardEl) cardEl.querySelectorAll("button").forEach(b=>b.disabled=true);
    const r = await call("/decide", {deal_id:id, values});
    if(r.ok){
      d.status = r.status; S.pending = S.pending.filter(x=>x.deal_id!==id); S.done.unshift({deal_id:id, company:d.company, status:r.status});
      if(!quiet){ toast("Written to HubSpot"); renderBar(); renderList(); }
      return true;
    }
    if(err) err.textContent = r.error || "Could not save";
    if(cardEl) cardEl.querySelectorAll("button").forEach(b=>b.disabled=false);
    return false;
  }

  function openDlg(){
    let dlg = document.getElementById("drDlg");
    if(!dlg){
      dlg = document.createElement("dialog"); dlg.id = "drDlg";
      dlg.innerHTML = `<div class="dr-head"><button class="dr-x" type="button" aria-label="Close">&times;</button><h3>To review</h3>
        <p class="dr-sub">The 7:30 check read each deal's calls, emails and notes and proposes what to write. Change a value if it is wrong, untick a field to leave it out, then Accept. Accept writes to HubSpot straight away. \"Who cancelled\" cards fix the leaderboard numbers only (nothing goes to HubSpot).</p>
        <div class="dr-tools"><button class="chip on" data-f="all">All</button><button class="chip" data-f="look">Needs a look</button><button class="chip" data-f="high">High confidence</button><span style="flex:1"></span><button class="btn" id="drHigh">Accept all high confidence</button></div></div>
        <div id="drList"></div>`;
      document.body.appendChild(dlg);
      dlg.querySelector(".dr-x").onclick = ()=>dlg.close();
      dlg.addEventListener("click", async e=>{
        const f = e.target.closest(".chip"); if(f){ S.filter = f.dataset.f; renderList(); return; }
        const cardEl = e.target.closest(".dr-card");
        if(e.target.closest("[data-skip]") && cardEl){ S.hidden.add(cardEl.dataset.id||cardEl.dataset.ckey); renderBar(); renderList(); return; }
        if(e.target.closest("[data-acceptc]") && cardEl){ await acceptCancel(cardEl.dataset.ckey, cardEl); return; }
        if(e.target.closest("[data-accept]") && cardEl){ await accept(cardEl.dataset.id, cardEl); return; }
        if(e.target.id==="drHigh"){
          const ids = visible().filter(isHigh).map(d=>d.deal_id), cks = visCancels().filter(cancelHigh).map(c=>c);
          if(!ids.length && !cks.length) return;
          S.busy = true; let ok = 0;
          for(const id of ids){ const c = dlg.querySelector(`.dr-card[data-id="${id}"]`); if(!c) continue; if(await accept(id, c, true)) ok++; }
          for(const c of cks){ if(await acceptCancel(c.key, null, true, c.verdict)) ok++; }
          S.busy = false; toast(ok+" of "+(ids.length+cks.length)+" saved"); renderBar(); renderList(); return;
        }
      });
      dlg.addEventListener("change", e=>{
        const st = e.target.closest("[data-stage]"); if(!st) return;
        const f = st.closest(".dr-f"), cat = f.querySelector("[data-cat]");
        cat.innerHTML = (st.value==="DQ"?S.opts.dq:S.opts.lost.filter(x=>x!=="superseded_active")).map(c=>`<option value="${esc(c)}">${esc(st.value==="DQ"?(DQ_LABEL[c]||c):c)}</option>`).join("");
      });
    }
    renderList(); if(!dlg.open) dlg.showModal();
  }

  async function load(){
    if(!DEMO && !token()) return;
    const r = await call("/list");
    if(!r.ok || !r.reviewer){ S.reviewer = false; renderBar(); return; }
    S.loaded = true; S.reviewer = true; S.pending = r.pending||[]; S.cancels = r.cancels||[]; S.done = r.done||[]; S.opts = r.options||S.opts;
    renderBar();
  }
  // lb-core builds the page and signs the user in; wait for its review bar to exist, then load once
  let tries = 0;
  const t = setInterval(()=>{ tries++; if(document.getElementById("reviewBar")){ clearInterval(t); load(); } else if(tries>60) clearInterval(t); }, 300);
})();
