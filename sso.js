/* Shared sign-in glue for every page.
   - Prefixes "/api/..." and "/auth/..." fetches with the backend URL and adds the session token.
   - Hides the page until the token is verified; bounces to the login page otherwise.
   - Sends people to a page they're allowed on, and adds the small "signed in as" bar. */
(function () {
  var C = window.JF_CONFIG, KEY = 'jf_token';
  var PAGES = { bdr: ['bdr.html', 'BDR tracker'], ae: ['ae.html', 'AE tracker'], cst: ['cst.html', 'CST tracker'], leaderboard: ['leaderboard.html', 'Leaderboard'] };
  var ORDER = ['bdr', 'ae', 'cst', 'leaderboard'];

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

  function bar(u) {
    var nav = ORDER.filter(function (k) { return k !== window.JF_PAGE && u.access.indexOf(k) !== -1; })
      .map(function (k) { return '<a href="' + PAGES[k][0] + '" style="color:#9cf;text-decoration:none">' + PAGES[k][1] + '</a>'; }).join('');
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:99999;font:12px system-ui,sans-serif;background:rgba(20,20,20,.85);color:#eee;padding:6px 10px;border-radius:8px;display:flex;gap:10px;align-items:center';
    d.innerHTML = nav + '<span></span><button style="font:inherit;background:transparent;color:#eee;border:1px solid #777;border-radius:5px;padding:2px 8px;cursor:pointer">Sign out</button>';
    d.querySelector('span').textContent = 'Signed in as ' + u.email;
    d.querySelector('button').onclick = function () { clear(); goLogin(); };
    document.body.appendChild(d);
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
