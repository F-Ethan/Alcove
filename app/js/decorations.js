(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function addBits(parent, className, count, minSize, maxSize) {
    for (var i = 0; i < count; i++) {
      var bit = document.createElement('i');
      bit.className = className;
      var size = minSize + Math.round(Math.random() * (maxSize - minSize));
      bit.style.left = Math.round(Math.random() * 100) + '%';
      bit.style.width = size + 'px';
      bit.style.height = size + 'px';
      bit.style.animationDuration = (9 + Math.random() * 10).toFixed(2) + 's';
      bit.style.animationDelay = (-Math.random() * 14).toFixed(2) + 's';
      bit.style.opacity = String(0.35 + Math.random() * 0.5);
      parent.appendChild(bit);
    }
  }

  function addLights(parent) {
    var bar = document.createElement('div');
    bar.className = 'garland';
    for (var i = 0; i < 16; i++) {
      var light = document.createElement('i');
      light.className = 'light tone-' + (i % 3);
      light.style.animationDelay = (i * 0.17).toFixed(2) + 's';
      bar.appendChild(light);
    }
    parent.appendChild(bar);
  }

  function renderDecoration(parent, mode, date) {
    if (!parent) return 'none';
    var kind = Alcove.util.activeDecoration(mode, date || new Date());
    if (parent.getAttribute('data-kind') === kind) return kind;
    parent.setAttribute('data-kind', kind);
    parent.className = 'decor decor-' + kind;
    parent.innerHTML = '';
    if (kind === 'christmas' || kind === 'winter') addBits(parent, 'flake', 32, 3, 7);
    if (kind === 'christmas') addLights(parent);
    if (kind === 'fall') addBits(parent, 'leaf', 18, 8, 14);
    if (kind === 'spring') addBits(parent, 'petal', 18, 6, 11);
    if (kind === 'summer') addBits(parent, 'mote', 14, 3, 6);
    return kind;
  }

  Alcove.renderDecoration = renderDecoration;
})(typeof window !== 'undefined' ? window : globalThis);
