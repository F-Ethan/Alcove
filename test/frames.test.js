const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove, memoryStorage } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'settings.js', 'probe.js', 'layouts.js', 'awake.js']);

const VALID = 'Abcd1234Abcd1234Abcd1234Abcd1234Abcd1234Abc';

test('API key shape rejects passwords and accepts a long Immich key', function () {
  const password = Alcove.inspectApiKey('hunter2');
  assert.equal(password.ok, false);
  assert.equal(password.message.indexOf('password, not an API key') !== -1, true);
  assert.equal(Alcove.inspectApiKey('hello world hello world hello world').ok, false);
  assert.equal(Alcove.inspectApiKey('bad+key+bad+key+bad+key+bad+key+bad').ok, false);
  assert.equal(Alcove.inspectApiKey('').ok, true);
  const good = Alcove.inspectApiKey('  ' + VALID + '  ');
  assert.equal(good.ok, true);
  assert.equal(good.value, VALID);
  assert.equal(Alcove.mergeSettings({ apiKey: 'hunter2' }).apiKey, '');
  assert.equal(Alcove.mergeSettings({ apiKey: VALID }).apiKey, VALID);
});

test('packaged defaults fill only empty server and key fields', function () {
  const builtin = {
    serverUrl: 'http://192.168.1.66:2283/',
    apiKey: VALID
  };
  const filled = Alcove.applyBuiltin({}, builtin);
  assert.equal(filled.serverUrl, 'http://192.168.1.66:2283');
  assert.equal(filled.apiKey, VALID);
  const saved = Alcove.applyBuiltin({
    serverUrl: 'http://10.0.0.8:2283',
    apiKey: 'Zyxw9876Zyxw9876Zyxw9876Zyxw9876Zyxw9876Zyx'
  }, builtin);
  assert.equal(saved.serverUrl, 'http://10.0.0.8:2283');
  assert.equal(saved.apiKey, 'Zyxw9876Zyxw9876Zyxw9876Zyxw9876Zyxw9876Zyx');
  const placeholder = Alcove.applyBuiltin({}, { serverUrl: 'http://192.168.1.66:2283', apiKey: 'paste-your-immich-api-key' });
  assert.equal(placeholder.apiKey, '');
  assert.equal(placeholder.serverUrl, 'http://192.168.1.66:2283');
  const storage = memoryStorage();
  const store = Alcove.createSettingsStore(storage);
  store.save(Alcove.applyBuiltin({ serverUrl: 'http://10.0.0.5:2283' }, builtin));
  assert.equal(store.load().serverUrl, 'http://10.0.0.5:2283');
  assert.equal(store.load().apiKey, VALID);
});

test('connection test hits users/me and distinguishes 401 from 403', async function () {
  let path = '';
  const result = await Alcove.probeImmich({
    serverUrl: 'http://immich.local',
    apiKey: VALID
  }, function (url) {
    path = url;
    return Promise.resolve({ ok: false, status: 403 });
  });
  assert.equal(path, 'http://immich.local/api/users/me');
  assert.equal(result.code, 'forbidden');
  const refused = await Alcove.probeImmich({
    serverUrl: 'http://immich.local',
    apiKey: VALID
  }, function () {
    return Promise.resolve({ ok: false, status: 401 });
  });
  assert.equal(refused.code, 'auth');
  assert.equal(refused.message, 'The API key was refused.');
  const shaped = await Alcove.probeImmich({
    serverUrl: 'http://immich.local',
    apiKey: 'password'
  }, function () {
    throw new Error('should not fetch');
  });
  assert.equal(shaped.code, 'shape');
});

test('orientation 6 swaps width and height before the frame is chosen', function () {
  const turned = { width: 4000, height: 3000, orientation: '6' };
  assert.equal(Alcove.layouts.orientationOf(turned), 'portrait');
  const aspect = Alcove.layouts.aspectOf(turned);
  assert.ok(Math.abs(aspect - (3000 / 4000)) < 0.001);
  const normal = Alcove.layouts.aspectOf({ width: 3000, height: 4000, orientation: '1' });
  assert.ok(normal < 1);
});

