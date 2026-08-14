/* InstaGhost — unsend vault.
 *
 * Keeps a local copy of DM items as they arrive, then notices when one stops
 * coming back and files it as unsent.
 *
 * Two things this is careful about:
 *
 *  - A thread fetch returns a *window* of messages, not the whole history. An
 *    item missing from a page of results is usually just outside that window,
 *    not deleted. So a message only counts as unsent if it sits inside the
 *    time range the new payload actually covers.
 *  - Everything stays in chrome.storage.local. Nothing is uploaded, and the
 *    whole archive dies with "Reset everything".
 */
(function () {
  'use strict';
  var IGX = window.IGX;
  var CFG = window.IGX_CONFIG;

  var V = IGX.vault = {};
  var KEY = CFG.VAULT_KEY;

  var MAX_THREADS = 40;
  var MAX_ITEMS = 400;
  var MAX_UNSENT = 300;

  var db = { threads: {}, unsent: [] };
  var loaded = false;
  var dirty = false;

  V.load = function (cb) {
    chrome.storage.local.get(KEY, function (res) {
      var stored = res && res[KEY];
      if (stored && stored.threads) db = stored;
      loaded = true;
      if (cb) cb(db);
    });
  };

  function persist() {
    dirty = true;
  }

  /* Batched — DM payloads arrive in bursts while a conversation loads. */
  setInterval(function () {
    if (!dirty || !loaded) return;
    dirty = false;
    var patch = {};
    patch[KEY] = db;
    chrome.storage.local.set(patch);
  }, 2500);

  V.all = function () { return db.unsent; };
  V.count = function () { return db.unsent.length; };

  V.clear = function () {
    db = { threads: {}, unsent: [] };
    persist();
  };

  V.forget = function (id) {
    db.unsent = db.unsent.filter(function (u) { return u.id !== id; });
    persist();
  };

  /* ------------------------------------------------------------------ *
   * ingest
   * ------------------------------------------------------------------ */
  function ingest(payload) {
    if (!loaded || !IGX.settings.enabled || !IGX.settings.vaultEnabled) return;
    if (!payload || !payload.items || !payload.items.length) return;

    var id = payload.threadId;
    var thread = db.threads[id];
    if (!thread) {
      thread = db.threads[id] = { title: payload.title || '', items: {} };
      trimThreads();
    }
    if (payload.title) thread.title = payload.title;

    /* The window this payload covers. Anything older than its oldest item is
     * simply not included in this page of results. */
    var stamps = payload.items.map(function (i) { return i.ts; }).filter(Boolean);
    var oldest = stamps.length ? Math.min.apply(null, stamps) : 0;
    var newest = stamps.length ? Math.max.apply(null, stamps) : 0;

    var arriving = {};
    payload.items.forEach(function (it) { arriving[it.id] = 1; });

    /* Anything we had inside this window that did not come back is gone. */
    var gone = [];
    Object.keys(thread.items).forEach(function (itemId) {
      if (arriving[itemId]) return;
      var known = thread.items[itemId];
      if (known.unsent) return;
      if (!known.ts || known.ts < oldest || known.ts > newest) return;   // out of window
      known.unsent = true;
      known.noticed = Date.now();
      gone.push(known);
    });

    /* Store the new ones. */
    payload.items.forEach(function (it) {
      var existing = thread.items[it.id];
      if (existing) {
        /* An edit is not an unsend, but it is worth keeping the original. */
        if (existing.text && it.text && existing.text !== it.text && !existing.edited) {
          existing.edited = existing.text;
        }
        existing.text = it.text || existing.text;
        return;
      }
      thread.items[it.id] = {
        id: it.id,
        ts: it.ts,
        from: it.from,
        type: it.type,
        text: it.text || '',
        media: IGX.settings.vaultMedia ? (it.media || '') : ''
      };
    });

    trimItems(thread);

    if (gone.length) {
      gone.forEach(function (g) {
        db.unsent.unshift({
          id: g.id,
          threadId: id,
          title: thread.title,
          from: g.from,
          ts: g.ts,
          text: g.text,
          media: g.media,
          noticed: g.noticed
        });
      });
      if (db.unsent.length > MAX_UNSENT) db.unsent.length = MAX_UNSENT;

      if (IGX.settings.vaultNotify) {
        var one = gone[0];
        IGX.toast(
          gone.length === 1
            ? '🗄️ @' + (one.from || 'someone') + ' unsent a message — kept in the vault'
            : '🗄️ ' + gone.length + ' messages were unsent — kept in the vault',
          'info'
        );
      }
      IGX.emit('vault', { count: db.unsent.length });
    }

    persist();
  }

  function trimItems(thread) {
    var ids = Object.keys(thread.items);
    if (ids.length <= MAX_ITEMS) return;
    ids.sort(function (a, b) { return (thread.items[a].ts || 0) - (thread.items[b].ts || 0); });
    /* Drop the oldest, but never drop something already marked unsent. */
    for (var i = 0; i < ids.length - MAX_ITEMS; i++) {
      if (!thread.items[ids[i]].unsent) delete thread.items[ids[i]];
    }
  }

  function trimThreads() {
    var ids = Object.keys(db.threads);
    if (ids.length <= MAX_THREADS) return;
    for (var i = 0; i < ids.length - MAX_THREADS; i++) delete db.threads[ids[i]];
  }

  IGX.on('dm', ingest);

  /* ------------------------------------------------------------------ *
   * export
   * ------------------------------------------------------------------ */
  V.export = function () {
    var text = db.unsent.map(function (u) {
      return [
        '[' + (u.ts ? new Date(u.ts * 1000).toLocaleString() : 'unknown time') + ']',
        '@' + (u.from || 'unknown'),
        u.title ? '(' + u.title + ')' : '',
        '\n' + (u.text || '(' + u.type + ' — no text)'),
        u.media ? '\n' + u.media : '',
        '\n---'
      ].filter(Boolean).join(' ');
    }).join('\n');

    var blob = new Blob([text || 'Nothing in the vault.'], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'instaghost-unsent.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1200);
  };

  IGX.register('vault', {
    apply: function (s) {
      /* Turning it off stops collection immediately and drops the archive of
       * live messages — only the already-flagged unsent list survives, since
       * that is the thing the user turned the feature on for. */
      if (!s.vaultEnabled && loaded && Object.keys(db.threads).length) {
        db.threads = {};
        persist();
      }
    }
  });
})();
