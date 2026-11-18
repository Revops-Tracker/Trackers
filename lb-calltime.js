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
  #ctPanel .few{color:var(--muted);font-style:italic}
  #ctPanel td{line-height:1.25}
  #ctPanel h4{margin:10px 0 2px;font-size:14px}
  `;
  document.head.appendChild(css);
  const cell = (x, first) => { const a = first ? x.first_show : x.show, b = first ? x.first_show + x.first_noshow : x.show + x.noshow;
    if(!b) return "<small>none</small>";
    const t = `<small>${a} of ${b} showed</small>`;
    return `<b>${Math.round(100*a/b)}%</b><br>${t}`; };
  const ccell = x => { if(!x || !x.discos) return "<small>none</small>";
    const m = x.mature ? `<br><small>45+ days old: ${x.mature_won} of ${x.mature}</small>` : "";
    return `<b>${(100*x.won/x.discos).toFixed(1).replace(/\.0$/,"")}%</b><br><small>${x.won} of ${x.discos} closed</small>${m}`; };
  function closeBlock(d){
    if(!d.close) return "";
    const rows = d.bands.map((b,i)=>`<tr><td>${esc(b)}</td><td>${ccell(d.close.cold.bands[i])}</td><td>${ccell(d.close.inbound.bands[i])}</td></tr>`).join("")
      + `<tr class="tot"><td><b>All lengths</b></td><td>${ccell(d.close.cold.all)}</td><td>${ccell(d.close.inbound.all)}</td></tr>`;
    const nc = d.close.cold.all.won;
    return `<h4>Booking call length vs closing</h4>
      <div class="ct-note"><b>How to read it.</b> Same booking-call lengths as above, but the question is: of the meetings that actually <b>happened</b> (a discovery call was held), how many became a won deal? Each deal counts once, at its first held call. The percentage is closed-won deals divided by held discovery calls, so no-shows and cancelled meetings are not in it. The "45+ days old" line is the same count using only calls held at least 45 days ago, because nearly all closes happen within 45 days and newer calls may still close. <b>Only ${nc} cold-call deals have closed so far, so treat each row as a hint, not proof.</b></div>
      <div class="ct-wrap"><table><thead><tr><th>Booking call length</th><th>Cold calls <small>(closed won of discos held)</small></th><th>Inbound leads <small>(closed won of discos held)</small></th></tr></thead><tbody>${rows}</tbody></table></div>`; }
  function render(d){
    let el = document.getElementById("ctPanel");
    if(!el){
      const mount = document.getElementById("bkExtra"), anchor = document.getElementById("drBar") || document.getElementById("reviewBar"); if(!mount && !anchor) return;
      el = document.createElement("div"); el.id = "ctPanel";
      if(mount) mount.appendChild(el); else anchor.parentNode.insertBefore(el, anchor.nextSibling);   // Sales L10: under the Bookings tab
    }
    const row = (label, i, strong) => { const c = i==null ? d.cold.all : d.cold.bands[i], n = i==null ? d.inbound.all : d.inbound.bands[i];
      return `<tr${strong?' class="tot"':""}><td>${strong?`<b>${esc(label)}</b>`:esc(label)}</td><td>${cell(c,true)}</td><td>${cell(c,false)}</td><td>${cell(n,true)}</td><td>${cell(n,false)}</td></tr>`; };
    const rows = d.bands.map((b,i)=>row(b,i,false)).join("") + row("All lengths", null, true);
    const bdr = d.bdrs.map(b=>{ const cnt = b.all.first_show + b.all.first_noshow; return `<tr><td>${esc(b.name)}</td><td>${b.total}</td><td>${cnt}</td><td>${b.median_min} min</td><td>${cell(b.all,true)}</td><td>${cell(b.short,true)}</td><td>${cell(b.long,true)}</td><td>${ccell(b.close)}</td></tr>`; }).join("");
    el.innerHTML = `<details open><summary>Booking call length vs show-up<span class="prog">does a longer booking call mean a better show rate?</span></summary>
      <div class="ct-note"><b>How to read it.</b> We find the call that booked each meeting (Nooks calls logged in HubSpot) and group the meetings by how long that call lasted. Each cell shows the % who showed up, and underneath, how many showed out of how many were counted (people who showed plus people who no-showed). <b>Showed on first slot</b> leaves out calls that were moved. <b>Showed at all</b> also counts people who showed after a move. Cancelled-ahead, pending and no-call-found bookings are not counted.</div>
      <div class="ct-wrap"><table><thead>
        <tr class="grp"><th rowspan="2">Booking call length</th><th colspan="2">Cold calls <small>(first touch was a cold call)</small></th><th colspan="2">Inbound leads <small>(a rep booked them by phone)</small></th></tr>
        <tr><th>Showed on first slot</th><th>Showed at all</th><th>Showed on first slot</th><th>Showed at all</th></tr>
      </thead><tbody>${rows}</tbody></table></div>
      <div class="ct-note"><small>A booking call was found for ${d.cold.matched} of ${d.cold.total} cold-call bookings and ${d.inbound.matched} of ${d.inbound.total} inbound bookings (most inbound leads book themselves, so there is no call).</small></div>
      ${closeBlock(d)}
      <h4>By BDR (cold-call bookings, showed on first slot)</h4>
      <div class="ct-note">If call length really drives showing, a BDR's longer calls should beat their own shorter ones. "Counted" is how many of their bookings made it into the percentages; the rest had no booking call found, were moved, cancelled ahead, or are still pending.</div>
      <div class="ct-wrap"><table><thead><tr><th>BDR</th><th>Cold-call bookings</th><th>Counted</th><th>Typical booking call</th><th>All counted</th><th>Calls under 5 min</th><th>Calls 5 min or more</th><th>Closed won, all calls</th></tr></thead><tbody>${bdr||`<tr><td colspan="8">Not enough bookings yet.</td></tr>`}</tbody></table></div>
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
