(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function delayMs(attempt, baseMs, maxMs, rand) {
    var base = baseMs > 0 ? baseMs : 1;
    var cap = maxMs > 0 ? maxMs : base;
    var exp = base * Math.pow(2, attempt);
    if (exp > cap) exp = cap;
    var roll = rand ? rand() : 0;
    if (roll < 0) roll = 0;
    if (roll > 1) roll = 1;
    return Math.round(exp + roll * exp * 0.2);
  }

  function retry(fn, options) {
    var opts = options || {};
    var tries = opts.tries || 5;
    var attempt = 0;
    var sleep = opts.sleep || function (ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    };
    var rand = opts.rand || Math.random;
    function once() {
      return Promise.resolve().then(fn).catch(function (error) {
        var allow = opts.retryOn ? opts.retryOn(error) : true;
        if (!allow || attempt >= tries - 1) {
          if (error && typeof error === 'object') error.attempts = attempt + 1;
          throw error;
        }
        var wait = delayMs(attempt, opts.baseMs || 500, opts.maxMs || 30000, rand);
        attempt += 1;
        return sleep(wait).then(once);
      });
    }
    return once();
  }

  Alcove.retry = retry;
  Alcove.retryDelay = delayMs;
})(typeof window !== 'undefined' ? window : globalThis);
