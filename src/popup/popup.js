/* InstaGhost — popup. Quick switches + a door to the full dashboard. */
(function () {
  'use strict';
  var CFG = window.IGX_CONFIG;

  var QUICK = [
    { key: 'ghostStories', icon: '👻', label: 'Ghost stories' },
    { key: 'ghostDmSeen', icon: '💬', label: 'Hide DM seen' },
    { key: 'ghostTyping', icon: '⌨️', label: 'Hide typing' },
    { key: 'hideActiveStatus', icon: '🟢', label: 'Hide active status' },
    { key: 'blurLikeCounts', icon: '🔢', label: 'Blur like counts' },
    { key: 'dislikeEnabled', icon: '👎', label: 'Dislike button' },
    { key: 'dlButtons', icon: '⬇️', label: 'Download buttons' },
    { key: 'hoverEnlarge', icon: '🔍', label: 'Hover to enlarge' }
  ];

  var settings = {};
  var $ = function (id) { return document.getElementById(id); };

  function accent() {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(settings.accent || '#7C5CFF');
    if (!m) return;
    document.documentElement.style.setProperty('--acc',
      parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16));
  }

  function countActive() {
    var n = 0;
    CFG.SCHEMA.forEach(function (d) {
      if (d.key === 'enabled') return;
      if (typeof d.def === 'boolean' && settings[d.key]) n++;
    });
    return n;
  }

  function renderQuick() {
    var box = $('quick');
    box.innerHTML = '';
    QUICK.forEach(function (q) {
      var row = document.createElement('div');
      row.className = 'qrow';
      row.innerHTML = '<span class="ic">' + q.icon + '</span><span class="t">' + q.label + '</span>';
      var sw = document.createElement('div');
      sw.className = 'sw sm' + (settings[q.key] ? ' on' : '');
      sw.addEventListener('click', function () {
        settings[q.key] = !settings[q.key];
        sw.classList.toggle('on', settings[q.key]);
        CFG.setSetting(q.key, settings[q.key]);
        $('active').textContent = countActive();
      });
      row.appendChild(sw);
      box.appendChild(row);
    });
  }

  function renderTheme() {
    var def = CFG.SCHEMA.filter(function (d) { return d.key === 'theme'; })[0];
    var sel = $('theme');
    sel.innerHTML = '';
    def.options.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.value;
      op.textContent = o.label;
      if (settings.theme === o.value) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () {
      settings.theme = sel.value;
      CFG.setSetting('theme', sel.value);
    });
  }

  function syncMaster() {
    $('master').classList.toggle('on', !!settings.enabled);
    document.body.classList.toggle('off', !settings.enabled);
  }

  function askTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      var onIg = tab && /https:\/\/www\.instagram\.com/.test(tab.url || '');
      if (!onIg) {
        $('status').textContent = 'Open instagram.com to use it';
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: 'igx:status' }, function (res) {
        if (chrome.runtime.lastError || !res) {
          $('status').textContent = 'Reload the Instagram tab';
          return;
        }
        $('status').textContent = 'Active on this tab';
        $('status').className = 'live';
        $('blocked').textContent = res.blocked || 0;
        $('dislikes').textContent = res.dislikes || 0;
      });
    });
  }

  CFG.getSettings(function (s) {
    settings = s;
    accent();
    syncMaster();
    renderQuick();
    renderTheme();
    $('active').textContent = countActive();
    askTab();
  });

  $('master').addEventListener('click', function () {
    settings.enabled = !settings.enabled;
    CFG.setSetting('enabled', settings.enabled);
    syncMaster();
  });

  $('open').addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (tab && /https:\/\/www\.instagram\.com/.test(tab.url || '')) {
        chrome.tabs.sendMessage(tab.id, { type: 'igx:open-panel' });
        window.close();
      } else {
        chrome.tabs.create({ url: 'https://www.instagram.com/' });
      }
    });
  });

  $('reset').addEventListener('click', function () {
    if (!confirm('Reset InstaGhost?\n\nClears every setting, all dislikes and all follower snapshots. Cannot be undone.')) return;
    CFG.resetAll(function () {
      CFG.getSettings(function (s) {
        settings = s;
        accent(); syncMaster(); renderQuick(); renderTheme();
        $('active').textContent = countActive();
      });
    });
  });
})();
