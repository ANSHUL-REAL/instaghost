/* InstaGhost — follower audit engine.
 *
 * Walks the same paginated endpoints the web app uses for its own follower
 * lists, deliberately slowly. Instagram rate-limits this hard; the scan backs
 * off on 429 and can be stopped at any point. */
(function () {
  'use strict';
  var IGX = window.IGX;
  var CFG = window.IGX_CONFIG;

  var A = IGX.audit = {};
  var running = false;
  var abort = false;

  A.isRunning = function () { return running; };
  A.stop = function () { abort = true; };

  A.whoami = function () {
    return IGX.ask('WHOAMI', {}, 4000);
  };

  function trim(u) {
    return {
      pk: String(u.pk || u.id || ''),
      username: u.username,
      full_name: u.full_name || '',
      priv: !!u.is_private,
      ver: !!u.is_verified,
      pic: u.profile_pic_url || ''
    };
  }

  /* Pull one full list (followers or following) with pagination + backoff. */
  function pull(uid, kind, onProgress) {
    var out = [];
    var seen = {};
    var maxId = '';
    var page = 0;
    var delay = parseInt(IGX.settings.scanDelay, 10) || 1800;

    function step() {
      if (abort) return Promise.resolve({ list: out, aborted: true });

      var path = '/api/v1/friendships/' + uid + '/' + kind + '/?count=50' +
                 (maxId ? '&max_id=' + encodeURIComponent(maxId) : '');

      return IGX.ask('API', { path: path }, 25000).then(function (res) {
        if (!res) return { list: out, error: 'No response from Instagram.' };

        if (res.status === 429 || res.status === 403) {
          onProgress({ kind: kind, count: out.length, page: page, throttled: true });
          if (page === 0) {
            return { list: out, error: 'Instagram refused the very first request (HTTP ' + res.status + '). Wait a few minutes and retry.' };
          }
          return IGX.sleep(30000).then(step);      // one long cooldown, then continue
        }

        if (res.status === 401) return { list: out, error: 'Not logged in — open instagram.com and sign in first.' };
        if (!res.ok || !res.data) return { list: out, error: 'Unexpected response (HTTP ' + res.status + ').' };

        var users = res.data.users || [];
        for (var i = 0; i < users.length; i++) {
          var t = trim(users[i]);
          if (t.pk && !seen[t.pk]) { seen[t.pk] = 1; out.push(t); }
        }
        page++;
        onProgress({ kind: kind, count: out.length, page: page, throttled: false });

        maxId = res.data.next_max_id;
        if (!maxId || !users.length) return { list: out };
        return IGX.sleep(IGX.jitter(delay)).then(step);
      });
    }

    return step();
  }

  A.scan = function (onProgress) {
    if (running) return Promise.resolve({ error: 'A scan is already running.' });
    running = true;
    abort = false;
    onProgress = onProgress || function () {};

    return A.whoami().then(function (me) {
      if (!me || !me.userId) {
        running = false;
        return { error: 'Could not read your session. Are you logged into instagram.com?' };
      }

      return pull(me.userId, 'followers', onProgress).then(function (f) {
        if (f.error) return { error: f.error };
        if (f.aborted) return { aborted: true, partial: true };
        return IGX.sleep(2000).then(function () {
          return pull(me.userId, 'following', onProgress).then(function (g) {
            if (g.error) return { error: g.error, followers: f.list };
            return {
              ts: Date.now(),
              uid: me.userId,
              followers: f.list,
              following: g.list,
              aborted: !!g.aborted
            };
          });
        });
      });
    }).then(function (r) {
      running = false;
      if (r && r.followers && r.following) A.saveSnapshot(r);
      return r;
    }).catch(function (e) {
      running = false;
      return { error: String(e && e.message || e) };
    });
  };

  /* ---------------- snapshots ---------------- */
  var MAX_SNAPSHOTS = 8;

  A.saveSnapshot = function (snap) {
    chrome.storage.local.get(CFG.SNAPSHOT_KEY, function (res) {
      var list = (res && res[CFG.SNAPSHOT_KEY]) || [];
      list.push(snap);
      while (list.length > MAX_SNAPSHOTS) list.shift();
      var patch = {};
      patch[CFG.SNAPSHOT_KEY] = list;
      chrome.storage.local.set(patch);
    });
  };

  A.snapshots = function () {
    return new Promise(function (resolve) {
      chrome.storage.local.get(CFG.SNAPSHOT_KEY, function (res) {
        resolve((res && res[CFG.SNAPSHOT_KEY]) || []);
      });
    });
  };

  A.clearSnapshots = function () {
    var patch = {};
    patch[CFG.SNAPSHOT_KEY] = [];
    return new Promise(function (r) { chrome.storage.local.set(patch, r); });
  };

  /* ---------------- analysis ---------------- */
  function index(list) {
    var m = {};
    (list || []).forEach(function (u) { m[u.pk] = u; });
    return m;
  }

  A.analyse = function (snap, prev) {
    var fMap = index(snap.followers);
    var gMap = index(snap.following);

    var notFollowingBack = snap.following.filter(function (u) { return !fMap[u.pk]; });
    var fans = snap.followers.filter(function (u) { return !gMap[u.pk]; });
    var mutuals = snap.followers.filter(function (u) { return gMap[u.pk]; });

    var out = {
      ts: snap.ts,
      counts: {
        followers: snap.followers.length,
        following: snap.following.length,
        mutuals: mutuals.length,
        notFollowingBack: notFollowingBack.length,
        fans: fans.length
      },
      notFollowingBack: notFollowingBack,
      fans: fans,
      mutuals: mutuals,
      gainedFollowers: [],
      lostFollowers: [],
      startedFollowing: [],
      youUnfollowed: [],
      hasPrev: false
    };

    if (prev) {
      var pf = index(prev.followers), pg = index(prev.following);
      out.hasPrev = true;
      out.prevTs = prev.ts;
      out.gainedFollowers = snap.followers.filter(function (u) { return !pf[u.pk]; });
      out.lostFollowers = prev.followers.filter(function (u) { return !fMap[u.pk]; });
      out.startedFollowing = snap.following.filter(function (u) { return !pg[u.pk]; });
      out.youUnfollowed = prev.following.filter(function (u) { return !gMap[u.pk]; });
    }
    return out;
  };

  /* Someone who followed you at some point across the stored history and is
   * gone now — the "followed, then unfollowed" list. */
  A.churn = function (snaps) {
    if (!snaps.length) return [];
    var current = index(snaps[snaps.length - 1].followers);
    var everSeen = {};
    for (var i = 0; i < snaps.length - 1; i++) {
      snaps[i].followers.forEach(function (u) {
        if (!current[u.pk]) {
          if (!everSeen[u.pk]) everSeen[u.pk] = { user: u, lastSeen: snaps[i].ts, firstSeen: snaps[i].ts };
          else everSeen[u.pk].lastSeen = snaps[i].ts;
        }
      });
    }
    return Object.keys(everSeen).map(function (k) { return everSeen[k]; })
      .sort(function (a, b) { return b.lastSeen - a.lastSeen; });
  };

  /* ---------------- export ---------------- */
  A.exportCsv = function (rows, name) {
    var head = 'username,full_name,private,verified,profile\n';
    var body = rows.map(function (u) {
      return [
        u.username,
        '"' + String(u.full_name || '').replace(/"/g, '""') + '"',
        u.priv ? 'yes' : 'no',
        u.ver ? 'yes' : 'no',
        'https://www.instagram.com/' + u.username + '/'
      ].join(',');
    }).join('\n');
    saveText(head + body, name + '.csv', 'text/csv');
  };

  A.exportJson = function (data, name) {
    saveText(JSON.stringify(data, null, 2), name + '.json', 'application/json');
  };

  function saveText(text, filename, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
})();
