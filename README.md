<div align="center">

<img src="icons/icon128.png" width="88" alt="InstaGhost" />

# InstaGhost

**A private layer over Instagram web.**

Watch stories without being listed. Read DMs without the receipt. Save any media,
blur the numbers that make you feel bad, retheme the whole app, privately dislike
posts, and find out who quietly dropped you.

[![CI](https://github.com/ANSHUL-REAL/instaghost/actions/workflows/ci.yml/badge.svg)](https://github.com/ANSHUL-REAL/instaghost/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-7C5CFF.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-4285F4.svg)](manifest.json)
[![Dependencies](https://img.shields.io/badge/dependencies-0-40D699.svg)](package.json)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-7C5CFF.svg)](CONTRIBUTING.md)

Chrome · Edge · Brave — Manifest V3, no build step, no dependencies,
**nothing ever leaves your machine.**

</div>

---

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and pick this `instaghost` folder
4. Open [instagram.com](https://www.instagram.com) — a **👻 InstaGhost** pill appears bottom-right

Open the dashboard by clicking that pill, by pressing **Ctrl + Shift + G**, or from
the toolbar icon → *Open full dashboard*.

---

## What's in it

### 🔒 Ghost mode — blocks the request, not the pixel
These intercept Instagram's own network calls before they leave the browser, so
the server is never told in the first place.

| Feature | Default | What it blocks |
|---|---|---|
| Ghost Stories | **on** | `reel/seen` — your name never enters the viewer list |
| Ghost Live | off | live heartbeat — you aren't counted as a viewer |
| Hide DM "Seen" | **on** | `mark_seen` — read without the blue receipt |
| Hide typing indicator | **on** | `indicate_activity` |
| Hide active status | off | presence polling, plus strips green dots from the page |
| Block trackers | off | `facebook.com/tr` pixels and client-event logging beacons |

### 🔢 Hide counts — blurred, not deleted
Every number stays on the page behind a blur. **Hover to read it.** Likes (on by
default), comments, followers, following, posts, views, story viewers.

### ✨ Clean feed
Blur suggested posts (peek overlay, never `display:none` — the feed cannot go
blank), hide suggested users, ads, Explore tab, Reels tab, stories tray,
shopping, Threads promo, verified badges, plus Focus mode, blur-all-feed-images
and disable autoplay.

### 🔍 Hover peek
Hover any grid thumbnail and a floating preview follows your cursor — pulling the
**real video** for reels, not the static thumb. Adjustable 240–560px. Plus feed
zoom on hover and hover-only download buttons.

### 🎨 Appearance
Midnight AMOLED (true `#000`), Ocean Blue, Sunset Pink, Forest Green, Dracula,
Paper. Accent colour picker, rounded posts, hide story rings, and a custom CSS
box that overrides everything.

### ⚡ Power tools
- **Download** — button next to Like on every post, reel and story. Grabs the
  original CDN file from the API payload, not the on-screen thumbnail, so videos
  actually work (Instagram serves those as unsaveable blobs). Carousels download
  all slides at once. **Shift-click** opens the original in a new tab. **D** saves
  whatever you're looking at.
- **👎 Private dislike** — sits next to Like. Purely local; Instagram is never
  told. Choose what it does to that post next time: remember / dim / blur behind
  a cover / collapse. Disliked reels auto-scroll past.
- Real video controls, playback speed, remembered mute & volume, pause stories on
  hover, copy link (shift = copy caption), session timer.

### 🫥 Screen privacy *(DMs)*
For when someone can see your screen. Blur names, message previews, avatars, the
open conversation and shared media in Direct — then reveal on hover, while
holding `Alt+Shift+R`, or on click.

**Panic mode** (`Alt+Shift+P`) blurs and dims the entire page in one keypress,
with an optional floating button. InstaGhost's own panel stays usable underneath,
so you can always turn it back off. Revealing also stops the instant the window
loses focus — walking away is exactly when you don't want things uncovered.

Blur, never hide: a selector that guesses wrong and blurs is a cosmetic
annoyance, one that hides is a broken inbox. The composer is never blurred.

### 🚀 Beyond Insta+
The things modded Android clients get installed for — and three they cannot do,
because they are not a browser.

- **Exact timestamps** — Instagram already ships the real time in `<time datetime>`,
  it just refuses to show it. "4d" becomes the actual date, with the full weekday on hover.
- **Full-size profile pictures** — click any avatar for a lightbox with save and
  open-original. Instagram provides no way to do this at all.
- **Bulk download** — one click saves every post loaded on the page. A whole
  profile grid, hashtag or saved collection, not one post at a time.
- **DM media download** — save photos and videos out of a conversation.
- **Picture-in-picture** — pop a reel into a floating window that survives
  switching tabs.
- **Alt-click to copy any text** — captions, comments, bios, usernames.
- **Caption sidecar files** and a **translate button**.

### 🗄️ Unsend vault *(off by default)*
Archives DM items as they arrive, so a message someone unsends is still readable.

The subtle part: a thread fetch returns a *window* of messages, not the whole
history, so an item only counts as unsent if it falls inside the time range the
new payload actually covers. Without that guard, scrolling a conversation would
flag half of it as deleted.

It only ever keeps messages already delivered to you, and nothing leaves your
machine. But someone unsending *is* them changing their mind, and this overrides
that — which is why it ships off, with that trade stated in the panel rather than
buried down here.

### ⭐ Watchlist
Pin accounts you check often and see their public profile without leaving the
page you are on: bio, links, counts, recent posts, and the posts they are tagged in.

**A bookmark list, not a tracker.** Nothing runs on a timer, no history is kept,
and each lookup asks Instagram once and forgets the answer when you close the tab.
The stored part is just a list of usernames.

Note on a common request: finding **every comment a person has written** is not
possible — for anyone. Instagram has no endpoint for it; comments only exist per
post. No extension can do it, and any tool claiming otherwise is guessing.

### 📊 Followers
One scan walks your follower and following lists and works out:

- who **doesn't follow you back**
- who **you don't follow back**
- mutuals
- from the second scan on: **who unfollowed you**, who's new, who *you* unfollowed
- **followed then left** — anyone who appeared in an older snapshot and is gone now

Export any list as CSV, or the whole snapshot as JSON. Last 8 snapshots kept.

---

## Honest limits

**Your own green dot is a server-side setting.** No extension can fake it. Turn it
off for real at [instagram.com/accounts/activity_status](https://www.instagram.com/accounts/activity_status/).
The "Hide active status" toggle blocks presence *polling* and removes other
people's dots from your view — that's the part a browser can control.

**DM read receipts also travel over a realtime socket.** InstaGhost blocks the REST
`mark_seen` path, which covers the usual case. If a receipt ever slips through,
that's the socket — its frames are compressed binary and can't be selectively
edited without killing live message delivery entirely, which isn't a trade worth
making by default.

**Nothing is retroactive.** Anything you viewed before switching a toggle on was
already recorded.

**The follower scan is the risky feature.** It walks Instagram's private API page
by page — exactly what rate limiting exists to catch. It runs slowly on purpose,
backs off for 30s when throttled, and can be stopped mid-run. **Run it once a
day, not once an hour.**

**This breaks Instagram's Terms of Service.** Blocking their telemetry and reading
their private API are both against the rules. Realistic worst case is a temporary
action block; use an account you can afford to lose.

**Instagram ships new code constantly.** Rules match on both URL *and* GraphQL
operation name so they survive most renames, but a big redesign can break DOM
features (buttons, blur tagging). Network blocking is far more durable than
anything that depends on the page structure.

---

## If Instagram ever looks broken

1. Toolbar icon → flip the **master switch off**. Everything stops instantly —
   no blocking, no DOM changes, stock Instagram.
2. Still odd? **Reset everything** (in the popup or the dashboard footer) clears
   every setting, dislike and snapshot.
3. Individual suspects: *Hide active status* and *Block trackers* are the two
   aggressive ones. Turn those off first.

---

## How it's built

```
manifest.json
icons/                      generated by tools/make-icons.js
src/
  inject/hook.js            MAIN world, document_start — patches fetch, XHR and
                            sendBeacon; blocks the ghost rules; harvests media
                            URLs out of API responses; proxies the audit API
  shared/config.js          the whole feature schema + storage helpers
  content/
    00-core.js              settings, page bridge, one shared throttled observer
    10-theme.js             themes via Instagram's own CSS variables
    20-media.js             media resolution + downloads
    30-dislike.js           private dislikes
    40-cleanup.js           count blurring + feed cleanup
    45-tools.js             playback, copy tools, session timer
    50-hover.js             hover peek card
    60-followers.js         follower audit engine
    70-panel.js             the dashboard (shadow DOM)
    99-boot.js              wiring
    page.css                styles for the bits inside Instagram's DOM
  popup/                    toolbar popup
  background/sw.js          downloads (chrome.downloads bypasses CDN CORS)
```

Two design rules worth knowing if you edit it:

- **One observer.** Instagram mutates the DOM constantly; every feature shares a
  single throttled tick instead of registering its own MutationObserver.
- **Stamp once, never re-measure.** Scanners mark each node they inspect and use
  `:not([data-igx-…])` selectors, so a 500-post feed is never re-walked.

Two design rules worth knowing if you edit it are in
[CONTRIBUTING.md](CONTRIBUTING.md) — breaking either will make a long feed crawl.

```bash
node tools/validate.js     # syntax, manifest paths, schema and rule consistency
node tools/make-icons.js   # regenerate icons/
node tools/pack.js         # build a store-ready zip
```

---

## Contributing

Contributions are very welcome — especially **selector fixes after an Instagram
redesign**, which is the failure mode this project will always have.

Read [CONTRIBUTING.md](CONTRIBUTING.md) first; it explains the two-world
architecture and the two performance rules in about five minutes. Adding a
feature is usually one entry in the schema plus a few lines in a content
module — the whole UI renders itself from that schema, so you never touch panel
code to add a toggle.

Good first contributions:

- A new theme (one object in `10-theme.js`)
- A new ghost rule when Instagram renames a GraphQL operation
- Non-English label matching — several detectors are English-only today
- Better selectors for anything currently found by heuristic

What won't be merged: automation (mass follow/unfollow, auto-like, bulk DMs),
anything that sends data off your machine, anything aimed at other people's
accounts, and any analytics whatsoever. See the full list in CONTRIBUTING.md.

Please also read the [Code of Conduct](CODE_OF_CONDUCT.md) and, for anything
security-related, [SECURITY.md](SECURITY.md) — report those privately, not as a
public issue.

## License

[MIT](LICENSE) © 2026 Anshul Nautiyal

Free to use, fork, modify and redistribute. Provided as-is, with no warranty —
including no warranty that Instagram won't change something tomorrow.

## Disclaimer

InstaGhost is an independent project. It is not affiliated with, endorsed by, or
connected to Instagram or Meta Platforms, Inc. in any way. "Instagram" is a
trademark of Meta Platforms, Inc.

Using it breaks Instagram's Terms of Service, as explained in **Honest limits**
above. You accept that risk yourself.
