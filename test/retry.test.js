const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'retry.js']);

test('retry delay doubles until the cap', function () {
  assert.equal(Alcove.retryDelay(0, 500, 30000, function () { return 0; }), 500);
  assert.equal(Alcove.retryDelay(2, 500, 30000, function () { return 0; }), 2000);
  assert.equal(Alcove.retryDelay(8, 500, 2000, function () { return 0; }), 2000);
});

test('retry succeeds on a later attempt and stops on a refused status', async function () {
  let calls = 0;
  const value = await Alcove.retry(function () {
    calls += 1;
    if (calls < 3) return Promise.reject(new Error('down'));
    return 'up';
  }, {
    tries: 4,
    baseMs: 5,
    maxMs: 20,
    sleep: function () { return Promise.resolve(); },
    rand: function () { return 0; }
  });
  assert.equal(value, 'up');
  assert.equal(calls, 3);

  let authCalls = 0;
  await assert.rejects(function () {
    return Alcove.retry(function () {
      authCalls += 1;
      const error = new Error('no');
      error.status = 401;
      return Promise.reject(error);
    }, {
      tries: 4,
      retryOn: function (error) { return !(error && error.status >= 400 && error.status < 500); },
      sleep: function () { return Promise.resolve(); }
    });
  });
  assert.equal(authCalls, 1);
});
