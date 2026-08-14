/* InstaGhost — watchlist.
 *
 * A pinned list of accounts plus an on-demand view of their public profile:
 * bio, links, counts, their recent posts, and the posts they are tagged in.
 *
 * What this deliberately does NOT do, and will not be extended to do:
 *
 *   - poll or refresh on a timer
 *   - keep any history, so it cannot build "what they did this week"
 *   - track when they post, when they are online, or who they interact with
 *
 * Results live in memory for the session and die with the tab. The stored part
 * is just the list of usernames — the same thing a browser bookmark holds.
 * The difference between a bookmark and surveillance is whether it accumulates,
 * so this one does not accumulate.
 *
 * There is also no way to find "every comment this person made". That is not a
 * restraint, it is a fact: Instagram has no endpoint for it. Comments are only
 * ever retrievable per post.
 */
(function () {
  'use strict';
  var IGX = window.IGX;

  var W = IGX.watch = {};
  var KEY = 'igx:watch';

  var pinned = [];          // [{ username, note, added }]
  var results = {};         // username -> profile, memory only, never persisted
  var loaded = false;

  W.load = function (cb) {
    chrome.storage.local.get(KEY, function (res) {
      pinned = (res && res[KEY]) || [];
      loaded = true;
      if (cb) cb(pinned);
    });
  };

  function persist() {
    var patch = {};
    patch[KEY] = pinned;
    chrome.storage.local.set(patch);
  }

  W.list = function () { return pinned; };
  W.count = function () { return pinned.length; };
  W.has = function (u) {
    u = String(u || '').toLowerCase();
    return pinned.some(function (p) { return p.username === u; });
  };

  W.add = function (username) {
    var u = String(username || '').trim().toLowerCase().replace(/^@/, '').replace(/\/+$/, '');
    if (!u || !/^[a-z0-9._]{1,30}$/.test(u)) return { ok: false, error: 'That does not look like a username.' };
    if (W.has(u)) return { ok: false, error: '@' + u + ' is already pinned.' };
    pinned.unshift({ username: u, note: '', added: Date.now() });
    persist();
    return { ok: true, username: u };
  };

  W.remove = function (username) {
    var u = String(username).toLowerCase();
    pinned = pinned.filter(function (p) { return p.username !== u; });
    delete results[u];
    persist();
  };

  W.toggle = function (username) {
    var u = String(username || '').toLowerCase().replace(/^@/, '');
    if (W.has(u)) { W.remove(u); return false; }
    W.add(u);
    return true;
  };

  W.note = function (username, text) {
    var p = pinned.filter(function (x) { return x.username === String(username).toLowerCase(); })[0];
    if (!p) return;
    p.note = String(text || '').slice(0, 240);
    persist();
  };

  W.cached = function (username) { return results[String(username).toLowerCase()] || null; };

  /* ------------------------------------------------------------------ *
   * lookup — two requests, only when asked
   * ------------------------------------------------------------------ */
  function thumbOf(node) {
    if (node.thumbnail_src || node.display_url) return node.thumbnail_src || node.display_url;
    if (node.image_versions2 && node.image_versions2.candidates) {
      var c = node.image_versions2.candidates;
      return c[c.length - 1] && c[c.length - 1].url;   // smallest, it is a thumbnail
    }
    return '';
  }

  W.lookup = function (username) {
    var u = String(username).toLowerCase();

    return IGX.ask('API', {
      path: '/api/v1/users/web_profile_info/?username=' + encodeURIComponent(u)
    }, 20000).then(function (res) {
      if (!res) return { error: 'No response from Instagram.' };
      if (res.status === 404) return { error: '@' + u + ' does not exist, or was renamed.' };
      if (res.status === 429) return { error: 'Instagram is rate-limiting you. Wait a few minutes.' };
      if (res.status === 401) return { error: 'Not logged in — open instagram.com and sign in.' };
      if (!res.ok || !res.data || !res.data.data || !res.data.data.user) {
        return { error: 'Unexpected response (HTTP ' + res.status + ').' };
      }

      var user = res.data.data.user;
      var profile = {
        username: user.username,
        pk: String(user.id || ''),
        fullName: user.full_name || '',
        bio: user.biography || '',
        link: (user.external_url || ''),
        category: user.category_name || user.business_category_name || '',
        pic: user.profile_pic_url_hd || user.profile_pic_url || '',
        priv: !!user.is_private,
        ver: !!user.is_verified,
        followers: (user.edge_followed_by && user.edge_followed_by.count) || 0,
        following: (user.edge_follow && user.edge_follow.count) || 0,
        posts: (user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.count) || 0,
        recent: [],
        tagged: [],
        taggedError: '',
        fetched: Date.now()
      };

      /* Recent posts come free with the profile call — no extra request. */
      var edges = (user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.edges) || [];
      profile.recent = edges.slice(0, 12).map(function (e) {
        return {
          code: e.node.shortcode,
          thumb: thumbOf(e.node),
          video: !!e.node.is_video
        };
      }).filter(function (p) { return p.code; });

      if (profile.priv || !IGX.settings.watchTagged || !profile.pk) {
        results[u] = profile;
        return profile;
      }

      return IGX.ask('API', {
        path: '/api/v1/usertags/' + profile.pk + '/feed/?count=12'
      }, 20000).then(function (t) {
        if (t && t.ok && t.data && t.data.items) {
          profile.tagged = t.data.items.slice(0, 12).map(function (it) {
            return {
              code: it.code,
              thumb: thumbOf(it),
              video: !!(it.video_versions && it.video_versions.length),
              by: (it.user && it.user.username) || ''
            };
          }).filter(function (p) { return p.code; });
        } else if (t && t.status === 429) {
          profile.taggedError = 'Rate-limited on the tagged feed — the profile above is still fresh.';
        } else {
          profile.taggedError = 'Tagged posts unavailable for this account.';
        }
        results[u] = profile;
        return profile;
      });
    }).catch(function (e) {
      return { error: String((e && e.message) || e) };
    });
  };

  /* ------------------------------------------------------------------ *
   * ☆ pin button on profile pages
   * ------------------------------------------------------------------ */
  var STAR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';

  function currentProfile() {
    if (IGX.route() !== 'profile') return null;
    var u = location.pathname.replace(/\//g, '').toLowerCase();
    return /^[a-z0-9._]{1,30}$/.test(u) ? u : null;
  }

  function injectPin() {
    if (!IGX.settings.enabled || !IGX.settings.watchEnabled || !IGX.settings.watchPinButton) return;
    var u = currentProfile();
    if (!u) return;

    var header = document.querySelector('header section') || document.querySelector('header');
    if (!header) return;

    var existing = header.querySelector('.igx-pin');
    if (existing) {
      existing.classList.toggle('igx-on', W.has(u));
      if (existing.dataset.user === u) return;
      existing.remove();
    }

    /* Sit next to the username heading. */
    var anchor = header.querySelector('h2, h1') ||
                 header.querySelector('a[href="/' + u + '/"]');
    if (!anchor) return;

    var b = IGX.el('div', {
      class: 'igx-btn igx-pin' + (W.has(u) ? ' igx-on' : ''),
      role: 'button',
      title: 'Pin @' + u + ' to your watchlist',
      html: STAR
    });
    b.dataset.user = u;
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var on = W.toggle(u);
      b.classList.toggle('igx-on', on);
      IGX.toast(on ? '⭐ @' + u + ' pinned to your watchlist' : '@' + u + ' unpinned', on ? 'ok' : 'info');
      IGX.emit('watch', { count: W.count() });
    }, true);

    anchor.insertAdjacentElement('afterend', b);
  }

  IGX.register('watch', {
    apply: function (s) {
      if (!s.enabled || !s.watchEnabled || !s.watchPinButton) {
        IGX.$$('.igx-pin').forEach(function (n) { n.remove(); });
        return;
      }
      injectPin();
    }
  });

  IGX.onTick(function () {
    if (!IGX.settings.enabled || !IGX.settings.watchEnabled) return;
    injectPin();
  });
})();
