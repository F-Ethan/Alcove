const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { loadAlcove } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'settings.js', 'md5.js', 'music.js', 'navidrome.js']);

test('md5 matches a known digest and does not put the password in the token', function () {
  assert.equal(Alcove.md5('abc'), crypto.createHash('md5').update('abc').digest('hex'));
  assert.equal(Alcove.md5('password' + 'salt'), crypto.createHash('md5').update('passwordsalt').digest('hex'));
});

test('a season playlist falls back to the decorations-off list', function () {
  const lists = { christmas: 'xmas', winter: '', fall: '', spring: '', summer: '', none: 'quiet' };
  assert.equal(Alcove.musicPlan.playlistIdFor(lists, 'christmas'), 'xmas');
  assert.equal(Alcove.musicPlan.playlistIdFor(lists, 'winter'), 'quiet');
  assert.equal(Alcove.musicPlan.playlistIdFor({ none: '' }, 'fall'), '');
});

test('radio prefers the season stream and ignores empty urls', function () {
  const streams = [
    { name: 'Any', url: 'http://example.test/any.mp3', season: 'any' },
    { name: 'Empty', url: '', season: 'christmas' },
    { name: 'Carol', url: 'http://example.test/carol.mp3', season: 'christmas' }
  ];
  const christmas = Alcove.musicPlan.radioChoice(streams, 'christmas', function () { return 0; });
  const summer = Alcove.musicPlan.radioChoice(streams, 'summer', function () { return 0; });
  assert.equal(christmas.url, 'http://example.test/carol.mp3');
  assert.equal(summer.url, 'http://example.test/any.mp3');
  assert.equal(Alcove.musicPlan.radioChoice([{ url: '', season: 'any' }], 'winter', function () { return 0; }), null);
});

test('night dimming and mute scale the music volume', function () {
  assert.equal(Alcove.musicPlan.outputVolume(40, false, false), 0.4);
  assert.ok(Math.abs(Alcove.musicPlan.outputVolume(40, true, false) - 0.14) < 0.001);
  assert.equal(Alcove.musicPlan.outputVolume(40, true, true), 0);
});

test('music passwords are redacted and streams keep their season', function () {
  const saved = Alcove.mergeSettings({
    music: {
      enabled: true,
      source: 'radio',
      navidrome: { url: 'http://192.168.1.66:4533/', username: 'ethan', password: 'secret-pass', playlists: { christmas: 'pl-1' } },
      radio: { streams: [{ name: 'Carol', url: 'http://example.test/a.mp3', season: 'christmas' }] }
    }
  });
  assert.equal(saved.music.enabled, true);
  assert.equal(saved.music.navidrome.url, 'http://192.168.1.66:4533');
  assert.equal(saved.music.navidrome.playlists.christmas, 'pl-1');
  assert.equal(saved.music.radio.streams[0].season, 'christmas');
  const redacted = Alcove.redactSettings(saved);
  assert.equal(redacted.music.navidrome.password, '***');
  assert.equal(JSON.stringify(redacted).includes('secret-pass'), false);
});

test('navidrome stream urls carry a token and leave the password out', async function () {
  let seen = '';
  const client = Alcove.createNavidrome({
    url: 'http://music.local',
    username: 'ethan',
    password: 'secret-pass',
    fetch: function (url) {
      seen = url;
      if (url.indexOf('getPlaylist') !== -1) {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({ 'subsonic-response': { status: 'ok', playlist: { entry: [{ id: 'track-9', title: 'Carol' }] } } });
          }
        });
      }
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ 'subsonic-response': { status: 'ok' } }); } });
    }
  });
  const tracks = await client.tracks('pl-1');
  assert.equal(tracks[0].title, 'Carol');
  assert.equal(tracks[0].url.indexOf('secret-pass'), -1);
  assert.equal(tracks[0].url.indexOf('t=') !== -1, true);
  assert.equal(seen.indexOf('secret-pass'), -1);
});
