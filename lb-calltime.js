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
  #ctPanel td small,#ctPanel th small{color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0}
  #ctPanel tr.tot td{border-top:2px solid var(--line)}
  #ctPanel .grp th{text-align:center;border-bottom:0;padding-bottom:0}
  #ctPanel .grp th:first-child{text-align:left;vertical-align:bottom}
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
    const row = (label, i, strong) => { const c = i==null ? d.cold.all : d.cold.bands[i], n = i==null ? d.inbound.all : d.inbound.bands[i]; const w = x => strong ? `<b>${x}</b>` : x;
      return `<tr${strong?' class="tot"':""}><td>${w(esc(label))}</td><td>${w(cell(c,true))}</td><td>${w(cell(c,false))}</td><td>${w(cell(n,true))}</td><td>${w(cell(n,false))}</td></tr>`; };
    const rows = d.bands.map((b,i)=>row(b,i,false)).join("") + row("All lengths", null, true);
    const bdr = d.bdrs.map(b=>`<tr><td>${esc(b.name)}</td><td>${b.median_min} min</td><td>${cell(b.all,true)}</td><td>${cell(b.short,true)}</td><td>${cell(b.long,true)}</td></tr>`).join("");
    el.innerHTML = `<details><summary>Booking call length vs show-up<span class="prog">does a longer booking call mean a better show rate?</span></summary>
      <div class="ct-note">Length of the call that booked the meeting (Nooks calls logged in HubSpot). Each cell is the show rate, with the number of bookings in brackets. <b>Showed on first slot</b> leaves out calls that were moved. <b>Showed at all</b> also counts people who showed after a move. Cancelled-ahead and pending bookings are left out of both.</div>
      <div class="ct-wrap"><table><thead>
        <tr class="grp"><th rowspan="2">Booking call length</th><th colspan="2">Cold calls <small>(first touch was a cold call)</small></th><th colspan="2">Inbound leads <small>(a rep booked them by phone)</small></th></tr>
        <tr><th>Showed on first slot</th><th>Showed at all</th><th>Showed on first slot</th><th>Showed at all</th></tr>
      </thead><tbody>${rows}</tbody></table></div>
      <div class="ct-note"><small>Matched to a booking call: ${d.cold.matched} of ${d.cold.total} cold-call bookings, ${d.inbound.matched} of ${d.inbound.total} inbound bookings (most inbound leads book themselves, so they have no call).</small></div>
      <h4>By BDR: cold-call bookings, showed on first slot</h4>
      <div class="ct-note">If call length really drives showing, each BDR's longer calls should beat their own shorter ones.</div>
      <div class="ct-wrap"><table><thead><tr><th>BDR</th><th>Typical booking call</th><th>All calls</th><th>Calls under 5 min</th><th>Calls 5 min or more</th></tr></thead><tbody>${bdr||`<tr><td colspan="5">Not enough bookings yet.</td></tr>`}</tbody></table></div>
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
