# Contributing to InstaGhost

Contributions are genuinely welcome — bug reports, new toggles, selector fixes
after an Instagram redesign, translations, or just better wording in the UI.

This document is short on purpose. If something here blocks you, open an issue
and ask; a question is a valid contribution.

---

## Getting set up

No build step, no dependencies, no bundler. The extension runs from source.

```bash
git clone https://github.com/<your-username>/instaghost.git
cd instaghost
node tools/validate.js        # syntax + manifest check (Node 18+)
```

Then load it:

1. `chrome://extensions`
2. Developer mode on
3. **Load unpacked** → pick the repo folder
4. After editing a file, hit the ↻ reload icon on the extension card, then
   reload the Instagram tab

That's the whole loop.

---

## How the pieces fit

Read this before changing anything — it will save you an afternoon.

| File | World | Job |
|---|---|---|
| `src/inject/hook.js` | **MAIN** | Patches `fetch` / `XMLHttpRequest` / `sendBeacon` inside Instagram's own JS context. Blocks ghost-mode requests, harvests media URLs from API responses, proxies the follower API. Has **no access to `chrome.*`**. |
| `src/content/*.js` | ISOLATED | Everything DOM. Has `chrome.*`, cannot touch page JS. |
| `src/shared/config.js` | both extension contexts | The single source of truth for every feature. |
| `src/background/sw.js` | service worker | Downloads only (`chrome.downloads` bypasses CDN CORS; a content-script `fetch` does not). |

The two worlds talk over `window.postMessage` with an `__igx` envelope — see
`IGX.ask()` in `00-core.js` and the message switch at the bottom of `hook.js`.

### Two rules that keep it fast

Instagram mutates the DOM continuously. Breaking either of these will make the
tab crawl on a long feed, and it will not be obvious in a 10-post test.

1. **One observer.** There is a single throttled tick in `00-core.js`. Register
   with `IGX.onTick(fn)` — never add your own `MutationObserver`.
2. **Stamp once, never re-measure.** Any scanner that calls
   `getBoundingClientRect()` or `getComputedStyle()` must stamp every node it
   inspects (match or not) and select with `:not([data-igx-…])`. See `hideDots()`
   in `40-cleanup.js` for the pattern.

---

## Adding a feature

Almost every feature is one entry in `SCHEMA` (`src/shared/config.js`) plus a
few lines in a content module. The dashboard and popup render themselves from
that schema — you do not touch any UI code to add a toggle.

```js
{
  key: 'hideSomething',      // camelCase, unique
  group: 'feed',             // ghost | counts | feed | hover | theme | tools | audit
  def: false,                // default. Anything that could break the page: false
  world: 'page',             // ONLY for network blocking — omit for DOM features
  label: 'Hide something',
  hint: 'One sentence on what actually happens, in plain language.',
  risky: true                // optional, renders an "aggressive" badge
}
```

Then read it in a module:

```js
IGX.onTick(function () {
  var s = IGX.settings;
  if (!s.enabled || !s.hideSomething) return;
  // ...
});
```

### Adding a ghost-mode (network) rule

Add to `RULES` in `hook.js`. Match on **both** URL and request body — Instagram
renames GraphQL operations constantly, but the friendly-name string travels in
the POST body, which makes body patterns the durable half:

```js
{
  id: 'ghostSomething',                       // must equal the schema key
  url: [/\/api\/v1\/something\/seen/i],
  body: [/SomethingSeenMutation/i, /mark_something/i]
}
```

Blocked requests return a plausible fake response so Instagram's code keeps
going. If you block something that expects real data back, the app will break —
so only block fire-and-forget writes, never reads.

---

## House style

- **Plain ES5-ish JavaScript.** No build step means no transpiler. `var`,
  `function`, and `Promise` are fine; template literals are used in one place
  and that's the limit.
- **Comments explain *why*, not *what*.** `// stamp so we never re-measure` is
  useful. `// loop over articles` is not.
- Match the surrounding code — 2-space indent, single quotes, semicolons.
- No dependencies. Not one. This ships as source into people's browsers.

## What will not be merged

- Anything that sends user data anywhere. InstaGhost is local-only and stays
  local-only — no analytics, no telemetry, no "anonymous usage stats", no
  remote config.
- Automation: mass-following, mass-unfollowing, auto-liking, bulk DMs, scrapers
  aimed at other people's accounts. This is a **privacy and comfort** tool for
  your own session, not an engagement bot.
- Anything that scrapes or stores other users' data beyond the follower audit
  the user runs on their own account.
- `display: none` on feed content where a blur would do. A wrong selector that
  blurs is a cosmetic annoyance; a wrong selector that hides is a blank feed and
  a bug report.
- New default-on features that touch the DOM aggressively. Default to `false`
  and let people opt in.

---

## Pull requests

1. Branch from `main`: `git checkout -b fix/story-seen-selector`
2. Run `node tools/validate.js` — CI runs exactly this
3. **Test it in a real browser on a real Instagram tab.** There are no unit
   tests; the only meaningful verification is the extension actually working.
   Say in the PR what you tested and on which surfaces (feed / reels / stories /
   DMs / profile).
4. One logical change per PR. A selector fix and a new theme are two PRs.
5. Describe the *user-visible* effect first, the implementation second.

Commit messages: imperative and specific. `fix story-seen rule for the new
GraphQL name` beats `update hook.js`.

---

## Reporting a bug

Instagram ships new code constantly, so "it stopped working" is the most common
and most useful report. Please include:

- What broke, and on which page (feed / reels / story / DM / profile)
- Which toggles were on — a screenshot of the dashboard is perfect
- Anything in the console (F12 → Console), especially lines with `[InstaGhost]`
- Browser and version

If Instagram looks broken rather than InstaGhost: flip the master switch off
first, confirm it's us, and say so in the report. That single fact saves a lot
of guessing.

---

## A note on scope

This extension deliberately breaks Instagram's Terms of Service by blocking
their telemetry and reading their private API. That is the point, and it is
disclosed plainly in the README rather than hidden.

What it will never do is help anyone harass, impersonate, mass-target or
deceive another person. Contributions in that direction get closed without
much discussion — please don't take it personally.

By contributing you agree your work is licensed under the [MIT License](LICENSE),
and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
