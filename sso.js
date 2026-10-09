/* Shared sign-in glue for every page.
   - Prefixes "/api/..." and "/auth/..." fetches with the backend URL and adds the session token.
   - Hides the page until the token is verified; bounces to the login page otherwise.
   - Sends people to a page they're allowed on, and adds the small "signed in as" bar. */
(function () {
  var C = window.JF_CONFIG, KEY = 'jf_token';
  var PAGES = { bdr: ['bdr.html', 'BDR tracker'], ae: ['ae.html', 'AE tracker'], cst: ['cst.html', 'CST tracker'], leaderboard: ['leaderboard-auto.html', 'Leaderboard'], reporting: ['reporting.html', 'Sales L10'] }; // auto leaderboard (HubSpot-driven, daily); Max's leaderboard.html still reachable by URL
  var ORDER = ['bdr', 'ae', 'cst', 'leaderboard', 'reporting']; // reporting = admins only (granted by jf-sso)

  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(t) { try { localStorage.setItem(KEY, t); } catch (e) {} }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function goLogin() { location.replace('index.html'); }
  function firstAllowed(u) {
    for (var i = 0; i < ORDER.length; i++) if (u.access.indexOf(ORDER[i]) !== -1) return PAGES[ORDER[i]][0];
    return null;
  }

  var hide = document.createElement('style');
  hide.textContent = 'html{visibility:hidden}';
  if (!window.JF_LOGIN) document.head.appendChild(hide);

  var real = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    if (typeof url === 'string' && (url.indexOf('/api/') === 0 || url.indexOf('/auth/') === 0)) {
      url = C.API_BASE + url;
      opts = opts || {};
      var h = new Headers(opts.headers || {});
      var t = get();
      if (t) h.set('Authorization', 'Bearer ' + t);
      opts.headers = h;
    }
    return real(url, opts).then(function (r) {
      if (r.status === 401 && !window.JF_LOGIN) { clear(); goLogin(); }
      return r;
    });
  };

  // Tab bar across the top of every page: one tab per page the person can open, current page highlighted.
  function bar(u) {
    var css = document.createElement('style');
    css.textContent =
      '.jfnav{position:sticky;top:0;z-index:9999;display:flex;align-items:center;gap:16px;padding:0 20px;height:54px;background:#14213D;color:#E8ECF5;font:14px/1.2 "Segoe UI",system-ui,sans-serif;box-shadow:0 1px 0 rgba(255,255,255,.06),0 4px 14px rgba(10,20,40,.18)}' +
      '.jfnav-brand{font-weight:700;letter-spacing:.02em;white-space:nowrap;opacity:.9}' +
      '.jfnav-tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}' +
      '.jfnav-tabs::-webkit-scrollbar{display:none}' +
      '.jfnav-tabs a{color:#C9D3EA;text-decoration:none;padding:8px 14px;border-radius:8px;font-weight:600;white-space:nowrap}' +
      '.jfnav-tabs a:hover{background:rgba(255,255,255,.08);color:#fff}' +
      '.jfnav-tabs a[aria-current="page"]{background:#fff;color:#14213D}' +
      '.jfnav-me{display:flex;align-items:center;gap:10px;white-space:nowrap;font-size:13px;color:#97A3BD}' +
      '.jfnav-me button{font:inherit;background:transparent;color:#E8ECF5;border:1px solid rgba(255,255,255,.25);border-radius:7px;padding:5px 10px;cursor:pointer}' +
      '.jfnav-me button:hover{background:rgba(255,255,255,.08)}' +
      '@media (max-width:1000px){.jfnav-email{display:none}}' +
      '@media (max-width:720px){.jfnav{gap:10px;padding:0 12px}.jfnav-brand{display:none}}';
    document.head.appendChild(css);
    var tabs = ORDER.filter(function (k) { return u.access.indexOf(k) !== -1; })
      .map(function (k) { return '<a href="' + PAGES[k][0] + '"' + (k === window.JF_PAGE ? ' aria-current="page"' : '') + '>' + PAGES[k][1] + '</a>'; }).join('');
    var d = document.createElement('nav');
    d.className = 'jfnav';
    d.setAttribute('aria-label', 'Trackers');
    d.innerHTML = '<span class="jfnav-brand">JF Sales</span><div class="jfnav-tabs">' + tabs + '</div>' +
      '<div class="jfnav-me"><span class="jfnav-email"></span><button type="button">Sign out</button></div>';
    d.querySelector('.jfnav-email').textContent = u.email;
    d.querySelector('button').title = 'Signed in as ' + u.email;
    d.querySelector('button').onclick = function () { clear(); goLogin(); };
    document.body.insertBefore(d, document.body.firstChild);
  }

  window.JF = {
    setToken: set,
    enter: function (u) { var p = firstAllowed(u); if (p) location.replace(p); else return false; },
  };

  if (window.JF_LOGIN) {
    // already signed in? skip the login card
    if (get()) real(C.API_BASE + '/auth/me', { headers: { Authorization: 'Bearer ' + get() } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (u) { if (u && u.ok) window.JF.enter(u); else clear(); }).catch(function () {});
    return;
  }

  if (!get()) { goLogin(); return; }
  real(C.API_BASE + '/auth/me', { headers: { Authorization: 'Bearer ' + get() } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (u) {
      if (!u || !u.ok) { clear(); goLogin(); return; }
      if (u.access.indexOf(window.JF_PAGE) === -1) {
        var p = firstAllowed(u);
        if (p) location.replace(p);
        else document.body.innerHTML = '<p style="font-family:sans-serif;padding:40px">You do not have access to any pages. Ask RevOps.</p>', hide.remove();
        return;
      }
      hide.remove();
      window.JF_USER = u;
      if (document.body) bar(u); else document.addEventListener('DOMContentLoaded', function () { bar(u); });
    })
    .catch(function () { hide.remove(); });
})();
