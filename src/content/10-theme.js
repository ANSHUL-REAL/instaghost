/* InstaGhost — theming.
 * Repaints Instagram by overriding the CSS custom properties their own
 * stylesheet already composes with, so it survives most redesigns. */
(function () {
  'use strict';
  var IGX = window.IGX;

  /* Values are "R, G, B" triples because Instagram writes rgba(var(--x), a). */
  var THEMES = {
    amoled: {
      name: 'Midnight AMOLED',
      bg: '0, 0, 0', bg2: '0, 0, 0', elevated: '12, 12, 14',
      text: '235, 237, 243', text2: '134, 140, 152', sep: '26, 26, 30',
      link: '120, 160, 255', hover: '18, 18, 22', dark: true
    },
    ocean: {
      name: 'Ocean Blue',
      bg: '9, 18, 33', bg2: '12, 24, 43', elevated: '18, 34, 58',
      text: '225, 236, 252', text2: '132, 156, 190', sep: '28, 48, 78',
      link: '86, 168, 255', hover: '20, 38, 64', dark: true
    },
    sunset: {
      name: 'Sunset Pink',
      bg: '28, 14, 24', bg2: '36, 18, 30', elevated: '50, 24, 41',
      text: '252, 232, 242', text2: '198, 148, 176', sep: '70, 34, 56',
      link: '255, 138, 176', hover: '58, 28, 47', dark: true
    },
    forest: {
      name: 'Forest Green',
      bg: '10, 22, 17', bg2: '13, 28, 22', elevated: '20, 40, 32',
      text: '226, 244, 234', text2: '134, 176, 154', sep: '30, 56, 45',
      link: '92, 214, 152', hover: '22, 44, 35', dark: true
    },
    dracula: {
      name: 'Dracula',
      bg: '40, 42, 54', bg2: '33, 34, 44', elevated: '52, 55, 70',
      text: '248, 248, 242', text2: '150, 152, 170', sep: '68, 71, 90',
      link: '189, 147, 249', hover: '58, 61, 78', dark: true
    },
    paper: {
      name: 'Paper',
      bg: '250, 249, 245', bg2: '244, 242, 236', elevated: '255, 255, 255',
      text: '32, 30, 26', text2: '116, 112, 104', sep: '226, 222, 212',
      link: '38, 90, 180', hover: '238, 235, 228', dark: false
    }
  };

  var STYLE_ID = 'igx-theme-style';

  function styleNode() {
    var n = document.getElementById(STYLE_ID);
    if (!n) {
      n = document.createElement('style');
      n.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(n);
    }
    return n;
  }

  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
    if (!m) return '124, 92, 255';
    return parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16);
  }
  IGX.hexToRgb = hexToRgb;

  function build(s) {
    var css = [];
    var accent = hexToRgb(s.accent);

    /* Accent is exposed even on the default theme — InstaGhost's own UI uses it. */
    css.push(':root{--igx-accent:' + accent + ';}');

    var t = THEMES[s.theme];
    if (t) {
      css.push(
        'html,:root{' +
        '--ig-primary-background:' + t.bg + ';' +
        '--ig-secondary-background:' + t.bg2 + ';' +
        '--ig-elevated-background:' + t.elevated + ';' +
        '--ig-elevated-separator:' + t.sep + ';' +
        '--ig-primary-text:' + t.text + ';' +
        '--ig-secondary-text:' + t.text2 + ';' +
        '--ig-tertiary-text:' + t.text2 + ';' +
        '--ig-separator:' + t.sep + ';' +
        '--ig-stroke:' + t.sep + ';' +
        '--ig-link:' + t.link + ';' +
        '--ig-highlight-background:' + t.hover + ';' +
        '--ig-hover-overlay:' + t.hover + ';' +
        '--ig-banner-background:' + t.elevated + ';' +
        '--ig-primary-button:' + accent + ';' +
        '--ig-primary-button-hover:' + accent + ';' +
        '--ig-badge:' + accent + ';' +
        '--ig-media-background:' + t.bg2 + ';' +
        '--ig-secondary-button-background:' + t.elevated + ';' +
        'color-scheme:' + (t.dark ? 'dark' : 'light') + ';' +
        '}',
        /* A handful of surfaces are hard-coded in their bundle. */
        'body,main[role="main"],section > main{background:rgb(' + t.bg + ') !important;}',
        'article,div[role="dialog"]{background-color:rgb(' + t.bg + ');}',
        'svg[aria-label]{color:rgb(' + t.text + ');}'
      );
    }

    if (s.roundedPosts) {
      css.push(
        'article img[srcset],article video,article canvas{border-radius:18px !important;}',
        'article{border-radius:22px !important;overflow:hidden;}',
        'div[role="dialog"] img[srcset]{border-radius:14px;}'
      );
    }

    if (s.hideStoryRings) {
      css.push(
        'a[href^="/stories/"] canvas,div[role="button"] canvas,' +
        'section canvas[height]{display:none !important;}'
      );
    }

    if (s.customCss) css.push('/* custom */\n' + s.customCss);

    return css.join('\n');
  }

  IGX.register('theme', {
    apply: function (s) {
      styleNode().textContent = s.enabled ? build(s) : '';
      document.documentElement.setAttribute('data-igx-theme', s.enabled ? (s.theme || 'default') : 'off');
      document.documentElement.style.setProperty('--igx-accent', hexToRgb(s.accent));
    },
    THEMES: THEMES
  });
})();
