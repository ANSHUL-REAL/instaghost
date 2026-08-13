/* InstaGhost — shared settings schema + storage helpers.
 * Loaded as a classic script in: content scripts (isolated world), popup, service worker.
 * Exposes a single global: IGX_CONFIG
 */
(function (root) {
  'use strict';

  var SETTINGS_KEY = 'igx:settings';
  var SNAPSHOT_KEY = 'igx:snapshots';
  var DISLIKE_KEY = 'igx:dislikes';

  /* world:'page' = forwarded to the MAIN-world hook, which blocks real network
   * requests. Everything else is DOM/CSS work in the isolated world. */
  var SCHEMA = [
    /* ============ master ============ */
    {
      key: 'enabled', group: 'master', world: 'page', def: true,
      label: 'InstaGhost enabled',
      hint: 'Master switch. Off means zero blocking, zero DOM changes — plain Instagram.'
    },

    /* ============ 1. Privacy core — ghost mode ============ */
    {
      key: 'ghostStories', group: 'ghost', world: 'page', def: true, safe: true,
      label: 'Ghost Stories',
      hint: 'Blocks reel/seen. You watch, your name never enters their viewer list.'
    },
    {
      key: 'ghostLive', group: 'ghost', world: 'page', def: false,
      label: 'Ghost Live',
      hint: 'Blocks the live heartbeat so you are not counted as a viewer. The player may drop early.'
    },
    {
      key: 'ghostDmSeen', group: 'ghost', world: 'page', def: true,
      label: 'Hide DM "Seen"',
      hint: 'Blocks mark_seen. Read messages without the blue receipt.'
    },
    {
      key: 'ghostTyping', group: 'ghost', world: 'page', def: true,
      label: 'Hide typing indicator',
      hint: 'Blocks indicate_activity. They never see "typing…".'
    },
    {
      key: 'hideActiveStatus', group: 'ghost', world: 'page', def: false, risky: true,
      label: 'Hide active status',
      hint: 'Blocks presence polling and strips green dots. Aggressive — you also stop seeing who is online.'
    },
    {
      key: 'blockTrackers', group: 'ghost', world: 'page', def: false,
      label: 'Block trackers',
      hint: 'Drops facebook.com/tr pixels and client-event logging beacons.'
    },

    /* ============ 2. Hide counts — blur + hover to reveal ============ */
    {
      key: 'blurLikeCounts', group: 'counts', def: true,
      label: 'Hide like counts',
      hint: 'Blurs to ••••. Hover to reveal.'
    },
    {
      key: 'hideCommentCounts', group: 'counts', def: false,
      label: 'Hide comment counts',
      hint: '"View all 120 comments" loses the number.'
    },
    {
      key: 'blurFollowerCount', group: 'counts', def: false,
      label: 'Hide follower count',
      hint: 'Blurs the followers number on profiles, including yours.'
    },
    {
      key: 'blurFollowingCount', group: 'counts', def: false,
      label: 'Hide following count',
      hint: 'Blurs the following number on profiles.'
    },
    {
      key: 'hidePostCount', group: 'counts', def: false,
      label: 'Hide post count',
      hint: 'Blurs the total posts number.'
    },
    {
      key: 'hideViewCounts', group: 'counts', def: false,
      label: 'Hide view counts',
      hint: 'Blurs "10k views" on reels and videos.'
    },
    {
      key: 'hideStoryViewCounts', group: 'counts', def: false,
      label: 'Hide story viewer counts',
      hint: 'Blurs the viewer count on your own stories.'
    },

    /* ============ 3. Clean feed ============ */
    {
      key: 'blurSuggested', group: 'feed', def: false,
      label: 'Blur suggested posts',
      hint: 'Covers them with a peek overlay instead of removing them, so the feed never goes blank.'
    },
    {
      key: 'hideSuggestedUsers', group: 'feed', def: false,
      label: 'Hide suggested users',
      hint: 'Removes the "Suggested for you" people rail and sidebar.'
    },
    {
      key: 'hideAds', group: 'feed', def: false,
      label: 'Hide ads / sponsored',
      hint: 'Anything labelled Sponsored or Paid partnership is collapsed.'
    },
    {
      key: 'hideExploreTab', group: 'feed', def: false,
      label: 'Hide Explore tab',
      hint: 'Dims the Explore entry point in the nav.'
    },
    {
      key: 'hideReelsTab', group: 'feed', def: false,
      label: 'Hide Reels tab',
      hint: 'Dims the Reels entry point in the nav.'
    },
    {
      key: 'hideStoriesTray', group: 'feed', def: false,
      label: 'Hide stories tray',
      hint: 'Removes the story bar at the top of Home.'
    },
    {
      key: 'hideShopping', group: 'feed', def: false,
      label: 'Hide shopping',
      hint: 'Removes shop tabs, product tags and "View shop" buttons.'
    },
    {
      key: 'hideThreadsPromo', group: 'feed', def: false,
      label: 'Hide Threads promo',
      hint: 'Kills the Threads cross-promotion cards and badges.'
    },
    {
      key: 'hideVerified', group: 'feed', def: false,
      label: 'Hide verified badges',
      hint: 'No blue ticks anywhere.'
    },
    {
      key: 'focusMode', group: 'feed', def: false,
      label: 'Focus mode',
      hint: 'Minimal chrome: sidebar dimmed, suggestions gone, feed centred.'
    },
    {
      key: 'blurFeedImages', group: 'feed', def: false,
      label: 'Blur feed images',
      hint: 'Every feed image starts blurred. Click to reveal that one.'
    },
    {
      key: 'disableAutoplay', group: 'feed', def: false,
      label: 'Disable autoplay',
      hint: 'Videos stay paused until you press play.'
    },

    /* ============ 4. Hover peek ============ */
    {
      key: 'hoverEnlarge', group: 'hover', def: true,
      label: 'Hover to enlarge',
      hint: 'Hovering a grid thumbnail floats a large preview next to the cursor.'
    },
    {
      key: 'hoverEnlargeSize', group: 'hover', def: '340', type: 'range',
      min: 240, max: 560, step: 20,
      label: 'Preview size',
      hint: 'Width of the floating preview card, in pixels.'
    },
    {
      key: 'feedZoomHover', group: 'hover', def: true,
      label: 'Feed zoom on hover',
      hint: 'Feed images lift slightly when the pointer is over them.'
    },
    {
      key: 'downloadOnHover', group: 'hover', def: true,
      label: 'Download button on hover only',
      hint: 'Keeps the save control invisible until you hover the post.'
    },

    /* ============ 5. Themes & appearance ============ */
    {
      key: 'theme', group: 'theme', def: 'default', type: 'select',
      options: [
        { value: 'default', label: 'Instagram default' },
        { value: 'amoled', label: 'Midnight AMOLED' },
        { value: 'ocean', label: 'Ocean Blue' },
        { value: 'sunset', label: 'Sunset Pink' },
        { value: 'forest', label: 'Forest Green' },
        { value: 'dracula', label: 'Dracula' },
        { value: 'paper', label: 'Paper (light)' }
      ],
      label: 'Theme',
      hint: 'Repaints Instagram by overriding its own colour variables.'
    },
    {
      key: 'accent', group: 'theme', def: '#7C5CFF', type: 'color',
      label: 'Accent colour',
      hint: 'Buttons, links and InstaGhost\'s own UI.'
    },
    {
      key: 'roundedPosts', group: 'theme', def: true,
      label: 'Rounded posts',
      hint: 'Soft 18px corners on posts and media.'
    },
    {
      key: 'hideStoryRings', group: 'theme', def: false,
      label: 'Hide story rings',
      hint: 'Drops the gradient ring around story avatars.'
    },
    {
      key: 'customCss', group: 'theme', def: '', type: 'textarea',
      label: 'Custom CSS',
      hint: 'Injected last, so it overrides everything above.'
    },

    /* ============ 6. Power tools ============ */
    {
      key: 'dlButtons', group: 'tools', def: true,
      label: 'Download buttons',
      hint: 'Adds a save control to posts, reels and stories. Shift-click opens the original in a new tab.'
    },
    {
      key: 'dlOriginalQuality', group: 'tools', def: true,
      label: 'Original quality',
      hint: 'Pulls the full-res CDN file from the API payload instead of the thumbnail.'
    },
    {
      key: 'dlSubfolder', group: 'tools', def: true,
      label: 'Sort downloads by user',
      hint: 'Files land in Downloads/InstaGhost/<username>/.'
    },
    {
      key: 'dlHotkey', group: 'tools', def: true,
      label: 'Hotkey: D to download',
      hint: 'Saves whatever media you are currently looking at.'
    },
    {
      key: 'dislikeEnabled', group: 'tools', def: true,
      label: 'Private dislike button',
      hint: 'A 👎 next to Like. Stored only on this machine — Instagram is never told.'
    },
    {
      key: 'dislikeAction', group: 'tools', def: 'blur', type: 'select',
      options: [
        { value: 'none', label: 'Just remember it' },
        { value: 'dim', label: 'Dim it' },
        { value: 'blur', label: 'Blur behind a cover' },
        { value: 'hide', label: 'Collapse it' }
      ],
      label: 'Dislike effect',
      hint: 'What happens when that post shows up again.'
    },
    {
      key: 'dislikeAutoSkip', group: 'tools', def: true,
      label: 'Auto-skip disliked reels',
      hint: 'Scrolls past a reel you already rejected.'
    },
    {
      key: 'videoControls', group: 'tools', def: true,
      label: 'Real video controls',
      hint: 'Scrubber, volume and fullscreen on reels and video posts.'
    },
    {
      key: 'videoSpeed', group: 'tools', def: '1', type: 'select',
      options: [
        { value: '1', label: 'Normal' }, { value: '1.25', label: '1.25×' },
        { value: '1.5', label: '1.5×' }, { value: '2', label: '2×' }
      ],
      label: 'Playback speed',
      hint: 'Applied to every video as it starts.'
    },
    {
      key: 'rememberVolume', group: 'tools', def: true,
      label: 'Remember mute / volume',
      hint: 'Stop re-muting every single reel.'
    },
    {
      key: 'storyPauseHover', group: 'tools', def: true,
      label: 'Pause stories on hover',
      hint: 'Hold the pointer over a story to freeze it.'
    },
    {
      key: 'copyTools', group: 'tools', def: true,
      label: 'Copy caption & links',
      hint: 'Adds copy-caption and copy-link actions to the post menu bar.'
    },
    {
      key: 'usageTimer', group: 'tools', def: false,
      label: 'Session timer',
      hint: 'A small clock showing how long you have been on Instagram.'
    },

    /* ============ 7. Follower audit ============ */
    {
      key: 'scanDelay', group: 'audit', def: '1800', type: 'select',
      options: [
        { value: '1200', label: 'Fast — 1.2s per page (riskier)' },
        { value: '1800', label: 'Balanced — 1.8s per page' },
        { value: '3000', label: 'Careful — 3s per page' },
        { value: '5000', label: 'Paranoid — 5s per page' }
      ],
      label: 'Scan pace',
      hint: 'Delay between follower-list pages. Slower means less chance of a rate limit.'
    }
  ];

  var DEFAULTS = (function () {
    var o = {};
    for (var i = 0; i < SCHEMA.length; i++) o[SCHEMA[i].key] = SCHEMA[i].def;
    return o;
  })();

  var PAGE_KEYS = SCHEMA.filter(function (s) { return s.world === 'page'; })
    .map(function (s) { return s.key; });

  var GROUPS = [
    { id: 'ghost',  label: 'Ghost mode',  icon: '🔒', blurb: 'Blocks the requests that tell Instagram what you looked at.' },
    { id: 'counts', label: 'Hide counts', icon: '🔢', blurb: 'Blurred, not deleted — hover any number to reveal it.' },
    { id: 'feed',   label: 'Clean feed',  icon: '✨', blurb: 'Strip the feed down to what you actually followed.' },
    { id: 'hover',  label: 'Hover peek',  icon: '🔍', blurb: 'Preview and act on media without opening it.' },
    { id: 'theme',  label: 'Appearance',  icon: '🎨', blurb: 'Themes, accent colour and your own CSS.' },
    { id: 'tools',  label: 'Power tools', icon: '⚡', blurb: 'Downloads, private dislikes, playback control.' },
    { id: 'audit',  label: 'Followers',   icon: '📊', blurb: 'Who dropped you, who never followed back.' }
  ];

  function getSettings(cb) {
    chrome.storage.local.get(SETTINGS_KEY, function (res) {
      var stored = (res && res[SETTINGS_KEY]) || {};
      var merged = {};
      for (var k in DEFAULTS) merged[k] = (k in stored) ? stored[k] : DEFAULTS[k];
      cb(merged);
    });
  }

  function setSetting(key, value, cb) {
    chrome.storage.local.get(SETTINGS_KEY, function (res) {
      var stored = (res && res[SETTINGS_KEY]) || {};
      stored[key] = value;
      var patch = {};
      patch[SETTINGS_KEY] = stored;
      chrome.storage.local.set(patch, function () { if (cb) cb(stored); });
    });
  }

  function setMany(obj, cb) {
    chrome.storage.local.get(SETTINGS_KEY, function (res) {
      var stored = (res && res[SETTINGS_KEY]) || {};
      for (var k in obj) stored[k] = obj[k];
      var patch = {};
      patch[SETTINGS_KEY] = stored;
      chrome.storage.local.set(patch, function () { if (cb) cb(stored); });
    });
  }

  /* Panic button: back to stock Instagram, nothing blocked, nothing stored. */
  function resetAll(cb) {
    chrome.storage.local.clear(function () {
      var patch = {};
      patch[SETTINGS_KEY] = {};
      chrome.storage.local.set(patch, cb || function () {});
    });
  }

  function onSettingsChanged(cb) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes[SETTINGS_KEY]) return;
      getSettings(cb);
    });
  }

  root.IGX_CONFIG = {
    SETTINGS_KEY: SETTINGS_KEY,
    SNAPSHOT_KEY: SNAPSHOT_KEY,
    DISLIKE_KEY: DISLIKE_KEY,
    SCHEMA: SCHEMA,
    GROUPS: GROUPS,
    DEFAULTS: DEFAULTS,
    PAGE_KEYS: PAGE_KEYS,
    getSettings: getSettings,
    setSetting: setSetting,
    setMany: setMany,
    resetAll: resetAll,
    onSettingsChanged: onSettingsChanged
  };
})(typeof self !== 'undefined' ? self : this);
