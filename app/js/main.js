(function (root) {
  var Alcove = root.Alcove;

  function boot() {
    var storage = root.localStorage;
    var store = Alcove.createSettingsStore(storage);
    var settings = store.load();
    var frame = document.getElementById('frame');
    var screen = Alcove.createSettingsScreen({
      rootEl: document.getElementById('settings'),
      navEl: document.getElementById('settings-nav'),
      paneEl: document.getElementById('settings-pane'),
      statusEl: document.getElementById('settings-status'),
      store: store,
      fetch: root.fetch.bind(root),
      onChange: function (next) {
        settings = next;
        paintFrame(settings);
      },
      onClose: function (next) {
        settings = next;
        paintFrame(settings);
        frame.hidden = false;
      }
    });

    Alcove.remote.attachRemote({
      settingsScreen: screen,
      onFrameKey: function () { return false; }
    });

    paintFrame(settings);
    if (!settings.serverUrl || !settings.apiKey) screen.open();
    else frame.hidden = false;

    root.AlcoveApp = { screen: screen, store: store };
  }

  function paintFrame(settings) {
    var note = document.getElementById('frame-note');
    if (!note) return;
    if (!settings.serverUrl || !settings.apiKey) {
      note.textContent = 'Add the Immich server and API key in settings. Press Yellow, or S on a keyboard.';
      return;
    }
    note.textContent = 'Connected settings are saved on this TV. The photo wall fills in once sources load.';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
