/* InstaGhost — the features people install modded Android clients for, plus a
 * few that only a browser can do. */
(function () {
  'use strict';
  var IGX = window.IGX;

  var PLUS = IGX.plus = {};

  /* ------------------------------------------------------------------ *
   * exact timestamps
   *
   * Instagram already ships the real time in <time datetime="…">. It just
   * refuses to show it. We add a title for hover and a small absolute stamp
   * beside it — appending a sibling survives React re-renders far better than
   * rewriting their text node would.
   * ------------------------------------------------------------------ */
  function stampTimes() {
    if (!IGX.settings.exactTimestamps) return;
    IGX.$$('time[datetime]:not([data-igx-ts])').forEach(function (t) {
      t.dataset.igxTs = '1';
      var d = new Date(t.getAttribute('datetime'));
      if (isNaN(d.getTime())) return;

      var full = d.toLocaleString(undefined, {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      t.setAttribute('title', full);

      /* Inside a comment or DM row the space is tight — hover is enough. */
      var r = t.getBoundingClientRect();
      if (r.width === 0 || t.closest('[role="row"], li')) return;

      var tag = IGX.el('span', {
        class: 'igx-ts',
        text: d.toLocaleString(undefined, {
          day: 'numeric', month: 'short', year: '2-digit',
          hour: '2-digit', minute: '2-digit'
        })
      });
      t.insertAdjacentElement('afterend', tag);
    });
  }

  /* ------------------------------------------------------------------ *
   * full-size profile pictures
   * ------------------------------------------------------------------ */
  function avatarOf(img) {
    var a = img.closest('a[href^="/"]');
    var name = a ? a.getAttribute('href').replace(/\//g, '') : null;
    if (!name && IGX.route() === 'profile') name = location.pathname.replace(/\//g, '');
    return name ? name.toLowerCase() : null;
  }

  PLUS.openAvatar = function (username, fallbackSrc) {
    IGX.media.record(['avatar:' + username]).then(function (rec) {
      var url = (rec && rec.items[0] && rec.items[0].url) || fallbackSrc;
      if (!url) { IGX.toast('Could not find that picture at full size.', 'warn'); return; }
      lightbox(url, username, rec);
    });
  };

  function lightbox(url, username, rec) {
    var old = document.getElementById('igx-lightbox');
    if (old) old.remove();

    var box = IGX.el('div', { id: 'igx-lightbox' }, [
      IGX.el('div', { class: 'igx-lb-inner' }, [
        IGX.el('img', { src: url, alt: username }),
        IGX.el('div', { class: 'igx-lb-bar' }, [
          IGX.el('span', { class: 'igx-lb-name', text: '@' + username }),
          IGX.el('div', { class: 'igx-lb-btn', role: 'button', text: 'Save' }),
          IGX.el('div', { class: 'igx-lb-btn', role: 'button', text: 'Open original' }),
          IGX.el('div', { class: 'igx-lb-btn igx-lb-x', role: 'button', text: 'Close' })
        ])
      ])
    ]);

    var btns = box.querySelectorAll('.igx-lb-btn');
    btns[0].addEventListener('click', function () {
      IGX.media.download(rec || { owner: username, code: 'avatar', items: [{ type: 'image', url: url }] },
        'profile picture');
    });
    btns[1].addEventListener('click', function () { window.open(url, '_blank', 'noopener'); });
    btns[2].addEventListener('click', function () { box.remove(); });
    box.addEventListener('click', function (e) { if (e.target === box) box.remove(); });

    document.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add('igx-show'); });
  }

  /* Click an avatar anywhere — profile header, feed post, story ring, DM list. */
  document.addEventListener('click', function (e) {
    if (!IGX.settings.enabled || !IGX.settings.avatarViewer) return;
    if (!e.altKey && !e.target.dataset) return;
    var img = e.target.closest && e.target.closest('img');
    if (!img) return;
    var r = img.getBoundingClientRect();
    /* Avatars are small and square. Anything bigger is post media. */
    if (r.width > 190 || Math.abs(r.width - r.height) > 4) return;
    var radius = getComputedStyle(img).borderRadius;
    if (radius.indexOf('%') === -1 && parseFloat(radius) < 12) return;

    var name = avatarOf(img);
    if (!name) return;
    e.preventDefault();
    e.stopPropagation();
    PLUS.openAvatar(name, img.currentSrc || img.src);
  }, true);

  /* ------------------------------------------------------------------ *
   * bulk download — everything currently loaded on the page
   * ------------------------------------------------------------------ */
  PLUS.bulk = function () {
    if (!IGX.settings.bulkDownload) return;

    var codes = [];
    IGX.$$('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]').forEach(function (a) {
      var m = a.getAttribute('href').match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
      if (m && codes.indexOf(m[1]) === -1) codes.push(m[1]);
    });

    if (!codes.length) {
      IGX.toast('No posts found on this page.', 'warn');
      return;
    }

    IGX.toast('Resolving ' + codes.length + ' posts…', 'info');

    var found = 0, missed = 0, files = 0;
    var chain = Promise.resolve();

    codes.forEach(function (code) {
      chain = chain.then(function () {
        return IGX.media.record(['code:' + code]).then(function (rec) {
          if (!rec || !rec.items.length) { missed++; return; }
          found++;
          files += rec.items.length;
          IGX.media.download(rec, null, true);
          /* Space the downloads out — Chrome throttles a burst of them. */
          return IGX.sleep(280);
        });
      });
    });

    chain.then(function () {
      IGX.toast('Saved ' + files + ' file' + (files === 1 ? '' : 's') + ' from ' + found + ' posts.' +
        (missed ? ' ' + missed + ' were not loaded yet — scroll further and run it again.' : ''),
        found ? 'ok' : 'warn');
    });
  };

  /* ------------------------------------------------------------------ *
   * download everything in the open conversation
   * ------------------------------------------------------------------ */
  PLUS.threadId = function () {
    var m = location.pathname.match(/\/direct\/t\/(\d+)/);
    return m ? m[1] : null;
  };

  PLUS.dmGrab = function () {
    var id = PLUS.threadId();
    if (!id) { IGX.toast('Open a conversation first.', 'warn'); return; }

    IGX.media.record(['dm:' + id]).then(function (rec) {
      /* Photos in DMs are plain <img> tags, so scraping catches anything the
       * API payload missed. Videos only ever come from the payload. */
      var dom = IGX.media.scrapeDom(document.querySelector('div[role="grid"], main') || document.body);
      var seen = {};
      var items = [];
      ((rec && rec.items) || []).concat(dom).forEach(function (it) {
        var k = String(it.url).split('?')[0];
        if (seen[k]) return;
        seen[k] = 1;
        items.push(it);
      });

      if (!items.length) { IGX.toast('Nothing saveable loaded in this chat yet.', 'warn'); return; }
      IGX.media.download({ owner: 'direct_' + id.slice(-6), code: 'chat', items: items }, 'conversation');
    });
  };

  /* ------------------------------------------------------------------ *
   * picture-in-picture
   * ------------------------------------------------------------------ */
  var PIP_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="12" width="8" height="6" rx="1"/></svg>';

  function nearestVideo(node) {
    var scope = (node && node.closest && node.closest('article')) || document;
    return scope.querySelector('video') || document.querySelector('video');
  }

  function injectPip() {
    if (!IGX.settings.pipButton) return;
    if (!document.pictureInPictureEnabled) return;

    IGX.media.actionHosts().forEach(function (h) {
      if (h.bar.querySelector('.igx-pip')) return;
      if (!nearestVideo(h.bar)) return;
      var b = IGX.media.makeButton('igx-pip', 'Picture-in-picture', PIP_SVG, function () {
        var v = nearestVideo(h.bar);
        if (!v) { IGX.toast('No video here.', 'warn'); return; }
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
          return;
        }
        v.disablePictureInPicture = false;
        v.requestPictureInPicture().catch(function (err) {
          IGX.toast('Picture-in-picture refused: ' + (err && err.message || 'unknown'), 'warn');
        });
      });
      h.button.insertAdjacentElement('afterend', b);
    });
  }

  /* ------------------------------------------------------------------ *
   * translate
   * ------------------------------------------------------------------ */
  var T_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 5h11"/><path d="M9 3v2c0 5-2.5 8-5 9"/><path d="M7 12c1.5 2.5 4 4 6 4.5"/>' +
    '<path d="m13 21 4-9 4 9"/><path d="M14.5 18h5"/></svg>';

  function captionOf(article) {
    if (!article) return '';
    var h1 = article.querySelector('h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    var spans = IGX.$$('span[dir="auto"]', article);
    for (var i = 0; i < spans.length; i++) {
      var t = spans[i].textContent.trim();
      if (t.length > 25) return t;
    }
    return '';
  }
  PLUS.captionOf = captionOf;

  function injectTranslate() {
    if (!IGX.settings.translateBtn) return;
    IGX.media.actionHosts().forEach(function (h) {
      if (h.bar.querySelector('.igx-tr')) return;
      var article = h.bar.closest('article') || document.querySelector('div[role="dialog"]') || h.bar;
      var b = IGX.media.makeButton('igx-tr', 'Translate this caption', T_SVG, function () {
        var text = captionOf(article);
        if (!text) { IGX.toast('No caption found to translate.', 'warn'); return; }
        var lang = (navigator.language || 'en').split('-')[0];
        window.open('https://translate.google.com/?sl=auto&tl=' + lang +
          '&op=translate&text=' + encodeURIComponent(text.slice(0, 1800)), '_blank', 'noopener');
      });
      h.button.insertAdjacentElement('afterend', b);
    });
  }

  /* ------------------------------------------------------------------ *
   * alt-click to copy any text
   * ------------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    if (!IGX.settings.enabled || !IGX.settings.altCopy) return;
    if (!e.altKey) return;
    var t = e.target;
    if (!t || !t.textContent) return;
    var text = (window.getSelection() && String(window.getSelection()).trim()) || t.textContent.trim();
    if (!text || text.length > 4000) return;
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(function () {
      IGX.toast('Copied ' + (text.length > 40 ? text.slice(0, 40) + '…' : text), 'ok');
    }).catch(function () { IGX.toast('Clipboard blocked by the page.', 'warn'); });
  }, true);

  /* ------------------------------------------------------------------ *
   * caption sidecar files
   * ------------------------------------------------------------------ */
  PLUS.saveCaptionFile = function (rec) {
    if (!IGX.settings.saveCaption || !rec) return;
    var lines = [
      '@' + (rec.owner || 'unknown'),
      rec.code ? 'https://www.instagram.com/p/' + rec.code + '/' : '',
      rec.taken_at ? new Date(rec.taken_at * 1000).toLocaleString() : '',
      '',
      rec.caption || '(no caption)'
    ].filter(Boolean).join('\n');

    var blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (rec.owner || 'instagram') + '_' + (rec.code || rec.pk || 'post') + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1200);
  };

  /* ------------------------------------------------------------------ *
   * module
   * ------------------------------------------------------------------ */
  function undo() {
    IGX.$$('.igx-ts').forEach(function (n) { n.remove(); });
    IGX.$$('[data-igx-ts]').forEach(function (n) { n.removeAttribute('data-igx-ts'); });
    IGX.$$('.igx-pip, .igx-tr').forEach(function (n) { n.remove(); });
    var lb = document.getElementById('igx-lightbox');
    if (lb) lb.remove();
  }

  IGX.register('plus', {
    apply: function (s) {
      undo();
      if (!s.enabled) return;
      stampTimes();
      injectPip();
      injectTranslate();
    }
  });

  IGX.onTick(function () {
    if (!IGX.settings.enabled) return;
    stampTimes();
    injectPip();
    injectTranslate();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var lb = document.getElementById('igx-lightbox');
      if (lb) lb.remove();
    }
  }, true);
})();
