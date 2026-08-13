/* InstaGhost — media resolution + downloading.
 *
 * Instagram serves video through MSE, so <video>.src is a blob: URL that cannot
 * be saved. The only reliable source is the JSON the app already fetched, which
 * the MAIN-world hook caches for us. DOM scraping is the fallback for images. */
(function () {
  'use strict';
  var IGX = window.IGX;

  var media = IGX.media = {};

  /* ---------------- keys ---------------- */
  function shortcodeFrom(url) {
    var m = String(url || '').match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }

  /* Build the ordered list of cache keys that could hold this media. */
  media.keysFor = function (node) {
    var keys = [];
    var route = IGX.route();

    var article = node && node.closest ? node.closest('article') : null;
    if (article) {
      var link = article.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]');
      var sc = link && shortcodeFrom(link.getAttribute('href'));
      if (sc) keys.push('code:' + sc);
      var owned = article.querySelector('header a[href^="/"]');
      if (owned) {
        var u = owned.getAttribute('href').replace(/\//g, '');
        if (u) keys.push('last:' + u.toLowerCase());
      }
    }

    if (route === 'post' || route === 'reel') {
      var cur = shortcodeFrom(location.pathname);
      if (cur) keys.push('code:' + cur);
    }

    if (route === 'story') {
      var sk = IGX.storyKey();
      if (sk) { keys.push('pk:' + sk.pk); keys.push('last:' + sk.user.toLowerCase()); }
    }

    if (route === 'profile') {
      var un = location.pathname.replace(/\//g, '').toLowerCase();
      if (un) keys.push('avatar:' + un);
    }

    return keys;
  };

  media.record = function (keys) {
    return IGX.ask('GET_MEDIA', { keys: keys }, 4000).then(function (r) {
      return (r && r.ok) ? r.media : null;
    });
  };

  /* ---------------- DOM fallback ---------------- */
  function bestFromSrcset(img) {
    var ss = img.getAttribute('srcset');
    if (!ss) return img.currentSrc || img.src;
    var best = null, bw = 0;
    ss.split(',').forEach(function (part) {
      var bits = part.trim().split(/\s+/);
      var w = parseInt(bits[1] || '0', 10) || 0;
      if (w >= bw) { bw = w; best = bits[0]; }
    });
    return best || img.currentSrc || img.src;
  }

  media.scrapeDom = function (node) {
    var scope = (node && node.closest && node.closest('article')) ||
                document.querySelector('div[role="dialog"]') || document.body;
    var out = [];
    IGX.$$('img[srcset], img[src^="http"]', scope).forEach(function (img) {
      var r = img.getBoundingClientRect();
      if (r.width < 160 || r.height < 160) return;          // avatars, icons
      var u = bestFromSrcset(img);
      if (u && u.indexOf('http') === 0 && out.indexOf(u) === -1) out.push(u);
    });
    return out.map(function (u) { return { type: 'image', url: u }; });
  };

  /* ---------------- download ---------------- */
  function extOf(url, type) {
    var clean = String(url).split('?')[0];
    var m = clean.match(/\.(jpg|jpeg|png|webp|heic|mp4|mov|webm)$/i);
    if (m) return m[1].toLowerCase();
    return type === 'video' ? 'mp4' : 'jpg';
  }

  function safe(s) {
    return String(s || 'instagram').replace(/[^\w.\-]+/g, '_').slice(0, 60);
  }

  media.download = function (rec, label) {
    if (!rec || !rec.items || !rec.items.length) {
      IGX.toast('Nothing to download here yet — scroll the media into view and retry.', 'warn');
      return;
    }
    var s = IGX.settings;
    var owner = safe(rec.owner || 'instagram');
    var tag = safe(rec.code || rec.pk || Date.now());
    var multi = rec.items.length > 1;

    rec.items.forEach(function (item, i) {
      var name = owner + '_' + tag + (multi ? '_' + (i + 1) : '') + '.' + extOf(item.url, item.type);
      var path = s.dlSubfolder ? ('InstaGhost/' + owner + '/' + name) : name;
      chrome.runtime.sendMessage({ type: 'igx:download', url: item.url, filename: path });
    });

    IGX.toast(
      (multi ? rec.items.length + ' files' : (rec.items[0].type === 'video' ? 'Video' : 'Photo')) +
      ' from @' + (rec.owner || 'instagram') + (label ? ' · ' + label : ''),
      'ok'
    );
  };

  /* Resolve the best available source for a node, API first, DOM second. */
  media.grab = function (node, label) {
    var keys = media.keysFor(node);
    return media.record(keys).then(function (rec) {
      if (rec && rec.items.length && IGX.settings.dlOriginalQuality) {
        media.download(rec, label);
        return true;
      }
      var items = media.scrapeDom(node);
      if (items.length) {
        media.download({ owner: rec && rec.owner, code: keys[0] && keys[0].split(':')[1], items: items }, label);
        return true;
      }
      if (rec) { media.download(rec, label); return true; }
      IGX.toast('Could not find a source. Let the post load fully, then try again.', 'warn');
      return false;
    });
  };

  /* Whatever is dominating the viewport right now — used by the hotkey and the
   * floating button, which is how stories and profile pictures get saved. */
  media.grabVisible = function () {
    var route = IGX.route();
    if (route === 'story' || route === 'profile') return media.grab(document.body, route);

    var best = null, bestArea = 0;
    IGX.$$('article').forEach(function (a) {
      var r = a.getBoundingClientRect();
      var vis = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (vis > bestArea) { bestArea = vis; best = a; }
    });
    return media.grab(best || document.body);
  };

  /* ---------------- injected buttons ---------------- */
  var DL_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3v12"/><path d="m7 12 5 5 5-5"/><path d="M5 21h14"/></svg>';

  function makeButton(cls, title, html, onClick) {
    var b = IGX.el('div', {
      class: 'igx-btn ' + cls,
      role: 'button',
      tabindex: '0',
      title: title,
      html: html
    });
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      onClick(b);
    }, true);
    return b;
  }
  media.makeButton = makeButton;

  /* Anchor on the Like control: it is the one node with a stable aria-label in
   * every media surface (feed, modal, reel rail). */
  media.actionHosts = function () {
    var svgs = IGX.$$('svg[aria-label="Like"], svg[aria-label="Unlike"], ' +
                      'svg[aria-label="Me gusta"], svg[aria-label="Curtir"]');
    var hosts = [];
    svgs.forEach(function (svg) {
      var btn = svg.closest('div[role="button"], button, span[role="button"]');
      if (!btn || !btn.parentElement) return;
      hosts.push({ button: btn, bar: btn.parentElement });
    });
    return hosts;
  };

  function inject() {
    if (!IGX.settings.enabled || !IGX.settings.dlButtons) return;
    media.actionHosts().forEach(function (h) {
      if (h.bar.querySelector('.igx-dl')) return;
      var b = makeButton('igx-dl', 'Download (D)  ·  Shift-click opens the original', DL_SVG, function () {});
      b.addEventListener('click', function (e) {
        if (e.shiftKey) {
          var keys = media.keysFor(h.bar);
          media.record(keys).then(function (rec) {
            var url = rec && rec.items && rec.items[0] && rec.items[0].url;
            if (!url) { var dom = media.scrapeDom(h.bar); url = dom[0] && dom[0].url; }
            if (url) window.open(url, '_blank', 'noopener');
            else IGX.toast('No original source found yet.', 'warn');
          });
        } else {
          media.grab(h.bar);
        }
      }, true);
      h.button.insertAdjacentElement('afterend', b);
    });
  }

  /* ---------------- floating catch-all ---------------- */
  function floatingButton() {
    if (document.getElementById('igx-fab-dl')) return;
    var fab = IGX.el('div', {
      id: 'igx-fab-dl',
      class: 'igx-fab',
      title: 'Download what you are looking at',
      html: DL_SVG
    });
    fab.addEventListener('click', function () { media.grabVisible(); });
    document.body.appendChild(fab);
  }

  function updateFab() {
    var fab = document.getElementById('igx-fab-dl');
    if (!fab) return;
    var route = IGX.route();
    var show = IGX.settings.enabled && IGX.settings.dlButtons &&
               (route === 'story' || route === 'reel' || route === 'profile');
    fab.style.display = show ? 'flex' : 'none';
  }

  /* ---------------- hotkey ---------------- */
  document.addEventListener('keydown', function (e) {
    if (!IGX.settings.enabled || !IGX.settings.dlHotkey) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      media.grabVisible();
    }
  }, true);

  IGX.register('media', {
    apply: function (s) {
      if (document.body) floatingButton();
      updateFab();
      if (!s.enabled || !s.dlButtons) IGX.$$('.igx-dl').forEach(function (n) { n.remove(); });
      else inject();
    },
    tick: function () {
      if (!IGX.settings.enabled || !IGX.settings.dlButtons) return;
      inject();
      updateFab();
    }
  });

  IGX.onTick(function () {
    var m = IGX.modules.filter(function (x) { return x.name === 'media'; })[0];
    if (m && m.tick) m.tick();
  });
})();