test('collage hero is the large portrait, mate is landscape, and the clock stays clear', function () {
  function check(side) {
    const frames = Alcove.layouts.collage({ heroSide: side });
    assert.equal(frames.length, 5);
    assert.equal(frames[0].role, 'hero');
    assert.equal(frames[0].prefer, 'portrait');
    assert.equal(frames[1].prefer, 'landscape');
    const heroArea = frames[0].width * frames[0].height;
    const mateArea = frames[1].width * frames[1].height;
    frames.slice(2).forEach(function (small) {
      assert.ok(small.width * small.height < mateArea);
    });
    assert.ok(mateArea / heroArea >= 0.4 && mateArea / heroArea <= 0.65);
    frames.forEach(function (frame) {
      assert.equal(Alcove.layouts.hitsClock(frame), false);
      for (let i = 0; i < frames.length; i++) {
        if (frames[i] !== frame) assert.equal(Alcove.layouts.intersects(frame, frames[i]), false);
      }
    });
    const pixel = (frames[0].width / frames[0].height) * (16 / 9);
    assert.ok(pixel < 1);
    return frames[0].left;
  }
  const left = check('left');
  const right = check('right');
  assert.ok(right > left);
  const fallback = Alcove.layouts.collage({ heroSide: 'left', heroOrient: 'landscape' });
  assert.equal(fallback[0].prefer, 'landscape');
  const fitted = Alcove.layouts.fitInBox({ left: 10, top: 10, width: 40, height: 40, prefer: 'any' }, 2 / 3);
  const fittedPixel = (fitted.width / fitted.height) * (16 / 9);
  assert.ok(Math.abs(fittedPixel - (2 / 3)) < 0.05);
});

test('keep awake does nothing in mock mode and blocks the screensaver on a TV', function () {
  const calls = [];
  const mock = Alcove.createKeepAwake({ mock: true, forceTv: true, webOSService: function () { calls.push('no'); } });
  assert.equal(mock.sync(true), 'off');
  assert.equal(calls.length, 0);
  const tv = Alcove.createKeepAwake({
    forceTv: true,
    webOSService: function (uri, options) {
      calls.push({ uri: uri, method: options.method, parameters: options.parameters });
      if (options.onSuccess && options.method === 'registerScreenSaverRequest') {
        options.onSuccess({ screenSaverRequest: true, clientName: 'Alcove', timestamp: '99' });
      }
      return { cancel: function () { calls.push('cancel'); } };
    }
  });
  assert.equal(tv.sync(true), 'luna');
  assert.equal(calls[0].method, 'registerScreenSaverRequest');
  assert.equal(calls[0].parameters.subscribe, true);
  assert.equal(calls[0].parameters.clientName, 'com.ethan.alcove');
  assert.equal(calls[1].method, 'responseScreenSaverRequest');
  assert.equal(calls[1].parameters.ack, false);
  assert.equal(calls[1].parameters.timestamp, '99');
  assert.equal(calls[1].parameters.clientName, 'com.ethan.alcove');
  tv.sync(false);
  assert.equal(calls.indexOf('cancel') !== -1, true);
});

test('keep awake plays the corner video on a TV and restarts it if it stalls', async function () {
  const plays = [];
  let line = '';
  const listeners = {};
  const video = {
    paused: true,
    ended: false,
    readyState: 0,
    setAttribute: function () {},
    addEventListener: function (name, fn) { listeners[name] = fn; },
    play: function () {
      plays.push('play');
      this.paused = false;
      this.readyState = 4;
      return Promise.resolve();
    },
    pause: function () { this.paused = true; }
  };
  const keeper = Alcove.createKeepAwake({
    forceTv: true,
    video: video,
    onStatus: function (text) { line = text; },
    webOSService: function (uri, options) {
      if (options.onFailure && options.method === 'registerScreenSaverRequest') {
        options.onFailure({ returnValue: false, errorText: 'denied' });
      }
      return { cancel: function () {} };
    }
  });
  assert.equal(keeper.sync(true), 'video');
  await Promise.resolve();
  assert.equal(plays.length, 1);
  assert.equal(line, 'Keep awake: luna=fail, video=playing');
  video.paused = true;
  video.readyState = 1;
  listeners.stalled();
  assert.equal(plays.length, 2);
  keeper.sync(false);
  assert.equal(line, '');
  assert.equal(video.paused, true);
});
