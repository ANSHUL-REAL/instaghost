/* InstaGhost — count blurring and feed cleanup.
 *
 * Rule of the house: nothing gets display:none'd if hiding it could blank the
 * page. Suggested posts and counts are blurred behind a peek overlay instead,
 * so a mis-detection is a cosmetic annoyance rather than a broken feed. */
(function () {
  'use strict';
  var IGX = window.IGX;

  var STYLE_ID = 'igx-clean-style';
  function styleNode() {
    var n = document.getElementById(STYLE_ID);
    if (!n) {
      n = document.createElement('style');
      n.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(n);
    }
    return n;
  }

  /* Static rules that are pure CSS — cheaper and safer than DOM walking. */
  function buildCss(s) {
    var css = [];
    if (!s.enabled) return '';

    if (s.hideReelsTab) {
      css.push('div[role="navigation"] a[href^="/reels"],nav a[href^="/reels"]{display:none !important;}');
    }
    if (s.hideExploreTab) {
      css.push('div[role="navigation"] a[href^="/explore"],nav a[href^="/explore"]{display:none !important;}');
    }
    if (s.hideVerified) {
      css.push('svg[aria-label="Verified"],svg[aria-label="Verificado"]{display:none !important;}');
    }
    if (s.hideThreadsPromo) {
      css.push('a[href*="threads.net"],a[href*="threads.com"]{display:none !important;}');
    }
    if (s.hideShopping) {
      css.push(
        'a[href*="/shop/"],a[href^="/shopping"],div[role="navigation"] a[href*="shop"]{display:none !important;}',
        'svg[aria-label="Shop"],svg[aria-label="Shopping"]{display:none !important;}'
      );
    }
    if (s.blurFeedImages) {
      css.push(
        'article img[srcset]:not(.igx-revealed-img),article video:not(.igx-revealed-img){' +
        'filter:blur(22px);transition:filter .25s ease;cursor:zoom-in;}'
      );
    }
    if (s.focusMode) {
      css.push(
        'div[role="navigation"]{opacity:.18;transition:opacity .25s ease;}',
        'div[role="navigation"]:hover{opacity:1;}',
        'main + div,aside{display:none !important;}',
        'article{box-shadow:none !important;}'
      );
    }
    return css.join('\n');
  }

  /* ------------------------------------------------------------------ *
   * helpers
   * ------------------------------------------------------------------ */
  function mark(el, cls) {
    if (!el || el.classList.contains(cls)) return;
    el.classList.add(cls);
  }

  function textOf(el) { return (el.textContent || '').trim(); }

  /* ------------------------------------------------------------------ *
   * counts — blur, hover reveals
   * ------------------------------------------------------------------ */
  var LIKE_RE = /^[\d][\d.,\s]*[KMkm]?\s*(likes?|curtidas?|me gusta)$/i;
  var VIEW_RE = /^[\d][\d.,\s]*[KMkm]?\s*(views?|plays?|visualizações)$/i;
  var COMMENT_RE = /(view all|view)\s+[\d.,]+\s*[KMkm]?\s*comments?/i;
  var NUM_RE = /^[\d][\d.,\s]*[KMkm]?$/;

  /* Every scanner below filters on :not([data-igx-c]) so an element is measured
   * once and never again — Instagram's feed is far too big to re-walk on a
   * 180ms tick. Elements are stamped even when they do not match. */
  function scan(sel, limit) {
    var out = [];
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length && out.length < (limit || 400); i++) out.push(nodes[i]);
    return out;
  }

  function blurCounts(s) {
    /* likes */
    if (s.blurLikeCounts) {
      scan('article span:not([data-igx-c]), article a[href$="/liked_by/"]:not([data-igx-c])').forEach(function (n) {
        var t = textOf(n);
        n.dataset.igxC = '0';
        if (!t || t.length > 40) return;
        if (LIKE_RE.test(t) || /^liked by /i.test(t)) {
          n.dataset.igxC = 'like';
          mark(n, 'igx-blur');
        }
      });
    }

    /* comments */
    if (s.hideCommentCounts) {
      scan('article a:not([data-igx-cc]), article span:not([data-igx-cc])').forEach(function (n) {
        var t = textOf(n);
        n.dataset.igxCc = '1';
        if (!t || t.length > 60 || !COMMENT_RE.test(t)) return;
        n.dataset.igxC = 'comment';
        mark(n, 'igx-blur');
      });
    }

    /* views / plays */
    if (s.hideViewCounts) {
      scan('article span:not([data-igx-cv]), main span:not([data-igx-cv])').forEach(function (n) {
        var t = textOf(n);
        n.dataset.igxCv = '1';
        if (!t || t.length > 30 || !VIEW_RE.test(t)) return;
        n.dataset.igxC = 'view';
        mark(n, 'igx-blur');
      });
    }

    /* profile header: posts / followers / following */
    if (s.blurFollowerCount || s.blurFollowingCount || s.hidePostCount) {
      scan('header li:not([data-igx-c]), main header span:not([data-igx-c])', 60).forEach(function (li) {
        li.dataset.igxC = '0';
        var t = textOf(li).toLowerCase();
        if (!t || t.length > 40) return;
        var want =
          (s.blurFollowerCount && /follower/.test(t)) ||
          (s.blurFollowingCount && /following/.test(t)) ||
          (s.hidePostCount && /\bposts?\b/.test(t));
        if (!want) return;
        li.dataset.igxC = 'profile';
        /* Blur only the number, keep the word readable. */
        var num = IGX.$$('span, a > span', li).filter(function (x) { return NUM_RE.test(textOf(x)); })[0];
        mark(num || li, 'igx-blur');
      });
    }

    /* your own story viewer count */
    if (s.hideStoryViewCounts) {
      scan('a[href*="seen_by"]:not([data-igx-c]), section div[role="button"] span:not([data-igx-c])', 80)
        .forEach(function (n) {
        var t = textOf(n);
        n.dataset.igxC = '0';
        if (!t || t.length > 24) return;
        if (!NUM_RE.test(t) && !/viewer/i.test(t)) return;
        if (!n.closest('section') && IGX.route() !== 'story') return;
        n.dataset.igxC = 'storyview';
        mark(n, 'igx-blur');
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * feed cleanup
   * ------------------------------------------------------------------ */
  var AD_RE = /^(sponsored|paid partnership|patrocinado|gesponsert)/i;
  var SUGGEST_RE = /(suggested for you|suggested posts|suggested accounts|sugerido para ti)/i;

  function peekCover(article, label) {
    if (article.querySelector(':scope > .igx-peek-tag')) return;
    var tag = IGX.el('div', { class: 'igx-peek-tag', text: '👁️ ' + label + ' • hover to peek' });
    article.appendChild(tag);
  }

  function cleanFeed(s) {
    IGX.$$('article:not([data-igx-seen])').forEach(function (a) {
      var head = a.querySelector('header');
      var headText = head ? head.innerText.slice(0, 200) : '';
      /* Posts mount empty and fill in — do not judge one until it has text,
       * or every ad slips through on the first tick. */
      if (!headText.trim()) return;
      a.dataset.igxSeen = '1';

      var top = a.innerText.slice(0, 260);
      if (AD_RE.test(headText.trim()) || /\bSponsored\b/.test(headText)) a.dataset.igxKind = 'ad';
      else if (SUGGEST_RE.test(top)) a.dataset.igxKind = 'suggested';
    });

    IGX.$$('article[data-igx-kind]').forEach(function (a) {
      var kind = a.dataset.igxKind;
      if (kind === 'ad') {
        a.classList.toggle('igx-collapse', !!s.hideAds);
      } else if (kind === 'suggested') {
        var on = !!s.blurSuggested;
        a.classList.toggle('igx-peek', on);
        if (on) peekCover(a, 'Suggested');
        else {
          var t = a.querySelector(':scope > .igx-peek-tag');
          if (t) t.remove();
        }
      }
    });

    /* Suggested-people rails and the sidebar block — never an article. */
    if (s.hideSuggestedUsers) {
      IGX.$$('main span, main h2, main h3, aside span, div > span').forEach(function (n) {
        if (n.dataset.igxSg) return;
        var t = textOf(n);
        if (!t || t.length > 60 || !SUGGEST_RE.test(t)) return;
        n.dataset.igxSg = '1';
        if (n.closest('article')) return;
        var box = n;
        for (var i = 0; i < 4 && box.parentElement && box.parentElement !== document.body; i++) {
          box = box.parentElement;
          if (box.querySelectorAll('a[href^="/"]').length >= 3) break;
        }
        if (box && !box.querySelector('article')) box.classList.add('igx-collapse');
      });
    }

    /* stories tray */
    if (s.hideStoriesTray && IGX.route() === 'home') {
      var link = document.querySelector('main a[href^="/stories/"]');
      if (link) {
        var box = link;
        for (var i = 0; i < 8 && box.parentElement; i++) {
          box = box.parentElement;
          if (box.querySelectorAll('a[href^="/stories/"]').length >= 3 &&
              box.getBoundingClientRect().height < 240) {
            box.classList.add('igx-collapse');
            break;
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * blur feed images — click to reveal one
   * ------------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    if (!IGX.settings.enabled || !IGX.settings.blurFeedImages) return;
    var t = e.target;
    if (!t || (t.tagName !== 'IMG' && t.tagName !== 'VIDEO')) return;
    if (!t.closest('article')) return;
    /* Swallow the first click to reveal — but only the first. Otherwise the
     * post can never be opened while this setting is on. */
    if (t.classList.contains('igx-revealed-img')) return;
    e.preventDefault();
    e.stopPropagation();
    t.classList.add('igx-revealed-img');
  }, true);

  /* ------------------------------------------------------------------ *
   * green dots (part of "hide active status")
   * ------------------------------------------------------------------ */
  function isGreenish(color) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color || '');
    if (!m) return false;
    var r = +m[1], g = +m[2], b = +m[3];
    return g > 140 && r < g - 45 && b < g - 45;
  }

  /* Measuring every node is expensive, so each one is stamped after its first
   * check and never measured again. */
  function hideDots() {
    if (!IGX.settings.hideActiveStatus) return;
    scan('span:not([data-igx-dot]), i:not([data-igx-dot])', 300).forEach(function (n) {
      n.dataset.igxDot = '0';
      var r = n.getBoundingClientRect();
      if (r.width === 0 || r.width > 18 || Math.abs(r.width - r.height) > 4) return;
      var st = getComputedStyle(n);
      if (parseFloat(st.borderRadius) < 4 && st.borderRadius.indexOf('%') === -1) return;
      if (!isGreenish(st.backgroundColor)) return;
      n.dataset.igxDot = '1';
      n.style.setProperty('display', 'none', 'important');
    });
    scan('svg circle:not([data-igx-dot])', 120).forEach(function (c) {
      c.dataset.igxDot = '0';
      if (!isGreenish(getComputedStyle(c).fill)) return;
      c.dataset.igxDot = '1';
      var svg = c.closest('svg');
      if (svg) svg.style.setProperty('display', 'none', 'important');
    });
  }

  /* ------------------------------------------------------------------ *
   * module
   * ------------------------------------------------------------------ */
  /* Wipe every stamp and mark so the next pass re-decides from scratch.
   * Only ever runs on a settings change, never on a tick. */
  function resetMarks() {
    IGX.$$('.igx-blur').forEach(function (n) { n.classList.remove('igx-blur'); });
    IGX.$$('.igx-collapse').forEach(function (n) { n.classList.remove('igx-collapse'); });
    IGX.$$('.igx-peek').forEach(function (n) { n.classList.remove('igx-peek'); });
    IGX.$$('.igx-peek-tag').forEach(function (n) { n.remove(); });
    ['igxC', 'igxCc', 'igxCv', 'igxDot', 'igxSg'].forEach(function (k) {
      var attr = 'data-' + k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
      IGX.$$('[' + attr + ']').forEach(function (n) { n.removeAttribute(attr); });
    });
    IGX.$$('[data-igx-seen]').forEach(function (n) {
      n.removeAttribute('data-igx-seen');
      n.removeAttribute('data-igx-kind');
    });
  }

  IGX.register('cleanup', {
    apply: function (s) {
      resetMarks();
      if (!s.enabled) { styleNode().textContent = ''; return; }
      styleNode().textContent = buildCss(s);
      blurCounts(s);
      cleanFeed(s);
    }
  });

  IGX.onTick(function () {
    var s = IGX.settings;
    if (!s.enabled) return;
    blurCounts(s);
    cleanFeed(s);
    hideDots();
  });
})();
