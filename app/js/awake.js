(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var LUNA = 'luna://com.webos.service.tvpower/power';

  function createKeepAwake(env) {
    var context = env || {};
    var bridge = null;
    var video = null;
    var mode = 'off';

    function isMock() {
      if (context.mock) return true;
      var loc = context.location || root.location;
      return !!(loc && String(loc.search || '').indexOf('mock=1') !== -1);
    }

    function onTv() {
      if (isMock()) return false;
      if (context.forceTv) return true;
      return !!(context.PalmSystem || root.PalmSystem || context.webOSService || context.PalmServiceBridge ||
        (root.webOS && root.webOS.service) || root.PalmServiceBridge);
    }

    function respond(payload) {
      if (!payload) return;
      var asked = payload.screenSaverRequest === true || payload.state === 'Active' || payload.timestamp;
      if (!asked && payload.returnValue && !payload.timestamp) return;
      if (!payload.timestamp && !payload.screenSaverRequest) return;
      var body = {
        ack: false,
        timestamp: payload.timestamp,
        clientName: payload.clientName || payload.client || 'alcove'
      };
      if (context.webOSService) {
        context.webOSService(LUNA, {
          method: 'responseScreenSaverRequest',
          parameters: body
        });
        return;
      }
      if (root.webOS && root.webOS.service && root.webOS.service.request) {
        root.webOS.service.request(LUNA, {
          method: 'responseScreenSaverRequest',
          parameters: body
        });
      }
    }

    function subscribe() {
      var params = { subscribe: true };
      if (context.webOSService) {
        bridge = context.webOSService(LUNA, {
          method: 'registerScreenSaverRequest',
          parameters: params,
          subscribe: true,
          onSuccess: respond,
          onFailure: function () { startVideo(); }
        });
        mode = 'luna';
        return;
      }
      if (root.webOS && root.webOS.service && root.webOS.service.request) {
        bridge = root.webOS.service.request(LUNA, {
          method: 'registerScreenSaverRequest',
          parameters: params,
          subscribe: true,
          onSuccess: respond,
          onFailure: function () { startVideo(); }
        });
        mode = 'luna';
        return;
      }
      if (context.PalmServiceBridge || root.PalmServiceBridge) {
        var Ctor = context.PalmServiceBridge || root.PalmServiceBridge;
        bridge = new Ctor();
        bridge.onservicecallback = function (message) {
          try { respond(JSON.parse(message)); } catch (err) { startVideo(); }
        };
        bridge.call(LUNA + '/registerScreenSaverRequest', JSON.stringify(params));
        mode = 'palm';
        return;
      }
      startVideo();
    }

    function startVideo() {
      if (!onTv() || video) return;
      var el = context.video;
      if (!el && root.document) el = root.document.getElementById('keep-awake');
      if (!el) return;
      video = el;
      video.muted = true;
      video.loop = true;
      video.setAttribute('playsinline', '');
      var pending = video.play && video.play();
      if (pending && pending.catch) pending.catch(function () {});
      mode = 'video';
    }

    function stop() {
      if (bridge && bridge.cancel) bridge.cancel();
      bridge = null;
      if (video && video.pause) video.pause();
      video = null;
      mode = 'off';
    }

    return {
      sync: function (enabled) {
        if (!enabled || !onTv()) {
          stop();
          return mode;
        }
        if (mode === 'off') subscribe();
        return mode;
      },
      stop: stop,
      mode: function () { return mode; }
    };
  }

  Alcove.createKeepAwake = createKeepAwake;
})(typeof window !== 'undefined' ? window : globalThis);
