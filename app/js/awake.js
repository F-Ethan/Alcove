(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var SERVICE = 'luna://com.webos.service.tvpower/power';
  var CLIENT = 'com.ethan.alcove';

  function createKeepAwake(env) {
    var context = env || {};
    var bridge = null;
    var video = null;
    var alive = false;
    var lunaOk = false;
    var videoPlaying = false;
    var kicking = false;
    var watchTimer = 0;
    var pollTimer = 0;

    function isMock() {
      if (context.mock) return true;
      var loc = context.location || root.location;
      return !!(loc && String(loc.search || '').indexOf('mock=1') !== -1);
    }

    function onTv() {
      if (isMock()) return false;
      if (context.forceTv) return true;
      return !!(context.PalmSystem || root.PalmSystem || context.webOSService || context.PalmServiceBridge ||
        context.WebOSServiceBridge || (root.webOS && root.webOS.service) || root.PalmServiceBridge ||
        root.WebOSServiceBridge);
    }

    function publish() {
      if (!context.onStatus) return;
      if (!alive) {
        context.onStatus('');
        return;
      }
      context.onStatus('Keep awake: luna=' + (lunaOk ? 'ok' : 'fail') + ', video=' + (videoPlaying ? 'playing' : 'stopped'));
    }

    function serviceRequest(method, parameters, handlers) {
      var params = parameters || {};
      var listen = handlers || {};
      var subscribed = params.subscribe === true;
      if (context.webOSService) {
        return context.webOSService(SERVICE, {
          method: method,
          parameters: params,
          subscribe: subscribed,
          onSuccess: listen.onSuccess,
          onFailure: listen.onFailure
        });
      }
      if (root.webOS && root.webOS.service && root.webOS.service.request) {
        return root.webOS.service.request(SERVICE, {
          method: method,
          parameters: params,
          subscribe: subscribed,
          onSuccess: listen.onSuccess,
          onFailure: listen.onFailure
        });
      }
      var Ctor = context.WebOSServiceBridge || root.WebOSServiceBridge || context.PalmServiceBridge || root.PalmServiceBridge;
      if (!Ctor) {
        if (listen.onFailure) listen.onFailure({ returnValue: false, errorText: 'no luna bridge' });
        return null;
      }
      var one = new Ctor();
      one.onservicecallback = function (message) {
        var payload = null;
        try {
          payload = JSON.parse(message);
        } catch (err) {
          if (listen.onFailure) listen.onFailure({ returnValue: false, errorText: 'bad json' });
          return;
        }
        if (payload && payload.returnValue === false) {
          if (listen.onFailure) listen.onFailure(payload);
          return;
        }
        if (listen.onSuccess) listen.onSuccess(payload || {});
      };
      try {
        one.call(SERVICE + '/' + method, JSON.stringify(params));
      } catch (err) {
        if (listen.onFailure) listen.onFailure({ returnValue: false, errorText: 'call failed' });
        return null;
      }
      return one;
    }

    function ack(payload) {
      if (!payload || payload.timestamp == null || payload.timestamp === '') return;
      serviceRequest('responseScreenSaverRequest', {
        clientName: CLIENT,
        ack: false,
        timestamp: payload.timestamp
      }, {
        onSuccess: function () {
          lunaOk = true;
          publish();
        },
        onFailure: function () {
          lunaOk = false;
          publish();
        }
      });
    }

    function onRegister(payload) {
      if (payload && payload.returnValue === false) {
        lunaOk = false;
        publish();
        return;
      }
      lunaOk = true;
      publish();
      if (!payload) return;
      var asked = payload.state === 'Active' || payload.screenSaverRequest === true ||
        (payload.timestamp != null && payload.timestamp !== '' && payload.subscribed !== true);
      if (asked) ack(payload);
    }

    function subscribe() {
      if (bridge && bridge.cancel) {
        try { bridge.cancel(); } catch (err) { /* The old subscription is already gone. */ }
      }
      bridge = serviceRequest('registerScreenSaverRequest', {
        subscribe: true,
        clientName: CLIENT
      }, {
        onSuccess: onRegister,
        onFailure: function () {
          lunaOk = false;
          publish();
        }
      });
    }

    function nudge() {
      if (!alive || !onTv()) return;
      if (!lunaOk) {
        subscribe();
        return;
      }
      serviceRequest('getPowerState', {}, {
        onSuccess: function () {},
        onFailure: function () {}
      });
    }

    function kick() {
      if (!alive || !video || kicking) return;
      if (!video.paused && !video.ended && video.readyState >= 2) {
        videoPlaying = true;
        publish();
        return;
      }
      kicking = true;
      var pending = null;
      try {
        pending = video.play && video.play();
      } catch (err) {
        kicking = false;
        videoPlaying = false;
        publish();
        return;
      }
      if (!video.paused && !video.ended) {
        videoPlaying = true;
        publish();
      }
      if (pending && pending.then) {
        pending.then(function () {
          kicking = false;
          if (!alive || !video) return;
          videoPlaying = !video.paused && !video.ended;
          publish();
        }, function () {
          kicking = false;
          if (!alive) return;
          videoPlaying = false;
          publish();
        });
        return;
      }
      kicking = false;
      videoPlaying = !video.paused;
      publish();
    }

    function startVideo() {
      if (!onTv()) return;
      var el = context.video;
      if (!el && root.document) el = root.document.getElementById('keep-awake');
      if (!el) return;
      video = el;
      video.muted = true;
      video.loop = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      if ('playsInline' in video) video.playsInline = true;
      if (video.addEventListener) {
        video.addEventListener('playing', function () {
          videoPlaying = true;
          publish();
        });
        video.addEventListener('pause', kick);
        video.addEventListener('stalled', kick);
        video.addEventListener('waiting', kick);
        video.addEventListener('ended', kick);
        video.addEventListener('error', function () {
          videoPlaying = false;
          publish();
        });
      }
      kick();
      if (watchTimer) root.clearInterval(watchTimer);
      watchTimer = root.setInterval(kick, 5000);
    }

    function stop() {
      alive = false;
      lunaOk = false;
      videoPlaying = false;
      kicking = false;
      if (watchTimer) root.clearInterval(watchTimer);
      if (pollTimer) root.clearInterval(pollTimer);
      watchTimer = 0;
      pollTimer = 0;
      if (bridge && bridge.cancel) {
        try { bridge.cancel(); } catch (err) { /* Already cancelled. */ }
      }
      bridge = null;
      if (video && video.pause) video.pause();
      video = null;
      publish();
    }

    function mode() {
      if (!alive) return 'off';
      if (lunaOk && videoPlaying) return 'luna';
      if (lunaOk) return 'luna';
      if (videoPlaying) return 'video';
      return 'off';
    }

    return {
      sync: function (enabled) {
        if (!enabled || !onTv()) {
          stop();
          return 'off';
        }
        if (alive) return mode();
        alive = true;
        subscribe();
        startVideo();
        if (pollTimer) root.clearInterval(pollTimer);
        pollTimer = root.setInterval(nudge, 180000);
        publish();
        return mode();
      },
      stop: stop,
      mode: mode
    };
  }

  Alcove.createKeepAwake = createKeepAwake;
})(typeof window !== 'undefined' ? window : globalThis);
