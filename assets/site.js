/* Shared behaviour for project sub-pages: language switcher + theme toggle.
   English lives in each page's HTML; es/fr/de come from i18n/sub-<lang>.json
   (same ?lang= and localStorage 'lang' / 'theme' keys as index.html). */
(function () {
  var C = { langs: ['en', 'es', 'fr', 'de'], fallback: 'en', path: 'i18n/sub-' };
  var root = document.documentElement;
  var lang = C.fallback;

  // Decide the initial language before first paint
  try {
    var q = new URLSearchParams(location.search).get('lang');
    var saved = localStorage.getItem('lang');
    if (C.langs.indexOf(q) > -1) lang = q;
    else if (C.langs.indexOf(saved) > -1) lang = saved;
  } catch (e) {}
  root.lang = lang;
  if (lang !== C.fallback) {
    root.classList.add('i18n-pending');
    setTimeout(function () { root.classList.remove('i18n-pending'); }, 2500);
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var dict = null, token = 0, cache = {}, items = [], attrs = [];

    // ── Theme toggle (pages default to dark; data-theme="dark" is set by the head script) ──
    var tbtn = document.getElementById('theme-toggle');
    if (tbtn) tbtn.addEventListener('click', function () {
      var isDark = root.getAttribute('data-theme') === 'dark';
      if (isDark) { root.removeAttribute('data-theme'); try { localStorage.setItem('theme', 'light'); } catch (e) {} }
      else { root.setAttribute('data-theme', 'dark'); try { localStorage.setItem('theme', 'dark'); } catch (e) {} }
    });

    // ── Collect translatable elements once (English original is kept to switch back) ──
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.dataset.i18n;
      if (el.querySelector('svg')) {
        var tn = Array.prototype.find.call(el.childNodes, function (n) { return n.nodeType === 3 && n.nodeValue.trim(); });
        if (tn) items.push({ key: key, node: tn, orig: tn.nodeValue, text: true });
      } else {
        items.push({ key: key, node: el, orig: el.innerHTML, text: false });
      }
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.dataset.i18nAttr.split(';').forEach(function (pair) {
        var i = pair.indexOf(':'); if (i < 0) return;
        var attr = pair.slice(0, i).trim(), key = pair.slice(i + 1).trim();
        attrs.push({ el: el, attr: attr, key: key, orig: el.getAttribute(attr) });
      });
    });

    function flatten(obj, prefix, out) {
      for (var k in obj) {
        var v = obj[k], p = prefix ? prefix + '.' + k : k;
        if (v && typeof v === 'object') flatten(v, p, out); else out[p] = v;
      }
      return out;
    }
    function load(l) {
      if (!cache[l]) {
        cache[l] = fetch(C.path + l + '.json')
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (j) { return flatten(j, '', {}); });
        cache[l].catch(function () { delete cache[l]; });
      }
      return cache[l];
    }

    function render(l, d) {
      dict = d; root.lang = l;
      items.forEach(function (it) {
        var tr = d && d[it.key] !== undefined ? d[it.key] : undefined;
        if (it.text) {
          var lead = it.orig.match(/^\s*/)[0], trail = it.orig.match(/\s*$/)[0];
          it.node.nodeValue = tr !== undefined ? lead + tr + trail : it.orig;
        } else {
          it.node.innerHTML = tr !== undefined ? tr : it.orig;
        }
      });
      attrs.forEach(function (a) {
        var tr = d && d[a.key] !== undefined ? d[a.key] : undefined;
        a.el.setAttribute(a.attr, tr !== undefined ? tr : a.orig);
      });
      var cur = document.getElementById('lang-current'); if (cur) cur.textContent = l.toUpperCase();
      document.querySelectorAll('#lang-menu [data-lang]').forEach(function (b) {
        b.setAttribute('aria-current', String(b.dataset.lang === l));
      });
    }

    function setLang(l, persist) {
      if (C.langs.indexOf(l) < 0) return;
      var mine = ++token;
      var p = l === C.fallback ? Promise.resolve(null) : load(l);
      p.then(function (d) {
        if (mine !== token) return;
        render(l, d);
        root.classList.remove('i18n-pending');
        if (persist) { try { localStorage.setItem('lang', l); } catch (e) {} }
      }).catch(function (e) {
        console.error('[i18n] Could not load ' + C.path + l + '.json (' + e.message + '). If you opened the file directly (file://), serve the folder with a local web server.');
        root.classList.remove('i18n-pending');
      });
    }

    // ── Dropdown wiring ──
    var sw = document.getElementById('lang-switch'), toggle = document.getElementById('lang-toggle');
    if (sw && toggle) {
      var closeMenu = function () { sw.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = sw.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      document.querySelectorAll('#lang-menu [data-lang]').forEach(function (b) {
        b.addEventListener('click', function () { setLang(b.dataset.lang, true); closeMenu(); });
      });
      document.addEventListener('click', function (e) { if (!sw.contains(e.target)) closeMenu(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    }

    setLang(lang, false);
  });
})();
