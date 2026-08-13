<!-- Thanks for contributing. Lead with the user-visible effect. -->

## What this changes

<!-- One or two sentences. What is different for someone using the extension? -->

## Why

<!-- The bug it fixes, or the annoyance it removes. Link an issue if there is one. -->

## How I tested it

<!-- There are no unit tests — a real browser on a real Instagram tab is the only
     verification that counts. Tick what you actually exercised. -->

- [ ] `node tools/validate.js` passes
- [ ] Loaded unpacked and reloaded the Instagram tab
- [ ] Home feed
- [ ] Reels
- [ ] Stories
- [ ] Direct messages
- [ ] Profile page
- [ ] Toggled the feature off again and confirmed the page returns to normal
- [ ] Master switch off leaves Instagram completely untouched

## Checklist

- [ ] No new dependencies
- [ ] New settings are declared in `SCHEMA` with a label, a hint and a default
- [ ] Anything that could break the page defaults to **off**
- [ ] New DOM scanners stamp every node they inspect and select with `:not([data-igx-…])`
- [ ] No new `MutationObserver` — used `IGX.onTick()` instead
- [ ] Nothing sends data off the user's machine

## Notes for the reviewer

<!-- Anything fragile, any selector you're unsure about, anything you want a second opinion on. -->
