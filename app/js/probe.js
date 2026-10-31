(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function classifyProbe(outcome) {
    if (outcome.ok) {
      return { ok: true, code: 'ok', message: 'Connected.' };
    }
    if (outcome.status === 401 || outcome.status === 403) {
      return {
        ok: false,
        code: 'auth',
        message: 'The server refused the API key. Check the key and its read permissions.'
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
    if (!settings.apiKey) {
      return Promise.resolve({
        ok: false,
        code: 'key',
        message: 'Enter an API key. A read-only key is enough.'
      });
    }
    var ping = base + '/server/ping';
    var headers = {
      'Accept': 'application/json',
      'x-api-key': settings.apiKey
    };
    return fetchImpl(ping, { method: 'GET', headers: headers }).then(function (response) {
      return classifyProbe({ ok: response.ok, status: response.status });
    }).catch(function () {
      return fetchImpl(ping, { method: 'GET', mode: 'no-cors' }).then(function () {
        return classifyProbe({ ok: false, corsBlocked: true });
      }).catch(function () {
        return classifyProbe({ ok: false });
      });
    });
  }

  Alcove.classifyProbe = classifyProbe;
  Alcove.probeImmich = probeImmich;
})(typeof window !== 'undefined' ? window : globalThis);
