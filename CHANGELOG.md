# Changelog

All notable changes to InstaGhost are documented here.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
and the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## [1.1.0] — 2026-08-14

### Added
- **Beyond Insta+ tab** — exact timestamps, full-size profile-picture lightbox,
  bulk download of everything loaded on a page, DM media download,
  picture-in-picture, alt-click to copy any text, caption sidecar files, translate
- **Unsend vault** (off by default) — archives DM items and flags ones that stop
  coming back, with a pagination guard so a narrower fetch window is not mistaken
  for a mass deletion
- **Watchlist** — pin accounts, look up their public profile, recent posts and
  tagged posts on demand. No polling, no history
- Author attribution and repository links in the dashboard, popup and manifest

### Fixed
- **Security:** the follower list built rows from API data with `innerHTML`, so an
  `<img onerror>` in someone's display name would have executed in the isolated
  world where `chrome.*` is reachable. All user-controlled values are escaped now
- `blurFeedImages` swallowed every click on a feed image, making revealed posts
  impossible to open

## [1.0.0] — 2026-08-13

First release.

### Ghost mode
- Ghost Stories — blocks `reel/seen` so you never appear in a viewer list *(on by default)*
- Hide DM "Seen" — blocks `mark_seen` *(on by default)*
- Hide typing indicator — blocks `indicate_activity` *(on by default)*
- Ghost Live — blocks the live viewer heartbeat
- Hide active status — blocks presence polling and strips green dots from the page
- Block trackers — drops `facebook.com/tr` pixels and client-event logging beacons
- Rules match on both URL and GraphQL operation name, so they survive most renames
- Safe defaults are seeded into the hook at `document_start`, before Instagram's
  bundle boots, so protection is live from the first byte

### Hide counts
- Likes, comments, followers, following, posts, views and story viewers
- Blurred rather than removed — hover any number to read it

### Clean feed
- Blur suggested posts behind a peek overlay, never `display:none`
- Hide suggested users, ads, Explore tab, Reels tab, stories tray, shopping,
  Threads promo and verified badges
- Focus mode, blur all feed images, disable autoplay

### Hover peek
- Floating preview card follows the cursor over grid thumbnails, resolving the
  real video for reels rather than the static thumbnail
- Adjustable 240–560px, feed zoom on hover, hover-only download buttons

### Appearance
- Themes: Midnight AMOLED, Ocean Blue, Sunset Pink, Forest Green, Dracula, Paper
- Accent colour picker, rounded posts, hide story rings, custom CSS box

### Power tools
- Download button on posts, reels and stories — pulls the original CDN file from
  the API payload, so videos work despite Instagram serving them as blob URLs
- Whole carousels in one click; Shift-click opens the original; `D` saves what
  you are looking at
- Private dislike button — local only, with four effects and reel auto-skip
- Real video controls, playback speed, remembered mute and volume, pause stories
  on hover, copy link and caption, session timer

### Followers
- Scan finds who doesn't follow you back, who you don't follow back, and mutuals
- From the second scan: who unfollowed you, who's new, who you unfollowed, and
  anyone who followed then left
- Throttled with 30s backoff on rate limits, stoppable mid-run
- CSV and JSON export, last 8 snapshots kept

### Safety
- Master switch stops all blocking and all DOM changes instantly
- Reset everything clears settings, dislikes and snapshots

[1.0.0]: https://github.com/ANSHUL-REAL/instaghost/releases/tag/v1.0.0
[1.1.0]: https://github.com/ANSHUL-REAL/instaghost/releases/tag/v1.1.0
