/* InstaGhost — screen privacy for Direct messages.
 *
 * Shoulder-surfing cover: blur names, previews, avatars, bubbles and media in
 * the inbox, then reveal on hover, on a held key, or on click.
 *
 * Two design rules, both learned the hard way:
 *
 *   1. Blur, never hide. A selector that guesses wrong and blurs something is a
 *      cosmetic annoyance; one that guesses wrong and hides something is a
 *      broken inbox and a bug report.
 *   2. Tag once, style with root classes. Elements get a stable `igx-p-*` class
 *      on first sight; turning a setting on or off just flips a class on <html>,
 *      so it is instant and never re-walks the DOM.
 *
 * Instagram's DM markup is unusually volatile, so panes are found structurally —
 * by the conversation links and the message composer — rather than by class
 * names that will not survive the next redesign.
 */
(function () {
  'use strict';
  var IGX = window.IGX;

  var P = IGX.privacy = {};
  var revealing = false;

  /* ------------------------------------------------------------------ *
   * finding the two panes
   * ------------------------------------------------------------------ */

  /* The conversation list: walk up from a thread link until the ancestor holds
   * more than one of them. Those hrefs are the most stable thing on the page. */
  function listPane() {
    var links = IGX.$$('a[href^="/direct/t/"]');
    if (!links.length) return null;
    var node = links[0];
    for (var i = 0; i < 12 && node.parentElement; i++) {
      node = node.parentElement;
      if (node.querySelectorAll('a[href^="/direct/t/"]').length > 1) return node;
    }
    return null;
  }

  /* The open conversation: the composer is unmistakable, so climb from it to
   * the first ancestor wide and tall enough to be the message pane. */
  function conversationPane() {
    var box = document.querySelector('div[contenteditable="true"][role="textbox"], textarea[placeholder]');
    if (!box) return null;
    var node = box;
    for (var i = 0; i < 12 && node.parentElement; i++) {
      node = node.parentElement;
      var r = node.getBoundingClientRect();
      if (r.width > 380 && r.height > 320) return node;
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * tagging
   * ------------------------------------------------------------------ */
  function rowsIn(pane) {
    var rows = IGX.$$('a[href^="/direct/t/"]', pane).map(function (a) {
      return a.closest('[role="listitem"]') || a;
    });
    if (rows.length) return rows;
    return IGX.$$('[role="listitem"], div[role="button"]', pane);
  }

  function tagList() {
    var pane = listPane();
    if (!pane) return;
    if (!pane.classList.contains('igx-p-list')) pane.classList.add('igx-p-list');

    rowsIn(pane).forEach(function (row) {
      if (row.dataset.igxP) return;

      /* Avatars are told apart from post media by size, so a row measured
       * before its images have laid out would classify nothing and — because
       * the stamp below is permanent — never get another chance. Leave it
       * unstamped and try again on the next tick instead. */
      var pending = false;
      IGX.$$('img, canvas', row).forEach(function (n) {
        var r = n.getBoundingClientRect();
        if (!r.width) { pending = true; return; }
        if (r.width <= 80) n.classList.add('igx-p-avatar');
      });

      /* First text-bearing leaf is the name, everything after is the preview
       * and the timestamp. Getting this backwards only means the wrong half is
       * blurred, which is why it is safe to guess. */
      var seenName = false;
      IGX.$$('span, div[dir]', row).forEach(function (n) {
        if (n.querySelector('span, div')) return;             // leaves only
        var t = (n.textContent || '').trim();
        if (!t) return;
        if (!seenName) { n.classList.add('igx-p-name'); seenName = true; }
        else n.classList.add('igx-p-preview');
      });

      if (!pending && seenName) row.dataset.igxP = '1';
    });
  }

  function tagConversation() {
    var pane = conversationPane();
    if (!pane) return;
    if (!pane.classList.contains('igx-p-convo')) pane.classList.add('igx-p-convo');

    IGX.$$('img, video, canvas', pane).forEach(function (n) {
      if (n.dataset.igxP) return;
      var r = n.getBoundingClientRect();
      if (!r.width) return;                    // not laid out yet — retry next tick
      n.dataset.igxP = '1';
      if (r.width > 80) n.classList.add('igx-p-media');
      else n.classList.add('igx-p-avatar');
    });

    IGX.$$('div[role="row"], div[role="listitem"]', pane).forEach(function (n) {
      if (n.dataset.igxP) return;
      n.dataset.igxP = '1';
      n.classList.add('igx-p-bubble');
    });
  }

  /* The composer must never be blurred — you cannot type into what you cannot
   * see, and a blurred input reads as a broken page.
   *
   * The exemption rule is `.igx-p-safe *` with !important, so how far this
   * climbs matters enormously: reach <body> and it cancels every blur on the
   * page, silently turning the whole feature off. Stop at anything tall enough
   * to be more than a composer, and never touch body or html. */
  function protectComposer() {
    var box = document.querySelector('div[contenteditable="true"][role="textbox"], textarea[placeholder]');
    if (!box) return;
    box.classList.add('igx-p-safe');

    var node = box.parentElement;
    for (var i = 0; i < 3; i++) {
      if (!node || node === document.body || node === document.documentElement) break;
      if (node.getBoundingClientRect().height > 220) break;
      node.classList.add('igx-p-safe');
      node = node.parentElement;
    }
  }

  /* ------------------------------------------------------------------ *
   * applying
   * ------------------------------------------------------------------ */
  function root(cls, on) {
    document.documentElement.classList.toggle(cls, !!on);
  }

  function sync(s) {
    var on = s.enabled && IGX.route() === 'dm';
    root('igx-dm-list', on && s.dmBlurList);
    root('igx-dm-names', on && s.dmBlurNames);
    root('igx-dm-previews', on && s.dmBlurPreviews);
    root('igx-dm-avatars', on && s.dmBlurAvatars);
    root('igx-dm-convo', on && s.dmBlurConversation);
    root('igx-dm-media', on && s.dmBlurMedia);

    var mode = s.dmRevealMode || 'hover';
    root('igx-reveal-hover', on && mode === 'hover');
    root('igx-reveal-click', on && mode === 'click');
    root('igx-revealing', revealing);
  }

  /* ------------------------------------------------------------------ *
   * panic mode
   * ------------------------------------------------------------------ */
  P.panic = false;

  P.togglePanic = function (force) {
    P.panic = (force === undefined) ? !P.panic : !!force;
    root('igx-panic', P.panic);
    var btn = document.getElementById('igx-panic-btn');
    if (btn) btn.classList.toggle('igx-on', P.panic);
    IGX.toast(P.panic ? 'Panic mode on — Alt+Shift+P to bring it back' : 'Panic mode off',
      P.panic ? 'warn' : 'ok');
  };

  function panicButton() {
    var existing = document.getElementById('igx-panic-btn');
    if (!IGX.settings.enabled || !IGX.settings.panicButton) {
      if (existing) existing.remove();
      return;
    }
    if (existing || !document.body) return;
    var b = IGX.el('div', {
      id: 'igx-panic-btn',
      class: 'igx-fab' + (P.panic ? ' igx-on' : ''),
      title: 'Panic mode (Alt+Shift+P)',
      html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12"/>' +
        '<circle cx="12" cy="12" r="3"/><path d="m3 3 18 18"/></svg>'
    });
    b.addEventListener('click', function () { P.togglePanic(); });
    document.body.appendChild(b);
  }

  /* ------------------------------------------------------------------ *
   * keyboard
   * ------------------------------------------------------------------ */
  document.addEventListener('keydown', function (e) {
    if (!IGX.settings.enabled) return;
    if (IGX.inOwnUi(e) || IGX.editableTarget(e)) return;

    if (IGX.settings.panicKey && e.altKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault();
      P.togglePanic();
      return;
    }
    if (e.altKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
      e.preventDefault();
      if (!revealing) { revealing = true; sync(IGX.settings); }
    }
  }, true);

  document.addEventListener('keyup', function (e) {
    if (!revealing) return;
    if (e.key === 'Alt' || e.key === 'Shift' || e.key === 'R' || e.key === 'r') {
      revealing = false;
      sync(IGX.settings);
    }
  }, true);

  /* Losing focus with content revealed is exactly the moment you walk away. */
  window.addEventListener('blur', function () {
    if (!revealing) return;
    revealing = false;
    sync(IGX.settings);
  });

  /* ------------------------------------------------------------------ *
   * click to reveal
   * ------------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    if (!IGX.settings.enabled || IGX.settings.dmRevealMode !== 'click') return;
    if (IGX.route() !== 'dm') return;
    var hit = e.target.closest && e.target.closest(
      '.igx-p-name, .igx-p-preview, .igx-p-avatar, .igx-p-media, .igx-p-bubble');
    if (!hit) return;
    hit.classList.toggle('igx-p-shown');
  }, true);

  /* ------------------------------------------------------------------ *
   * module
   * ------------------------------------------------------------------ */
  function undo() {
    ['igx-dm-list', 'igx-dm-names', 'igx-dm-previews', 'igx-dm-avatars',
     'igx-dm-convo', 'igx-dm-media', 'igx-reveal-hover', 'igx-reveal-click',
     'igx-revealing', 'igx-panic'].forEach(function (c) { root(c, false); });
  }

  IGX.register('privacy', {
    apply: function (s) {
      if (!s.enabled) { undo(); panicButton(); return; }
      panicButton();
      sync(s);
    }
  });

  IGX.onTick(function () {
    var s = IGX.settings;
    if (!s.enabled) return;
    if (IGX.route() === 'dm') {
      tagList();
      tagConversation();
      protectComposer();
    }
    sync(s);
  });
})();
