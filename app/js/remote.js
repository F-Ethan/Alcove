(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function isYellow(event) {
    return event.keyCode === 405 || event.key === 's' || event.key === 'S';
  }

  function isBack(event) {
    return event.keyCode === 461 || event.key === 'Escape' || event.key === 'Back' || event.key === 'BrowserBack' || event.key === 'XF86Back';
  }

  function platformBack() {
    try {
      if (root.PalmSystem && root.PalmSystem.platformBack) {
        root.PalmSystem.platformBack();
        return;
      }
      if (root.webOS && root.webOS.platformBack) root.webOS.platformBack();
    } catch (err) {
      // The desktop preview has no TV shell to return to.
    }
  }

  function attachRemote(opts) {
    function onKey(event) {
      var screen = opts.settingsScreen;
      if (screen.isOpen()) {
        if (screen.handleKey(event)) {
          event.preventDefault();
        }
        return;
      }
      if (isYellow(event)) {
        event.preventDefault();
        screen.open();
        return;
      }
      if (opts.onFrameKey && opts.onFrameKey(event)) {
        event.preventDefault();
      } else if (isBack(event)) {
        event.preventDefault();
        platformBack();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return { detach: function () { document.removeEventListener('keydown', onKey, true); } };
  }

  Alcove.remote = {
    isYellow: isYellow,
    isBack: isBack,
    platformBack: platformBack,
    attachRemote: attachRemote
  };
})(typeof window !== 'undefined' ? window : globalThis);
