/* InstaGhost — content core: settings, page bridge, DOM utilities. */
(function () {
  'use strict';

  var CFG = window.IGX_CONFIG;

  var IGX = window.IGX = {
    settings: Object.assign({}, CFG.DEFAULTS),
    modules: [],
    ready: false,
    blockedCount: 0
  };

  /* ---------------- module registry ---------------- */
  IGX.register = function (name, mod) {
    mod.name = name;
    IGX.modules.push(mod);
    return mod;
  };

  IGX.applyAll = function () {
    for (var i = 0; i < IGX.modules.length; i++) {
      try {
        if (IGX.modules[i].apply) IGX.modules[i].apply(IGX.settings);
      } catch (e) { console.warn('[InstaGhost]', IGX.modules[i].name, e); }
    }
  };

  /* ---------------- page bridge ---------------- */
  var waiting = {};
  var seq = 0;

  IGX.toPage = function (type, payload) {
    window.postMessage({ __igx: 'content', type: type, payload: payload || {} }, location.origin);
  };

  IGX.ask = function (type, payload, timeoutMs) {
    return new Promise(function (resolve) {
      var id = 'q' + (++seq);
      var done = false;
      waiting[id] = function (data) { done = true; delete waiting[id]; resolve(data); };
      window.postMessage({ __igx: 'content', type: type, payload: payload || {}, id: id }, location.origin);
      setTimeout(function () {
        if (!done) { delete waiting[id]; resolve(null); }
      }, timeoutMs || 15000);
    });
  };

  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var m = ev.data;
    if (!m || m.__igx !== 'page') return;

    if (m.type === 'RESULT' && m.id && waiting[m.id]) { waiting[m.id](m.payload); return; }
    if (m.type === 'READY') { IGX.pushSettings(); return; }
    if (m.type === 'BLOCKED') {
      IGX.blockedCount = m.payload.total;
      IGX.emit('blocked', m.payload);
      return;
    }
    if (m.type === 'MEDIA_CACHED') { IGX.emit('media', m.payload); return; }
    if (m.type === 'DM_THREAD') { IGX.emit('dm', m.payload); return; }
  });

  IGX.pushSettings = function () {
    var page = {};
    var keys = CFG.PAGE_KEYS.concat(CFG.EXTRA_PAGE_KEYS);
    for (var i = 0; i < keys.length; i++) page[keys[i]] = IGX.settings[keys[i]];
    IGX.toPage('SETTINGS', page);
  };

  /* ---------------- tiny event bus ---------------- */
  var listeners = {};
  IGX.on = function (evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); };
  IGX.emit = function (evt, data) {
    (listeners[evt] || []).forEach(function (fn) { try { fn(data); } catch (e) {} });
  };

  /* ---------------- DOM helpers ---------------- */
  IGX.$ = function (sel, root) { return (root || document).querySelector(sel); };
  IGX.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  IGX.el = function (tag, props, kids) {
    var n = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === 'style' && typeof props[k] === 'object') Object.assign(n.style, props[k]);
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2).toLowerCase(), props[k]);
      else if (k === 'class') n.className = props[k];
      else if (k === 'html') n.innerHTML = props[k];
      else if (k === 'text') n.textContent = props[k];
      else n.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  };

  IGX.whenBody = function (fn) {
    if (document.body) return fn();
    new MutationObserver(function (m, obs) {
      if (document.body) { obs.disconnect(); fn(); }
    }).observe(document.documentElement, { childList: true });
  };

  /* One shared, throttled observer — Instagram mutates the DOM constantly and
   * a per-feature observer would melt the tab. */
  var tickers = [];
  IGX.onTick = function (fn) { tickers.push(fn); };

  var scheduled = false;
  function runTickers() {
    scheduled = false;
    for (var i = 0; i < tickers.length; i++) {
      try { tickers[i](); } catch (e) { /* keep the rest alive */ }
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(runTickers, 180);
  }

  IGX.startObserver = function () {
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(schedule, 1500);       // catches attribute-only / canvas-ish changes
    schedule();
  };

  /* ---------------- routing ---------------- */
  var lastHref = location.href;
  IGX.route = function () {
    var p = location.pathname;
    if (p.indexOf('/stories/') === 0) return 'story';
    if (p.indexOf('/reels/') === 0 || p.indexOf('/reel/') === 0) return 'reel';
    if (p.indexOf('/p/') === 0) return 'post';
    if (p.indexOf('/direct/') === 0) return 'dm';
    if (p.indexOf('/explore') === 0) return 'explore';
    if (p === '/' || p === '') return 'home';
    return 'profile';
  };
  IGX.storyKey = function () {
    var m = location.pathname.match(/^\/stories\/([^/]+)\/(\d+)/);
    return m ? { user: m[1], pk: m[2] } : null;
  };

  setInterval(function () {
    if (location.href === lastHref) return;
    lastHref = location.href;
    IGX.emit('route', IGX.route());
    schedule();
  }, 350);

  /* ---------------- keyboard, across the shadow boundary ----------------
   *
   * Events fired inside our shadow root are retargeted on the way out: a
   * listener on document sees the host <div id="igx-root">, not the field, and
   * document.activeElement reports the host too.
   *
   * That breaks every "is the user typing right now?" guard on the page —
   * ours and Instagram's. Theirs is the damaging one: their keyboard shortcuts
   * conclude no field is focused and swallow the character.
   * ------------------------------------------------------------------ */
  function realTarget(e) {
    return (e.composedPath && e.composedPath()[0]) || e.target;
  }

  IGX.editableTarget = function (e) {
    var el = realTarget(e);
    if (!el || !el.tagName) return null;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return el;
    return null;
  };

  IGX.inOwnUi = function (e) {
    var path = (e.composedPath && e.composedPath()) || [];
    for (var i = 0; i < path.length; i++) {
      if (path[i] && path[i].id === 'igx-root') return true;
    }
    return false;
  };

  /* A capture-phase listener on document cannot be blocked without also
   * stopping the field from ever receiving the event. So rather than fight for
   * the keystroke, we notice it never landed and put it back. Costs nothing
   * when nothing is interfering. */
  document.addEventListener('keydown', function (e) {
    if (!IGX.inOwnUi(e)) return;
    var el = IGX.editableTarget(e);
    if (!el || el.isContentEditable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== 'Backspace' && e.key.length !== 1) return;   // skips IME, arrows, F-keys

    var before = el.value;
    var start = el.selectionStart;
    var end = el.selectionEnd;

    setTimeout(function () {
      if (el.value !== before) return;            // it landed on its own
      var s = (start == null) ? el.value.length : start;
      var t = (end == null) ? s : end;

      if (e.key === 'Backspace') {
        if (s === t) { if (!s) return; s -= 1; }
        el.value = el.value.slice(0, s) + el.value.slice(t);
      } else {
        el.value = el.value.slice(0, s) + e.key + el.value.slice(t);
        s += 1;
      }
      try { el.setSelectionRange(s, s); } catch (err) {}
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, 0);
  }, true);

  /* ---------------- toasts ---------------- */
  var toastHost = null;
  IGX.toast = function (msg, kind) {
    if (!document.body) return;
    if (!toastHost) {
      toastHost = IGX.el('div', { id: 'igx-toasts' });
      document.body.appendChild(toastHost);
    }
    var t = IGX.el('div', { class: 'igx-toast igx-toast-' + (kind || 'info'), text: msg });
    toastHost.appendChild(t);
    setTimeout(function () { t.classList.add('igx-out'); }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3100);
  };

  /* ---------------- misc ---------------- */
  IGX.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  IGX.jitter = function (base) { return base + Math.floor(Math.random() * base * 0.4); };
  IGX.fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  IGX.stamp = function (ts) {
    var d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  /* ---------------- settings load ---------------- */
  IGX.loadSettings = function (cb) {
    CFG.getSettings(function (s) {
      IGX.settings = s;
      IGX.pushSettings();
      if (cb) cb(s);
    });
  };

  IGX.set = function (key, value) {
    IGX.settings[key] = value;
    CFG.setSetting(key, value);
    IGX.pushSettings();
    IGX.applyAll();
  };

  CFG.onSettingsChanged(function (s) {
    IGX.settings = s;
    IGX.pushSettings();
    IGX.applyAll();
    IGX.emit('settings', s);
  });
})();
