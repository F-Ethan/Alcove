(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function baseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  function createNavidrome(options) {
    var fetchImpl = options.fetch;

    function authQuery() {
      var salt = Math.random().toString(36).slice(2, 12);
      var token = Alcove.md5(String(options.password || '') + salt);
      return 'u=' + encodeURIComponent(options.username || '')
        + '&t=' + token
        + '&s=' + encodeURIComponent(salt)
        + '&v=1.16.1&c=Alcove&f=json';
    }

    function endpoint(view, extra) {
      return baseUrl(options.url) + '/rest/' + view + '.view?' + authQuery() + (extra || '');
    }

    function read(view, extra) {
      return fetchImpl(endpoint(view, extra), { method: 'GET', headers: { 'Accept': 'application/json' } }).then(function (response) {
        if (!response.ok) {
          var error = new Error('Music server request failed');
          error.status = response.status;
          throw error;
        }
        return response.json();
      }).then(function (body) {
        var sub = body && body['subsonic-response'] ? body['subsonic-response'] : {};
        if (sub.status && sub.status !== 'ok') {
          var refused = new Error('Music server refused the login');
          refused.status = 401;
          throw refused;
        }
        return sub;
      });
    }

    function asList(value) {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    }

    return {
      ping: function () { return read('ping'); },
      playlists: function () {
        return read('getPlaylists').then(function (sub) {
          var rows = asList(sub.playlists && sub.playlists.playlist);
          var out = [];
          for (var i = 0; i < rows.length; i++) {
            if (!rows[i] || rows[i].id == null) continue;
            out.push({ id: String(rows[i].id), label: rows[i].name || String(rows[i].id) });
          }
          return out;
        });
      },
      tracks: function (playlistId) {
        return read('getPlaylist', '&id=' + encodeURIComponent(playlistId)).then(function (sub) {
          var rows = asList(sub.playlist && sub.playlist.entry);
          var out = [];
          for (var i = 0; i < rows.length; i++) {
            if (!rows[i] || rows[i].id == null) continue;
            out.push({
              id: String(rows[i].id),
              title: rows[i].title || 'Track',
              url: endpoint('stream', '&id=' + encodeURIComponent(rows[i].id))
            });
          }
          return out;
        });
      }
    };
  }

  Alcove.createNavidrome = createNavidrome;
})(typeof window !== 'undefined' ? window : globalThis);
