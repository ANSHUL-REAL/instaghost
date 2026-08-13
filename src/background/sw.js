/* InstaGhost — service worker.
 * Downloads have to happen here: chrome.downloads bypasses CORS on the CDN,
 * which a content-script fetch does not. */

importScripts('/src/shared/config.js');

chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
  if (!msg) return;

  if (msg.type === 'igx:download') {
    chrome.downloads.download({
      url: msg.url,
      filename: msg.filename,
      conflictAction: 'uniquify',
      saveAs: false
    }, function (id) {
      if (chrome.runtime.lastError) {
        console.warn('[InstaGhost] download failed:', chrome.runtime.lastError.message);
        respond({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        respond({ ok: true, id: id });
      }
    });
    return true;                 // async respond
  }

  if (msg.type === 'igx:open-options') {
    chrome.tabs.create({ url: 'https://www.instagram.com/' });
    return false;
  }
});

/* First install: land on Instagram with the panel ready. */
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason !== 'install') return;
  chrome.tabs.create({ url: 'https://www.instagram.com/' });
});
