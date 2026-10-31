(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function burnInShift(nowMs, enabled) {
    if (!enabled) return { x: 0, y: 0 };
    var period = 7 * 60 * 1000;
    var t = (nowMs % period) / period;
    var angle = t * Math.PI * 2;
    return {
      x: Math.round(Math.sin(angle) * 14),
      y: Math.round(Math.cos(angle) * 10)
    };
  }

  function clockText(date) {
    var hours = date.getHours();
    var suffix = hours >= 12 ? 'PM' : 'AM';
    var hour12 = hours % 12;
    if (hour12 === 0) hour12 = 12;
    return {
      time: hour12 + ':' + Alcove.util.pad2(date.getMinutes()),
      suffix: suffix,
      date: WEEKDAYS[date.getDay()] + ', ' + MONTHS[date.getMonth()] + ' ' + date.getDate()
    };
  }

  function nightOpacity(date, settings) {
    if (!settings || !settings.nightDimming) return 0;
    return Alcove.util.isNight(date, settings.nightStart, settings.nightEnd) ? 0.42 : 0;
  }

  Alcove.display = {
    burnInShift: burnInShift,
    clockText: clockText,
    nightOpacity: nightOpacity
  };
})(typeof window !== 'undefined' ? window : globalThis);
