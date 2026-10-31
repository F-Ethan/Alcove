(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function baseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  function createJellyfin(options) {
    var fetchImpl = options.fetch;
    var session = { token: '', userId: '' };

    function headers(token) {
      var value = {
        'Accept': 'application/json',
        'X-Emby-Authorization': 'MediaBrowser Client="Alcove", Device="AlcoveTV", DeviceId="alcove-tv", Version="1.0.0"'
      };
      if (token) value['X-Emby-Token'] = token;
      return value;
    }

    function login() {
      if (session.token && session.userId) return Promise.resolve(session);
      return fetchImpl(baseUrl(options.url) + '/Users/AuthenticateByName', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Emby-Authorization': headers()['X-Emby-Authorization']
        },
        body: JSON.stringify({ Username: options.username || '', Pw: options.password || '' })
      }).then(function (response) {
        if (!response.ok) {
          var error = new Error('Jellyfin login failed');
          error.status = response.status;
          throw error;
        }
        return response.json();
      }).then(function (body) {
        session.token = body && body.AccessToken ? body.AccessToken : '';
        session.userId = body && body.User && body.User.Id ? body.User.Id : '';
        if (!session.token || !session.userId) {
          var missing = new Error('Jellyfin login failed');
          missing.status = 401;
          throw missing;
        }
        return session;
      });
    }

    function get(path, token) {
      return fetchImpl(baseUrl(options.url) + path, { method: 'GET', headers: headers(token) }).then(function (response) {
        if (response.status === 401) {
          session.token = '';
          session.userId = '';
        }
        if (!response.ok) {
          var error = new Error('Jellyfin request failed');
          error.status = response.status;
          throw error;
        }
        return response.json();
      });
    }

    return {
      ping: function () { return login(); },
      playlists: function () {
        return login().then(function (auth) {
          return get('/Users/' + encodeURIComponent(auth.userId) + '/Items?IncludeItemTypes=Playlist&Recursive=true', auth.token);
        }).then(function (body) {
          var rows = body && body.Items ? body.Items : [];
          var out = [];
          for (var i = 0; i < rows.length; i++) {
            if (!rows[i] || !rows[i].Id) continue;
            out.push({ id: String(rows[i].Id), label: rows[i].Name || String(rows[i].Id) });
          }
          return out;
        });
      },
      tracks: function (playlistId) {
        return login().then(function (auth) {
          return get('/Playlists/' + encodeURIComponent(playlistId) + '/Items?UserId=' + encodeURIComponent(auth.userId), auth.token).then(function (body) {
            var rows = body && body.Items ? body.Items : [];
            var out = [];
            for (var i = 0; i < rows.length; i++) {
              if (!rows[i] || !rows[i].Id) continue;
              out.push({
                id: String(rows[i].Id),
                title: rows[i].Name || 'Track',
                url: baseUrl(options.url) + '/Audio/' + encodeURIComponent(rows[i].Id) + '/stream?static=true&api_key=' + encodeURIComponent(auth.token)
              });
            }
            return out;
          });
        });
      }
    };
  }

  Alcove.createJellyfin = createJellyfin;
})(typeof window !== 'undefined' ? window : globalThis);
