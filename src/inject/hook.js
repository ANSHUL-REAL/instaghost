/* InstaGhost — MAIN-world network hook.
 *
 * Runs inside Instagram's own JS context at document_start, before their bundle
 * boots, so every fetch / XHR / beacon / socket goes through us first.
 *
 * Responsibilities:
 *   1. Drop the outbound requests that tell Instagram what you looked at.
 *   2. Harvest media URLs out of API responses (the DOM only ever has blobs).
 *   3. Act as a same-origin API proxy for the follower audit.
 *
 * Talks to the isolated-world content script over window.postMessage only —
 * chrome.* does not exist here.
 */
(function () {
  'use strict';

  if (window.__IGX_HOOK__) return;

  var TAG = 'igx';
  var origFetch = window.fetch;
  var OrigXHR = window.XMLHttpRequest;
  var origSend = OrigXHR.prototype.send;
  var origOpen = OrigXHR.prototype.open;
  var origBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);

  /* Seeded with the schema's safe defaults so the ghost rules are live from the
   * very first byte — the content script overrides this within milliseconds
   * once chrome.storage answers. */
  var settings = {
    enabled: true,
    ghostStories: true,
    ghostDmSeen: true,
    ghostTyping: true,
    ghostLive: false,
    hideActiveStatus: false,
    blockTrackers: false
  };
  var stats = { blocked: 0, byRule: {} };

  /* ------------------------------------------------------------------ *
   * Block rules
   *
   * Instagram renames GraphQL operations constantly, so every rule matches on
   * BOTH the URL and the request body. Body patterns are the durable half:
   * the friendly-name string travels in the POST body of every /graphql/query.
   * ------------------------------------------------------------------ */
  var RULES = [
    {
      id: 'ghostStories',
      url: [/\/stories\/reel\/seen/i, /\/api\/v1\/media\/seen/i, /\/stories\/reel\/seen_state/i],
      body: [/reel_seen/i, /StoriesV3Seen/i, /StoriesReelSeen/i, /mark_stories_seen/i,
             /xdt_mark_stories?_seen/i, /PolarisStoriesSeenMutation/i, /reelMediaSeen/i]
    },
    {
      id: 'ghostDmSeen',
      url: [/\/direct_v2\/threads\/[^/]+\/items\/[^/]+\/seen/i,
            /\/direct_v2\/visual_threads\/[^/]+\/item_seen/i,
            /\/direct_v2\/threads\/[^/]+\/mark_seen/i],
      body: [/DirectThreadMarkSeen/i, /"action"\s*:\s*"mark_seen"/i, /markThreadSeen/i]
    },
    {
      id: 'ghostTyping',
      url: [/\/direct_v2\/threads\/[^/]+\/indicate_activity/i],
      body: [/indicate_activity/i, /IndicateActivity/i]
    },
    {
      id: 'hideActiveStatus',
      url: [/\/direct_v2\/get_presence/i, /get_presence_active_now/i],
      body: [/PresenceQuery/i, /get_presence/i]
    },
    {
      id: 'ghostLive',
      url: [/\/live\/[^/]+\/heartbeat_and_get_viewer_count/i, /\/live\/[^/]+\/join/i],
      body: []
    },
    {
      id: 'blockTrackers',
      url: [/facebook\.com\/tr/i, /connect\.facebook\.net/i,
            /logging_client_events/i, /\/ajax\/bz/i, /\/logging\/falco/i, /\/qpl\/logs/i,
            /\/api\/v1\/logging_client_events/i, /\/ajax\/qm\//i, /\/web\/perf/i,
            /graphql\/batch/i],
      body: [/falco/i, /"event_type"\s*:\s*"client_event"/i],
      /* Only drop the batch endpoint when it is clearly a log batch — it also
       * carries real queries. */
      guard: function (url, body) {
        if (/graphql\/batch/i.test(url)) return /falco|client_event|qpl/i.test(body || '');
        return true;
      }
    }
  ];

  function matchRule(url, body) {
    if (settings.enabled === false) return null;
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if (!settings[r.id]) continue;
      var hit = false;
      for (var u = 0; u < r.url.length && !hit; u++) if (r.url[u].test(url)) hit = true;
      if (!hit && body) {
        for (var b = 0; b < r.body.length && !hit; b++) if (r.body[b].test(body)) hit = true;
      }
      if (!hit) continue;
      if (r.guard && !r.guard(url, body)) continue;
      return r;
    }
    return null;
  }

  function noteBlock(rule, url) {
    stats.blocked++;
    stats.byRule[rule.id] = (stats.byRule[rule.id] || 0) + 1;
    post('BLOCKED', { rule: rule.id, url: String(url).slice(0, 200), total: stats.blocked });
  }

  /* A response shaped enough like Instagram's own that their code keeps going. */
  function fakeBody(url) {
    if (/graphql/i.test(url)) return '{"data":{},"extensions":{},"status":"ok"}';
    return '{"status":"ok"}';
  }

  /* ------------------------------------------------------------------ *
   * Request normalisation
   * ------------------------------------------------------------------ */
  function bodyToText(body) {
    try {
      if (!body) return '';
      if (typeof body === 'string') return body.slice(0, 4000);
      if (body instanceof URLSearchParams) return body.toString().slice(0, 4000);
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        var out = [];
        body.forEach(function (v, k) { out.push(k + '=' + (typeof v === 'string' ? v : '[blob]')); });
        return out.join('&').slice(0, 4000);
      }
      if (body instanceof Blob) return '';
      if (body && body.buffer) return '';
    } catch (e) {}
    return '';
  }

  /* ------------------------------------------------------------------ *
   * fetch
   * ------------------------------------------------------------------ */
  window.fetch = function (input, init) {
    var url = '', method = 'GET', body = '';
    try {
      if (typeof input === 'string') url = input;
      else if (input && input.url) { url = input.url; method = input.method || 'GET'; }
      if (init) {
        method = init.method || method;
        body = bodyToText(init.body);
      }
    } catch (e) {}

    var rule = url ? matchRule(url, body) : null;
    if (rule) {
      noteBlock(rule, url);
      return Promise.resolve(new Response(fakeBody(url), {
        status: 200, headers: { 'content-type': 'application/json' }
      }));
    }

    var p = origFetch.apply(this, arguments);
    if (url && isHarvestable(url)) {
      p.then(function (res) {
        try {
          var ct = res.headers.get('content-type') || '';
          if (ct.indexOf('json') === -1 && ct.indexOf('javascript') === -1) return;
          res.clone().text().then(function (t) { harvestText(t, url); }).catch(function () {});
        } catch (e) {}
      }).catch(function () {});
    }
    return p;
  };

  /* ------------------------------------------------------------------ *
   * XMLHttpRequest
   * ------------------------------------------------------------------ */
  OrigXHR.prototype.open = function (method, url) {
    try { this.__igx = { method: method, url: String(url) }; } catch (e) {}
    return origOpen.apply(this, arguments);
  };

  OrigXHR.prototype.send = function (body) {
    var meta = this.__igx || {};
    var rule = meta.url ? matchRule(meta.url, bodyToText(body)) : null;

    if (rule) {
      noteBlock(rule, meta.url);
      var xhr = this;
      var payload = fakeBody(meta.url);
      setTimeout(function () {
        try {
          define(xhr, 'readyState', 4);
          define(xhr, 'status', 200);
          define(xhr, 'statusText', 'OK');
          define(xhr, 'responseText', payload);
          define(xhr, 'response', xhr.responseType === 'json' ? JSON.parse(payload) : payload);
          define(xhr, 'responseURL', meta.url);
          fire(xhr, 'readystatechange');
          fire(xhr, 'load');
          fire(xhr, 'loadend');
        } catch (e) {}
      }, 0);
      return;
    }

    if (meta.url && isHarvestable(meta.url)) {
      var self = this;
      this.addEventListener('load', function () {
        try {
          var t = (self.responseType === '' || self.responseType === 'text')
            ? self.responseText
            : (self.responseType === 'json' ? JSON.stringify(self.response) : null);
          if (t) harvestText(t, meta.url);
        } catch (e) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  function define(obj, prop, value) {
    try { Object.defineProperty(obj, prop, { configurable: true, get: function () { return value; } }); }
    catch (e) { try { obj[prop] = value; } catch (e2) {} }
  }

  function fire(xhr, type) {
    var ev;
    try { ev = new ProgressEvent(type); } catch (e) { ev = new Event(type); }
    try { if (typeof xhr['on' + type] === 'function') xhr['on' + type](ev); } catch (e) {}
    try { xhr.dispatchEvent(ev); } catch (e) {}
  }

  /* ------------------------------------------------------------------ *
   * sendBeacon — used for a lot of the "you saw this" pings
   * ------------------------------------------------------------------ */
  if (origBeacon) {
    navigator.sendBeacon = function (url, data) {
      var rule = matchRule(String(url), bodyToText(data));
      if (rule) { noteBlock(rule, url); return true; }   // lie: claim it queued
      return origBeacon(url, data);
    };
  }

  /* ------------------------------------------------------------------ *
   * Media harvesting
   * ------------------------------------------------------------------ */
  var HARVEST = /\/api\/v1\/|\/graphql|\/data\/shared_data|feed\/|clips\/|reels_media|web_profile_info/i;
  var cache = new Map();      // key -> record
  var MAX_CACHE = 900;

  function isHarvestable(url) {
    if (!HARVEST.test(url)) return false;
    if (/logging|falco|\/bz|qpl/i.test(url)) return false;
    return true;
  }

  function harvestText(text, url) {
    if (!text || text.length < 40) return;
    var json;
    try {
      var s = text.indexOf('{');
      if (s === -1) return;
      json = JSON.parse(text.charAt(0) === '{' ? text : text.slice(s));
    } catch (e) { return; }
    var found = 0;
    walk(json, 0, function () { found++; });
    if (found) post('MEDIA_CACHED', { count: found, size: cache.size });
  }

  function walk(node, depth, onFound) {
    if (!node || depth > 12 || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length && i < 300; i++) walk(node[i], depth + 1, onFound);
      return;
    }
    if (looksLikeMedia(node)) {
      var rec = buildRecord(node);
      if (rec && rec.items.length) { store(rec); onFound(); }
    } else if (node.username && (node.profile_pic_url || node.profile_pic_url_hd || node.hd_profile_pic_url_info)) {
      storeAvatar(node);
    }
    for (var k in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
      var v = node[k];
      if (v && typeof v === 'object') walk(v, depth + 1, onFound);
    }
  }

  function looksLikeMedia(n) {
    return !!(n.image_versions2 || n.video_versions || n.display_url || n.display_resources ||
              n.carousel_media || n.edge_sidecar_to_children);
  }

  function best(list, urlKey) {
    if (!list || !list.length) return null;
    var top = null;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c || !c[urlKey || 'url']) continue;
      if (!top || (c.width || 0) * (c.height || 0) > (top.width || 0) * (top.height || 0)) top = c;
    }
    return top;
  }

  function itemsOf(n) {
    var out = [];
    // v1 API shape
    if (n.video_versions && n.video_versions.length) {
      var v = best(n.video_versions);
      if (v) out.push({ type: 'video', url: v.url, w: v.width, h: v.height });
    } else if (n.image_versions2 && n.image_versions2.candidates) {
      var im = best(n.image_versions2.candidates);
      if (im) out.push({ type: 'image', url: im.url, w: im.width, h: im.height });
    }
    // GraphQL shape
    if (!out.length) {
      if (n.video_url) out.push({ type: 'video', url: n.video_url, w: 0, h: 0 });
      else if (n.display_resources && n.display_resources.length) {
        var d = best(n.display_resources, 'src');
        if (d) out.push({ type: 'image', url: d.src, w: d.config_width, h: d.config_height });
      } else if (n.display_url) out.push({ type: 'image', url: n.display_url, w: 0, h: 0 });
    }
    return out;
  }

  function buildRecord(n) {
    var items = [];
    var kids = n.carousel_media ||
      (n.edge_sidecar_to_children && n.edge_sidecar_to_children.edges &&
       n.edge_sidecar_to_children.edges.map(function (e) { return e.node; }));

    if (kids && kids.length) {
      for (var i = 0; i < kids.length; i++) items = items.concat(itemsOf(kids[i]));
    }
    if (!items.length) items = itemsOf(n);
    if (!items.length) return null;

    var owner = (n.user && n.user.username) || (n.owner && n.owner.username) ||
                (n.caption && n.caption.user && n.caption.user.username) || 'instagram';

    return {
      code: n.code || n.shortcode || null,
      pk: String(n.pk || n.id || '').split('_')[0] || null,
      owner: owner,
      taken_at: n.taken_at || n.taken_at_timestamp || 0,
      caption: (n.caption && (n.caption.text || n.caption)) ||
               (n.edge_media_to_caption && n.edge_media_to_caption.edges &&
                n.edge_media_to_caption.edges[0] && n.edge_media_to_caption.edges[0].node.text) || '',
      isStory: !!(n.story_bloks_stickers || n.expiring_at || n.story_feed_media),
      items: items
    };
  }

  function store(rec) {
    if (rec.code) put('code:' + rec.code, rec);
    if (rec.pk) put('pk:' + rec.pk, rec);
    /* Newest media for a user, so "download the story I'm looking at" can fall back. */
    if (rec.owner) {
      var k = 'last:' + rec.owner.toLowerCase();
      var prev = cache.get(k);
      if (!prev || (rec.taken_at || 0) >= (prev.taken_at || 0)) put(k, rec);
    }
  }

  function storeAvatar(u) {
    var url = (u.hd_profile_pic_url_info && u.hd_profile_pic_url_info.url) ||
              u.profile_pic_url_hd || u.profile_pic_url;
    if (!url) return;
    put('avatar:' + String(u.username).toLowerCase(), {
      owner: u.username, pk: String(u.pk || u.id || ''), taken_at: 0, items: [
        { type: 'image', url: url, w: 0, h: 0 }
      ]
    });
  }

  function put(key, rec) {
    if (cache.size > MAX_CACHE) {
      var it = cache.keys();
      for (var i = 0; i < 200; i++) { var n = it.next(); if (n.done) break; cache.delete(n.value); }
    }
    cache.set(key, rec);
  }

  function lookup(keys) {
    for (var i = 0; i < keys.length; i++) {
      var r = cache.get(keys[i]);
      if (r) return r;
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Same-origin API proxy (follower audit lives in the content script,
   * but the request has to originate here to carry the session properly)
   * ------------------------------------------------------------------ */
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[2]) : '';
  }

  function apiGet(path) {
    return origFetch.call(window, 'https://www.instagram.com' + path, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'x-ig-app-id': appId(),
        'x-csrftoken': cookie('csrftoken'),
        'x-requested-with': 'XMLHttpRequest',
        'accept': '*/*'
      }
    }).then(function (res) {
      return res.text().then(function (t) {
        var data = null;
        try { data = JSON.parse(t); } catch (e) {}
        return { status: res.status, ok: res.ok, data: data, raw: data ? null : t.slice(0, 300) };
      });
    }).catch(function (e) {
      return { status: 0, ok: false, data: null, raw: String(e && e.message || e) };
    });
  }

  /* Instagram ships the web app id in the page; fall back to the long-stable one. */
  function appId() {
    try {
      var m = document.documentElement.innerHTML.match(/"X-IG-App-ID"\s*:\s*"(\d+)"/) ||
              document.documentElement.innerHTML.match(/appId"\s*:\s*"(\d+)"/);
      if (m) return m[1];
    } catch (e) {}
    return '936619743392459';
  }

  /* ------------------------------------------------------------------ *
   * Bridge
   * ------------------------------------------------------------------ */
  function post(type, payload, id) {
    try {
      window.postMessage({ __igx: 'page', type: type, payload: payload, id: id || null }, location.origin);
    } catch (e) {}
  }

  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var m = ev.data;
    if (!m || m.__igx !== 'content') return;

    switch (m.type) {
      case 'SETTINGS':
        settings = m.payload || {};
        break;

      case 'GET_MEDIA': {
        var rec = lookup(m.payload.keys || []);
        post('RESULT', { ok: !!rec, media: rec }, m.id);
        break;
      }

      case 'API': {
        apiGet(m.payload.path).then(function (r) { post('RESULT', r, m.id); });
        break;
      }

      case 'WHOAMI': {
        post('RESULT', {
          userId: cookie('ds_user_id'),
          csrf: !!cookie('csrftoken'),
          appId: appId()
        }, m.id);
        break;
      }

      case 'STATS':
        post('RESULT', { stats: stats, cache: cache.size }, m.id);
        break;
    }
  });

  window.__IGX_HOOK__ = {
    version: '1.0.0',
    stats: stats,
    dump: function () { return Array.from(cache.entries()); }
  };

  post('READY', { version: '1.0.0' });
})();
