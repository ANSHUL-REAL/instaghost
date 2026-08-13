/* InstaGhost — private dislikes.
 * Purely local. Nothing is sent to Instagram; this is a personal blocklist that
 * happens to look like a button. */
(function () {
  'use strict';
  var IGX = window.IGX;
  var CFG = window.IGX_CONFIG;

  var store = {};        // shortcode -> { ts, owner }
  var loaded = false;

  var D = IGX.dislike = {};

  D.load = function (cb) {
    chrome.storage.local.get(CFG.DISLIKE_KEY, function (res) {
      store = (res && res[CFG.DISLIKE_KEY]) || {};
      loaded = true;
      if (cb) cb(store);
    });
  };

  function persist() {
    var patch = {};
    patch[CFG.DISLIKE_KEY] = store;
    chrome.storage.local.set(patch);
  }

  D.all = function () { return store; };
  D.count = function () { return Object.keys(store).length; };
  D.has = function (id) { return !!store[id]; };

  D.toggle = function (id, owner) {
    if (!id) return false;
    if (store[id]) { delete store[id]; }
    else { store[id] = { ts: Date.now(), owner: owner || '' }; }
    persist();
    return !!store[id];
  };

  D.clear = function () { store = {}; persist(); refresh(true); };

  D.remove = function (id) { delete store[id]; persist(); refresh(true); };

  /* ---------------- identity ---------------- */
  function idFor(article) {
    if (!article) return null;
    var link = article.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]');
    var href = link ? link.getAttribute('href') : location.pathname;
    var m = String(href).match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }

  function ownerOf(article) {
    var a = article && article.querySelector('header a[href^="/"]');
    if (a) return a.getAttribute('href').replace(/\//g, '');
    var any = article && article.querySelector('a[href^="/"][role="link"]');
    return any ? any.getAttribute('href').replace(/\//g, '') : '';
  }

  /* ---------------- button ---------------- */
  var ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M17 14V4"/><path d="M21 4v9a1 1 0 0 1-1 1h-3"/>' +
    '<path d="M7 4h7v10l-4 6a2.5 2.5 0 0 1-2.4-3.2L8.5 14H4a2 2 0 0 1-2-2.4l1.2-5.6A2 2 0 0 1 5.2 4H7z"/></svg>';

  function inject() {
    if (!IGX.settings.enabled || !IGX.settings.dislikeEnabled) return;
    IGX.media.actionHosts().forEach(function (h) {
      if (h.bar.querySelector('.igx-dislike')) return;
      var article = h.bar.closest('article') || document.querySelector('div[role="dialog"]') || h.bar;
      var b = IGX.media.makeButton('igx-dislike', 'Dislike (private, only for you)', ICON, function (btn) {
        var id = idFor(article);
        if (!id) { IGX.toast('Cannot identify this post yet — try again in a second.', 'warn'); return; }
        var on = D.toggle(id, ownerOf(article));
        btn.classList.toggle('igx-on', on);
        IGX.toast(on ? 'Disliked. Kept between us.' : 'Dislike removed.', on ? 'ok' : 'info');
        refresh(true);
      });
      var id = idFor(article);
      if (id && store[id]) b.classList.add('igx-on');
      h.button.insertAdjacentElement('afterend', b);
    });
  }

  /* ---------------- effect ---------------- */
  function cover(article) {
    if (article.querySelector(':scope > .igx-cover')) return;
    var c = IGX.el('div', { class: 'igx-cover' }, [
      IGX.el('div', { class: 'igx-cover-text', text: 'You disliked this' }),
      IGX.el('div', { class: 'igx-cover-btn', role: 'button', text: 'Show anyway' })
    ]);
    c.querySelector('.igx-cover-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      article.classList.remove('igx-disliked');
      article.classList.add('igx-revealed');
      c.remove();
    });
    article.appendChild(c);
  }

  function refresh(force) {
    if (!loaded || !IGX.settings.dislikeEnabled) return;
    /* Nothing disliked and nothing currently marked — skip the whole walk. */
    if (!force && !D.count() && !document.querySelector('.igx-disliked')) return;
    var action = IGX.settings.dislikeAction || 'blur';

    IGX.$$('article').forEach(function (article) {
      if (article.classList.contains('igx-revealed') && !force) return;
      var id = idFor(article);
      var hit = id && store[id];

      article.classList.toggle('igx-disliked', !!hit);
      article.setAttribute('data-igx-action', hit ? action : '');
      if (hit && action === 'blur') cover(article);
      if (!hit) {
        var c = article.querySelector(':scope > .igx-cover');
        if (c) c.remove();
        article.classList.remove('igx-revealed');
      }
      /* keep injected buttons in sync */
      IGX.$$('.igx-dislike', article).forEach(function (b) { b.classList.toggle('igx-on', !!hit); });
    });
  }

  /* ---------------- reels auto-skip ---------------- */
  var lastSkip = 0;
  function autoSkip() {
    if (!IGX.settings.dislikeEnabled || !IGX.settings.dislikeAutoSkip) return;
    if (IGX.route() !== 'reel') return;
    if (Date.now() - lastSkip < 1200) return;

    var target = null;
    IGX.$$('article, div[role="presentation"] > div > div').some(function (a) {
      var r = a.getBoundingClientRect();
      if (r.height < 200) return false;
      var centre = r.top + r.height / 2;
      if (centre > 0 && centre < innerHeight) { target = a; return true; }
      return false;
    });
    if (!target) return;

    var id = idFor(target.closest('article') || target);
    if (!id || !store[id]) return;

    lastSkip = Date.now();
    var scroller = target;
    while (scroller && scroller !== document.body) {
      var st = getComputedStyle(scroller);
      if (/(auto|scroll)/.test(st.overflowY) && scroller.scrollHeight > scroller.clientHeight + 40) break;
      scroller = scroller.parentElement;
    }
    var by = Math.max(innerHeight * 0.9, 500);
    if (scroller && scroller !== document.body) scroller.scrollBy({ top: by, behavior: 'smooth' });
    else window.scrollBy({ top: by, behavior: 'smooth' });
    IGX.toast('Skipped a reel you disliked', 'info');
  }

  IGX.register('dislike', {
    apply: function (s) {
      if (!s.enabled || !s.dislikeEnabled) {
        IGX.$$('.igx-dislike').forEach(function (n) { n.remove(); });
        IGX.$$('.igx-disliked').forEach(function (n) {
          n.classList.remove('igx-disliked');
          var c = n.querySelector(':scope > .igx-cover'); if (c) c.remove();
        });
        return;
      }
      inject();
      refresh(true);
    }
  });

  IGX.onTick(function () {
    if (!IGX.settings.enabled || !IGX.settings.dislikeEnabled) return;
    inject();
    refresh(false);
    autoSkip();
  });
})();
