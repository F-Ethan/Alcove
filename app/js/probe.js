(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function classifyProbe(outcome) {
    if (outcome.ok) {
      return { ok: true, code: 'ok', message: 'Connected.' };
    }
    if (outcome.status === 401) {
      return {
        ok: false,
        code: 'auth',
        message: 'The API key was refused.'
      };
    }
    if (outcome.status === 403) {
      return {
        ok: false,
        code: 'forbidden',
        message: 'A permission is missing. The key needs asset.read, asset.view, album.read, person.read, folder.read, memory.read, tag.read, and user.read.'
      };
    }
    if (outcome.status) {
      return {
        ok: false,
        code: 'http',
        message: 'Immich replied with status ' + outcome.status + '.'
      };
    }
    if (outcome.corsBlocked) {
      return {
        ok: false,
        code: 'cors',
        message: 'The TV can reach the server, but the browser blocked the response. Installed apps on webOS 25 usually allow this. On older webOS, put a reverse proxy in front of Immich and point Alcove at that address. Sample Caddy and nginx configs are in the proxy folder.'
      };
    }
    return {
      ok: false,
      code: 'offline',
      message: 'The server did not answer. Check the URL, the laptop, and the Wi-Fi. Saved photos stay on screen once a library has loaded.'
    };
  }

  function probeImmich(settings, fetchImpl) {
    var base = Alcove.util.apiBase(settings.serverUrl);
    if (!base) {
      return Promise.resolve({
        ok: false,
        code: 'url',
        message: 'Enter a server URL that starts with http:// or https://.'
      });
    }
    var key = Alcove.inspectApiKey ? Alcove.inspectApiKey(settings.apiKey) : { ok: !!settings.apiKey, empty: !settings.apiKey, value: settings.apiKey };
    if (!settings.apiKey || key.empty) {
      return Promise.resolve({
        ok: false,
        code: 'key',
        message: 'Enter an API key. A read-only key is enough.'
      });
    }
    if (!key.ok) {
      return Promise.resolve({
        ok: false,
        code: 'shape',
        message: key.message
      });
    }
    var me = base + '/users/me';
    var headers = {
      'Accept': 'application/json',
      'x-api-key': key.value
    };
    return fetchImpl(me, { method: 'GET', headers: headers }).then(function (response) {
      return classifyProbe({ ok: response.ok, status: response.status });
    }).catch(function () {
      return fetchImpl(me, { method: 'GET', mode: 'no-cors' }).then(function () {
        return classifyProbe({ ok: false, corsBlocked: true });
      }).catch(function () {
        return classifyProbe({ ok: false });
      });
    });
  }

  Alcove.classifyProbe = classifyProbe;
  Alcove.probeImmich = probeImmich;
})(typeof window !== 'undefined' ? window : globalThis);
