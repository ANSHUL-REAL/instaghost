/* InstaGhost — hover peek.
 * Floating preview card that follows the cursor over grid thumbnails, plus the
 * CSS-only hover behaviours (feed zoom, hover-only download button). */
(function () {
  'use strict';
  var IGX = window.IGX;

  var STYLE_ID = 'igx-hover-style';
  function styleNode() {
    var n = document.getElementById(STYLE_ID);
    if (!n) {
      n = document.createElement('style');
      n.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(n);
    }
    return n;
  }

  function buildCss(s) {
    if (!s.enabled) return '';
    var css = [];
    if (s.feedZoomHover) {
      css.push(
        'article img[srcset],article video{transition:transform .28s cubic-bezier(.2,.7,.3,1);}',
        'article img[srcset]:hover,article video:hover{transform:scale(1.02);}'
      );
    }
    if (s.downloadOnHover) {
      css.push(
        '.igx-dl,.igx-copy{opacity:0;transform:translateY(2px);' +
        'transition:opacity .18s ease,transform .18s ease;}',
        'article:hover .igx-dl,article:hover .igx-copy,' +
        'section:hover .igx-dl,section:hover .igx-copy,' +
        'div[role="dialog"]:hover .igx-dl,div[role="dialog"]:hover .igx-copy{opacity:1;transform:none;}'
      );
    }
    return css.join('\n');
  }

  /* ------------------------------------------------------------------ *
   * preview card
   * ------------------------------------------------------------------ */
  var card = null, cardMedia = null, cardMeta = null;
  var hoverTimer = null, activeLink = null;
  var lookupCache = {};

  function ensureCard() {
    if (card || !document.body) return card;
    card = IGX.el('div', { id: 'igx-peek-card' }, [
      IGX.el('div', { class: 'igx-peek-media' }),
      IGX.el('div', { class: 'igx-peek-meta' })
    ]);
    cardMedia = card.querySelector('.igx-peek-media');
    cardMeta = card.querySelector('.igx-peek-meta');
    document.body.appendChild(card);
    return card;
  }

  function hide() {
    clearTimeout(hoverTimer);
    activeLink = null;
    if (!card) return;
    card.classList.remove('igx-show');
    setTimeout(function () {
      if (!card || card.classList.contains('igx-show')) return;
      cardMedia.innerHTML = '';
    }, 220);
  }

  function place(x, y) {
    if (!card) return;
    var w = parseInt(IGX.settings.hoverEnlargeSize, 10) || 340;
    var pad = 18;
    var left = x + pad;
    var top = y - w * 0.4;
    if (left + w + pad > innerWidth) left = x - w - pad;
    if (top < pad) top = pad;
    var maxTop = innerHeight - Math.min(w * 1.25, innerHeight - 2 * pad) - pad;
    if (top > maxTop) top = Math.max(pad, maxTop);
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.width = w + 'px';
  }

  function bestSrc(img) {
    var ss = img && img.getAttribute('srcset');
    if (!ss) return img ? (img.currentSrc || img.src) : '';
    var best = '', bw = 0;
    ss.split(',').forEach(function (part) {
      var bits = part.trim().split(/\s+/);
      var w = parseInt(bits[1] || '0', 10) || 0;
      if (w >= bw) { bw = w; best = bits[0]; }
    });
    return best;
  }

  function shortcodeOf(link) {
    var m = String(link.getAttribute('href') || '').match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }

  function show(link, x, y) {
    if (!ensureCard()) return;
    var img = link.querySelector('img');
    var fallback = bestSrc(img);
    var code = shortcodeOf(link);

    render(fallback ? { type: 'image', url: fallback } : null, null);
    place(x, y);
    card.classList.add('igx-show');

    if (!code) return;
    if (lookupCache[code]) { render(lookupCache[code].item, lookupCache[code].rec); return; }

    IGX.media.record(['code:' + code]).then(function (rec) {
      if (activeLink !== link) return;
      if (!rec || !rec.items || !rec.items.length) return;
      var item = rec.items[0];
      lookupCache[code] = { item: item, rec: rec };
      render(item, rec);
    });
  }

  function render(item, rec) {
    if (!item) { cardMedia.innerHTML = '<div class="igx-peek-empty">Loading preview…</div>'; return; }

    var current = cardMedia.firstElementChild;
    if (current && current.dataset && current.dataset.src === item.url) { /* keep */ }
    else if (item.type === 'video') {
      cardMedia.innerHTML = '';
      var v = IGX.el('video', { autoplay: '', muted: '', loop: '', playsinline: '' });
      v.dataset.src = item.url;
      v.src = item.url;
      v.muted = true;
      cardMedia.appendChild(v);
    } else {
      cardMedia.innerHTML = '';
      var i = IGX.el('img', { src: item.url });
      i.dataset.src = item.url;
      cardMedia.appendChild(i);
    }

    if (rec) {
      var bits = [];
      if (rec.owner) bits.push('@' + rec.owner);
      if (rec.items.length > 1) bits.push(rec.items.length + ' items');
      bits.push(item.type === 'video' ? 'video' : 'photo');
      cardMeta.textContent = bits.join(' · ') + '   —   D to save';
      cardMeta.style.display = '';
    } else {
      cardMeta.textContent = '';
      cardMeta.style.display = 'none';
    }
  }

  /* ------------------------------------------------------------------ *
   * wiring
   * ------------------------------------------------------------------ */
  document.addEventListener('mouseover', function (e) {
    if (!IGX.settings.enabled || !IGX.settings.hoverEnlarge) return;
    var link = e.target.closest && e.target.closest('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]');
    if (!link || !link.querySelector('img')) { return; }
    if (link === activeLink) return;
    /* Feed posts are already full size — only preview compact thumbnails. */
    if (link.getBoundingClientRect().width > 420) return;

    activeLink = link;
    clearTimeout(hoverTimer);
    var x = e.clientX, y = e.clientY;
    hoverTimer = setTimeout(function () {
      if (activeLink === link) show(link, x, y);
    }, 170);
  }, true);

  document.addEventListener('mouseout', function (e) {
    if (!activeLink) return;
    var to = e.relatedTarget;
    if (to && to.closest && (to.closest('#igx-peek-card') || to.closest('a') === activeLink)) return;
    hide();
  }, true);

  document.addEventListener('mousemove', function (e) {
    if (!card || !card.classList.contains('igx-show')) return;
    place(e.clientX, e.clientY);
  }, true);

  document.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);

  IGX.register('hover', {
    apply: function (s) {
      styleNode().textContent = buildCss(s);
      if (!s.enabled || !s.hoverEnlarge) hide();
    }
  });
})();
