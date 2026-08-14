/* InstaGhost — boot. Runs last in the content-script list. */
(function () {
  'use strict';
  var IGX = window.IGX;

  function start() {
    IGX.vault.load();
    IGX.watch.load();
    IGX.dislike.load(function () {
      IGX.loadSettings(function () {
        IGX.ready = true;
        IGX.applyAll();
        IGX.panel.init();
        IGX.startObserver();
        IGX.emit('route', IGX.route());
      });
    });
  }

  IGX.whenBody(start);

  /* React re-mounts the whole tree on navigation; re-apply after each route
   * change so injected controls and blur tags come back. */
  IGX.on('route', function () {
    if (!IGX.ready) return;
    setTimeout(function () { IGX.applyAll(); }, 350);
  });

  /* Popup asks for live state. */
  chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
    if (!msg) return;
    if (msg.type === 'igx:status') {
      respond({
        ok: true,
        blocked: IGX.blockedCount,
        dislikes: IGX.dislike.count(),
        unsent: IGX.vault.count(),
        route: IGX.route()
      });
      return true;
    }
  });
})();
