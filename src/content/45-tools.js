/* InstaGhost — playback control, copy tools, session timer. */
(function () {
  'use strict';
  var IGX = window.IGX;

  /* ------------------------------------------------------------------ *
   * video: controls, speed, volume memory, autoplay
   * ------------------------------------------------------------------ */
  var volume = { muted: true, level: 1, loaded: false };

  chrome.storage.local.get('igx:volume', function (r) {
    if (r && r['igx:volume']) volume = Object.assign(volume, r['igx:volume']);
    volume.loaded = true;
  });

  function saveVolume() {
    chrome.storage.local.set({ 'igx:volume': { muted: volume.muted, level: volume.level } });
  }

  function tuneVideos() {
    var s = IGX.settings;
    IGX.$$('video').forEach(function (v) {
      if (s.videoControls && !v.controls) { v.controls = true; v.classList.add('igx-video'); }
      if (!s.videoControls && v.classList.contains('igx-video')) {
        v.controls = false; v.classList.remove('igx-video');
      }

      var want = parseFloat(s.videoSpeed) || 1;
      if (v.dataset.igxRate !== String(want)) {
        v.dataset.igxRate = String(want);
        try { v.playbackRate = want; } catch (e) {}
      }

      if (s.rememberVolume && volume.loaded && !v.dataset.igxVol) {
        v.dataset.igxVol = '1';
        try { v.muted = volume.muted; v.volume = volume.level; } catch (e) {}
        v.addEventListener('volumechange', function () {
          volume.muted = v.muted; volume.level = v.volume; saveVolume();
        });
      }

      if (s.disableAutoplay && !v.dataset.igxAuto) {
        v.dataset.igxAuto = '1';
        v.autoplay = false;
        v.addEventListener('play', function () {
          if (v.dataset.igxUserPlay === '1') return;
          if (IGX.route() === 'story') return;      // stories would stall forever
          try { v.pause(); } catch (e) {}
        });
        v.addEventListener('click', function () { v.dataset.igxUserPlay = '1'; });
      }
      if (!s.disableAutoplay && v.dataset.igxAuto) v.dataset.igxUserPlay = '1';
    });
  }

  /* ------------------------------------------------------------------ *
   * stories: pause on hover
   * ------------------------------------------------------------------ */
  function storyHover() {
    if (!IGX.settings.storyPauseHover || IGX.route() !== 'story') return;
    var section = document.querySelector('section') || document.body;
    if (section.dataset.igxHover === '1') return;
    section.dataset.igxHover = '1';

    section.addEventListener('mouseenter', function () {
      document.documentElement.classList.add('igx-story-hold');
      IGX.$$('video').forEach(function (v) { try { v.pause(); } catch (e) {} });
    }, true);

    section.addEventListener('mouseleave', function () {
      document.documentElement.classList.remove('igx-story-hold');
      IGX.$$('video').forEach(function (v) { try { v.play(); } catch (e) {} });
    }, true);
  }

  /* ------------------------------------------------------------------ *
   * copy caption / link
   * ------------------------------------------------------------------ */
  var LINK_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/>' +
    '<path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>';

  function captionOf(article) {
    if (!article) return '';
    var h1 = article.querySelector('h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    var spans = IGX.$$('article span[dir="auto"], span[dir="auto"]', article);
    for (var i = 0; i < spans.length; i++) {
      var t = spans[i].textContent.trim();
      if (t.length > 25) return t;
    }
    return '';
  }

  function linkOf(article) {
    var a = article && article.querySelector('a[href*="/p/"], a[href*="/reel/"]');
    var href = a ? a.getAttribute('href') : location.pathname;
    return 'https://www.instagram.com' + href;
  }

  function injectCopy() {
    if (!IGX.settings.copyTools) return;
    IGX.media.actionHosts().forEach(function (h) {
      if (h.bar.querySelector('.igx-copy')) return;
      var article = h.bar.closest('article') || document.querySelector('div[role="dialog"]') || h.bar;
      var b = IGX.media.makeButton('igx-copy', 'Copy link  ·  Shift-click copies the caption', LINK_SVG, function () {});
      b.addEventListener('click', function (e) {
        var text = e.shiftKey ? (captionOf(article) || '(no caption found)') : linkOf(article);
        navigator.clipboard.writeText(text).then(function () {
          IGX.toast(e.shiftKey ? 'Caption copied' : 'Link copied', 'ok');
        }).catch(function () { IGX.toast('Clipboard blocked by the page', 'warn'); });
      }, true);
      h.button.insertAdjacentElement('afterend', b);
    });
  }

  /* ------------------------------------------------------------------ *
   * session timer
   * ------------------------------------------------------------------ */
  var sessionStart = Date.now();
  var timerNode = null;

  function timerTick() {
    if (!IGX.settings.enabled || !IGX.settings.usageTimer) {
      if (timerNode) { timerNode.remove(); timerNode = null; }
      return;
    }
    if (!document.body) return;
    if (!timerNode) {
      timerNode = IGX.el('div', { id: 'igx-timer', title: 'Time on Instagram this session' });
      document.body.appendChild(timerNode);
    }
    var secs = Math.floor((Date.now() - sessionStart) / 1000);
    var mm = String(Math.floor(secs / 60)).padStart(2, '0');
    var ss = String(secs % 60).padStart(2, '0');
    timerNode.textContent = '⏱ ' + mm + ':' + ss;
    timerNode.classList.toggle('igx-timer-warn', secs > 20 * 60);
  }
  setInterval(timerTick, 1000);

  IGX.register('tools', {
    apply: function (s) {
      if (!s.enabled) {
        IGX.$$('.igx-copy').forEach(function (n) { n.remove(); });
        IGX.$$('video.igx-video').forEach(function (v) { v.controls = false; v.classList.remove('igx-video'); });
        timerTick();
        return;
      }
      if (!s.copyTools) IGX.$$('.igx-copy').forEach(function (n) { n.remove(); });
      tuneVideos();
      injectCopy();
      timerTick();
    }
  });

  IGX.onTick(function () {
    if (!IGX.settings.enabled) return;
    tuneVideos();
    storyHover();
    injectCopy();
  });
})();
