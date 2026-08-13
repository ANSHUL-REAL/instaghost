# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x | ✅ |

InstaGhost is distributed as unpacked source. "Upgrading" means pulling the
latest `main` and hitting reload on the extension card.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repository.

Include what you can:

- What the flaw allows an attacker to do
- Steps to reproduce, or a proof of concept
- Which file and function you believe is responsible
- Browser and version

You can expect an acknowledgement within a few days and an honest answer about
whether and when it will be fixed. There is no bounty — this is an unpaid side
project — but you will be credited in the release notes unless you'd rather not
be.

## What counts as a vulnerability here

This extension runs with host permissions on `instagram.com` and patches
`fetch`, `XMLHttpRequest` and `sendBeacon` inside the page's own JavaScript
context. Things that matter:

- **Data leaving the machine.** InstaGhost makes no outbound requests of its
  own. Any code path that sends user data anywhere — including to a CDN, a
  logging endpoint or a third party — is a serious bug, report it.
- **Injection through Instagram content.** The panel builds some DOM from API
  data (usernames, captions, media URLs). Anywhere hostile profile content
  could reach `innerHTML` and execute is a real vulnerability.
- **Privilege escalation across the world boundary.** The MAIN-world hook
  deliberately has no `chrome.*` access. A path that lets page JavaScript reach
  extension APIs through the `postMessage` bridge is a serious bug.
- **Stored-data exposure.** Follower snapshots and dislikes live in
  `chrome.storage.local`. Anything that exposes them to the page counts.

## What does not count

- **Instagram blocking, throttling or actioning your account.** That is the
  documented, expected risk of the tool, disclosed in the README. It is not a
  vulnerability.
- **Selectors breaking after an Instagram redesign.** That is a normal bug —
  please open a regular issue.
- **The extension violating Instagram's Terms of Service.** Known, intentional,
  and stated plainly up front.

## Scope note

Reports about Instagram's own infrastructure belong to
[Meta's bug bounty programme](https://www.facebook.com/whitehat), not here.
