/* Call length vs show-up (Reporting page): how long the call that booked a meeting was, against whether the prospect showed.
   Data: Supabase edge fn calltime-report (table cold_booking_calltime, rebuilt daily by the n8n job "Cold booking call time").
   First-time show = showed on the first slot (moved calls left out). Overall = any show incl. after a move, vs no-show; cancels ahead and pending left out.
   Loaded by reporting.html after lb-core.js. Self-contained. */
(function(){
  const API = "https://ottvswkgqohurzilfafu.supabase.co/functions/v1/calltime-report";
  const DEMO = /[?&]demo=1/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const token = () => { try { return localStorage.getItem("jf_token"); } catch(e){ return null; } };
  const css = document.createElement("style");
  css.textContent = `
  #ctPanel{margin:0 0 12px}
  #ctPanel details{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 16px}
  #ctPanel summary{cursor:pointer;font-size:15px;font-weight:600}
  #ctPanel summary .prog{color:var(--muted);font-size:13px;font-weight:400;margin-left:8px}
  #ctPanel .ct-note{color:var(--muted);font-size:13px;margin:8px 0}
  #ctPanel .ct-wrap{overflow-x:auto}
  #ctPanel table{border-collapse:collapse;width:100%;font-size:14px;margin:6px 0 12px}
  #ctPanel th,#ctPanel td{text-align:right;padding:6px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
  #ctPanel th:first-child,#ctPanel td:first-child{text-align:left}
  #ctPanel th{font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
  #ctPanel td small{color:var(--muted)}
  #ctPanel h4{margin:10px 0 2px;font-size:14px}
  `;
  document.head.appendChild(css);
  const pct = (a,b) => b ? Math.round(100*a/b)+"%" : "–";
  const cell = (x, first) => { const a = first ? x.first_show : x.show, b = first ? x.first_show + x.first_noshow : x.show + x.noshow; return b ? `${pct(a,b)} <small>(${b})</small>` : "–"; };
  function render(d){
    let el = document.getElementById("ctPanel");
    if(!el){
      const anchor = document.getElementById("drBar") || document.getElementById("reviewBar"); if(!anchor) return;
      el = document.createElement("div"); el.id = "ctPanel"; anchor.parentNode.insertBefore(el, anchor.nextSibling);
    }
    const rows = d.bands.map((b,i)=>`<tr><td>${esc(b)}</td><td>${cell(d.cold.bands[i],true)}</td><td>${cell(d.cold.bands[i],false)}</td><td>${cell(d.inbound.bands[i],true)}</td><td>${cell(d.inbound.bands[i],false)}</td></tr>`).join("")
      + `<tr><td><b>All</b></td><td><b>${cell(d.cold.all,true)}</b></td><td><b>${cell(d.cold.all,false)}</b></td><td><b>${cell(d.inbound.all,true)}</b></td><td><b>${cell(d.inbound.all,false)}</b></td></tr>`;
    const bdr = d.bdrs.map(b=>`<tr><td>${esc(b.name)}</td><td>${b.all.n}</td><td>${b.median_min}</td><td>${cell(b.all,true)}</td><td>${cell(b.short,true)}</td><td>${cell(b.long,true)}</td></tr>`).join("");
    el.innerHTML = `<details><summary>Booking call length vs show-up<span class="prog">does a longer booking call mean a better show rate?</span></summary>
      <div class="ct-note">The call that booked the meeting, matched from the Nooks call log in HubSpot. Pure cold = first touch was a cold call (${d.cold.matched} of ${d.cold.total} bookings matched to a call). Inbound = first touch was inbound but a rep booked it on the phone (${d.inbound.matched} of ${d.inbound.total}; most inbound leads book themselves). Each cell is the show rate with the number of bookings in brackets. First-time = showed on the first slot, moved calls left out. Overall = showed at all, including after a move; cancels ahead of the call and pending calls left out.${d.updated_at?` Updated ${esc(new Date(d.updated_at).toLocaleDateString())}.`:""}</div>
      <div class="ct-wrap"><table><thead><tr><th>Call length</th><th>Cold: first-time</th><th>Cold: overall</th><th>Inbound: first-time</th><th>Inbound: overall</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h4>By BDR (pure cold, first-time show)</h4>
      <div class="ct-note">If call length really drives showing, each BDR's long calls should beat their own short calls. Short = under 5 minutes.</div>
      <div class="ct-wrap"><table><thead><tr><th>BDR</th><th>Bookings</th><th>Median call (min)</th><th>All calls</th><th>Under 5 min</th><th>5 min+</th></tr></thead><tbody>${bdr||`<tr><td colspan="6">Not enough bookings yet.</td></tr>`}</tbody></table></div>
    </details>`;
  }
  async function load(){
    try{
      const url = DEMO ? "demo-calltime.json" : API;
      const res = await fetch(url, DEMO ? {} : {headers:{Authorization:"Bearer "+token()}, cache:"no-store"});
      const j = await res.json(); if(j && j.ok) render(j);
    }catch(e){}
  }
  let tries = 0;
  const t = setInterval(()=>{ tries++; if(document.getElementById("reviewBar") && (token() || DEMO)){ clearInterval(t); load(); } else if(tries>60) clearInterval(t); }, 300);
})();
